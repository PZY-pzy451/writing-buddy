import {
	AlertTriangle,
	CheckCircle2,
	CircleDot,
	Filter,
	LoaderCircle,
	RefreshCw,
	ShieldAlert,
	Sparkles
} from 'lucide-react';
import {
	aggregateContinuityIssues,
	DesktopStoryRepository,
	parseForeshadowing,
	parseItemState,
	parsePlotThread,
	parseStoryInformation,
	parseStoryItem,
	parseTimelineEvent,
	resolveContinuityIssue,
	ruleIssueToContinuityCandidate,
	runInformationRules,
	runItemRules,
	runPlotRules,
	runTimelineRules,
	toStoryChapterId,
	type ContinuityCandidate,
	type ContinuityEvidence,
	type ContinuityIssue,
	type ContinuityLayer,
	type ContinuitySeverity
} from '@writing-buddy/story-kernel';
import { flattenChapters, type ResourceDescriptor } from '@writing-buddy/domain';
import { hashText, type ReviewIssue } from '@writing-buddy/review';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import { AppEmptyState } from '../../shared/presentation/AppEmptyState';
import {
	ContinuityReviewRepository,
	reviewIssueToContinuityCandidate
} from '../../review/ReviewRepository';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { IssueEvidenceView } from './IssueEvidenceView';
import { StoryConsistencyAiPanel } from './StoryConsistencyAiPanel';
import { replaceStoryConsistencyIssues } from './StoryConsistencyReviewService';
import './ContinuityReviewPage.css';

export type ContinuityCandidateLoader = (
	projectRoot: string,
	reviewIssues: readonly ReviewIssue[]
) => Promise<readonly ContinuityCandidate[]>;

async function loadItemStates(projectRoot: string) {
	try {
		const file = await desktopBridge.readText(projectRoot, 'story/states/item-states.json');
		const value = JSON.parse(file.content) as unknown;
		return Array.isArray(value) ? value.map(item => parseItemState(item as never)) : [];
	} catch {
		return [];
	}
}

const defaultContinuityCandidateLoader: ContinuityCandidateLoader = async (
	projectRoot,
	reviewIssues
) => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [rawEvents, rawItems, rawPlots, rawForeshadowing, rawInformation, itemStates] = await Promise.all([
		repository.list('timelineEvent'),
		repository.list('item'),
		repository.list('plotThread'),
		repository.list('foreshadowing'),
		repository.list('information'),
		loadItemStates(projectRoot)
	]);
	const events = rawEvents.map(value => parseTimelineEvent(value as never));
	const items = rawItems.map(value => parseStoryItem(value as never));
	const plots = rawPlots.map(value => parsePlotThread(value as never));
	const foreshadowing = rawForeshadowing.map(value => parseForeshadowing(value as never));
	const information = rawInformation.map(value => parseStoryInformation(value as never));
	const currentOrder = events.reduce(
		(maximum, event) => Math.max(maximum, event.narrativePosition.narrativeOrder),
		0
	);
	const kernelIssues = [
		...runTimelineRules({ events, travelLinks: [] }),
		...runItemRules(items, itemStates),
		...runPlotRules(plots, foreshadowing, currentOrder),
		...runInformationRules(information)
	];
	return [
		...reviewIssues.map(reviewIssueToContinuityCandidate),
		...kernelIssues.map(ruleIssueToContinuityCandidate)
	];
};

interface ContinuityReviewPageProps {
	readonly projectRoot?: string;
	readonly loadCandidates?: ContinuityCandidateLoader;
	readonly loadPrevious?: () => Promise<readonly ContinuityIssue[]>;
	readonly persist?: (issues: readonly ContinuityIssue[]) => Promise<readonly ContinuityIssue[]>;
	readonly onOpenEvidence?: (evidence: ContinuityEvidence) => void;
	readonly chapters?: readonly AiChapterSource[];
	readonly readOnly?: boolean;
}

const severityLabels: Readonly<Record<ContinuitySeverity, string>> = {
	info: '信息',
	suggestion: '建议',
	warning: '警告',
	error: '错误'
};

const layerLabels: Readonly<Record<ContinuityLayer, string>> = {
	'text-rule': '正文规则',
	'story-kernel': 'Story Kernel',
	ai: 'AI 建议'
};

