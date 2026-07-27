import { CalendarClock, MapPin, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TimelineEvent, TimelineMode } from '@writing-buddy/story-kernel';

export type TimelineTrackKind = 'character' | 'location' | 'plot' | 'eventType';

interface TimelineCanvasProps {
	readonly events: readonly TimelineEvent[];
	readonly labels: Readonly<Record<string, string>>;
	readonly mode: TimelineMode;
	readonly trackKind: TimelineTrackKind;
	readonly zoom: number;
	readonly selectedId?: string;
	readonly onSelect: (event: TimelineEvent) => void;
}

interface Track {
	readonly id: string;
	readonly label: string;
	readonly events: readonly TimelineEvent[];
}

function eventTrackIds(event: TimelineEvent, kind: TimelineTrackKind): readonly string[] {
	if (kind === 'character') {
		return event.participantIds;
	}
	if (kind === 'location') {
		return event.locationIds;
	}
	if (kind === 'plot') {
		return event.plotThreadIds;
	}
	return [event.eventType];
}

const trackPrefixes: Readonly<Record<TimelineTrackKind, string>> = {
	character: '人物',
	location: '地点',
	plot: '剧情线',
	eventType: '事件类型'
};

function buildTracks(
	events: readonly TimelineEvent[],
	labels: Readonly<Record<string, string>>,
	kind: TimelineTrackKind
): readonly Track[] {
	const tracks = new Map<string, TimelineEvent[]>();
	for (const event of events) {
		const ids = eventTrackIds(event, kind);
		for (const id of ids.length ? ids : ['unassigned']) {
			tracks.set(id, [...(tracks.get(id) ?? []), event]);
		}
	}
	return [...tracks].map(([id, trackEvents]) => ({
		id,
		label: `${trackPrefixes[kind]} · ${id === 'unassigned' ? '未分配' : (labels[id] ?? id)}`,
		events: trackEvents
	}));
}

function eventTimeLabel(event: TimelineEvent, mode: TimelineMode): string {
	if (mode === 'narrative-order') {
		return `叙事 ${event.narrativePosition.narrativeOrder}`;
	}
	if (event.storyTimeKind === 'relative' && event.relativeTime) {
		return `相对 ${event.relativeTime.offsetMinutes} 分钟`;
	}
	if (event.storyTimeKind === 'range' && event.uncertainRange) {
		return `${event.uncertainRange.earliest ?? '？'} — ${event.uncertainRange.latest ?? '？'}`;
	}
	if (!event.storyStart) {
		return '时间未定';
	}
	const date = new Date(event.storyStart);
	return Number.isNaN(date.getTime()) ? event.storyStart : date.toLocaleString();
}

export function TimelineCanvas({
	events,
	labels,
	mode,
	trackKind,
	zoom,
	selectedId,
	onSelect
}: TimelineCanvasProps): React.JSX.Element {
	const [scrollLeft, setScrollLeft] = useState(0);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(720);
	const itemWidth = Math.round(172 * zoom);
	const trackHeight = 112;
	const headerHeight = 64;
	const canvasWidth = Math.max(1180, 170 + events.length * itemWidth);
	const startIndex = Math.max(0, Math.floor(scrollLeft / itemWidth) - 3);
	const endIndex = Math.min(events.length, startIndex + Math.ceil(1180 / itemWidth) + 7);
	const visibleIds = useMemo(() => new Set(
		events.slice(startIndex, endIndex).map(event => event.id)
	), [endIndex, events, startIndex]);
	const tracks = useMemo(() => buildTracks(events, labels, trackKind), [events, labels, trackKind]);
	const trackStart = Math.max(
		0,
		Math.floor(Math.max(0, scrollTop - headerHeight) / trackHeight) - 3
	);
	const trackCount = Math.ceil(viewportHeight / trackHeight) + 6;
	const trackEnd = Math.min(tracks.length, trackStart + trackCount);
	const visibleTracks = tracks.slice(trackStart, trackEnd);
	const indexById = useMemo(() => new Map(
		events.map((event, index) => [event.id, index])
	), [events]);

	const navigate = (current: TimelineEvent, direction: -1 | 1) => {
		const index = indexById.get(current.id) ?? 0;
		const next = events[Math.min(events.length - 1, Math.max(0, index + direction))];
		if (next) {
			onSelect(next);
			window.setTimeout(() => {
				document.querySelector<HTMLElement>(`[data-timeline-event="${CSS.escape(next.id)}"]`)?.focus();
			}, 0);
		}
	};

	return (
		<section className="timeline-canvas" role="region" aria-label="多轨时间线画布">
			<div
				className="timeline-scroll"
				onScroll={event => {
					setScrollLeft(event.currentTarget.scrollLeft);
					setScrollTop(event.currentTarget.scrollTop);
					setViewportHeight(event.currentTarget.clientHeight || 720);
				}}
			>
				<div className="timeline-virtual-surface" style={{ width: canvasWidth }}>
					<header className="timeline-time-header">
						<span>{mode === 'story-time' ? '故事实际时间' : '读者叙事顺序'}</span>
						<div>
							{events.map((event, index) => visibleIds.has(event.id) ? (
								<time key={event.id} style={{ left: 154 + index * itemWidth }}>
									{eventTimeLabel(event, mode)}
								</time>
							) : null)}
						</div>
					</header>
					<div className="timeline-track-stack">
						{trackStart ? (
							<div
								className="timeline-track-spacer"
								style={{ height: trackStart * trackHeight }}
								aria-hidden="true"
							/>
						) : null}
						{visibleTracks.map(track => (
							<div className="timeline-track" key={track.id}>
								<strong className="timeline-track-label">
									{trackKind === 'character' ? <UserRound size={15} /> : trackKind === 'location' ? <MapPin size={15} /> : <CalendarClock size={15} />}
									{track.label}
								</strong>
								<div className="timeline-track-events">
									{track.events.map(event => {
										if (!visibleIds.has(event.id)) {
											return null;
										}
										const index = indexById.get(event.id) ?? 0;
										return (
											<button
												type="button"
												key={event.id}
												data-timeline-event={event.id}
												style={{
													left: 154 + index * itemWidth,
													width: Math.max(116, itemWidth - 18)
												}}
												className={selectedId === event.id ? 'is-active' : ''}
												onClick={() => onSelect(event)}
												onKeyDown={keyboardEvent => {
													if (keyboardEvent.key === 'ArrowRight') {
														keyboardEvent.preventDefault();
														navigate(event, 1);
													} else if (keyboardEvent.key === 'ArrowLeft') {
														keyboardEvent.preventDefault();
														navigate(event, -1);
													}
												}}
												aria-label={`${event.title}，${eventTimeLabel(event, mode)}`}
											>
												<span>{event.eventType}</span>
												<strong>{event.title}</strong>
												<small>{eventTimeLabel(event, mode)}</small>
											</button>
										);
									})}
								</div>
							</div>
						))}
						{trackEnd < tracks.length ? (
							<div
								className="timeline-track-spacer"
								style={{ height: (tracks.length - trackEnd) * trackHeight }}
								aria-hidden="true"
							/>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
