import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	ChevronDown,
	ChevronRight,
	FileText,
	FolderOpen,
	GripVertical
} from 'lucide-react';
import { useState } from 'react';
import type {
	ChapterDescriptor,
	ResourceDescriptor,
	VolumeDescriptor
} from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { useAppStore } from '../../../app/store';
import {
	resolveProjectStructureDrop,
	type ProjectStructureDragItem,
	type ProjectStructureDropIntent,
	type ProjectStructureDropPlacement
} from './ProjectStructureDrag';

const volumeDragId = (volumeId: string) => `project-volume:${volumeId}`;
const chapterDragId = (chapterId: string) => `project-chapter:${chapterId}`;

interface DropFeedback {
	readonly overId: string;
	readonly placement: ProjectStructureDropPlacement | 'inside';
	readonly intent: ProjectStructureDropIntent;
}

interface ProjectStructureTreeProps {
	readonly snapshot: ProjectSnapshot;
	readonly activeResourceId?: string;
	readonly collapsedVolumes: ReadonlySet<string>;
	readonly search: string;
	readonly chapterWords: (chapterId: string) => number;
	readonly onToggleVolume: (volumeId: string) => void;
	readonly onOpenChapter: (resource: ResourceDescriptor) => void;
}

interface SortableRowProps {
	readonly item: ProjectStructureDragItem;
	readonly disabledReason?: string;
	readonly feedback?: DropFeedback;
}

function readDragItem(data: { readonly current?: Record<string, unknown> }): ProjectStructureDragItem | undefined {
	const candidate = data.current?.structureItem;
	if (!candidate || typeof candidate !== 'object') {
		return undefined;
	}
	return candidate as ProjectStructureDragItem;
}

function placementFromEvent(event: DragOverEvent | DragEndEvent): ProjectStructureDropPlacement {
	const translated = event.active.rect.current.translated;
	if (!event.over || !translated) {
		return 'before';
	}
	const activeCenter = translated.top + translated.height / 2;
	const overCenter = event.over.rect.top + event.over.rect.height / 2;
	return activeCenter > overCenter ? 'after' : 'before';
}

function feedbackClass(feedback: DropFeedback | undefined): string {
	if (!feedback) {
		return '';
	}
	if (!feedback.intent.allowed) {
		return ' is-drop-invalid';
	}
	return ` is-drop-valid is-drop-${feedback.placement}`;
}

function SortableVolumeRow({
	item,
	volume,
	expanded,
	disabledReason,
	feedback,
	onToggle
}: SortableRowProps & {
	readonly volume: VolumeDescriptor;
	readonly expanded: boolean;
	readonly onToggle: () => void;
}): React.JSX.Element {
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition
	} = useSortable({
		id: volumeDragId(volume.id),
		data: { structureItem: item },
		disabled: Boolean(disabledReason)
	});
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition
	};

	return (
		<div
			ref={setNodeRef}
			className={`tree-row volume-row${isDragging ? ' is-drag-source' : ''}${feedbackClass(feedback)}`}
			style={style}
			data-structure-id={volume.id}
		>
			<button
				className="tree-row-main"
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				aria-label={`${expanded ? '收起' : '展开'}${volume.title}`}
			>
				{expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
				<FolderOpen size={18} />
				<span>{volume.title}</span>
			</button>
			<button
				ref={setActivatorNodeRef}
				className="tree-drag-handle"
				type="button"
				disabled={Boolean(disabledReason)}
				title={disabledReason ?? `拖动“${volume.title}”调整卷顺序`}
				aria-label={disabledReason
					? `拖动卷：${volume.title}，${disabledReason}`
					: `拖动卷：${volume.title}`}
				{...attributes}
				{...listeners}
				aria-describedby="project-structure-drag-instructions"
			>
				<GripVertical size={16} />
			</button>
		</div>
	);
}

