import {
	AlertTriangle,
	CalendarClock,
	LayoutList,
	ListTree,
	MapPin,
	Minus,
	Plus,
	UserRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	createStoryId,
	DesktopStoryRepository,
	parseTimelineEvent,
	queryEvents,
	runTimelineRules,
	type StoryResource,
	type TimelineEvent,
	type TimelineMode,
	type TravelLinkRule
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { EventInspector } from './EventInspector';
import { TimelineCanvas, type TimelineTrackKind } from './TimelineCanvas';
import './TimelinePage.css';

export interface TimelinePageData {
	readonly events: readonly TimelineEvent[];
	readonly labels: Readonly<Record<string, string>>;
	readonly travelLinks?: readonly TravelLinkRule[];
}

export type TimelinePageLoader = (projectRoot: string) => Promise<TimelinePageData>;
export type TimelineEventSaver = (event: TimelineEvent) => Promise<TimelineEvent>;

function resourceLabels(resources: readonly StoryResource[]): Readonly<Record<string, string>> {
	return Object.fromEntries(resources.map(resource => [resource.id, resource.title]));
}

const defaultLoadData: TimelinePageLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [events, characters, locations, plotThreads] = await Promise.all([
		repository.list('timelineEvent'),
		repository.list('character'),
		repository.list('location'),
		repository.list('plotThread')
	]);
	return {
		events: events.map(value => parseTimelineEvent(
			value as unknown as Parameters<typeof parseTimelineEvent>[0]
		)),
		labels: resourceLabels([...characters, ...locations, ...plotThreads])
	};
};

