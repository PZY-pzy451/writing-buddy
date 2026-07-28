import {
	AlertTriangle,
	Check,
	CheckCircle2,
	ChevronRight,
	CircleStop,
	Clock3,
	DatabaseZap,
	FileSearch,
	Filter,
	LoaderCircle,
	Play,
	RotateCcw,
	ShieldCheck,
	Sparkles
} from 'lucide-react';
import {
	buildStoryKernelGenerationMessages,
	storyKernelGenerationResourceTypes,
	type AiJobState,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	loadStoryKernelGenerationIdentities,
	StoryKernelGenerationService,
	StoryKernelGenerationStore,
	type StoryKernelGenerationBatch,
	type StoryKernelGenerationCandidate
} from '../ai-context/StoryKernelGenerationService';
import {
	ManuscriptExtractionRunner,
	ManuscriptExtractionRunStore,
	planManuscriptExtractionRun,
	type ManuscriptExtractionRun,
	type ManuscriptExtractionSource
} from './ManuscriptExtractionCenterService';
import './ManuscriptExtractionCenterPage.css';

type ExtractionScope =
	| 'current-chapter'
	| 'current-volume'
	| 'selected'
	| 'all'
	| 'unfinished';

const scopeLabels: Readonly<Record<ExtractionScope, string>> = {
	'current-chapter': '当前章',
	'current-volume': '当前卷',
	selected: '指定章节',
	all: '全部章节',
	unfinished: '未完成章节'
};

const typeLabels: Readonly<Record<StoryKernelGenerationResourceType, string>> = {
	character: '人物',
	scene: '场景',
	location: '地点',
	faction: '势力',
	item: '物品',
	worldRule: '世界规则',
	timelineEvent: '时间线事件',
	relationship: '人物关系',
	plotThread: '剧情线',
	foreshadowing: '伏笔',
	information: '信息权限'
};

const chapterStatusLabels: Readonly<Record<
	ManuscriptExtractionRun['chapters'][number]['status'],
	string
>> = {
	queued: '等待',
	running: '整理中',
	completed: '已完成',
	failed: '失败',
	cancelled: '已停止',
	interrupted: '上次中断',
	stale: '正文已变化'
};

const defaultTypes: readonly StoryKernelGenerationResourceType[] = [
	'character',
	'location',
	'item',
	'timelineEvent',
	'plotThread',
	'foreshadowing'
];
const emptyChapters: readonly AiChapterSource[] = [];

function candidateConfirmable(candidate: StoryKernelGenerationCandidate): boolean {
	return candidate.status === 'pending'
		&& candidate.conflicts.length === 0
		&& candidate.normalizedResource !== undefined;
}

function safeMessage(reason: unknown): string {
	const code = reason instanceof Error ? reason.message : String(reason);
	const labels: Readonly<Record<string, string>> = {
		authentication_failed: 'DeepSeek 尚未配置或密钥已失效。',
		network_unavailable: '当前无法连接 DeepSeek，已完成批次仍会保留。',
		connection_timeout: '连接 DeepSeek 超时，可稍后继续未完成批次。',
		'stale-source': '正文已发生变化，请刷新该章节后重新规划。',
		invalidManuscriptExtractionSource: '章节为空、过大或版本信息无效。',
		storyKernelGenerationCandidateBlocked: '所选候选仍有阻断冲突。',
		storyKernelGenerationRevisionConflict: '资料已变化，请重新整理后确认。'
	};
	return labels[code] ?? code;
}