function SortableChapterRow({
	item,
	chapter,
	words,
	active,
	disabledReason,
	feedback,
	onOpen
}: SortableRowProps & {
	readonly chapter: ChapterDescriptor;
	readonly words: number;
	readonly active: boolean;
	readonly onOpen: () => void;
}): React.JSX.Element {
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition
	} = useSortable({
		id: chapterDragId(chapter.id),
		data: { structureItem: item },
		disabled: Boolean(disabledReason)
	});
	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition
	};

	return (
		<div
			ref={setNodeRef}
			className={`tree-row chapter-row${active ? ' is-active' : ''}${isDragging ? ' is-drag-source' : ''}${feedbackClass(feedback)}`}
			style={style}
			data-structure-id={chapter.id}
		>
			<button className="tree-row-main" type="button" onClick={onOpen}>
				<FileText size={17} />
				<span>{chapter.title}</span>
				<small>{words || ''}</small>
			</button>
			<button
				ref={setActivatorNodeRef}
				className="tree-drag-handle"
				type="button"
				disabled={Boolean(disabledReason)}
				title={disabledReason ?? `拖动“${chapter.title}”调整章节位置`}
				aria-label={disabledReason
					? `拖动章节：${chapter.title}，${disabledReason}`
					: `拖动章节：${chapter.title}`}
				{...attributes}
				{...listeners}
				aria-describedby="project-structure-drag-instructions"
			>
				<GripVertical size={16} />
			</button>
		</div>
	);
}

