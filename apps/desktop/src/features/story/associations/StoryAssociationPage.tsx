import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	pointerWithin,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type CollisionDetection,
	type DragStartEvent
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
	BookOpen,
	Check,
	ChevronDown,
	CircleDot,
	Eye,
	GripVertical,
	Link2,
	Package,
	ShieldCheck,
	Sparkles,
	UserRound,
	X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	getItemStateAt,
	parseForeshadowing,
	parseStoryItem,
	parseStoryScene,
	type Character,
	type Foreshadowing,
	type ItemState,
	type StoryItem,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useModalFocus } from '../../../accessibility/useModalFocus';
import { desktopBridge } from '../../../platform/bridge';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { ItemStateFileStore } from '../assets/ItemAiReviewService';
import { StoryDragUndoToast } from '../shared/StoryDragUndoToast';
import { useStoryDragUndoShortcut } from '../shared/useStoryDragUndoShortcut';
import {
	resolveAssociationDrop,
	StoryAssociationService,
	type AssociationDragSource,
	type AssociationDropIntent,
	type AssociationDropTarget,
	type AssociationMutationReceipt
} from './StoryAssociationService';
import './StoryAssociationPage.css';

export interface StoryAssociationData {
	readonly characters: readonly Character[];
	readonly items: readonly StoryItem[];
	readonly foreshadowing: readonly Foreshadowing[];
	readonly scenes: readonly StoryScene[];
	readonly itemStates: readonly ItemState[];
}

export type StoryAssociationLoader = (
	projectRoot: string
) => Promise<StoryAssociationData>;

interface PendingAssociation {
	readonly intent: Extract<AssociationDropIntent, { readonly allowed: true }>;
	readonly sceneId?: string;
}

const sourceDragId = (source: AssociationDragSource) => (
	`association-source:${source.type}:${source.id}`
);
const targetDropId = (target: AssociationDropTarget) => (
	`association-target:${target.type}:${target.id}`
);

function readSource(data: { readonly current?: Record<string, unknown> }): AssociationDragSource | undefined {
	const source = data.current?.associationSource;
	return source && typeof source === 'object'
		? source as AssociationDragSource
		: undefined;
}

function readTarget(data: { readonly current?: Record<string, unknown> }): AssociationDropTarget | undefined {
	const target = data.current?.associationTarget;
	return target && typeof target === 'object'
		? target as AssociationDropTarget
		: undefined;
}

const associationCollisionDetection: CollisionDetection = arguments_ => {
	const pointerHits = pointerWithin(arguments_);
	if (pointerHits.length > 0) {
		const specificHit = pointerHits.find(hit => {
			const container = arguments_.droppableContainers.find(candidate => (
				candidate.id === hit.id
			));
			const target = container ? readTarget(container.data) : undefined;
			return target?.type === 'scene' || target?.type === 'character';
		});
		return specificHit ? [specificHit] : pointerHits;
	}
	return closestCenter(arguments_);
};

function sourceIcon(type: AssociationDragSource['type']): React.JSX.Element {
	if (type === 'character') return <UserRound size={17} />;
	if (type === 'item') return <Package size={17} />;
	return <Eye size={17} />;
}

function DraggableSource({
	source,
	disabled
}: {
	readonly source: AssociationDragSource;
	readonly disabled: boolean;
}): React.JSX.Element {
	const {
		attributes,
		isDragging,
		listeners,
		setNodeRef,
		transform
	} = useDraggable({
		id: sourceDragId(source),
		data: { associationSource: source },
		disabled
	});
	const typeLabel = source.type === 'character'
		? '人物'
		: source.type === 'item'
			? '物品'
			: '伏笔';
	return (
		<button
			ref={setNodeRef}
			type="button"
			className={`association-source-card${isDragging ? ' is-dragging' : ''}`}
			style={transform ? {
				transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
			} : undefined}
			disabled={disabled}
			aria-label={`拖动${typeLabel}：${source.title}`}
			{...attributes}
			{...listeners}
		>
			{sourceIcon(source.type)}
			<span><small>{typeLabel}</small><strong>{source.title}</strong></span>
			<GripVertical size={16} aria-hidden="true" />
		</button>
	);
}

