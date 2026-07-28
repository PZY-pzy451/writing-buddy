import {
	AlertTriangle,
	CalendarClock,
	Check,
	LayoutList,
	ListTree,
	MapPin,
	Minus,
	Plus,
	Sparkles,
	UserRound,
	X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	createStoryId,
	commitStoryMutation,
	DesktopStoryRepository,
	findNarrativeCausalityConflicts,
	parseTimelineEvent,
	queryEvents,
	reorderTimelineEvents,
	runTimelineRules,
	undoStoryMutation,
	type StoryResource,
	type Character,
	type Foreshadowing,
	type Location,
	type PlotThread,
	type StoryItem,
	type TimelineEvent,
	type TimelineMode,
	type TravelLinkRule,
	type NarrativeCausalityConflict,
	type StoryMutationReceipt
} from '@writing-buddy/story-kernel';
import { useModalFocus } from '../../../accessibility/useModalFocus';
import { desktopBridge } from '../../../platform/bridge';
import { AppEmptyState } from '../../shared/presentation/AppEmptyState';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { EventInspector } from './EventInspector';
import { TimelineAiPanel } from './TimelineAiPanel';
import { TimelineCanvas, type TimelineTrackKind } from './TimelineCanvas';
import { TimelineReorderRail } from './TimelineReorderRail';
import { VirtualTimelineList } from './VirtualTimelineList';
import { StoryDragUndoToast } from '../shared/StoryDragUndoToast';
import { useStoryDragUndoShortcut } from '../shared/useStoryDragUndoShortcut';
import './TimelinePage.css';

export interface TimelinePageData {
	readonly events: readonly TimelineEvent[];
	readonly labels: Readonly<Record<string, string>>;
	readonly travelLinks?: readonly TravelLinkRule[];
	readonly characters?: readonly Character[];
	readonly locations?: readonly Location[];
	readonly items?: readonly StoryItem[];
	readonly plotThreads?: readonly PlotThread[];
	readonly foreshadowing?: readonly Foreshadowing[];
}

export type TimelinePageLoader = (projectRoot: string) => Promise<TimelinePageData>;
export type TimelineEventSaver = (event: TimelineEvent) => Promise<TimelineEvent>;

function resourceLabels(resources: readonly StoryResource[]): Readonly<Record<string, string>> {
	return Object.fromEntries(resources.map(resource => [resource.id, resource.title]));
}

const defaultLoadData: TimelinePageLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [events, characters, locations, items, plotThreads, foreshadowing] = await Promise.all([
		repository.list('timelineEvent'),
		repository.list('character'),
		repository.list('location'),
		repository.list('item'),
		repository.list('plotThread'),
		repository.list('foreshadowing')
	]);
	return {
		events: events.map(value => parseTimelineEvent(
			value as unknown as Parameters<typeof parseTimelineEvent>[0]
		)),
		labels: resourceLabels([
			...characters,
			...locations,
			...items,
			...plotThreads,
			...foreshadowing
		]),
		characters: characters as unknown as readonly Character[],
		locations: locations as unknown as readonly Location[],
		items: items as unknown as readonly StoryItem[],
		plotThreads: plotThreads as unknown as readonly PlotThread[],
		foreshadowing: foreshadowing as unknown as readonly Foreshadowing[]
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
	readonly chapters?: readonly AiChapterSource[];
	readonly readOnly?: boolean;
	readonly onOpenEvidence?: OpenAiEvidence;
}

