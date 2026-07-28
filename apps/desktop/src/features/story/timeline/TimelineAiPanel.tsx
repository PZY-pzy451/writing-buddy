import {
	AlertTriangle,
	BookOpen,
	Check,
	ClockArrowUp,
	GitBranch,
	LoaderCircle,
	Sparkles,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildTimelineAnalysisMessages,
	parseTimelineAnalysisResponse,
	type AiJobState,
	type TimelineAnalysisActionType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type Character,
	type Foreshadowing,
	type Location,
	type PlotThread,
	type StoryItem,
	type TimelineEvent
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	TimelineAiReviewService,
	stageTimelineReviewBatch,
	type TimelineReviewBatch,
	type TimelineReviewSource
} from './TimelineAiReviewService';
import '../ai-context/AiReviewDrawer.css';

type TimelineScopeMode =
	| 'current-chapter'
	| 'current-volume'
	| 'selected-chapters'
	| 'unanalyzed';

const actions: readonly {
	readonly id: TimelineAnalysisActionType;
	readonly label: string;
	readonly instruction: string;
}[] = [{
	id: 'extract-events',
	label: '从正文提取',
	instruction: '只提取所选正文中明确发生的事件、时间、人物、地点、前置、结果、影响、剧情线和伏笔。'
}, {
	id: 'generate-events',
	label: '按目标生成',
	instruction: '依据章节目标生成可执行的事件骨架，并明确直接结果与后续影响。'
}, {
	id: 'generate-directions',
	label: '三种后续',
	instruction: '生成三个实质不同、因果清楚且不互相改写的下一步事件方向。'
}, {
	id: 'suggest-causality',
	label: '补全因果',
	instruction: '为既有事件与候选事件提出前置、促成、导致或阻断关系，不虚构未提供的事实。'
}];

const scopeLabels: Readonly<Record<TimelineScopeMode, string>> = {
	'current-chapter': '当前章',
	'current-volume': '当前卷',
	'selected-chapters': '指定章节',
	unanalyzed: '未分析章节'
};

const relationLabels = {
	precondition: '前置',
	causes: '导致',
	enables: '促成',
	blocks: '阻断'
} as const;

function mergeEvents(
	current: readonly TimelineEvent[],
	saved: readonly TimelineEvent[]
): readonly TimelineEvent[] {
	const byId = new Map(current.map(event => [event.id, event]));
	for (const event of saved) byId.set(event.id, event);
	return [...byId.values()];
}