function AssociationTarget({
	target,
	activeSource,
	children,
	className = ''
}: {
	readonly target: AssociationDropTarget;
	readonly activeSource?: AssociationDragSource;
	readonly children: React.ReactNode;
	readonly className?: string;
}): React.JSX.Element {
	const { isOver, setNodeRef } = useDroppable({
		id: targetDropId(target),
		data: { associationTarget: target }
	});
	const verdict = activeSource ? resolveAssociationDrop(activeSource, target) : undefined;
	const stateClass = activeSource
		? verdict?.allowed
			? ' is-valid-target'
			: ' is-invalid-target'
		: '';
	return (
		<div
			ref={setNodeRef}
			className={`${className}${stateClass}${isOver ? ' is-over' : ''}`}
			data-association-target={`${target.type}:${target.id}`}
		>
			{children}
			{isOver && verdict ? (
				<span className="association-target-label">
					{verdict.allowed ? <Check size={15} /> : <X size={15} />}
					{verdict.allowed ? '松开后确认关联' : verdict.reason}
				</span>
			) : null}
		</div>
	);
}

function AssociationConfirmSheet({
	pending,
	scenes,
	characters,
	items,
	itemStates,
	saving,
	onCancel,
	onConfirm
}: {
	readonly pending: PendingAssociation;
	readonly scenes: readonly StoryScene[];
	readonly characters: readonly Character[];
	readonly items: readonly StoryItem[];
	readonly itemStates: readonly ItemState[];
	readonly saving: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: (input: {
		readonly sceneId?: string;
		readonly action: 'plant' | 'reminder' | 'payoff';
		readonly narrativeOrder: number;
		readonly quantity: number;
	}) => void;
}): React.JSX.Element {
	const intent = pending.intent;
	const availableScenes = intent.target.type === 'chapter'
		? scenes.filter(scene => scene.chapterId === intent.target.id)
		: scenes;
	const initialScene = pending.sceneId
		?? (intent.target.type === 'scene' ? intent.target.id : availableScenes[0]?.id);
	const [sceneId, setSceneId] = useState(initialScene ?? '');
	const selectedScene = scenes.find(scene => scene.id === sceneId);
	const item = items.find(candidate => candidate.id === intent.source.id);
	const currentItemState = item
		? getItemStateAt(
			itemStates,
			item.id,
			Math.max(0, ...itemStates.map(state => state.effectiveFrom.narrativeOrder))
		)
		: undefined;
	const [narrativeOrder, setNarrativeOrder] = useState(
		selectedScene?.narrativeOrder
			?? currentItemState?.effectiveFrom.narrativeOrder
			?? 0
	);
	const [quantity, setQuantity] = useState(currentItemState?.quantity ?? 1);
	const [action, setAction] = useState<'plant' | 'reminder' | 'payoff'>('plant');
	const dialogRef = useModalFocus(onCancel);
	const needsScene = intent.target.type !== 'character';
	const targetCharacter = characters.find(character => character.id === intent.target.id);

	return (
		<div className="association-confirm-backdrop">
			<section
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby="association-confirm-title"
				className="association-confirm-sheet"
			>
				<header>
					<div>
						<span className="eyebrow">CONFIRM ASSOCIATION</span>
						<h2 id="association-confirm-title">确认资料关联</h2>
					</div>
					<button type="button" aria-label="关闭关联确认" onClick={onCancel}>
						<X size={18} />
					</button>
				</header>
				<div className="association-confirm-route">
					<span>{sourceIcon(intent.source.type)}{intent.source.title}</span>
					<Link2 size={18} />
					<span>{intent.target.type === 'character' ? <UserRound size={17} /> : <BookOpen size={17} />}{intent.target.title}</span>
				</div>
				<p>{intent.label}。确认前不会写入任何资料。</p>
				{needsScene ? (
					<label>
						<span>具体场景</span>
						<select
							aria-label="选择具体场景"
							value={sceneId}
							onChange={event => {
								const nextId = event.target.value;
								setSceneId(nextId);
								const nextScene = scenes.find(scene => scene.id === nextId);
								if (nextScene) setNarrativeOrder(nextScene.narrativeOrder);
							}}
						>
							{availableScenes.map(scene => (
								<option key={scene.id} value={scene.id}>{scene.title}</option>
							))}
						</select>
						<small>{availableScenes.length ? '关联会落到这个场景，不修改章节结构或正文锚点。' : '这个章节还没有可关联的场景。'}</small>
					</label>
				) : null}
				{intent.target.type === 'character' ? (
					<label>
						<span>生效场景（可选）</span>
						<select
							aria-label="选择物品转交生效场景"
							value={sceneId}
							onChange={event => {
								const nextId = event.target.value;
								setSceneId(nextId);
								const nextScene = scenes.find(scene => scene.id === nextId);
								if (nextScene) setNarrativeOrder(nextScene.narrativeOrder);
							}}
						>
							<option value="">仅指定叙事位置</option>
							{availableScenes.map(scene => (
								<option key={scene.id} value={scene.id}>{scene.title}</option>
							))}
						</select>
						<small>选择场景后会自动带入它的章节与叙事位置。</small>
					</label>
				) : null}
				{intent.source.type === 'foreshadowing' ? (
					<fieldset>
						<legend>伏笔作用</legend>
						{([
							['plant', '埋下'],
							['reminder', '提醒'],
							['payoff', '回收']
						] as const).map(([value, label]) => (
							<label key={value}>
								<input
									type="radio"
									name="foreshadowing-action"
									value={value}
									checked={action === value}
									onChange={() => setAction(value)}
								/>
								<span>{label}</span>
							</label>
						))}
					</fieldset>
				) : null}
				{intent.target.type === 'character' ? (
					<div className="association-transfer-fields">
						<label>
							<span>生效叙事位置</span>
							<input
								type="number"
								min={0}
								value={narrativeOrder}
								onChange={event => setNarrativeOrder(Number(event.target.value))}
							/>
						</label>
						<label>
							<span>转交后数量</span>
							<input
								type="number"
								min={0}
								value={quantity}
								onChange={event => setQuantity(Number(event.target.value))}
							/>
						</label>
						<small>持有人：{targetCharacter?.title ?? intent.target.title}。提交会新增一条已确认状态，并保留历史。</small>
					</div>
				) : null}
				<div className="association-confirm-safety">
					<ShieldCheck size={18} />
					<span><strong>安全写入</strong><small>乐观并发检查 · 可撤销 · 不调用 AI</small></span>
				</div>
				<footer>
					<button type="button" onClick={onCancel}>取消</button>
					<button
						type="button"
						className="is-primary"
						disabled={saving || (needsScene && !selectedScene) || quantity < 0}
						onClick={() => onConfirm({
							sceneId: selectedScene?.id,
							action,
							narrativeOrder,
							quantity
						})}
					>
						{saving ? '保存中…' : <><Check size={17} />确认关联</>}
					</button>
				</footer>
			</section>
		</div>
	);
}