function CausalityConfirmDialog({
	conflicts,
	saving,
	onCancel,
	onConfirm
}: {
	readonly conflicts: readonly NarrativeCausalityConflict[];
	readonly saving: boolean;
	readonly onCancel: () => void;
	readonly onConfirm: () => void;
}): React.JSX.Element {
	const dialogRef = useModalFocus(onCancel);
	return (
		<div className="timeline-causality-backdrop">
			<section
				ref={dialogRef}
				tabIndex={-1}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="timeline-causality-title"
				className="timeline-causality-dialog"
			>
				<header>
					<div><span className="eyebrow">CAUSALITY GUARD</span><h2 id="timeline-causality-title">确认因果顺序冲突</h2></div>
					<button type="button" aria-label="关闭因果冲突确认" onClick={onCancel}><X size={18} /></button>
				</header>
				<div className="timeline-causality-warning">
					<AlertTriangle size={20} />
					<p>新的叙事顺序会让结果早于已声明的前置事件。这里只改变读者看到的顺序，不改变故事实际时间。</p>
				</div>
				<ul>
					{conflicts.slice(0, 6).map(conflict => (
						<li key={`${conflict.predecessorId}:${conflict.eventId}`}>
							<strong>{conflict.eventTitle}</strong>
							<span>将出现在前置事件“{conflict.predecessorTitle}”之前</span>
						</li>
					))}
				</ul>
				{conflicts.length > 6 ? <p>另有 {conflicts.length - 6} 条冲突。</p> : null}
				<footer>
					<button type="button" onClick={onCancel}>返回调整</button>
					<button type="button" className="is-primary" disabled={saving} onClick={onConfirm}>
						<Check size={18} />{saving ? '保存中…' : '仍然保存'}
					</button>
				</footer>
			</section>
		</div>
	);
}

