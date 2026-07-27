import {
	AlertTriangle,
	BookOpenCheck,
	Columns3,
	Eye,
	ListChecks,
	Save
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	parseForeshadowing,
	parsePlotThread,
	plotThreadStatuses,
	runPlotRules,
	type Foreshadowing,
	type PlotThread,
	type PlotThreadStatus
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { ForeshadowingTable } from './ForeshadowingTable';
import './PlotBoardPage.css';

export interface PlotBoardData {
	readonly threads: readonly PlotThread[];
	readonly foreshadowing: readonly Foreshadowing[];
}

const statusLabels: Readonly<Record<PlotThreadStatus, string>> = {
	planned: '计划',
	active: '活跃',
	'at-risk': '风险',
	resolved: '已解决',
	abandoned: '已放弃'
};

const defaultLoadData = async (projectRoot: string): Promise<PlotBoardData> => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [threads, foreshadowing] = await Promise.all([
		repository.list('plotThread'),
		repository.list('foreshadowing')
	]);
	return {
		threads: threads.map(value => parsePlotThread(value as never)),
		foreshadowing: foreshadowing.map(value => parseForeshadowing(value as never))
	};
};

export function PlotBoardPage({
	projectRoot,
	loadData = defaultLoadData
}: {
	readonly projectRoot?: string;
	readonly loadData?: (projectRoot: string) => Promise<PlotBoardData>;
}): React.JSX.Element {
	const [data, setData] = useState<PlotBoardData>();
	const [view, setView] = useState<'board' | 'foreshadowing'>('board');
	const [currentOrder, setCurrentOrder] = useState(10);
	const [selectedId, setSelectedId] = useState<string>();
	const [draftStatus, setDraftStatus] = useState<PlotThreadStatus>('planned');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();

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
	const issues = useMemo(() => runPlotRules(data?.threads ?? [], data?.foreshadowing ?? [], currentOrder), [currentOrder, data]);

	const chooseThread = (thread: PlotThread) => {
		setSelectedId(thread.id);
		setDraftStatus(thread.status);
	};
	const saveStatus = async () => {
		if (!projectRoot || !data || !selected) return;
		setSaving(true);
		try {
			const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
			const saved = parsePlotThread(await repository.save({ ...selected, status: draftStatus }, selected.revision) as never);
			setData({ ...data, threads: data.threads.map(thread => thread.id === saved.id ? saved : thread) });
		} finally {
			setSaving(false);
		}
	};

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
				</div>
			</header>
			<div className="plot-board-messages">
				{error ? <div role="alert"><AlertTriangle size={15} />{error}</div> : null}
				{issues.length ? <div role="status"><AlertTriangle size={15} />{issues.length} 条生命周期风险</div> : null}
			</div>
			<section className="plot-board-workspace">
				<div className="plot-board-primary">
					{view === 'board' ? (
						<div className="plot-kanban" aria-label="剧情线看板">
							{plotThreadStatuses.map(status => (
								<section key={status} aria-labelledby={`plot-column-${status}`}>
									<header><h2 id={`plot-column-${status}`}>{statusLabels[status]}</h2><span>{data?.threads.filter(thread => thread.status === status).length ?? 0}</span></header>
									<div>
										{(data?.threads ?? []).filter(thread => thread.status === status).map(thread => {
											const start = thread.startPosition?.narrativeOrder ?? 0;
											const end = thread.targetResolution?.narrativeOrder ?? Math.max(currentOrder, 1);
											const coverage = Math.max(4, Math.min(100, ((currentOrder - start) / Math.max(1, end - start)) * 100));
											return (
												<button type="button" key={thread.id} className={selectedId === thread.id ? 'is-active' : ''} onClick={() => chooseThread(thread)}>
													<span className="eyebrow">{thread.tags[0] ?? 'PLOT THREAD'}</span>
													<strong>{thread.title}</strong>
													<p>{thread.dramaticQuestion ?? thread.premise ?? '尚未补充戏剧问题。'}</p>
													<span className="plot-coverage" aria-label={`章节覆盖 ${Math.round(coverage)}%`}><i style={{ width: `${coverage}%` }} /></span>
													<small>{thread.sceneIds.length} 场景 · {thread.evidenceIds.length} 证据</small>
												</button>
											);
										})}
									</div>
								</section>
							))}
						</div>
					) : <ForeshadowingTable items={data?.foreshadowing ?? []} currentOrder={currentOrder} onSelect={clue => setSelectedId(clue.id)} />}
				</div>
				<aside className="plot-inspector">
					{selected ? (
						<>
							<span className="eyebrow">PLOT INSPECTOR</span><h2>{selected.title}</h2>
							<p>{selected.premise ?? selected.summary ?? '尚未补充剧情线说明。'}</p>
							<label><span>生命周期</span><select value={draftStatus} onChange={event => setDraftStatus(event.target.value as PlotThreadStatus)}>{plotThreadStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
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
			<footer className="plot-board-legend"><BookOpenCheck size={13} />自动风险只创建审校问题，不修改剧情资料。</footer>
		</main>
	);
}
