import { useMemo, useState } from 'react';
import type { TimelineEvent } from '@writing-buddy/story-kernel';

const rowHeight = 54;
const overscan = 4;

interface VirtualTimelineListProps {
	readonly events: readonly TimelineEvent[];
	readonly labels: Readonly<Record<string, string>>;
	readonly onSelect: (event: TimelineEvent) => void;
}

export function VirtualTimelineList({
	events,
	labels,
	onSelect
}: VirtualTimelineListProps): React.JSX.Element {
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(600);
	const virtualWindow = useMemo(() => {
		const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
		const count = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
		const end = Math.min(events.length, start + count);
		return {
			start,
			visible: events.slice(start, end),
			before: start * rowHeight,
			after: Math.max(0, events.length - end) * rowHeight
		};
	}, [events, scrollTop, viewportHeight]);

	const navigate = (index: number, direction: -1 | 1) => {
		const nextIndex = Math.min(events.length - 1, Math.max(0, index + direction));
		const next = events[nextIndex];
		if (!next) return;
		onSelect(next);
		setScrollTop(Math.max(0, nextIndex * rowHeight - rowHeight * 2));
		window.setTimeout(() => {
			document.querySelector<HTMLElement>(
				`[data-timeline-list-event="${CSS.escape(next.id)}"]`
			)?.focus();
		}, 0);
	};

	return (
		<div
			className="timeline-list-scroll"
			onScroll={event => {
				setScrollTop(event.currentTarget.scrollTop);
				setViewportHeight(event.currentTarget.clientHeight || 600);
			}}
		>
			<table
				className="timeline-list"
				aria-label="时间线列表替代视图"
				aria-rowcount={events.length + 1}
			>
				<thead><tr><th>事件</th><th>类型</th><th>实际时间</th><th>叙事位置</th><th>轨道</th></tr></thead>
				<tbody>
					{virtualWindow.before ? (
						<tr className="timeline-list-spacer" aria-hidden="true">
							<td colSpan={5} style={{ height: virtualWindow.before }} />
						</tr>
					) : null}
					{virtualWindow.visible.map((event, visibleIndex) => {
						const index = virtualWindow.start + visibleIndex;
						return (
							<tr key={event.id} aria-rowindex={index + 2}>
								<td>
									<button
										type="button"
										data-timeline-list-event={event.id}
										aria-posinset={index + 1}
										aria-setsize={events.length}
										onClick={() => onSelect(event)}
										onKeyDown={keyboardEvent => {
											if (keyboardEvent.key === 'ArrowDown') {
												keyboardEvent.preventDefault();
												navigate(index, 1);
											} else if (keyboardEvent.key === 'ArrowUp') {
												keyboardEvent.preventDefault();
												navigate(index, -1);
											}
										}}
									>
										{event.title}
									</button>
								</td>
								<td>{event.eventType}</td>
								<td>{event.storyStart ?? '未确定'}</td>
								<td>{event.narrativePosition.narrativeOrder}</td>
								<td>{event.participantIds.map(id => labels[id] ?? id).join('、') || '未分配'}</td>
							</tr>
						);
					})}
					{virtualWindow.after ? (
						<tr className="timeline-list-spacer" aria-hidden="true">
							<td colSpan={5} style={{ height: virtualWindow.after }} />
						</tr>
					) : null}
				</tbody>
			</table>
		</div>
	);
}