export function TimelinePage({
	projectRoot,
	loadData = defaultLoadData,
	saveEvent,
	chapters = [],
	readOnly,
	onOpenEvidence
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
	const [aiOpen, setAiOpen] = useState(false);
	const [pendingReorder, setPendingReorder] = useState<{
		readonly updates: readonly TimelineEvent[];
		readonly conflicts: readonly NarrativeCausalityConflict[];
	}>();
	const [reorderUndo, setReorderUndo] = useState<StoryMutationReceipt>();

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
	const selectedIssues = selected
		? ruleIssues.filter(issue => issue.evidence.some(item => item.eventId === selected.id))
		: [];

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

	const persistReorder = useCallback(async (updates: readonly TimelineEvent[]) => {
		if (!projectRoot || !data || updates.length === 0) return;
		setSaving(true);
		setError(undefined);
		try {
			const currentById = new Map(data.events.map(event => [event.id, event]));
			const before = updates.map(event => currentById.get(event.id))
				.filter((event): event is TimelineEvent => event !== undefined);
			const receipt = await commitStoryMutation({
				repository: new DesktopStoryRepository(projectRoot, desktopBridge),
				before: before as unknown as readonly StoryResource[],
				after: updates as unknown as readonly StoryResource[],
				description: '已调整叙事事件顺序'
			});
			const savedById = new Map(receipt.saved.map(resource => [
				resource.id,
				parseTimelineEvent(resource as unknown as Parameters<typeof parseTimelineEvent>[0])
			]));
			setData(current => current ? {
				...current,
				events: current.events.map(event => savedById.get(event.id) ?? event)
			} : current);
			setReorderUndo(receipt);
			setPendingReorder(undefined);
		} catch (reason) {
			setError(reason instanceof Error && reason.name === 'StoryRevisionConflictError'
				? '时间线已在其他位置发生变化，请刷新后重试。'
				: '叙事顺序保存失败，原顺序没有改变。');
		} finally {
			setSaving(false);
		}
	}, [data, projectRoot]);

	const requestReorder = (activeId: string, overId: string) => {
		if (!data) return;
		try {
			const updates = reorderTimelineEvents({
				events: data.events,
				activeId,
				overId
			});
			if (updates.length === 0) return;
			const updatesById = new Map(updates.map(event => [event.id, event]));
			const next = data.events.map(event => updatesById.get(event.id) ?? event);
			const conflicts = findNarrativeCausalityConflicts(next);
			if (conflicts.length > 0) {
				setPendingReorder({ updates, conflicts });
				return;
			}
			void persistReorder(updates);
		} catch {
			setError('无法识别时间线拖放目标，顺序没有改变。');
		}
	};

	const undoReorder = useCallback(() => {
		if (!reorderUndo || !projectRoot || saving) return;
		setSaving(true);
		void undoStoryMutation({
			repository: new DesktopStoryRepository(projectRoot, desktopBridge),
			receipt: reorderUndo
		})
			.then(async () => {
				setReorderUndo(undefined);
				await reload();
			})
			.catch(() => setError('无法撤销：时间线资料已发生其他变化。'))
			.finally(() => setSaving(false));
	}, [projectRoot, reload, reorderUndo, saving]);
	useStoryDragUndoShortcut(Boolean(reorderUndo) && !saving, undoReorder);

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
					<button type="button" className="timeline-ai-event" disabled={!projectRoot || readOnly} onClick={() => setAiOpen(true)}><Sparkles size={16} />AI 从正文提取</button>
					<button type="button" className="timeline-new-event" disabled={readOnly} onClick={() => {
						const event = newTimelineEvent();
						setDraftEvent(event);
						setSelectedId(event.id);
					}}><Plus size={16} />手动添加</button>
				</div>
			</header>
			<div className="timeline-messages">
				{error ? <div className="timeline-error" role="alert"><AlertTriangle size={18} />{error}<button type="button" onClick={() => void reload()}>重试</button></div> : null}
			</div>
			<section className="timeline-workspace">
				<TimelineReorderRail
					events={events}
					mode={mode}
					disabled={Boolean(readOnly || saving)}
					onSelect={selectEvent}
					onReorder={requestReorder}
				/>
				{!data ? (
					<div className="timeline-loading">正在读取事件与轨道…</div>
				) : view === 'tracks' ? (
					<>
						<TimelineCanvas
							events={events}
							labels={data.labels}
							mode={mode}
							trackKind={trackKind}
							zoom={zoom}
							selectedId={selectedId}
							onSelect={selectEvent}
						/>
						{events.length === 0 ? (
							<AppEmptyState
								icon={Sparkles}
								title="从正文建立第一条故事进程"
								description="AI 候选会保留证据，并在作者确认前保持待定。"
								className="timeline-empty-state"
								actions={(
									<button type="button" disabled={!projectRoot || readOnly} onClick={() => setAiOpen(true)}>
										AI 从正文提取
									</button>
								)}
							/>
						) : null}
					</>
				) : (
					<VirtualTimelineList events={events} labels={data.labels} onSelect={selectEvent} />
				)}
				{selected ? (
					<EventInspector
						key={selected.id}
						event={selected}
						labels={data?.labels ?? {}}
						ruleIssues={selectedIssues}
						saving={saving}
						onSave={persistEvent}
						onClose={() => {
							setDraftEvent(undefined);
							setSelectedId(undefined);
						}}
					/>
				) : null}
			</section>
			{aiOpen && projectRoot ? (
				<TimelineAiPanel
					projectRoot={projectRoot}
					chapters={chapters}
					events={data?.events ?? []}
					characters={data?.characters ?? []}
					locations={data?.locations ?? []}
					items={data?.items ?? []}
					plotThreads={data?.plotThreads ?? []}
					foreshadowing={data?.foreshadowing ?? []}
					readOnly={readOnly}
					onClose={() => setAiOpen(false)}
					onAccepted={accepted => setData(current => current
						? { ...current, events: accepted }
						: current)}
					onOpenEvidence={onOpenEvidence}
				/>
			) : null}
			{pendingReorder ? (
				<CausalityConfirmDialog
					conflicts={pendingReorder.conflicts}
					saving={saving}
					onCancel={() => setPendingReorder(undefined)}
					onConfirm={() => void persistReorder(pendingReorder.updates)}
				/>
			) : null}
			{reorderUndo ? (
				<StoryDragUndoToast
					message={reorderUndo.description}
					busy={saving}
					onUndo={undoReorder}
					onDismiss={() => setReorderUndo(undefined)}
				/>
			) : null}
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
