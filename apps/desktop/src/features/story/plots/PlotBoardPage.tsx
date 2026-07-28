import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
	AlertTriangle,
	BookOpenCheck,
	Columns3,
	Eye,
	GripVertical,
	ListChecks,
	Save,
	Sparkles
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	commitStoryMutation,
	movePlotThreadStatus,
	parseForeshadowing,
	parsePlotThread,
	plotThreadStatuses,
	runPlotRules,
	undoStoryMutation,
	type Character,
	type Foreshadowing,
	type PlotThread,
	type PlotThreadStatus,
	type StoryScene,
	type StoryMutationReceipt,
	type StoryResource
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { ForeshadowingTable } from './ForeshadowingTable';
import { PlotAiPanel } from './PlotAiPanel';
import { StoryDragUndoToast } from '../shared/StoryDragUndoToast';
import { useStoryDragUndoShortcut } from '../shared/useStoryDragUndoShortcut';
import './PlotBoardPage.css';

export interface PlotBoardData {
	readonly threads: readonly PlotThread[];
	readonly foreshadowing: readonly Foreshadowing[];
	readonly characters?: readonly Character[];
	readonly scenes?: readonly StoryScene[];
}

const statusLabels: Readonly<Record<PlotThreadStatus, string>> = {
	planned: '计划',
	active: '活跃',
	'at-risk': '风险',
	resolved: '已解决',
	abandoned: '已放弃'
};

function readPlotThread(
	data: { readonly current?: Record<string, unknown> }
): PlotThread | undefined {
	const thread = data.current?.plotThread;
	return thread && typeof thread === 'object' ? thread as PlotThread : undefined;
}

function readPlotStatus(
	data: { readonly current?: Record<string, unknown> }
): PlotThreadStatus | undefined {
	const status = data.current?.plotStatus;
	return typeof status === 'string' && plotThreadStatuses.includes(status as PlotThreadStatus)
		? status as PlotThreadStatus
		: undefined;
}

function PlotThreadCard({
	thread,
	currentOrder,
	selected,
	disabled,
	onSelect
}: {
	readonly thread: PlotThread;
	readonly currentOrder: number;
	readonly selected: boolean;
	readonly disabled: boolean;
	readonly onSelect: () => void;
}): React.JSX.Element {
	const {
		attributes,
		isDragging,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform
	} = useDraggable({
		id: `plot-thread:${thread.id}`,
		data: { plotThread: thread },
		disabled
	});
	const start = thread.startPosition?.narrativeOrder ?? 0;
	const end = thread.targetResolution?.narrativeOrder ?? Math.max(currentOrder, 1);
	const coverage = Math.max(4, Math.min(
		100,
		((currentOrder - start) / Math.max(1, end - start)) * 100
	));
	return (
		<article
			ref={setNodeRef}
			className={`plot-thread-card${selected ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}`}
			style={transform ? {
				transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
			} : undefined}
		>
			<button type="button" className="plot-thread-main" onClick={onSelect}>
				<span className="eyebrow">{thread.tags[0] ?? 'PLOT THREAD'}</span>
				<strong id={`plot-thread-title-${thread.id}`}>{thread.title}</strong>
				<p>{thread.dramaticQuestion ?? thread.premise ?? '尚未补充戏剧问题。'}</p>
				<span className="plot-coverage" aria-label={`章节覆盖 ${Math.round(coverage)}%`}><i style={{ width: `${coverage}%` }} /></span>
				<small>{thread.sceneIds.length} 场景 · {thread.evidenceIds.length} 证据</small>
			</button>
			<button
				ref={setActivatorNodeRef}
				type="button"
				className="plot-thread-drag-handle"
				aria-label="拖动剧情线卡片"
				disabled={disabled}
				{...attributes}
				{...listeners}
				aria-describedby={`${attributes['aria-describedby'] ?? ''} plot-thread-title-${thread.id}`.trim()}
			>
				<GripVertical size={16} />
			</button>
		</article>
	);
}

