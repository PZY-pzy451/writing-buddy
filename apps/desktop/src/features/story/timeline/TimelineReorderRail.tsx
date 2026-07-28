import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent
} from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListTree, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import type { TimelineEvent, TimelineMode } from '@writing-buddy/story-kernel';

function SortableTimelineEvent({
	event,
	disabled,
	onSelect
}: {
	readonly event: TimelineEvent;
	readonly disabled: boolean;
	readonly onSelect: (event: TimelineEvent) => void;
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
		id: event.id,
		disabled,
		data: { timelineEvent: event }
	});
	return (
		<article
			ref={setNodeRef}
			className={`timeline-reorder-card${isDragging ? ' is-dragging' : ''}`}
			style={{
				transform: CSS.Transform.toString(transform),
				transition
			}}
		>
			<button
				ref={setActivatorNodeRef}
				type="button"
				className="timeline-reorder-handle"
				aria-label={`拖动事件：${event.title}`}
				disabled={disabled}
				{...attributes}
				{...listeners}
			>
				<GripVertical size={16} />
			</button>
			<button type="button" className="timeline-reorder-title" onClick={() => onSelect(event)}>
				<small>叙事 {event.narrativePosition.narrativeOrder}</small>
				<strong>{event.title}</strong>
			</button>
		</article>
	);
}

export function TimelineReorderRail({
	events,
	mode,
	disabled,
	onSelect,
	onReorder
}: {
	readonly events: readonly TimelineEvent[];
	readonly mode: TimelineMode;
	readonly disabled: boolean;
	readonly onSelect: (event: TimelineEvent) => void;
	readonly onReorder: (activeId: string, overId: string) => void;
}): React.JSX.Element {
	const [active, setActive] = useState<TimelineEvent>();
	const [announcement, setAnnouncement] = useState('');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	if (mode !== 'narrative-order') {
		return (
			<div className="timeline-drag-guard" role="note">
				<LockKeyhole size={15} />
				<span><strong>实际时间受保护</strong>切换到“叙事顺序”后可拖动读者看到事件的先后。</span>
			</div>
		);
	}
	const handleStart = (event: DragStartEvent) => {
		const picked = events.find(candidate => candidate.id === event.active.id);
		setActive(picked);
		if (picked) setAnnouncement(`已拾取${picked.title}，使用左右方向键调整位置。`);
	};
	const handleEnd = (event: DragEndEvent) => {
		const activeId = String(event.active.id);
		const overId = event.over ? String(event.over.id) : undefined;
		setActive(undefined);
		if (!overId || activeId === overId) {
			setAnnouncement('叙事顺序没有改变。');
			return;
		}
		setAnnouncement('已选择新的叙事位置，正在检查因果关系。');
		onReorder(activeId, overId);
	};
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			autoScroll
			onDragStart={handleStart}
			onDragEnd={handleEnd}
			onDragCancel={() => {
				setActive(undefined);
				setAnnouncement('已取消，叙事顺序没有改变。');
			}}
			accessibility={{
				screenReaderInstructions: {
					draggable: '按空格拾取事件，使用左右方向键移动，再按空格放下；按 Esc 取消。'
				}
			}}
		>
			<section className="timeline-reorder-rail" aria-label="叙事顺序拖拽轨">
				<header>
					<ListTree size={16} />
					<span><strong>叙事排序轨</strong><small>拖动只改变读者看到的先后；因果冲突会先询问。</small></span>
				</header>
				<div>
					<SortableContext
						items={events.map(event => event.id)}
						strategy={horizontalListSortingStrategy}
					>
						{events.map(event => (
							<SortableTimelineEvent
								key={event.id}
								event={event}
								disabled={disabled}
								onSelect={onSelect}
							/>
						))}
					</SortableContext>
				</div>
				<p className="sr-only" role="status" aria-live="polite">{announcement}</p>
			</section>
			<DragOverlay modifiers={[restrictToHorizontalAxis, restrictToWindowEdges]}>
				{active ? (
					<div className="timeline-reorder-overlay">
						<GripVertical size={16} />
						<span><small>调整叙事顺序</small><strong>{active.title}</strong></span>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}