export function ManuscriptExtractionCenterPage(props: {
	readonly projectRoot?: string;
	readonly chapters?: readonly AiChapterSource[];
	readonly activeChapterId?: string;
	readonly readOnly?: boolean;
	readonly repository?: StoryRepository;
	readonly runStore?: ManuscriptExtractionRunStore;
	readonly generationStore?: StoryKernelGenerationStore;
}): React.JSX.Element {
	const chapters = props.chapters ?? emptyChapters;
	const baseChapter = chapters.find(chapter => chapter.resourceId === props.activeChapterId)
		?? chapters[0];
	const repository = useMemo(
		() => props.repository ?? (
			props.projectRoot
				? new DesktopStoryRepository(props.projectRoot, desktopBridge)
				: undefined
		),
		[props.projectRoot, props.repository]
	);
	const runStore = useMemo(
		() => props.runStore ?? (
			props.projectRoot
				? new ManuscriptExtractionRunStore(props.projectRoot, desktopBridge)
				: undefined
		),
		[props.projectRoot, props.runStore]
	);
	const generationStore = useMemo(
		() => props.generationStore ?? (
			props.projectRoot
				? new StoryKernelGenerationStore(props.projectRoot, desktopBridge)
				: undefined
		),
		[props.generationStore, props.projectRoot]
	);
	const generationService = useMemo(
		() => generationStore && repository
			? new StoryKernelGenerationService(generationStore, repository)
			: undefined,
		[generationStore, repository]
	);
	const runner = useMemo(
		() => runStore ? new ManuscriptExtractionRunner(runStore) : undefined,
		[runStore]
	);
	const [scope, setScope] = useState<ExtractionScope>('current-volume');
	const [baseChapterId, setBaseChapterId] = useState(baseChapter?.resourceId ?? '');
	const [selectedChapterIds, setSelectedChapterIds] = useState<readonly string[]>(
		baseChapter ? [baseChapter.resourceId] : []
	);
	const [targetTypes, setTargetTypes] =
		useState<readonly StoryKernelGenerationResourceType[]>(defaultTypes);
	const [instruction, setInstruction] = useState(
		'只从正文提取有明确依据的结构化资料；不补写未出现的设定。'
	);
	const [runs, setRuns] = useState<readonly ManuscriptExtractionRun[]>([]);
	const [selectedRunId, setSelectedRunId] = useState<string>();
	const [batches, setBatches] = useState<readonly StoryKernelGenerationBatch[]>([]);
	const [selectedCandidateIds, setSelectedCandidateIds] =
		useState<ReadonlySet<string>>(new Set());
	const [candidateType, setCandidateType] =
		useState<StoryKernelGenerationResourceType | 'all'>('all');
	const [conflictOnly, setConflictOnly] = useState(false);
	const [planning, setPlanning] = useState(false);
	const [planningProgress, setPlanningProgress] = useState(0);
	const [streamState, setStreamState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [busyAction, setBusyAction] = useState<'run' | 'confirm'>();
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		if (!runStore || !generationStore) return;
		void Promise.all([runStore.load(), generationStore.load()])
			.then(([loadedRuns, loadedBatches]) => {
				if (cancelled) return;
				setRuns(loadedRuns);
				setSelectedRunId(loadedRuns.at(-1)?.id);
				setBatches(loadedBatches);
			})
			.catch(reason => {
				if (!cancelled) setError(safeMessage(reason));
			});
		return () => {
			cancelled = true;
		};
	}, [generationStore, runStore]);

	const selectedRun = runs.find(run => run.id === selectedRunId) ?? runs.at(-1);
	const completedChapterIds = useMemo(() => new Set(
		runs.flatMap(run => run.chapters
			.filter(chapter => chapter.status === 'completed')
			.map(chapter => chapter.resourceId))
	), [runs]);
	const effectiveBaseChapterId = baseChapterId || baseChapter?.resourceId || '';
	const selectedBaseChapter = chapters.find(chapter => (
		chapter.resourceId === effectiveBaseChapterId
	)) ?? baseChapter;
	const scopedChapters = useMemo(() => {
		if (scope === 'current-chapter') return selectedBaseChapter ? [selectedBaseChapter] : [];
		if (scope === 'current-volume') {
			return chapters.filter(chapter => (
				selectedBaseChapter?.volumeId
					? chapter.volumeId === selectedBaseChapter.volumeId
					: chapter.resourceId === selectedBaseChapter?.resourceId
			));
		}
		if (scope === 'selected') {
			return chapters.filter(chapter => selectedChapterIds.includes(chapter.resourceId));
		}
		if (scope === 'unfinished') {
			return chapters.filter(chapter => !completedChapterIds.has(chapter.resourceId));
		}
		return chapters;
	}, [
		chapters,
		completedChapterIds,
		scope,
		selectedBaseChapter,
		selectedChapterIds
	]);
	const runBatchIds = new Set(
		selectedRun?.chapters.flatMap(chapter => (
			chapter.candidateBatchId ? [chapter.candidateBatchId] : []
		)) ?? []
	);
	const runBatches = batches.filter(batch => runBatchIds.has(batch.id));
	const candidates = runBatches
		.flatMap(batch => batch.candidates.map(candidate => ({ batch, candidate })))
		.filter(({ candidate }) => (
			(candidateType === 'all' || candidate.resourceType === candidateType)
			&& (!conflictOnly || candidate.conflicts.length > 0)
		));
	const completedCount = selectedRun?.chapters.filter(chapter => (
		chapter.status === 'completed'
	)).length ?? 0;
	const conflictCount = runBatches.reduce((total, batch) => (
		total + batch.candidates.filter(candidate => candidate.conflicts.length > 0).length
	), 0);

	const loadSource = async (resourceId: string): Promise<ManuscriptExtractionSource> => {
		if (!props.projectRoot) throw new Error('请先打开作品。');
		const chapter = chapters.find(item => item.resourceId === resourceId);
		if (!chapter) throw new Error('invalidManuscriptExtractionSource');
		const file = await desktopBridge.readText(props.projectRoot, chapter.path);
		return {
			resourceId,
			title: chapter.title,
			sourceRevision: file.hash,
			content: file.content
		};
	};

	const createPlan = async () => {
		if (!runStore || scopedChapters.length === 0 || targetTypes.length === 0) return;
		setPlanning(true);
		setPlanningProgress(0);
		setError('');
		setNotice('');
		try {
			const run = await planManuscriptExtractionRun({
				instruction,
				targetTypes,
				chapters: scopedChapters.map(chapter => ({
					resourceId: chapter.resourceId,
					title: chapter.title
				})),
				loadSource,
				onChapterPlanned: completed => setPlanningProgress(completed)
			});
			await runStore.append(run);
			setRuns(await runStore.load());
			setSelectedRunId(run.id);
			setSelectedCandidateIds(new Set());
			setNotice(`已规划 ${run.chapters.length} 个章节；开始前预计 ${run.tokenEstimate.toLocaleString()} tokens。`);
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setPlanning(false);
		}
	};

	const startRun = async () => {
		if (!selectedRun || !runner || !repository || !generationService || !generationStore) return;
		setBusyAction('run');
		setError('');
		setNotice('');
		try {
			const result = await runner.run({
				runId: selectedRun.id,
				loadSource,
				processChapter: async ({
					run,
					source,
					onActiveCancel,
					onStreamProgress
				}) => {
					const identities = await loadStoryKernelGenerationIdentities(repository);
					const messages = buildStoryKernelGenerationMessages({
						instruction: run.instruction,
						content: source.content,
						resourceId: source.resourceId,
						sourceRevision: source.sourceRevision,
						targetTypes: run.targetTypes,
						existingResources: identities
					});
					let sampledLength = 0;
					const response = await runGroundedJsonJob({
						jobType: 'story-kernel-generation',
						messages,
						onProgress: progress => {
							setStreamState(progress.state);
							if (
								progress.output.length - sampledLength >= 128
								|| ['completed', 'failed', 'cancelled'].includes(progress.state)
							) {
								sampledLength = progress.output.length;
								setStreamedLength(progress.output.length);
								onStreamProgress(progress.output.length);
							}
						},
						onJobId: jobId => {
							setActiveJobId(jobId);
							onActiveCancel(jobId
								? () => desktopBridge.cancelAiJob(jobId).then(() => undefined)
								: undefined);
						}
					});
					const batch = await generationService.stageFromResponse({
						instruction: run.instruction,
						sourceResourceId: source.resourceId,
						sourceRevision: source.sourceRevision,
						content: source.content,
						targetTypes: run.targetTypes,
						response: response.output
					});
					return {
						candidateBatchId: batch.id,
						candidateCount: batch.candidates.length,
						conflictCount: batch.candidates.filter(candidate => (
							candidate.conflicts.length > 0
						)).length
					};
				},
				onUpdate: next => setRuns(current => (
					current.map(run => run.id === next.id ? next : run)
				))
			});
			setRuns(await runStore!.load());
			setBatches(await generationStore.load());
			setNotice(result.status === 'completed'
				? '全部章节已整理完成，候选仍需作者确认。'
				: '运行已结束；已完成批次保留，可显式继续或重试。');
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setBusyAction(undefined);
			setActiveJobId(undefined);
		}
	};

	const stopRun = async () => {
		await runner?.stop();
		if (activeJobId) await desktopBridge.cancelAiJob(activeJobId);
		setNotice('已请求停止；完成的章节和候选会保留。');
	};

	const refreshStaleChapter = async (resourceId: string) => {
		if (!selectedRun || !runner) return;
		try {
			const refreshed = await runner.refreshChapterSource(
				selectedRun.id,
				await loadSource(resourceId)
			);
			setRuns(current => current.map(run => run.id === refreshed.id ? refreshed : run));
			setNotice('已使用最新正文重新计算该章节 Token，尚未发起 AI 请求。');
		} catch (reason) {
			setError(safeMessage(reason));
		}
	};

	const confirmSelected = async () => {
		if (!props.projectRoot || !generationService || !generationStore) return;
		const selected = [...selectedCandidateIds];
		if (!selected.length) return;
		setBusyAction('confirm');
		setError('');
		try {
			const grouped = runBatches.map(batch => ({
				batch,
				ids: selected.filter(id => batch.candidates.some(candidate => candidate.id === id))
			})).filter(group => group.ids.length > 0);
			for (const group of grouped) {
				await desktopBridge.createSnapshot(
					props.projectRoot,
					'ai-manuscript-extraction',
					`AI 正文整理确认前 · ${group.batch.sourceResourceId}`
				);
				await generationService.confirm(group.batch.id, group.ids);
			}
			setBatches(await generationStore.load());
			setSelectedCandidateIds(new Set());
			setNotice(`已确认 ${selected.length} 个候选；每个章节写入前均创建安全快照。`);
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setBusyAction(undefined);
		}
	};

	return (
		<main className="extraction-center-page" aria-label="AI 从正文整理中心">
			<header className="extraction-center-header">
				<div>
					<span className="eyebrow">MANUSCRIPT ORGANIZATION</span>
					<h1>AI 从正文整理</h1>
					<p>按章节逐批提取结构化资料；停止、重启或失败都不会丢失已完成候选，也不会自动继续计费。</p>
				</div>
				<span className="extraction-privacy-badge"><ShieldCheck size={16} />作者秘密默认排除</span>
			</header>

			<section className="extraction-summary" aria-label="整理摘要">
				<div><FileSearch size={18} /><span>范围</span><strong>{scopedChapters.length} 章</strong></div>
				<div><DatabaseZap size={18} /><span>预计</span><strong>{selectedRun?.tokenEstimate.toLocaleString() ?? '—'} tokens</strong></div>
				<div><CheckCircle2 size={18} /><span>已完成</span><strong>{completedCount}</strong></div>
				<div><AlertTriangle size={18} /><span>冲突候选</span><strong>{conflictCount}</strong></div>
			</section>

			<div className="extraction-center-layout">
				<section className="extraction-setup-card" aria-labelledby="extraction-setup-title">
					<header>
						<div><span>01</span><h2 id="extraction-setup-title">范围与类型</h2></div>
						<small>创建计划不会调用 AI</small>
					</header>
					<div className="extraction-scope-grid" role="radiogroup" aria-label="正文整理范围">
						{Object.entries(scopeLabels).map(([id, label]) => (
							<button
								type="button"
								role="radio"
								aria-checked={scope === id}
								className={scope === id ? 'is-active' : ''}
								key={id}
								onClick={() => setScope(id as ExtractionScope)}
							>{label}</button>
						))}
					</div>
					{scope === 'current-chapter' || scope === 'current-volume' ? (
						<label>
							<span>基准章节</span>
							<select value={effectiveBaseChapterId} onChange={event => setBaseChapterId(event.target.value)}>
								{chapters.map(chapter => (
									<option value={chapter.resourceId} key={chapter.resourceId}>
										{chapter.volumeTitle ? `${chapter.volumeTitle} · ` : ''}{chapter.title}
									</option>
								))}
							</select>
						</label>
					) : null}
					{scope === 'selected' ? (
						<div className="extraction-chapter-checks" aria-label="指定整理章节">
							{chapters.map(chapter => (
								<label key={chapter.resourceId}>
									<input
										type="checkbox"
										checked={selectedChapterIds.includes(chapter.resourceId)}
										onChange={() => setSelectedChapterIds(current => (
											current.includes(chapter.resourceId)
												? current.filter(id => id !== chapter.resourceId)
												: [...current, chapter.resourceId]
										))}
									/>
									<span>{chapter.title}</span>
								</label>
							))}
						</div>
					) : null}
					<fieldset className="extraction-type-grid">
						<legend>提取资料类型</legend>
						{storyKernelGenerationResourceTypes.map(type => (
							<label key={type}>
								<input
									type="checkbox"
									checked={targetTypes.includes(type)}
									onChange={() => setTargetTypes(current => (
										current.includes(type)
											? current.filter(item => item !== type)
											: [...current, type]
									))}
								/>
								<span>{typeLabels[type]}</span>
							</label>
						))}
					</fieldset>
					<label>
						<span>作者指令</span>
						<textarea
							value={instruction}
							maxLength={2_000}
							onChange={event => setInstruction(event.target.value)}
						/>
					</label>
					<button
						type="button"
						className="extraction-plan-button"
						disabled={
							props.readOnly
							|| planning
							|| busyAction === 'run'
							|| scopedChapters.length === 0
							|| targetTypes.length === 0
							|| !instruction.trim()
						}
						onClick={() => void createPlan()}
					>
						{planning ? <LoaderCircle className="spin" size={17} /> : <Clock3 size={17} />}
						{planning
							? `正在读取 ${planningProgress}/${scopedChapters.length}`
							: '计算 Token 并创建批次'}
					</button>
				</section>

				<section className="extraction-run-card" aria-labelledby="extraction-run-title">
					<header>
						<div><span>02</span><h2 id="extraction-run-title">逐章运行</h2></div>
						{selectedRun ? <strong data-status={selectedRun.status}>{selectedRun.status}</strong> : null}
					</header>
					<p className="extraction-cost-boundary">
						<Sparkles size={16} />只有点击“开始”或“继续”才会调用 DeepSeek；重启应用不会自动恢复付费任务。
					</p>
					{runs.length > 1 ? (
						<select
							aria-label="选择历史整理运行"
							value={selectedRun?.id ?? ''}
							onChange={event => {
								setSelectedRunId(event.target.value);
								setSelectedCandidateIds(new Set());
							}}
						>
							{[...runs].reverse().map(run => (
								<option key={run.id} value={run.id}>
									{new Date(run.createdAt).toLocaleString()} · {run.chapters.length} 章 · {run.status}
								</option>
							))}
						</select>
					) : null}
					<div className="extraction-run-actions">
						<button
							type="button"
							disabled={
								!selectedRun
								|| selectedRun.status === 'running'
								|| selectedRun.status === 'completed'
								|| Boolean(busyAction)
							}
							onClick={() => void startRun()}
						>
							{busyAction === 'run' ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
							{selectedRun?.status === 'stopped' || selectedRun?.status === 'completed-with-errors'
								? '继续未完成批次'
								: '开始逐章整理'}
						</button>
						<button
							type="button"
							disabled={selectedRun?.status !== 'running' && busyAction !== 'run'}
							onClick={() => void stopRun()}
						>
							<CircleStop size={17} />停止
						</button>
					</div>
					{busyAction === 'run' ? (
						<p className="extraction-stream-status" role="status">
							<LoaderCircle className="spin" size={15} />
							{streamState} · 已接收 {streamedLength.toLocaleString()} 字符
						</p>
					) : null}
					<div className="extraction-chapter-list">
						{selectedRun?.chapters.map((chapter, index) => (
							<article key={chapter.resourceId} data-status={chapter.status}>
								<span>{index + 1}</span>
								<div>
									<strong>{chapter.title}</strong>
									<small>{chapter.tokenEstimate.toLocaleString()} tokens</small>
								</div>
								<em>{chapterStatusLabels[chapter.status]}</em>
								{chapter.status === 'completed' ? (
									<small>{chapter.candidateCount ?? 0} 候选 · {chapter.conflictCount ?? 0} 冲突</small>
								) : null}
								{chapter.errorCode ? <small>{chapter.errorCode}</small> : null}
								{chapter.status === 'stale' ? (
									<button type="button" onClick={() => void refreshStaleChapter(chapter.resourceId)}>
										<RotateCcw size={14} />使用最新正文
									</button>
								) : null}
							</article>
						))}
						{!selectedRun ? <p>先创建一个不计费的整理计划。</p> : null}
					</div>
				</section>
			</div>

			<section className="extraction-candidate-queue" aria-labelledby="candidate-queue-title">
				<header>
					<div>
						<span>03</span>
						<div><h2 id="candidate-queue-title">统一冲突候选</h2><small>AI 结果不会自动写入 Story Kernel</small></div>
					</div>
					<div className="extraction-candidate-filters">
						<Filter size={15} />
						<select aria-label="按候选类型筛选" value={candidateType} onChange={event => setCandidateType(event.target.value as typeof candidateType)}>
							<option value="all">全部类型</option>
							{storyKernelGenerationResourceTypes.map(type => <option value={type} key={type}>{typeLabels[type]}</option>)}
						</select>
						<label><input type="checkbox" checked={conflictOnly} onChange={event => setConflictOnly(event.target.checked)} />只看冲突</label>
						<button
							type="button"
							disabled={selectedCandidateIds.size === 0 || Boolean(busyAction) || props.readOnly}
							onClick={() => void confirmSelected()}
						>
							{busyAction === 'confirm' ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
							创建快照并确认 {selectedCandidateIds.size || ''}
						</button>
					</div>
				</header>
				<div className="extraction-candidate-grid">
					{candidates.map(({ batch, candidate }) => (
						<article
							key={candidate.id}
							data-conflict={candidate.conflicts.length > 0 ? 'true' : 'false'}
						>
							<header>
								<label>
									<input
										type="checkbox"
										aria-label={`选择 ${candidate.title}`}
										disabled={!candidateConfirmable(candidate) || Boolean(busyAction)}
										checked={selectedCandidateIds.has(candidate.id)}
										onChange={() => setSelectedCandidateIds(current => {
											const next = new Set(current);
											if (next.has(candidate.id)) next.delete(candidate.id);
											else next.add(candidate.id);
											return next;
										})}
									/>
									<span>{typeLabels[candidate.resourceType]}</span>
								</label>
								<strong>{Math.round(candidate.confidence * 100)}%</strong>
							</header>
							<h3>{candidate.title}</h3>
							<p>{candidate.rationale}</p>
							<small>{batch.sourceResourceId}</small>
							{candidate.evidence ? <blockquote>{candidate.evidence.quotePreview}</blockquote> : null}
							{candidate.conflicts.map(conflict => (
								<p className="extraction-conflict" key={`${conflict.code}:${conflict.message}`}>
									<AlertTriangle size={14} />{conflict.message}
								</p>
							))}
							<span className="extraction-candidate-state">
								{candidate.status === 'accepted'
									? '已写入'
									: candidate.status === 'rejected'
										? '已拒绝'
										: candidate.conflicts.length
											? '需处理冲突'
											: '待作者确认'}
								<ChevronRight size={14} />
							</span>
						</article>
					))}
					{candidates.length === 0 ? (
						<div className="extraction-candidate-empty">
							<DatabaseZap size={24} />
							<strong>还没有符合筛选的候选</strong>
							<span>完成至少一个章节后，候选会在这里按统一冲突规则显示。</span>
						</div>
					) : null}
				</div>
			</section>

			{notice ? <p className="extraction-notice" role="status">{notice}</p> : null}
			{error ? <p className="extraction-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
		</main>
	);
}