export function TimelineAiPanel(props: {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly events: readonly TimelineEvent[];
	readonly characters: readonly Character[];
	readonly locations: readonly Location[];
	readonly items: readonly StoryItem[];
	readonly plotThreads: readonly PlotThread[];
	readonly foreshadowing: readonly Foreshadowing[];
	readonly readOnly?: boolean;
	readonly onClose: () => void;
	readonly onAccepted: (events: readonly TimelineEvent[]) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [actionType, setActionType] = useState<TimelineAnalysisActionType>('extract-events');
	const [scopeMode, setScopeMode] = useState<TimelineScopeMode>('current-chapter');
	const [chapterResourceId, setChapterResourceId] = useState(
		props.chapters[0]?.resourceId ?? ''
	);
	const [selectedChapterIds, setSelectedChapterIds] = useState<readonly string[]>(
		props.chapters[0] ? [props.chapters[0].resourceId] : []
	);
	const [instruction, setInstruction] = useState(actions[0].instruction);
	const [batch, setBatch] = useState<TimelineReviewBatch>();
	const [selectedCandidateIds, setSelectedCandidateIds] = useState<readonly string[]>([]);
	const [selectedEdgeIds, setSelectedEdgeIds] = useState<readonly string[]>([]);
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applying, setApplying] = useState(false);
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const currentChapter = props.chapters.find(chapter => (
		chapter.resourceId === chapterResourceId
	));
	const sourceChapters = useMemo(() => {
		if (scopeMode === 'current-chapter') return currentChapter ? [currentChapter] : [];
		if (scopeMode === 'current-volume') {
			return props.chapters.filter(chapter => (
				currentChapter?.volumeId
					? chapter.volumeId === currentChapter.volumeId
					: chapter.resourceId === currentChapter?.resourceId
			));
		}
		if (scopeMode === 'selected-chapters') {
			return props.chapters.filter(chapter => selectedChapterIds.includes(chapter.resourceId));
		}
		const analyzed = new Set<string>(
			props.events.map(event => event.narrativePosition.chapterId)
		);
		return props.chapters.filter(chapter => !analyzed.has(chapter.resourceId));
	}, [
		currentChapter,
		props.chapters,
		props.events,
		scopeMode,
		selectedChapterIds
	]);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (sourceChapters.length === 0) return '当前范围没有可分析章节。';
		if (sourceChapters.length > 12) return '一次最多分析 12 章，请缩小范围。';
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [instruction, props.readOnly, sourceChapters.length]);

	const chooseAction = (next: TimelineAnalysisActionType) => {
		setActionType(next);
		setInstruction(actions.find(action => action.id === next)?.instruction ?? '');
		setBatch(undefined);
		setSelectedCandidateIds([]);
		setSelectedEdgeIds([]);
		setNotice(undefined);
		setError(undefined);
	};

	const readSources = async (): Promise<readonly TimelineReviewSource[]> => (
		Promise.all(sourceChapters.map(async chapter => {
			const source = await desktopBridge.readText(props.projectRoot, chapter.path);
			return {
				resourceId: chapter.resourceId,
				revision: source.hash,
				content: source.content,
				narrativeOrder: chapter.narrativeOrder
			};
		}))
	);

	const generate = async () => {
		if (disabledReason || generating) return;
		setBatch(undefined);
		setNotice(undefined);
		setError(undefined);
		setStreamedLength(0);
		try {
			const sources = await readSources();
			const messages = buildTimelineAnalysisMessages({
				actionType,
				instruction,
				sources: sources.map(source => ({
					resourceId: source.resourceId,
					sourceRevision: source.revision,
					narrativeOrder: source.narrativeOrder,
					content: source.content
				})),
				existingEvents: props.events.map(event => ({
					id: event.id,
					title: event.title,
					aliases: event.aliases,
					revision: event.revision
				})),
				characters: props.characters.map(character => ({
					id: character.id,
					title: character.title,
					revision: character.revision
				})),
				locations: props.locations.map(location => ({
					id: location.id,
					title: location.title,
					revision: location.revision
				})),
				items: props.items.map(item => ({
					id: item.id,
					title: item.title,
					revision: item.revision
				})),
				plotThreads: props.plotThreads.map(thread => ({
					id: thread.id,
					title: thread.title,
					revision: thread.revision
				})),
				foreshadowing: props.foreshadowing.map(clue => ({
					id: clue.id,
					title: clue.title,
					revision: clue.revision
				}))
			});
			const result = await runGroundedJsonJob({
				jobType: 'timeline-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const parsed = parseTimelineAnalysisResponse(
				result.output,
				actionType,
				{
					sourceIds: new Set(sources.map(source => source.resourceId)),
					eventIds: new Set(props.events.map(event => event.id)),
					characterIds: new Set(props.characters.map(character => character.id)),
					locationIds: new Set(props.locations.map(location => location.id)),
					itemIds: new Set(props.items.map(item => item.id)),
					plotThreadIds: new Set(props.plotThreads.map(thread => thread.id)),
					foreshadowingIds: new Set(props.foreshadowing.map(clue => clue.id))
				}
			);
			const next = stageTimelineReviewBatch({
				actionType,
				sources,
				events: props.events,
				responses: parsed.candidates,
				causalEdges: parsed.causalEdges
			});
			setBatch(next);
			setSelectedCandidateIds(next.candidates
				.filter(candidate => candidate.selectedByDefault)
				.map(candidate => candidate.id));
			setSelectedEdgeIds(next.edges
				.filter(edge => edge.selectedByDefault)
				.map(edge => edge.id));
			setJobState('completed');
			if (next.candidates.length === 0 && next.edges.length === 0) {
				setNotice('当前范围没有找到可确认的事件或因果关系。');
			}
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '故事进程候选生成失败。');
		}
	};

	const apply = async () => {
		if (!batch || props.readOnly || applying) return;
		setApplying(true);
		setNotice(undefined);
		setError(undefined);
		try {
			const currentSources = await readSources();
			const service = new TimelineAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-timeline-review',
					label
				)
			);
			const result = await service.applyBatch({
				batch,
				selectedCandidateIds,
				selectedEdgeIds,
				currentSources
			});
			setBatch({
				...batch,
				candidates: batch.candidates.map(candidate => (
					result.acceptedCandidateIds.includes(candidate.id)
						? { ...candidate, status: 'accepted' }
						: candidate
				))
			});
			props.onAccepted(mergeEvents(props.events, result.events));
			setNotice(
				`已创建安全快照并写入 ${result.acceptedCandidateIds.length} 个事件、${result.acceptedEdgeIds.length} 条因果关系。`
			);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '故事进程候选写入失败。');
		} finally {
			setApplying(false);
		}
	};

	const toggle = (
		values: readonly string[],
		setter: (values: readonly string[]) => void,
		id: string
	) => setter(values.includes(id) ? values.filter(value => value !== id) : [...values, id]);

	return (
		<aside className="ai-review-drawer" aria-label="AI 故事进程助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">EVENTS & CAUSALITY</span>
					<h2><ClockArrowUp size={20} />AI 故事进程助手</h2>
					<p>事件与因果边分开确认；本地确定性检查不会被 AI 结论覆盖。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 故事进程助手"><X size={18} /></button>
			</header>
			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="故事进程 AI 动作">
					{actions.map(action => (
						<button type="button" role="tab" aria-selected={action.id === actionType} className={action.id === actionType ? 'is-active' : ''} key={action.id} onClick={() => chooseAction(action.id)}>{action.label}</button>
					))}
				</div>
				<section className="ai-review-source-card">
					<div><BookOpen size={18} /><strong>正文范围 · {sourceChapters.length} 章</strong></div>
					<select aria-label="故事进程分析范围" value={scopeMode} onChange={event => setScopeMode(event.target.value as TimelineScopeMode)}>
						{Object.entries(scopeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
					</select>
					{scopeMode === 'current-chapter' || scopeMode === 'current-volume' ? (
						<select aria-label="故事进程基准章节" value={chapterResourceId} onChange={event => setChapterResourceId(event.target.value)}>
							{props.chapters.map(chapter => <option key={chapter.resourceId} value={chapter.resourceId}>{chapter.volumeTitle ? `${chapter.volumeTitle} · ` : ''}{chapter.title}</option>)}
						</select>
					) : null}
					{scopeMode === 'selected-chapters' ? (
						<div className="ai-review-check-grid" aria-label="指定故事进程章节">
							{props.chapters.map(chapter => (
								<label key={chapter.resourceId}>
									<input type="checkbox" checked={selectedChapterIds.includes(chapter.resourceId)} onChange={() => toggle(selectedChapterIds, setSelectedChapterIds, chapter.resourceId)} />
									<span>{chapter.title}</span>
								</label>
							))}
						</div>
					) : null}
					<small>一次最多发送 12 章；未分析范围按正式时间线事件判断。</small>
				</section>
				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea value={instruction} maxLength={2_000} onChange={event => setInstruction(event.target.value)} />
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button type="button" className="ai-review-primary" disabled={Boolean(disabledReason) || generating} onClick={() => void generate()}>
						{generating ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成事件与因果候选'}
					</button>
					{generating && activeJobId ? <button type="button" className="ai-review-secondary" onClick={() => void desktopBridge.cancelAiJob(activeJobId)}>取消</button> : null}
				</div>
				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}
				{batch?.candidates.length ? (
					<div className="ai-review-batch-row">
						<strong>事件候选 {batch.candidates.length}</strong>
						<button type="button" onClick={() => setSelectedCandidateIds(batch.candidates.filter(candidate => !candidate.blocking).map(candidate => candidate.id))}>选择全部可写项</button>
					</div>
				) : null}
				{batch?.candidates.map((candidate, index) => (
					<article className={`ai-review-candidate is-${candidate.status} ${selectedCandidateIds.includes(candidate.id) ? 'is-selected' : ''}`} key={candidate.id}>
						<header>
							<label className="ai-review-candidate-select">
								<input type="checkbox" disabled={candidate.blocking || candidate.status !== 'candidate'} checked={selectedCandidateIds.includes(candidate.id)} onChange={() => toggle(selectedCandidateIds, setSelectedCandidateIds, candidate.id)} />
								<span>事件候选 {index + 1}</span>
							</label>
							<strong>{Math.round(candidate.response.confidence * 100)}%</strong>
						</header>
						<h3>{candidate.response.title}</h3>
						<p>{candidate.response.summary}</p>
						<div className="ai-review-chip-row">
							<span>{candidate.response.eventType}</span>
							<span>叙事 {candidate.response.narrativeOrder}</span>
							<span>{candidate.response.participantIds.length} 人物</span>
						</div>
						<div className="ai-review-origin is-ai"><Sparkles size={13} />AI 建议 · {candidate.response.rationale}</div>
						{candidate.matchedEventId ? <div className="ai-review-merge-note"><AlertTriangle size={16} />同名事件已存在，勾选即表示显式合并。</div> : null}
						{candidate.conflicts.map(conflict => <p className="ai-review-inline-warning" key={conflict}>{conflict}</p>)}
						{candidate.localIssues.map(issue => <div className="ai-review-origin is-local" key={issue.id}><AlertTriangle size={13} />本地规则 · {issue.title}</div>)}
						{candidate.response.directResults.length ? <section className="ai-review-detail"><strong>直接结果</strong><p>{candidate.response.directResults.join('；')}</p></section> : null}
						{candidate.response.impacts.length ? <section className="ai-review-detail"><strong>后续影响</strong><p>{candidate.response.impacts.join('；')}</p></section> : null}
						{candidate.evidence && props.onOpenEvidence ? <button type="button" className="ai-review-evidence-button" onClick={() => props.onOpenEvidence?.(candidate.evidence!)}><BookOpen size={16} />查看原文证据</button> : null}
						{candidate.duplicateCount ? <small>已合并 {candidate.duplicateCount} 个重复候选。</small> : null}
					</article>
				))}
				{batch?.edges.length ? <h3 className="ai-review-subtitle"><GitBranch size={16} />虚线因果候选</h3> : null}
				<div className="ai-causality-preview">
					{batch?.edges.map(edge => (
						<label className={`ai-causality-edge ${edge.conflict ? 'has-conflict' : ''}`} key={edge.id}>
							<input type="checkbox" disabled={edge.blocking} checked={selectedEdgeIds.includes(edge.id)} onChange={() => toggle(selectedEdgeIds, setSelectedEdgeIds, edge.id)} />
							<span className="ai-causality-node">{edge.fromTitle}</span>
							<i aria-hidden="true" />
							<strong>{relationLabels[edge.relation]}</strong>
							<i aria-hidden="true" />
							<span className="ai-causality-node">{edge.toTitle}</span>
							<small>{edge.conflict ?? edge.rationale}</small>
						</label>
					))}
				</div>
				{batch ? (
					<button type="button" className="ai-review-accept" disabled={applying || (selectedCandidateIds.length === 0 && selectedEdgeIds.length === 0)} onClick={() => void apply()}>
						{applying ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
						确认写入所选事件与因果
					</button>
				) : null}
			</div>
		</aside>
	);
}