export function ContinuityReviewPage({
	projectRoot,
	loadCandidates = defaultContinuityCandidateLoader,
	loadPrevious,
	persist,
	onOpenEvidence,
	chapters = [],
	readOnly
}: ContinuityReviewPageProps): React.JSX.Element {
	const reviewIssues = useAppStore(state => state.issues);
	const setReviewIssues = useAppStore(state => state.setIssues);
	const snapshot = useAppStore(state => state.snapshot);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const requestEditorReveal = useAppStore(state => state.requestEditorReveal);
	const setMode = useAppStore(state => state.setMode);
	const [issues, setIssues] = useState<readonly ContinuityIssue[]>([]);
	const [selectedId, setSelectedId] = useState<string>();
	const [severity, setSeverity] = useState<ContinuitySeverity | 'all'>('all');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [aiPanelOpen, setAiPanelOpen] = useState(false);
	const repository = useMemo(
		() => projectRoot ? new ContinuityReviewRepository(projectRoot, desktopBridge) : undefined,
		[projectRoot]
	);

	const save = useCallback(async (next: readonly ContinuityIssue[]) => (
		persist ? persist(next) : repository ? repository.save(next) : next
	), [persist, repository]);

	const run = useCallback(async () => {
		if (!projectRoot) {
			setIssues([]);
			return;
		}
		setLoading(true);
		setError('');
		try {
			const [candidates, previous] = await Promise.all([
				loadCandidates(projectRoot, reviewIssues),
				loadPrevious ? loadPrevious() : repository?.load() ?? Promise.resolve([])
			]);
			const currentRevisions: Record<string, string> = {};
			if (session) currentRevisions[session.state.resourceId] = hashText(session.content);
			const next = aggregateContinuityIssues({ candidates, previous, currentRevisions });
			await save(next);
			setIssues(next);
			setSelectedId(current => (
				current && next.some(issue => issue.id === current) ? current : next[0]?.id
			));
			setNotice(`审查完成：${next.length} 个一致性问题，AI 结果均为待确认建议。`);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '一致性审查失败。');
		} finally {
			setLoading(false);
		}
	}, [
		loadCandidates,
		loadPrevious,
		projectRoot,
		repository,
		reviewIssues,
		save,
		session
	]);

	useEffect(() => {
		const timer = window.setTimeout(() => void run(), 0);
		return () => window.clearTimeout(timer);
	}, [run]);

	const filtered = useMemo(() => issues.filter(issue => (
		severity === 'all' || issue.severity === severity
	)), [issues, severity]);
	const selected = issues.find(issue => issue.id === selectedId) ?? filtered[0];
	const counts = useMemo(() => ({
		open: issues.filter(issue => issue.status === 'open').length,
		critical: issues.filter(issue => issue.severity === 'error').length,
		stale: issues.filter(issue => issue.status === 'stale').length,
		ai: issues.filter(issue => issue.layers.includes('ai')).length
	}), [issues]);

	const updateStatus = async (status: 'open' | 'resolved' | 'ignored') => {
		if (!selected) return;
		try {
			const nextIssue = resolveContinuityIssue(selected, status);
			const next = issues.map(issue => issue.id === nextIssue.id ? nextIssue : issue);
			await save(next);
			setIssues(next);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '问题状态更新失败。');
		}
	};

	const openEvidence = (evidence: ContinuityEvidence) => {
		if (onOpenEvidence) {
			onOpenEvidence(evidence);
			return;
		}
		if (!snapshot) return;
		const chapter = flattenChapters(snapshot.project).find(candidate => (
			candidate.id === evidence.resourceId
			|| toStoryChapterId(candidate.id) === evidence.resourceId
			|| toStoryChapterId(candidate.id) === evidence.chapterId
		));
		if (!chapter) {
			setError(`无法定位证据章节：${evidence.chapterId ?? evidence.resourceId}`);
			return;
		}
		const resource: ResourceDescriptor = {
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		};
		void openResource(resource).then(() => {
			setMode('works');
			requestEditorReveal(chapter.id, evidence.start ?? 0);
		});
	};

	return (
		<main className="continuity-review-page" aria-label="长篇一致性审查">
			<header className="continuity-page-header">
				<div>
					<span className="eyebrow">LONG-FORM CONTINUITY</span>
					<h1>长篇一致性审查</h1>
					<p>统一核对正文规则、Story Kernel 确定性约束与 AI 建议；所有结论都保留来源证据和作者处理状态。</p>
				</div>
				<div className="continuity-header-actions">
					<button
						type="button"
						disabled={!projectRoot || readOnly || chapters.length < 2}
						onClick={() => setAiPanelOpen(true)}
					>
						<Sparkles size={18} />AI 对照审查
					</button>
					<button type="button" onClick={() => void run()} disabled={!projectRoot || loading}>
						{loading ? <LoaderCircle className="spin" size={18} /> : <RefreshCw size={18} />}
						{loading ? '正在聚合审查' : '重新运行审查'}
					</button>
				</div>
			</header>

			<section className="continuity-metrics" aria-label="审查指标">
				<Metric icon={<CircleDot size={18} />} label="待处理" value={counts.open} />
				<Metric icon={<ShieldAlert size={18} />} label="严重冲突" value={counts.critical} />
				<Metric icon={<AlertTriangle size={18} />} label="证据过期" value={counts.stale} />
				<Metric icon={<Sparkles size={18} />} label="AI 建议" value={counts.ai} />
			</section>

			{notice ? <p className="continuity-notice" role="status">{notice}</p> : null}
			{error ? <p className="continuity-error" role="alert"><AlertTriangle size={18} />{error}</p> : null}

			<div className="continuity-workspace">
				<section className="continuity-list-panel">
					<header>
						<div><Filter size={18} /><h2>问题列表</h2></div>
						<select aria-label="按严重程度筛选" value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}>
							<option value="all">全部严重程度</option>
							<option value="error">错误</option>
							<option value="warning">警告</option>
							<option value="suggestion">建议</option>
							<option value="info">信息</option>
						</select>
					</header>
					<div className="continuity-issue-list">
						{filtered.map(issue => (
							<button
								type="button"
								key={issue.id}
								data-issue-id={issue.id}
								data-ai={issue.layers.includes('ai') ? 'true' : 'false'}
								className={selected?.id === issue.id ? 'is-active' : ''}
								onClick={() => setSelectedId(issue.id)}
							>
								<span className="severity-dot" data-severity={issue.severity} />
								<span>
									<strong>{issue.title}</strong>
									<small>{issue.message}</small>
								</span>
								<em>{severityLabels[issue.severity]}</em>
								<small>{issue.status}</small>
							</button>
						))}
						{!loading && filtered.length === 0 ? (
							<AppEmptyState
								icon={CheckCircle2}
								title="当前筛选下没有一致性问题"
								density="compact"
								tone="positive"
								className="continuity-empty"
							/>
						) : null}
					</div>
				</section>

				<section className="continuity-detail-panel">
					{selected ? (
						<>
							<header>
								<div>
									<span data-severity={selected.severity}>{severityLabels[selected.severity]}</span>
									<h2>{selected.title}</h2>
								</div>
								<span data-status={selected.status}>{selected.status}</span>
							</header>
							<p>{selected.message}</p>
							<div className="continuity-layer-list">
								{selected.layers.map(layer => <span key={layer}>{layerLabels[layer]}</span>)}
							</div>
							<IssueEvidenceView issue={selected} onOpenEvidence={openEvidence} />
							<div className="continuity-actions">
								<button type="button" onClick={() => void updateStatus('resolved')} disabled={selected.status === 'resolved' || selected.status === 'stale'}>标记已解决</button>
								<button type="button" onClick={() => void updateStatus('ignored')} disabled={selected.status === 'ignored' || selected.status === 'stale'}>忽略</button>
								<button type="button" onClick={() => void updateStatus('open')} disabled={selected.status === 'open'}>重新打开</button>
							</div>
						</>
					) : (
						<AppEmptyState
							icon={CheckCircle2}
							title="选择问题查看来源与证据"
							description="问题详情会区分规则、Story Kernel 与 AI 来源。"
							density="panel"
							className="continuity-empty"
						/>
					)}
				</section>
			</div>

			{aiPanelOpen && projectRoot && snapshot ? (
				<StoryConsistencyAiPanel
					projectId={snapshot.project.projectId}
					projectRoot={projectRoot}
					chapters={chapters}
					readOnly={readOnly}
					onClose={() => setAiPanelOpen(false)}
					onCreated={created => {
						setReviewIssues(replaceStoryConsistencyIssues(reviewIssues, created));
						setNotice(`AI 对照审查已创建 ${created.length} 条待处理建议；没有修改正文或 Story Kernel。`);
					}}
				/>
			) : null}
		</main>
	);
}

function Metric(props: {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly value: number;
}): React.JSX.Element {
	return <div>{props.icon}<span>{props.label}</span><strong>{props.value}</strong></div>;
}