export function ProjectStructureTree({
	snapshot,
	activeResourceId,
	collapsedVolumes,
	search,
	chapterWords,
	onToggleVolume,
	onOpenChapter
}: ProjectStructureTreeProps): React.JSX.Element {
	const moveProjectStructure = useAppStore(state => state.moveProjectStructure);
	const moveBusy = useAppStore(state => state.structureMoveBusy);
	const persistedAnnouncement = useAppStore(state => state.structureMoveAnnouncement);
	const [activeItem, setActiveItem] = useState<ProjectStructureDragItem>();
	const [dropFeedback, setDropFeedback] = useState<DropFeedback>();
	const [localAnnouncement, setLocalAnnouncement] = useState('');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const disabledReason = snapshot.readOnly
		? '只读作品不能调整结构'
		: search
			? '清除搜索后可调整结构'
			: moveBusy
				? '正在保存项目结构'
				: undefined;

	const resolveFeedback = (
		event: DragOverEvent | DragEndEvent
	): DropFeedback | undefined => {
		const active = readDragItem(event.active.data);
		const over = event.over ? readDragItem(event.over.data) : undefined;
		if (!active || !over) {
			return undefined;
		}
		const placement = active.entityType === 'chapter' && over.entityType === 'volume'
			? 'inside'
			: placementFromEvent(event);
		return {
			overId: over.entityId,
			placement,
			intent: resolveProjectStructureDrop(
				snapshot.project,
				active,
				over,
				placement === 'inside' ? 'after' : placement
			)
		};
	};

	const resetDrag = () => {
		setActiveItem(undefined);
		setDropFeedback(undefined);
	};

	const handleDragStart = (event: DragStartEvent) => {
		const item = readDragItem(event.active.data);
		setActiveItem(item);
		setDropFeedback(undefined);
		if (item) {
			setLocalAnnouncement(`已拾取${item.entityType === 'volume' ? '卷' : '章节'}“${item.title}”。使用方向键选择位置，空格或回车放下，Esc 取消。`);
		}
	};

	const handleDragOver = (event: DragOverEvent) => {
		const feedback = resolveFeedback(event);
		setDropFeedback(feedback);
		if (feedback) {
			setLocalAnnouncement(feedback.intent.allowed
				? feedback.intent.label
				: `不能放在这里：${feedback.intent.reason}`);
		}
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const feedback = resolveFeedback(event) ?? dropFeedback;
		resetDrag();
		if (!feedback) {
			setLocalAnnouncement('未移动项目结构。');
			return;
		}
		if (!feedback.intent.allowed) {
			setLocalAnnouncement(feedback.intent.reason);
			return;
		}
		setLocalAnnouncement(`正在保存：${feedback.intent.label}`);
		void moveProjectStructure(feedback.intent.command).then(moved => {
			if (!moved) {
				setLocalAnnouncement('项目结构移动失败，原顺序未改变。');
			}
		});
	};

	const handleDragCancel = () => {
		resetDrag();
		setLocalAnnouncement('已取消移动，项目顺序未改变。');
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			autoScroll
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			accessibility={{
				screenReaderInstructions: {
					draggable: '按空格或回车拾取项目，使用方向键选择位置，再按空格或回车放下；按 Esc 取消。'
				},
				announcements: {
					onDragStart: ({ active }) => {
						const item = readDragItem(active.data);
						return item ? `已拾取${item.title}` : '已拾取项目';
					},
					onDragOver: ({ over }) => over ? '已移动到新的候选位置' : '当前没有可放置位置',
					onDragEnd: ({ over }) => over ? '已放下项目' : '项目未移动',
					onDragCancel: () => '已取消移动'
				}
			}}
		>
			<p className="sr-only" id="project-structure-drag-instructions">
				按空格或回车拾取，使用方向键选择位置，再按空格或回车放下；按 Esc 取消。
			</p>
			<p className="sr-only" role="status" aria-live="polite">
				{localAnnouncement}
			</p>
			<p className="sr-only" role="status" aria-live="polite">
				{persistedAnnouncement}
			</p>
			{disabledReason && !moveBusy && (
				<p className="tree-reorder-hint">
					<GripVertical size={14} aria-hidden="true" />{disabledReason}
				</p>
			)}
			<SortableContext
				items={snapshot.project.volumes.map(volume => volumeDragId(volume.id))}
				strategy={verticalListSortingStrategy}
			>
				{snapshot.project.volumes.map((volume, volumeIndex) => {
					const expanded = !collapsedVolumes.has(volume.id);
					const chapters = volume.chapters.filter(
						chapter => !search || chapter.title.toLocaleLowerCase().includes(search)
					);
					if (search && chapters.length === 0 && !volume.title.toLocaleLowerCase().includes(search)) {
						return null;
					}
					const volumeItem: ProjectStructureDragItem = {
						entityType: 'volume',
						entityId: volume.id,
						title: volume.title,
						containerId: snapshot.project.projectId,
						index: volumeIndex,
						projectRevision: snapshot.projectRevision
					};
					return (
						<div className="tree-group" key={volume.id}>
							<SortableVolumeRow
								item={volumeItem}
								volume={volume}
								expanded={expanded}
								disabledReason={disabledReason}
								feedback={dropFeedback?.overId === volume.id ? dropFeedback : undefined}
								onToggle={() => onToggleVolume(volume.id)}
							/>
							{expanded && (
								<SortableContext
									items={chapters.map(chapter => chapterDragId(chapter.id))}
									strategy={verticalListSortingStrategy}
								>
									<div className="tree-children">
										{chapters.map(chapter => {
											const chapterIndex = volume.chapters.findIndex(candidate => candidate.id === chapter.id);
											const resource: ResourceDescriptor = {
												id: chapter.id,
												type: 'chapter',
												title: chapter.title,
												path: chapter.file,
												projectId: snapshot.project.projectId
											};
											return (
												<SortableChapterRow
													key={chapter.id}
													item={{
														entityType: 'chapter',
														entityId: chapter.id,
														title: chapter.title,
														containerId: volume.id,
														index: chapterIndex,
														projectRevision: snapshot.projectRevision
													}}
													chapter={chapter}
													words={chapterWords(chapter.id)}
													active={activeResourceId === chapter.id}
													disabledReason={disabledReason}
													feedback={dropFeedback?.overId === chapter.id ? dropFeedback : undefined}
													onOpen={() => onOpenChapter(resource)}
												/>
											);
										})}
									</div>
								</SortableContext>
							)}
						</div>
					);
				})}
			</SortableContext>
			{activeItem && (
				<div
					className={`tree-drop-status ${dropFeedback?.intent.allowed ? 'is-valid' : dropFeedback ? 'is-invalid' : ''}`}
					role="status"
				>
					{dropFeedback
						? dropFeedback.intent.allowed
							? dropFeedback.intent.label
							: dropFeedback.intent.reason
						: '选择目标位置'}
				</div>
			)}
			<DragOverlay modifiers={[restrictToWindowEdges]}>
				{activeItem ? (
					<div className="structure-drag-overlay">
						{activeItem.entityType === 'volume'
							? <FolderOpen size={18} />
							: <FileText size={18} />}
						<span>
							<small>{activeItem.entityType === 'volume' ? '卷' : '章节'}</small>
							<strong>{activeItem.title}</strong>
						</span>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