function PlotStatusColumn({
	status,
	activeThread,
	children
}: {
	readonly status: PlotThreadStatus;
	readonly activeThread?: PlotThread;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	const { isOver, setNodeRef } = useDroppable({
		id: `plot-status:${status}`,
		data: { plotStatus: status }
	});
	const same = activeThread?.status === status;
	return (
		<section
			ref={setNodeRef}
			className={`${activeThread ? same ? 'is-drop-current' : 'is-drop-valid' : ''}${isOver ? ' is-over' : ''}`}
			aria-labelledby={`plot-column-${status}`}
		>
			{children}
			{isOver && activeThread ? (
				<span className="plot-drop-label">
					{same ? '状态不变' : `松开移到“${statusLabels[status]}”`}
				</span>
			) : null}
		</section>
	);
}

const defaultLoadData = async (projectRoot: string): Promise<PlotBoardData> => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [threads, foreshadowing, characters, scenes] = await Promise.all([
		repository.list('plotThread'),
		repository.list('foreshadowing'),
		repository.list('character'),
		repository.list('scene')
	]);
	return {
		threads: threads.map(value => parsePlotThread(value as never)),
		foreshadowing: foreshadowing.map(value => parseForeshadowing(value as never)),
		characters: characters as unknown as readonly Character[],
		scenes: scenes as unknown as readonly StoryScene[]
	};
};