export function StoryAssociationPage({
	projectRoot,
	chapters,
	readOnly,
	loadData
}: {
	readonly projectRoot?: string;
	readonly chapters: readonly AiChapterSource[];
	readonly readOnly?: boolean;
	readonly loadData?: StoryAssociationLoader;
}): React.JSX.Element {
	const repository = useMemo(() => projectRoot
		? new DesktopStoryRepository(projectRoot, desktopBridge)
		: undefined, [projectRoot]);
	const itemStateStore = useMemo(() => projectRoot
		? new ItemStateFileStore(projectRoot, desktopBridge)
		: undefined, [projectRoot]);
	const service = useMemo(() => repository && itemStateStore
		? new StoryAssociationService(repository, itemStateStore)
		: undefined, [itemStateStore, repository]);
	const [data, setData] = useState<StoryAssociationData>({
		characters: [],
		items: [],
		foreshadowing: [],
		scenes: [],
		itemStates: []
	});
	const [activeSource, setActiveSource] = useState<AssociationDragSource>();
	const [hoveredIntent, setHoveredIntent] = useState<AssociationDropIntent>();
	const [pending, setPending] = useState<PendingAssociation>();
	const [undoReceipt, setUndoReceipt] = useState<AssociationMutationReceipt>();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const [announcement, setAnnouncement] = useState('');
	const [expandedChapters, setExpandedChapters] = useState<ReadonlySet<string>>(
		() => new Set(chapters.map(chapter => chapter.resourceId))
	);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const reload = useCallback(async () => {
		if (projectRoot && loadData) {
			try {
				setData(await loadData(projectRoot));
				setError(undefined);
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : '关联资料读取失败');
			}
			return;
		}
		if (!repository || !itemStateStore) return;
		try {
			const [characters, items, foreshadowing, scenes, itemStates] = await Promise.all([
				repository.list('character'),
				repository.list('item'),
				repository.list('foreshadowing'),
				repository.list('scene'),
				itemStateStore.load()
			]);
			setData({
				characters: characters as unknown as readonly Character[],
				items: items.map(value => parseStoryItem(value as never)),
				foreshadowing: foreshadowing.map(value => parseForeshadowing(value as never)),
				scenes: scenes.map(value => parseStoryScene(value)),
				itemStates
			});
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '关联资料读取失败');
		}
	}, [itemStateStore, loadData, projectRoot, repository]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const sources: readonly {
		readonly id: AssociationDragSource['type'];
		readonly title: string;
		readonly description: string;
		readonly items: readonly AssociationDragSource[];
	}[] = [
		{
			id: 'character',
			title: '人物',
			description: '拖到章节或场景，记录出场',
			items: data.characters.map(character => ({
				type: 'character',
				id: character.id,
				title: character.title
			}))
		},
		{
			id: 'item',
			title: '物品',
			description: '拖到人物或场景，确认持有/出现',
			items: data.items.map(item => ({
				type: 'item',
				id: item.id,
				title: item.title
			}))
		},
		{
			id: 'foreshadowing',
			title: '伏笔',
			description: '拖到场景，选择埋下/提醒/回收',
			items: data.foreshadowing.map(clue => ({
				type: 'foreshadowing',
				id: clue.id,
				title: clue.title
			}))
		}
	];

	const resetDrag = () => {
		setActiveSource(undefined);
		setHoveredIntent(undefined);
	};
	const handleDragStart = (event: DragStartEvent) => {
		const source = readSource(event.active.data);
		setActiveSource(source);
		setHoveredIntent(undefined);
		if (source) {
			setAnnouncement(`已拾取${source.title}。使用方向键选择目标，空格放下，Esc 取消。`);
		}
	};
	const handleDragOver = (event: DragOverEvent) => {
		const source = readSource(event.active.data);
		const target = event.over ? readTarget(event.over.data) : undefined;
		const intent = source && target ? resolveAssociationDrop(source, target) : undefined;
		setHoveredIntent(intent);
		if (intent) {
			setAnnouncement(intent.allowed ? intent.label : intent.reason);
		}
	};
	const handleDragEnd = (event: DragEndEvent) => {
		const source = readSource(event.active.data);
		const target = event.over ? readTarget(event.over.data) : undefined;
		const intent = source && target
			? resolveAssociationDrop(source, target)
			: hoveredIntent;
		resetDrag();
		if (!intent) {
			setAnnouncement('已取消，资料没有改变。');
			return;
		}
		if (!intent.allowed) {
			setAnnouncement(intent.reason);
			return;
		}
		const sceneId = intent.target.type === 'scene'
			? intent.target.id
			: intent.target.type === 'chapter'
				? data.scenes.find(scene => scene.chapterId === intent.target.id)?.id
				: undefined;
		setPending({ intent, ...(sceneId ? { sceneId } : {}) });
		setAnnouncement('已打开关联确认，尚未写入资料。');
	};
	const confirmAssociation = async (input: {
		readonly sceneId?: string;
		readonly action: 'plant' | 'reminder' | 'payoff';
		readonly narrativeOrder: number;
		readonly quantity: number;
	}) => {
		if (!pending || !service) return;
		setSaving(true);
		setError(undefined);
		try {
			let receipt: AssociationMutationReceipt;
			if (pending.intent.target.type === 'character') {
				const item = data.items.find(candidate => candidate.id === pending.intent.source.id);
				const character = data.characters.find(candidate => candidate.id === pending.intent.target.id);
				const scene = data.scenes.find(candidate => candidate.id === input.sceneId);
				if (!item || !character) throw new Error('associationResourceMissing');
				receipt = await service.transferItem({
					item,
					character,
					position: {
						chapterId: scene?.chapterId ?? 'chapter:unassigned',
						...(scene ? { sceneId: scene.id } : {}),
						narrativeOrder: input.narrativeOrder
					},
					quantity: input.quantity
				});
			} else {
				const scene = data.scenes.find(candidate => candidate.id === input.sceneId);
				if (!scene) throw new Error('associationSceneRequired');
				receipt = await service.associateWithScene({
					scene,
					source: pending.intent.source,
					...(pending.intent.source.type === 'foreshadowing'
						? {
							foreshadowing: data.foreshadowing.find(candidate => (
								candidate.id === pending.intent.source.id
							)),
							foreshadowingAction: input.action
						}
						: {})
				});
			}
			setUndoReceipt(receipt);
			setPending(undefined);
			setAnnouncement(receipt.kind === 'story'
				? receipt.receipt.description
				: receipt.description);
			await reload();
		} catch (reason) {
			const code = reason instanceof Error ? reason.message : 'associationFailed';
			setError(code === 'associationAlreadyExists'
				? '这条关联已经存在，资料没有重复写入。'
				: code === 'itemStateConflict'
					? '这次转交会造成物品持有冲突，请调整生效位置。'
					: code.includes('Revision') || code.includes('externalChange')
						? '资料已在其他位置发生变化，请刷新后重试。'
						: '关联保存失败，原资料没有改变。');
		} finally {
			setSaving(false);
		}
	};
	const undo = useCallback(() => {
		if (!undoReceipt || !service || saving) return;
		setSaving(true);
		void service.undo(undoReceipt)
			.then(async () => {
				setUndoReceipt(undefined);
				setAnnouncement('已撤销最近一次资料关联。');
				await reload();
			})
			.catch(() => setError('无法撤销：资料已发生其他变化。'))
			.finally(() => setSaving(false));
	}, [reload, saving, service, undoReceipt]);
	useStoryDragUndoShortcut(Boolean(undoReceipt) && !saving, undo);

	return (
		<main className="story-association-page" aria-label="资料关联编排">
			<header className="association-page-header">
				<div>
					<span className="eyebrow">GROUNDING WORKBENCH</span>
					<h1>关联编排</h1>
					<p>把人物、物品和伏笔放入故事位置；松开后先确认，再安全写入。</p>
				</div>
				<div className="association-safety-badge">
					<ShieldCheck size={17} />
					<span><strong>显式确认</strong><small>无 AI 请求 · 可撤销</small></span>
				</div>
			</header>
			{error ? <div className="association-error" role="alert">{error}</div> : null}
			<DndContext
				sensors={sensors}
				collisionDetection={associationCollisionDetection}
				autoScroll
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDragCancel={() => {
					resetDrag();
					setAnnouncement('已取消，资料没有改变。');
				}}
				accessibility={{
					screenReaderInstructions: {
						draggable: '按空格拾取资料，使用方向键选择目标，再按空格放下；按 Esc 取消。'
					}
				}}
			>
				<p className="sr-only" role="status" aria-live="polite">{announcement}</p>
				<section className="association-workspace">
					<aside className="association-source-shelf">
						<header>
							<div><span className="eyebrow">SOURCE</span><h2>资料卡</h2></div>
							<span>{sources.reduce((total, group) => total + group.items.length, 0)}</span>
						</header>
						{sources.map(group => (
							<section key={group.id}>
								<header><div><h3>{group.title}</h3><small>{group.description}</small></div><span>{group.items.length}</span></header>
								<div>
									{group.items.map(source => (
										<DraggableSource
											key={source.id}
											source={source}
											disabled={Boolean(readOnly || saving)}
										/>
									))}
									{group.items.length === 0 ? <p>暂无{group.title}资料</p> : null}
								</div>
							</section>
						))}
					</aside>
					<section className="association-story-map">
						<header>
							<div><span className="eyebrow">STORY POSITION</span><h2>章节与场景</h2></div>
							<span><CircleDot size={14} />{data.scenes.length} 个场景</span>
						</header>
						<div className="association-chapter-list">
							{chapters.map(chapter => {
								const chapterScenes = data.scenes
									.filter(scene => scene.chapterId === chapter.resourceId)
									.sort((left, right) => left.narrativeOrder - right.narrativeOrder);
								const expanded = expandedChapters.has(chapter.resourceId);
								const target: AssociationDropTarget = {
									type: 'chapter',
									id: chapter.resourceId,
									title: chapter.title
								};
								return (
									<AssociationTarget
										key={chapter.resourceId}
										target={target}
										activeSource={activeSource}
										className="association-chapter-target"
									>
										<header>
											<button
												type="button"
												onClick={() => setExpandedChapters(current => {
													const next = new Set(current);
													if (next.has(chapter.resourceId)) next.delete(chapter.resourceId);
													else next.add(chapter.resourceId);
													return next;
												})}
												aria-expanded={expanded}
											>
												<ChevronDown size={16} className={expanded ? '' : 'is-collapsed'} />
												<BookOpen size={17} />
												<span><strong>{chapter.title}</strong><small>{chapter.volumeTitle}</small></span>
												<em>{chapterScenes.length}</em>
											</button>
										</header>
										{expanded ? (
											<div className="association-scene-list">
												{chapterScenes.map(scene => (
													<AssociationTarget
														key={scene.id}
														target={{ type: 'scene', id: scene.id, title: scene.title }}
														activeSource={activeSource}
														className="association-scene-target"
													>
														<span>{scene.narrativeOrder}</span>
														<div><strong>{scene.title}</strong><small>{scene.participantIds.length} 人物 · {(scene.itemIds ?? []).length} 物品 · {scene.foreshadowingIds.length} 伏笔</small></div>
														<Link2 size={15} />
													</AssociationTarget>
												))}
												{chapterScenes.length === 0 ? <p>暂无场景；章节可以作为目标，但确认前需要先创建场景。</p> : null}
											</div>
										) : null}
									</AssociationTarget>
								);
							})}
							{chapters.length === 0 ? <div className="association-empty"><BookOpen size={30} /><span>当前作品还没有章节</span></div> : null}
						</div>
					</section>
					<aside className="association-character-targets">
						<header>
							<div><span className="eyebrow">HOLDER</span><h2>人物目标</h2></div>
							<span>{data.characters.length}</span>
						</header>
						<p>把物品拖到人物上，确认生效位置与数量。</p>
						<div>
							{data.characters.map(character => (
								<AssociationTarget
									key={character.id}
									target={{ type: 'character', id: character.id, title: character.title }}
									activeSource={activeSource}
									className="association-character-target"
								>
									<UserRound size={18} />
									<span><strong>{character.title}</strong><small>{character.role ?? '人物'}</small></span>
									<Package size={15} />
								</AssociationTarget>
							))}
						</div>
					</aside>
				</section>
				{activeSource ? (
					<div className={`association-floating-status${hoveredIntent?.allowed ? ' is-valid' : hoveredIntent ? ' is-invalid' : ''}`} role="status">
						{hoveredIntent
							? hoveredIntent.allowed
								? hoveredIntent.label
								: hoveredIntent.reason
							: '选择高亮的目标；松开后还需确认'}
					</div>
				) : null}
				<DragOverlay modifiers={[restrictToWindowEdges]}>
					{activeSource ? (
						<div className="association-drag-overlay">
							{sourceIcon(activeSource.type)}
							<span><small>正在关联</small><strong>{activeSource.title}</strong></span>
							<Sparkles size={15} />
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
			{pending ? (
				<AssociationConfirmSheet
					pending={pending}
					scenes={data.scenes}
					characters={data.characters}
					items={data.items}
					itemStates={data.itemStates}
					saving={saving}
					onCancel={() => {
						setPending(undefined);
						setAnnouncement('已取消，资料没有改变。');
					}}
					onConfirm={input => void confirmAssociation(input)}
				/>
			) : null}
			{undoReceipt ? (
				<StoryDragUndoToast
					message={undoReceipt.kind === 'story'
						? undoReceipt.receipt.description
						: undoReceipt.description}
					busy={saving}
					onUndo={undo}
					onDismiss={() => setUndoReceipt(undefined)}
				/>
			) : null}
		</main>
	);
}