function newTimelineEvent(): TimelineEvent {
	const now = new Date().toISOString();
	return parseTimelineEvent({
		id: createStoryId('timeline-event'),
		type: 'timelineEvent',
		title: '未命名事件',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 0,
		storyTimeKind: 'unknown',
		narrativePosition: {
			chapterId: 'chapter:unassigned',
			narrativeOrder: 0
		},
		eventType: '未分类',
		participantIds: [],
		locationIds: [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: [],
		informationIds: [],
		evidenceIds: []
	});
}

interface TimelinePageProps {
	readonly projectRoot?: string;
	readonly loadData?: TimelinePageLoader;
	readonly saveEvent?: TimelineEventSaver;
}

export function TimelinePage({
	projectRoot,
	loadData = defaultLoadData,
	saveEvent
}: TimelinePageProps): React.JSX.Element {
	const [data, setData] = useState<TimelinePageData>();
	const [error, setError] = useState<string>();
	const [mode, setMode] = useState<TimelineMode>('story-time');
	const [view, setView] = useState<'tracks' | 'list'>('tracks');
	const [trackKind, setTrackKind] = useState<TimelineTrackKind>('character');
	const [zoom, setZoom] = useState(1);
	const [selectedId, setSelectedId] = useState<string>();
	const [draftEvent, setDraftEvent] = useState<TimelineEvent>();
	const [saving, setSaving] = useState(false);

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ events: [], labels: {} });
			return;
		}
		setError(undefined);
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => (
				current && loaded.events.some(event => event.id === current)
					? current
					: queryEvents(loaded.events, {}, {}, 'story-time')[0]?.id
			));
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : '时间线读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const events = useMemo(() => queryEvents(
		data?.events ?? [],
		{},
		{},
		mode
	), [data, mode]);
	const ruleIssues = useMemo(() => runTimelineRules({
		events: data?.events ?? [],
		travelLinks: data?.travelLinks ?? []
	}), [data]);
	const selected = draftEvent ?? events.find(event => event.id === selectedId);

	const selectEvent = (event: TimelineEvent) => {
		setDraftEvent(undefined);
		setSelectedId(event.id);
	};

	const persistEvent = async (event: TimelineEvent) => {
		if (!projectRoot && !saveEvent) {
			return;
		}
		setSaving(true);
		setError(undefined);
		try {
			const saved = saveEvent
				? await saveEvent(event)
				: parseTimelineEvent(
					await new DesktopStoryRepository(projectRoot!, desktopBridge)
						.save(event, event.revision) as unknown as Parameters<typeof parseTimelineEvent>[0]
				);
			setData(current => {
				if (!current) {
					return { events: [saved], labels: {} };
				}
				const exists = current.events.some(candidate => candidate.id === saved.id);
				return {
					...current,
					events: exists
						? current.events.map(candidate => candidate.id === saved.id ? saved : candidate)
						: [...current.events, saved]
				};
			});
			setDraftEvent(undefined);
			setSelectedId(saved.id);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : '事件保存失败。');
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="timeline-page" aria-label="多轨时间线">
			<header className="timeline-header">
				<div><span className="eyebrow">STORY TIME / NARRATIVE ORDER</span><h1>多轨时间线</h1><p>{events.length} 个事件 · 实际发生顺序与读者看到的顺序分别管理</p></div>
				<div className="timeline-toolbar">
					<div role="tablist" aria-label="时间顺序">
						<button type="button" role="tab" aria-selected={mode === 'story-time'} className={mode === 'story-time' ? 'is-active' : ''} onClick={() => setMode('story-time')}><CalendarClock size={16} />实际时间</button>
						<button type="button" role="tab" aria-selected={mode === 'narrative-order'} className={mode === 'narrative-order' ? 'is-active' : ''} onClick={() => setMode('narrative-order')}><ListTree size={16} />叙事顺序</button>
					</div>
					<select aria-label="轨道类型" value={trackKind} onChange={change => setTrackKind(change.target.value as TimelineTrackKind)}>
						<option value="character">人物轨道</option>
						<option value="location">地点轨道</option>
						<option value="plot">剧情线轨道</option>
						<option value="eventType">事件类型轨道</option>
					</select>
					<button type="button" aria-label="缩小时间线" onClick={() => setZoom(value => Math.max(0.65, value - 0.15))}><Minus size={16} /></button>
					<span>{Math.round(zoom * 100)}%</span>
					<button type="button" aria-label="放大时间线" onClick={() => setZoom(value => Math.min(1.8, value + 0.15))}><Plus size={16} /></button>
					<button type="button" className="timeline-view-toggle" aria-label="列表替代视图" onClick={() => setView(value => value === 'tracks' ? 'list' : 'tracks')}><LayoutList size={16} />{view === 'tracks' ? '列表' : '轨道'}</button>
					<button type="button" className="timeline-new-event" onClick={() => {
						const event = newTimelineEvent();
						setDraftEvent(event);
						setSelectedId(event.id);
					}}><Plus size={16} />新建事件</button>
				</div>
			</header>
			<div className="timeline-messages">
				{error ? <div className="timeline-error" role="alert"><AlertTriangle size={17} />{error}<button type="button" onClick={() => void reload()}>重试</button></div> : null}
			</div>
			<section className="timeline-workspace">
				{!data ? (
					<div className="timeline-loading">正在读取事件与轨道…</div>
				) : view === 'tracks' ? (
					<TimelineCanvas
						events={events}
						labels={data.labels}
						mode={mode}
						trackKind={trackKind}
						zoom={zoom}
						selectedId={selectedId}
						onSelect={selectEvent}
					/>
				) : (
					<div className="timeline-list-scroll">
						<table className="timeline-list" aria-label="时间线列表替代视图">
							<thead><tr><th>事件</th><th>类型</th><th>实际时间</th><th>叙事位置</th><th>轨道</th></tr></thead>
							<tbody>
								{events.map(event => (
									<tr key={event.id}>
										<td><button type="button" onClick={() => selectEvent(event)}>{event.title}</button></td>
										<td>{event.eventType}</td>
										<td>{event.storyStart ?? '未确定'}</td>
										<td>{event.narrativePosition.narrativeOrder}</td>
										<td>{event.participantIds.map(id => data.labels[id] ?? id).join('、') || '未分配'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{selected ? (
					<EventInspector
						key={selected.id}
						event={selected}
						saving={saving}
						onSave={persistEvent}
						onClose={() => {
							setDraftEvent(undefined);
							setSelectedId(undefined);
						}}
					/>
				) : null}
			</section>
			<footer className="timeline-legend">
				<span><UserRound size={13} />人物轨道</span>
				<span><MapPin size={13} />地点轨道</span>
				<span><CalendarClock size={13} />支持精确、日期、相对与未确定时间</span>
				<span className={ruleIssues.length ? 'has-rule-issues' : ''}>
					<AlertTriangle size={13} />确定性检查 {ruleIssues.length ? `${ruleIssues.length} 项冲突` : '通过'}
				</span>
			</footer>
		</main>
	);
}