export function PlotBoardPage({
	projectRoot,
	loadData = defaultLoadData,
	chapters = [],
	readOnly,
	onOpenEvidence
}: {
	readonly projectRoot?: string;
	readonly loadData?: (projectRoot: string) => Promise<PlotBoardData>;
	readonly chapters?: readonly AiChapterSource[];
	readonly readOnly?: boolean;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [data, setData] = useState<PlotBoardData>();
	const [view, setView] = useState<'board' | 'foreshadowing'>('board');
	const [currentOrder, setCurrentOrder] = useState(10);
	const [selectedId, setSelectedId] = useState<string>();
	const [draftStatus, setDraftStatus] = useState<{
		readonly threadId: string;
		readonly status: PlotThreadStatus;
	}>();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();
	const [aiOpen, setAiOpen] = useState(false);
	const [activeThread, setActiveThread] = useState<PlotThread>();
	const [plotUndo, setPlotUndo] = useState<StoryMutationReceipt>();
	const [announcement, setAnnouncement] = useState('');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ threads: [], foreshadowing: [] });
			return;
		}
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => current ?? loaded.threads[0]?.id);
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '剧情资料读取失败。');
		}
	}, [loadData, projectRoot]);
	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const selected = data?.threads.find(thread => thread.id === selectedId);
	const selectedClue = data?.foreshadowing.find(clue => clue.id === selectedId);
	const selectedDraftStatus = selected
		? draftStatus?.threadId === selected.id
			? draftStatus.status
			: selected.status
		: 'planned';
	const issues = useMemo(() => runPlotRules(data?.threads ?? [], data?.foreshadowing ?? [], currentOrder), [currentOrder, data]);

	const chooseThread = (thread: PlotThread) => {
		setSelectedId(thread.id);
		setDraftStatus({ threadId: thread.id, status: thread.status });
	};
	const saveStatus = async () => {
		if (!projectRoot || !data || !selected) return;
		setSaving(true);
		try {
			const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
			const saved = parsePlotThread(await repository.save({ ...selected, status: selectedDraftStatus }, selected.revision) as never);
			setData({ ...data, threads: data.threads.map(thread => thread.id === saved.id ? saved : thread) });
		} finally {
			setSaving(false);
		}
	};
	const moveThread = useCallback(async (thread: PlotThread, status: PlotThreadStatus) => {
		if (!projectRoot || !data) return;
		const next = movePlotThreadStatus(thread, status);
		if (!next) {
			setAnnouncement('剧情线状态没有改变。');
			return;
		}
		setSaving(true);
		setError(undefined);
		try {
			const receipt = await commitStoryMutation({
				repository: new DesktopStoryRepository(projectRoot, desktopBridge),
				before: [thread as unknown as StoryResource],
				after: [next as unknown as StoryResource],
				description: `已把“${thread.title}”移到“${statusLabels[status]}”`
			});
			const saved = parsePlotThread(receipt.saved[0] as never);
			setData(current => current ? {
				...current,
				threads: current.threads.map(candidate => candidate.id === saved.id ? saved : candidate)
			} : current);
			setSelectedId(saved.id);
			setDraftStatus({ threadId: saved.id, status: saved.status });
			setPlotUndo(receipt);
			setAnnouncement(receipt.description);
		} catch (reason) {
			setError(reason instanceof Error && reason.name === 'StoryRevisionConflictError'
				? '剧情线已在其他位置发生变化，请刷新后重试。'
				: '剧情线状态保存失败，原状态没有改变。');
		} finally {
			setSaving(false);
		}
	}, [data, projectRoot]);
	const handlePlotDragStart = (event: DragStartEvent) => {
		const thread = readPlotThread(event.active.data);
		setActiveThread(thread);
		if (thread) setAnnouncement(`已拾取剧情线${thread.title}，选择新的生命周期列。`);
	};
	const handlePlotDragEnd = (event: DragEndEvent) => {
		const thread = readPlotThread(event.active.data);
		const status = event.over ? readPlotStatus(event.over.data) : undefined;
		setActiveThread(undefined);
		if (!thread || !status) {
			setAnnouncement('已取消，剧情线状态没有改变。');
			return;
		}
		void moveThread(thread, status);
	};
	const undoPlotMove = useCallback(() => {
		if (!plotUndo || !projectRoot || saving) return;
		setSaving(true);
		void undoStoryMutation({
			repository: new DesktopStoryRepository(projectRoot, desktopBridge),
			receipt: plotUndo
		})
			.then(async () => {
				setPlotUndo(undefined);
				setAnnouncement('已撤销最近一次剧情线移动。');
				await reload();
			})
			.catch(() => setError('无法撤销：剧情线资料已发生其他变化。'))
			.finally(() => setSaving(false));
	}, [plotUndo, projectRoot, reload, saving]);
	useStoryDragUndoShortcut(Boolean(plotUndo) && !saving, undoPlotMove);

	return (
		<main className="plot-board-page" aria-label="剧情线与伏笔">
			<header className="plot-board-header">
				<div><span className="eyebrow">NARRATIVE CONTROL</span><h1>剧情线与伏笔</h1><p>以章节覆盖和生命周期识别停滞、风险与逾期回收。</p></div>
				<div className="plot-board-toolbar">
					<div role="tablist" aria-label="剧情资料视图">
						<button type="button" role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')}><Columns3 size={16} />剧情线</button>
						<button type="button" role="tab" aria-selected={view === 'foreshadowing'} className={view === 'foreshadowing' ? 'is-active' : ''} onClick={() => setView('foreshadowing')}><Eye size={16} />伏笔表</button>
					</div>
					<label><span>当前叙事位置</span><input type="number" aria-label="当前叙事位置" min={0} value={currentOrder} onChange={event => setCurrentOrder(Number(event.target.value))} /></label>
					<button type="button" className="plot-ai-button" disabled={!projectRoot || readOnly} onClick={() => setAiOpen(true)}><Sparkles size={16} />AI 剧情线与伏笔</button>
				</div>
			</header>
			<div className="plot-board-messages">
				{error ? <div role="alert"><AlertTriangle size={15} />{error}</div> : null}
				{issues.length ? <div role="status"><AlertTriangle size={15} />{issues.length} 条生命周期风险</div> : null}
			</div>
			<section className="plot-board-workspace">
				<div className="plot-board-primary">
					{view === 'board' ? (
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragStart={handlePlotDragStart}
							onDragEnd={handlePlotDragEnd}
							onDragCancel={() => {
								setActiveThread(undefined);
								setAnnouncement('已取消，剧情线状态没有改变。');
							}}
							accessibility={{
								screenReaderInstructions: {
									draggable: '按空格拾取剧情线，使用方向键选择状态列，再按空格放下；按 Esc 取消。'
								}
							}}
						>
							<p className="sr-only" role="status" aria-live="polite">{announcement}</p>
							<div className="plot-kanban" aria-label="剧情线看板">
								{plotThreadStatuses.map(status => (
									<PlotStatusColumn key={status} status={status} activeThread={activeThread}>
										<header><h2 id={`plot-column-${status}`}>{statusLabels[status]}</h2><span>{data?.threads.filter(thread => thread.status === status).length ?? 0}</span></header>
										<div>
											{(data?.threads ?? []).filter(thread => thread.status === status).map(thread => (
												<PlotThreadCard
													key={thread.id}
													thread={thread}
													currentOrder={currentOrder}
													selected={selectedId === thread.id}
													disabled={Boolean(readOnly || saving)}
													onSelect={() => chooseThread(thread)}
												/>
											))}
											{(data?.threads.filter(thread => thread.status === status).length ?? 0) === 0 && status === 'planned' ? (
												<button type="button" className="plot-ai-empty-card" disabled={!projectRoot || readOnly} onClick={() => setAiOpen(true)}>
													<Sparkles size={19} />
													<strong>用 AI 创建剧情线</strong>
													<small>先生成候选，再由作者确认。</small>
												</button>
											) : null}
										</div>
									</PlotStatusColumn>
								))}
							</div>
							<DragOverlay modifiers={[restrictToWindowEdges]}>
								{activeThread ? (
									<div className="plot-thread-overlay">
										<GripVertical size={17} />
										<span><small>移动剧情线</small><strong>{activeThread.title}</strong></span>
									</div>
								) : null}
							</DragOverlay>
						</DndContext>
					) : <ForeshadowingTable items={data?.foreshadowing ?? []} currentOrder={currentOrder} onSelect={clue => setSelectedId(clue.id)} />}
				</div>
				<aside className="plot-inspector">
					{selected ? (
						<>
							<span className="eyebrow">PLOT INSPECTOR</span><h2>{selected.title}</h2>
							<p>{selected.premise ?? selected.summary ?? '尚未补充剧情线说明。'}</p>
							<label><span>生命周期</span><select value={selectedDraftStatus} onChange={event => setDraftStatus({ threadId: selected.id, status: event.target.value as PlotThreadStatus })}>{plotThreadStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
							<section><h3>赌注</h3><p>{selected.stakes ?? '未定义'}</p></section>
							<section><h3>计划覆盖</h3><p>起点 {selected.startPosition?.narrativeOrder ?? '—'} → 计划解决 {selected.targetResolution?.narrativeOrder ?? '—'}</p></section>
							<section><h3>正文来源</h3>{selected.evidenceIds.map(id => <code key={id}>{id}</code>)}</section>
							<button type="button" className="plot-save" disabled={saving} onClick={() => void saveStatus()}><Save size={16} />{saving ? '保存中…' : '保存状态'}</button>
						</>
					) : selectedClue ? (
						<>
							<span className="eyebrow">FORESHADOWING</span><h2>{selectedClue.title}</h2>
							<section><h3>表面含义</h3><p>{selectedClue.surfaceMeaning ?? '未定义'}</p></section>
							<section><h3>真实含义</h3><p>{selectedClue.trueMeaning ?? '未定义'}</p></section>
							<section><h3>可见程度</h3><p>{Math.round(selectedClue.readerVisibility * 100)}%</p></section>
						</>
					) : <div className="plot-inspector-empty"><ListChecks size={34} /><h2>选择一条记录</h2><p>查看来源、计划位置和生命周期。</p></div>}
				</aside>
			</section>
			{aiOpen && projectRoot ? (
				<PlotAiPanel
					projectRoot={projectRoot}
					chapters={chapters}
					threads={data?.threads ?? []}
					foreshadowing={data?.foreshadowing ?? []}
					characters={data?.characters ?? []}
					scenes={data?.scenes ?? []}
					selectedThread={selected}
					selectedForeshadowing={selectedClue}
					currentNarrativeOrder={currentOrder}
					readOnly={readOnly}
					onClose={() => setAiOpen(false)}
					onAccepted={(threads, foreshadowing) => setData(current => current
						? { ...current, threads, foreshadowing }
						: current)}
					onOpenEvidence={onOpenEvidence}
				/>
			) : null}
			{plotUndo ? (
				<StoryDragUndoToast
					message={plotUndo.description}
					busy={saving}
					onUndo={undoPlotMove}
					onDismiss={() => setPlotUndo(undefined)}
				/>
			) : null}
			<footer className="plot-board-legend"><BookOpenCheck size={13} />自动风险只创建审校问题，不修改剧情资料。</footer>
		</main>
	);
}
