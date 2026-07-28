import {
	AlertTriangle,
	BookOpen,
	Check,
	Eye,
	LoaderCircle,
	LockKeyhole,
	Milestone,
	Sparkles,
	WandSparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	buildPlotAnalysisMessages,
	parsePlotAnalysisResponse,
	type AiJobState,
	type PlotAnalysisActionType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type Character,
	type Foreshadowing,
	type PlotThread,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import type { TimelineReviewSource } from '../timeline/TimelineAiReviewService';
import {
	PlotAiReviewService,
	stagePlotReviewBatch,
	type PlotReviewBatch,
	type PlotReviewResource
} from './PlotAiReviewService';
import '../ai-context/AiReviewDrawer.css';

const actions: readonly {
	readonly id: PlotAnalysisActionType;
	readonly label: string;
	readonly instruction: string;
	readonly selectedKind?: 'plotThread' | 'foreshadowing';
}[] = [{
	id: 'generate-plot-thread',
	label: '生成剧情线',
	instruction: '生成具有明确前提、赌注、戏剧问题、参与者与计划解决位置的剧情线候选。'
}, {
	id: 'generate-plot-consequences',
	label: '阻碍与转折',
	instruction: '为当前剧情线生成阻碍、转折和可能解决方式，保持生命周期可追踪。',
	selectedKind: 'plotThread'
}, {
	id: 'extract-plot-progress',
	label: '提取剧情推进',
	instruction: '只提取正文明确推进、阻碍或解决的剧情线信息，并给出精确证据。'
}, {
	id: 'generate-foreshadowing',
	label: '生成伏笔',
	instruction: '生成表面含义、埋设、提醒、计划回收和读者可见程度明确的伏笔。'
}, {
	id: 'generate-foreshadowing-payoff',
	label: '生成回收方式',
	instruction: '为当前伏笔生成可审核的提醒与回收方式，不改变作者确认的真实含义。',
	selectedKind: 'foreshadowing'
}, {
	id: 'extract-foreshadowing',
	label: '提取伏笔',
	instruction: '只提取正文中明确存在的埋设、提醒或回收，不推断未写出的真实含义。'
}];

const statusLabels = {
	planned: '计划',
	active: '活跃',
	'at-risk': '风险',
	resolved: '已解决',
	abandoned: '已放弃',
	planted: '已埋设',
	reminded: '已提醒',
	overdue: '已逾期'
} as const;

function mergeResources<T extends PlotReviewResource>(
	current: readonly T[],
	saved: readonly PlotReviewResource[],
	type: T['type']
): readonly T[] {
	const byId = new Map(current.map(resource => [resource.id, resource]));
	for (const resource of saved) {
		if (resource.type === type) byId.set(resource.id, resource as T);
	}
	return [...byId.values()];
}

export function PlotAiPanel(props: {
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly threads: readonly PlotThread[];
	readonly foreshadowing: readonly Foreshadowing[];
	readonly characters: readonly Character[];
	readonly scenes: readonly StoryScene[];
	readonly selectedThread?: PlotThread;
	readonly selectedForeshadowing?: Foreshadowing;
	readonly currentNarrativeOrder: number;
	readonly readOnly?: boolean;
	readonly onClose: () => void;
	readonly onAccepted: (
		threads: readonly PlotThread[],
		foreshadowing: readonly Foreshadowing[]
	) => void;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [actionType, setActionType] = useState<PlotAnalysisActionType>('generate-plot-thread');
	const [chapterResourceId, setChapterResourceId] = useState(
		props.chapters[0]?.resourceId ?? ''
	);
	const [useVolume, setUseVolume] = useState(false);
	const [includeAuthorSecrets, setIncludeAuthorSecrets] = useState(false);
	const [instruction, setInstruction] = useState(actions[0].instruction);
	const [batch, setBatch] = useState<PlotReviewBatch>();
	const [selectedCandidateIds, setSelectedCandidateIds] = useState<readonly string[]>([]);
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [activeJobId, setActiveJobId] = useState<string>();
	const [streamedLength, setStreamedLength] = useState(0);
	const [applying, setApplying] = useState(false);
	const [notice, setNotice] = useState<string>();
	const [error, setError] = useState<string>();
	const action = actions.find(candidate => candidate.id === actionType)!;
	const currentChapter = props.chapters.find(chapter => (
		chapter.resourceId === chapterResourceId
	));
	const sourceChapters = useMemo(() => (
		useVolume && currentChapter?.volumeId
			? props.chapters.filter(chapter => chapter.volumeId === currentChapter.volumeId)
			: currentChapter ? [currentChapter] : []
	), [currentChapter, props.chapters, useVolume]);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const disabledReason = useMemo(() => {
		if (props.readOnly) return '项目当前为只读。';
		if (sourceChapters.length === 0) return '请先在作品中创建章节。';
		if (sourceChapters.length > 12) return '一次最多分析 12 章，请关闭整卷范围。';
		if (action.selectedKind === 'plotThread' && !props.selectedThread) {
			return '请先在看板中选择一条剧情线。';
		}
		if (action.selectedKind === 'foreshadowing' && !props.selectedForeshadowing) {
			return '请先在伏笔表中选择一条伏笔。';
		}
		if (!instruction.trim()) return '请输入作者指令。';
		return undefined;
	}, [
		action.selectedKind,
		instruction,
		props.readOnly,
		props.selectedForeshadowing,
		props.selectedThread,
		sourceChapters.length
	]);

	const chooseAction = (next: PlotAnalysisActionType) => {
		setActionType(next);
		setInstruction(actions.find(candidate => candidate.id === next)?.instruction ?? '');
		setBatch(undefined);
		setSelectedCandidateIds([]);
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
			const messages = buildPlotAnalysisMessages({
				actionType,
				instruction,
				sources: sources.map(source => ({
					resourceId: source.resourceId,
					sourceRevision: source.revision,
					narrativeOrder: source.narrativeOrder,
					content: source.content
				})),
				includeAuthorSecrets,
				...(actionType === 'generate-plot-consequences' && props.selectedThread
					? { selectedPlotThreadId: props.selectedThread.id }
					: {}),
				...(actionType === 'generate-foreshadowing-payoff' && props.selectedForeshadowing
					? { selectedForeshadowingId: props.selectedForeshadowing.id }
					: {}),
				plotThreads: props.threads.map(thread => ({
					id: thread.id,
					title: thread.title,
					aliases: thread.aliases,
					status: thread.status,
					revision: thread.revision
				})),
				foreshadowing: props.foreshadowing.map(clue => ({
					id: clue.id,
					title: clue.title,
					aliases: clue.aliases,
					status: clue.status,
					...(clue.surfaceMeaning ? { surfaceMeaning: clue.surfaceMeaning } : {}),
					...(includeAuthorSecrets && clue.trueMeaning
						? { trueMeaning: clue.trueMeaning }
						: {}),
					revision: clue.revision
				})),
				characters: props.characters.map(character => ({
					id: character.id,
					title: character.title,
					revision: character.revision
				})),
				scenes: props.scenes.map(scene => ({
					id: scene.id,
					title: scene.title,
					revision: scene.revision
				}))
			});
			const result = await runGroundedJsonJob({
				jobType: 'plot-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const responses = parsePlotAnalysisResponse(result.output, actionType, {
				sourceIds: new Set(props.chapters.map(chapter => chapter.resourceId)),
				characterIds: new Set(props.characters.map(character => character.id)),
				sceneIds: new Set(props.scenes.map(scene => scene.id)),
				plotThreadIds: new Set(props.threads.map(thread => thread.id))
			});
			const next = stagePlotReviewBatch({
				actionType,
				includeAuthorSecrets,
				sources,
				threads: props.threads,
				foreshadowing: props.foreshadowing,
				responses,
				currentNarrativeOrder: props.currentNarrativeOrder
			});
			setBatch(next);
			setSelectedCandidateIds(next.candidates
				.filter(candidate => candidate.selectedByDefault)
				.map(candidate => candidate.id));
			setJobState('completed');
			if (next.candidates.length === 0) setNotice('当前范围没有找到可确认的剧情资料。');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '剧情资料候选生成失败。');
		}
	};

	const apply = async () => {
		if (!batch || applying || props.readOnly) return;
		setApplying(true);
		setNotice(undefined);
		setError(undefined);
		try {
			const service = new PlotAiReviewService(
				new DesktopStoryRepository(props.projectRoot, desktopBridge),
				label => desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-plot-review',
					label
				)
			);
			const result = await service.applyBatch({
				batch,
				selectedCandidateIds,
				currentSources: await readSources()
			});
			setBatch({
				...batch,
				candidates: batch.candidates.map(candidate => (
					result.acceptedCandidateIds.includes(candidate.id)
						? { ...candidate, status: 'accepted' }
						: candidate
				))
			});
			props.onAccepted(
				mergeResources(props.threads, result.resources, 'plotThread'),
				mergeResources(props.foreshadowing, result.resources, 'foreshadowing')
			);
			setNotice(`已创建安全快照并保存 ${result.resources.length} 条剧情资料。`);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '剧情资料候选写入失败。');
		} finally {
			setApplying(false);
		}
	};

	const toggleCandidate = (id: string) => setSelectedCandidateIds(current => (
		current.includes(id) ? current.filter(value => value !== id) : [...current, id]
	));

	return (
		<aside className="ai-review-drawer" aria-label="AI 剧情线与伏笔助手">
			<header className="ai-review-drawer-header">
				<div>
					<span className="eyebrow">PLOT LIFECYCLE & PAYOFF</span>
					<h2><Milestone size={20} />AI 剧情线与伏笔</h2>
					<p>AI 语义建议与本地生命周期规则分开显示；作者秘密默认不发送。</p>
				</div>
				<button type="button" className="ai-review-close" onClick={props.onClose} aria-label="关闭 AI 剧情线与伏笔助手"><X size={18} /></button>
			</header>
			<div className="ai-review-scroll">
				<div className="ai-review-action-grid" role="tablist" aria-label="剧情线与伏笔 AI 动作">
					{actions.map(candidate => (
						<button type="button" role="tab" aria-selected={candidate.id === actionType} className={candidate.id === actionType ? 'is-active' : ''} key={candidate.id} onClick={() => chooseAction(candidate.id)}>{candidate.label}</button>
					))}
				</div>
				<section className="ai-review-source-card">
					<div><BookOpen size={17} /><strong>正文范围 · {sourceChapters.length} 章</strong></div>
					<select aria-label="剧情资料分析章节" value={chapterResourceId} onChange={event => setChapterResourceId(event.target.value)}>
						{props.chapters.map(chapter => <option key={chapter.resourceId} value={chapter.resourceId}>{chapter.volumeTitle ? `${chapter.volumeTitle} · ` : ''}{chapter.title}</option>)}
					</select>
					<label className="ai-review-privacy-toggle">
						<input type="checkbox" checked={useVolume} onChange={event => setUseVolume(event.target.checked)} />
						<span>分析当前整卷</span>
					</label>
				</section>
				<label className={`ai-review-secret-toggle ${includeAuthorSecrets ? 'is-enabled' : ''}`}>
					<input type="checkbox" checked={includeAuthorSecrets} onChange={event => setIncludeAuthorSecrets(event.target.checked)} />
					<LockKeyhole size={16} />
					<span><strong>允许发送作者秘密</strong><small>默认关闭；开启后仅发送已有伏笔的真实含义。</small></span>
				</label>
				<label className="ai-review-instruction">
					<span>作者指令</span>
					<textarea value={instruction} maxLength={2_000} onChange={event => setInstruction(event.target.value)} />
				</label>
				{disabledReason ? <p className="ai-review-hint">{disabledReason}</p> : null}
				<div className="ai-review-run-row">
					<button type="button" className="ai-review-primary" disabled={Boolean(disabledReason) || generating} onClick={() => void generate()}>
						{generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
						{generating ? `正在分析 · ${streamedLength} 字符` : '生成剧情资料候选'}
					</button>
					{generating && activeJobId ? <button type="button" className="ai-review-secondary" onClick={() => void desktopBridge.cancelAiJob(activeJobId)}>取消</button> : null}
				</div>
				{error ? <p className="ai-review-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
				{notice ? <p className="ai-review-notice" role="status"><Check size={16} />{notice}</p> : null}
				{batch?.candidates.length ? (
					<div className="ai-review-batch-row">
						<strong>结构化候选 {batch.candidates.length}</strong>
						<button type="button" onClick={() => setSelectedCandidateIds(batch.candidates.filter(candidate => !candidate.blocking).map(candidate => candidate.id))}>选择全部可写项</button>
					</div>
				) : null}
				{batch?.candidates.map((candidate, index) => {
					const response = candidate.response;
					return (
						<article className={`ai-review-candidate is-${candidate.status} ${selectedCandidateIds.includes(candidate.id) ? 'is-selected' : ''}`} key={candidate.id}>
							<header>
								<label className="ai-review-candidate-select">
									<input type="checkbox" disabled={candidate.blocking || candidate.status !== 'candidate'} checked={selectedCandidateIds.includes(candidate.id)} onChange={() => toggleCandidate(candidate.id)} />
									<span>{response.kind === 'plotThread' ? '剧情线' : '伏笔'}候选 {index + 1}</span>
								</label>
								<strong>{Math.round(response.confidence * 100)}%</strong>
							</header>
							<h3>{response.title}</h3>
							<p>{response.summary}</p>
							<div className="ai-review-chip-row">
								<span>{statusLabels[response.status]}</span>
								<span>{response.kind === 'plotThread' ? `${response.participantIds.length} 人物` : `可见 ${Math.round(response.readerVisibility * 100)}%`}</span>
							</div>
							<div className="ai-review-origin is-ai"><Sparkles size={13} />AI 建议 · {response.rationale}</div>
							{candidate.matchedResourceId ? <div className="ai-review-merge-note"><AlertTriangle size={15} />同名资料已存在，勾选即表示显式合并。</div> : null}
							{candidate.conflicts.map(conflict => <p className="ai-review-inline-warning" key={conflict}>{conflict}</p>)}
							{candidate.localIssues.map(issue => <div className="ai-review-origin is-local" key={issue.id}><AlertTriangle size={13} />本地规则 · {issue.title}</div>)}
							{response.kind === 'plotThread' ? (
								<>
									<section className="ai-review-detail"><strong>剧情前提</strong><p>{response.premise}</p></section>
									<section className="ai-review-detail"><strong>赌注 / 戏剧问题</strong><p>{response.stakes} · {response.dramaticQuestion}</p></section>
								</>
							) : (
								<>
									<section className="ai-review-detail"><strong>表面含义</strong><p>{response.surfaceMeaning}</p></section>
									{response.trueMeaning ? <section className="ai-review-detail is-secret"><Eye size={13} /><strong>真实含义</strong><p>{response.trueMeaning}</p></section> : null}
								</>
							)}
							{candidate.evidence && props.onOpenEvidence ? <button type="button" className="ai-review-evidence-button" onClick={() => props.onOpenEvidence?.(candidate.evidence!)}><BookOpen size={14} />查看原文证据</button> : null}
						</article>
					);
				})}
				{batch ? (
					<button type="button" className="ai-review-accept" disabled={applying || selectedCandidateIds.length === 0} onClick={() => void apply()}>
						{applying ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
						确认写入所选剧情资料
					</button>
				) : null}
			</div>
		</aside>
	);
}
