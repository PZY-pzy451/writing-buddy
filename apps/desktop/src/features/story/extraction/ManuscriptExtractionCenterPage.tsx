import {
	AlertTriangle,
	ArrowRightLeft,
	Check,
	CheckCircle2,
	ChevronRight,
	CircleStop,
	Clock3,
	DatabaseZap,
	ExternalLink,
	FilePenLine,
	FileSearch,
	Filter,
	GitCompareArrows,
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
	type ChapterReconciliationField,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import {
	updateStoryOutlineNode,
	updateStoryOutlineRoot
} from '../../creation-journey/CreationJourneyModel';
import {
	CreationJourneyStore,
	type LoadedCreationJourney
} from '../../creation-journey/CreationJourneyStore';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import {
	loadStoryKernelGenerationIdentities,
	StoryKernelGenerationService,
	StoryKernelGenerationStore,
	type StoryKernelGenerationBatch,
	type StoryKernelGenerationCandidate,
	type StoryKernelConfirmationUndoReceipt
} from '../ai-context/StoryKernelGenerationService';
import {
	ManuscriptExtractionRunner,
	ManuscriptExtractionRunStore,
	planManuscriptExtractionRun,
	type ManuscriptExtractionRun,
	type ManuscriptExtractionSource
} from './ManuscriptExtractionCenterService';
import {
	buildChapterReconciliationPatch,
	findMaterializedChapterPlan,
	findStaleExtractionBatchIds,
	groupChapterOrganizationCandidates
} from './ChapterOrganizationModel';
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
const reconciliationFieldLabels: Readonly<Record<ChapterReconciliationField, string>> = {
	summary: '章节概要',
	goal: '章节目标',
	conflict: '核心冲突',
	outcome: '章节结果',
	hook: '结尾钩子'
};
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
		storyKernelGenerationRevisionConflict: '资料已变化，请重新整理后确认。',
		storyKernelGenerationUndoConflict: '资料在确认后又被修改，为保护新内容，本次撤销已停止。',
		chapterReconciliationPlanUnavailable: '当前章节没有可安全更新的规划节点。',
		lockedChapterReconciliationPlan: '章节计划已锁定；可以查看差异，但不能由 AI 候选更新。',
		staleChapterReconciliationPlan: '章节计划已变化，请使用最新计划重新整理本章。',
		invalidChapterReconciliationSelection: '请选择仍然存在差异的大纲字段。',
		invalidChapterReconciliationResponse: 'AI 未返回完整的计划与实际比较，请重试整理本章。',
		invalidChapterReconciliationEvidence: 'AI 返回的差异没有可定位的正文依据。'
	};
	return labels[code] ?? code;
}

export function ManuscriptExtractionCenterPage(props: {
	readonly projectRoot?: string;
	readonly projectId?: string;
	readonly chapters?: readonly AiChapterSource[];
	readonly activeChapterId?: string;
	readonly readOnly?: boolean;
	readonly repository?: StoryRepository;
	readonly runStore?: ManuscriptExtractionRunStore;
	readonly generationStore?: StoryKernelGenerationStore;
	readonly journeyStore?: CreationJourneyStore;
	readonly onOpenEvidence?: (evidence: {
		readonly resourceId: string;
		readonly range?: { readonly start: number; readonly end: number };
	}) => void;
}): React.JSX.Element {
	const openQuickCapture = useAppStore(state => state.openQuickCapture);
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
	const journeyStore = useMemo(
		() => props.journeyStore ?? (
			props.projectRoot && props.projectId
				? new CreationJourneyStore(
					props.projectRoot,
					props.projectId,
					desktopBridge
				)
				: undefined
		),
		[props.journeyStore, props.projectId, props.projectRoot]
	);
	const runner = useMemo(
		() => runStore ? new ManuscriptExtractionRunner(runStore) : undefined,
		[runStore]
	);
	const [scope, setScope] = useState<ExtractionScope>(
		props.activeChapterId ? 'current-chapter' : 'current-volume'
	);
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
	const [journey, setJourney] = useState<LoadedCreationJourney>();
	const [selectedCandidateIds, setSelectedCandidateIds] =
		useState<ReadonlySet<string>>(new Set());
	const [selectedReconciliationFields, setSelectedReconciliationFields] =
		useState<Readonly<Record<string, readonly ChapterReconciliationField[]>>>({});
	const [staleBatchIds, setStaleBatchIds] =
		useState<ReadonlySet<string>>(new Set());
	const [lastConfirmationReceipts, setLastConfirmationReceipts] =
		useState<readonly StoryKernelConfirmationUndoReceipt[]>([]);
	const [candidateType, setCandidateType] =
		useState<StoryKernelGenerationResourceType | 'all'>('all');
	const [conflictOnly, setConflictOnly] = useState(false);
	const [planning, setPlanning] = useState(false);
	const [planningProgress, setPlanningProgress] = useState(0);
	const [streamState, setStreamState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [busyAction, setBusyAction] = useState<'run' | 'confirm' | 'undo'>();
	const [resolvingCandidateId, setResolvingCandidateId] = useState<string>();
	const [notice, setNotice] = useState('');
	const [error, setError] = useState('');

	const refreshStaleState = useCallback(async (
		nextBatches: readonly StoryKernelGenerationBatch[]
	) => {
		const projectRoot = props.projectRoot;
		if (!projectRoot) {
			setStaleBatchIds(new Set());
			return;
		}
		const sourceIds = [...new Set(nextBatches.map(batch => batch.sourceResourceId))];
		const currentRevisions = new Map<string, string>();
		const loadedJourney = journeyStore ? await journeyStore.load() : undefined;
		if (loadedJourney) setJourney(loadedJourney);
		await Promise.all(sourceIds.map(async resourceId => {
			const chapter = chapters.find(item => item.resourceId === resourceId);
			if (!chapter) return;
			const file = await desktopBridge.readText(projectRoot, chapter.path);
			currentRevisions.set(resourceId, file.hash);
		}));
		const currentPlanRevisions = new Map(
			loadedJourney?.state.outline.map(node => [node.id, node.revision ?? 1]) ?? []
		);
		setStaleBatchIds(findStaleExtractionBatchIds(
			nextBatches,
			currentRevisions,
			currentPlanRevisions
		));
	}, [chapters, journeyStore, props.projectRoot]);

	useEffect(() => {
		let cancelled = false;
		if (!runStore || !generationStore) return;
		void Promise.all([runStore.load(), generationStore.load()])
			.then(async ([loadedRuns, loadedBatches]) => {
				if (cancelled) return;
				setRuns(loadedRuns);
				setSelectedRunId(loadedRuns.at(-1)?.id);
				setBatches(loadedBatches);
				await refreshStaleState(loadedBatches);
			})
			.catch(reason => {
				if (!cancelled) setError(safeMessage(reason));
			});
		return () => {
			cancelled = true;
		};
	}, [generationStore, refreshStaleState, runStore]);

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
	const reconciliationBatches = runBatches.filter(batch => (
		batch.chapterReconciliation !== undefined
	));
	const selectedReconciliations = reconciliationBatches.flatMap(batch => {
		const fields = selectedReconciliationFields[batch.id] ?? [];
		return fields.length > 0 ? [{ batch, fields }] : [];
	});
	const selectedReconciliationFieldCount = selectedReconciliations.reduce(
		(total, selection) => total + selection.fields.length,
		0
	);
	const totalSelectionCount = selectedCandidateIds.size
		+ selectedReconciliationFieldCount;
	const candidateGroups = groupChapterOrganizationCandidates(runBatches)
		.flatMap(group => {
			if (candidateType !== 'all' && group.type !== candidateType) return [];
			const entries = group.entries.filter(({ candidate }) => (
				!conflictOnly || candidate.conflicts.length > 0
			));
			return entries.length > 0 ? [{ ...group, entries }] : [];
		});
	const visibleCandidateCount = candidateGroups.reduce(
		(total, group) => total + group.entries.length,
		0
	);
	const selectedHasStaleSource = runBatches.some(batch => (
		staleBatchIds.has(batch.id)
		&& (
			batch.candidates.some(candidate => selectedCandidateIds.has(candidate.id))
			|| (selectedReconciliationFields[batch.id]?.length ?? 0) > 0
		)
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

	const markPendingReconciliationNeedsReview = async (
		nextBatches: readonly StoryKernelGenerationBatch[]
	) => {
		if (!journeyStore) return;
		const current = await journeyStore.load();
		const hasCurrentDifference = nextBatches.some(batch => {
			const reconciliation = batch.chapterReconciliation;
			if (!reconciliation
				|| reconciliation.status !== 'pending'
				|| reconciliation.differences.length === 0
			) {
				return false;
			}
			return current.state.outline.some(node => (
				node.id === reconciliation.planNodeId
				&& (node.revision ?? 1) === reconciliation.planRevision
			));
		});
		if (!hasCurrentDifference || current.state.storyOutline?.status === 'needs_review') {
			setJourney(current);
			return;
		}
		const saved = await journeyStore.save(
			current,
			updateStoryOutlineRoot(current.state, { status: 'needs_review' })
		);
		setJourney(saved);
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
			setSelectedReconciliationFields({});
			setLastConfirmationReceipts([]);
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
					const latestJourney = journeyStore ? await journeyStore.load() : journey;
					if (latestJourney) setJourney(latestJourney);
					const chapterPlan = latestJourney
						? findMaterializedChapterPlan(
							latestJourney.state.outline,
							latestJourney.state.locks.outlineNodeIds,
							source.resourceId
						)
						: undefined;
					const messages = buildStoryKernelGenerationMessages({
						instruction: run.instruction,
						content: source.content,
						resourceId: source.resourceId,
						sourceRevision: source.sourceRevision,
						targetTypes: run.targetTypes,
						existingResources: identities,
						...(chapterPlan ? { chapterPlan } : {})
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
						...(chapterPlan ? { chapterPlan } : {}),
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
			const loadedBatches = await generationStore.load();
			setBatches(loadedBatches);
			await markPendingReconciliationNeedsReview(loadedBatches);
			await refreshStaleState(loadedBatches);
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
		if (totalSelectionCount === 0) return;
		if (selectedHasStaleSource) {
			setError('正文或章节计划已变化，旧候选不可确认；请使用最新内容重新整理本章。');
			return;
		}
		setBusyAction('confirm');
		setError('');
		const confirmedReceipts: StoryKernelConfirmationUndoReceipt[] = [];
		let journeySaved = false;
		try {
			const grouped = runBatches.map(batch => ({
				batch,
				ids: selected.filter(id => batch.candidates.some(candidate => candidate.id === id))
			})).filter(group => group.ids.length > 0);
			const selectedBatches = [...new Map([
				...grouped.map(group => [group.batch.id, group.batch] as const),
				...selectedReconciliations.map(selection => [
					selection.batch.id,
					selection.batch
				] as const)
			]).values()];
			for (const batch of selectedBatches) {
				const chapter = chapters.find(item => item.resourceId === batch.sourceResourceId);
				if (!chapter) throw new Error('stale-source');
				const source = await desktopBridge.readText(props.projectRoot, chapter.path);
				if (source.hash !== batch.sourceRevision) throw new Error('stale-source');
			}

			let loadedJourney: LoadedCreationJourney | undefined;
			let nextJourney = undefined as LoadedCreationJourney['state'] | undefined;
			if (selectedReconciliations.length > 0) {
				if (!journeyStore) throw new Error('chapterReconciliationPlanUnavailable');
				loadedJourney = await journeyStore.load();
				nextJourney = loadedJourney.state;
				for (const selection of selectedReconciliations) {
					const reconciliation = selection.batch.chapterReconciliation;
					if (!reconciliation) throw new Error('chapterReconciliationNotFound');
					const plan = findMaterializedChapterPlan(
						nextJourney.outline,
						nextJourney.locks.outlineNodeIds,
						selection.batch.sourceResourceId
					);
					if (!plan) throw new Error('chapterReconciliationPlanUnavailable');
					const patch = buildChapterReconciliationPatch(
						plan,
						reconciliation,
						selection.fields
					);
					nextJourney = updateStoryOutlineNode(
						nextJourney,
						reconciliation.planNodeId,
						patch
					);
				}
				const selectedReconciliationIds = new Set(
					selectedReconciliations.map(selection => selection.batch.id)
				);
				const hasUnadoptedDifference = reconciliationBatches.some(batch => {
					const reconciliation = batch.chapterReconciliation;
					if (!reconciliation || reconciliation.status !== 'pending') return false;
					if (!selectedReconciliationIds.has(batch.id)) {
						return reconciliation.differences.length > 0;
					}
					const selectedFields = new Set(selectedReconciliationFields[batch.id] ?? []);
					return reconciliation.differences.some(
						difference => !selectedFields.has(difference.field)
					);
				});
				if (hasUnadoptedDifference && nextJourney.storyOutline) {
					nextJourney = updateStoryOutlineRoot(
						nextJourney,
						{ status: 'needs_review' }
					);
				}
			}

			for (const batch of selectedBatches) {
				await desktopBridge.createSnapshot(
					props.projectRoot,
					'beforeDestructiveOperation',
					`AI 正文整理确认前 · ${batch.sourceResourceId}`
				);
			}
			for (const group of grouped) {
				const confirmation = await generationService.confirmWithReceipt(
					group.batch.id,
					group.ids
				);
				confirmedReceipts.push(confirmation.receipt);
				setLastConfirmationReceipts([...confirmedReceipts]);
			}
			if (loadedJourney && nextJourney && journeyStore) {
				const saved = await journeyStore.save(loadedJourney, nextJourney);
				journeySaved = true;
				setJourney(saved);
			}
			for (const selection of selectedReconciliations) {
				await generationService.resolveChapterReconciliation(
					selection.batch.id,
					'outline-updated'
				);
			}
			const loadedBatches = await generationStore.load();
			setBatches(loadedBatches);
			await refreshStaleState(loadedBatches);
			setSelectedCandidateIds(new Set());
			setSelectedReconciliationFields({});
			setNotice(
				`已批量确认 ${totalSelectionCount} 项；写入前已创建安全快照。`
			);
		} catch (reason) {
			if (!journeySaved && confirmedReceipts.length > 0) {
				const remaining = [...confirmedReceipts];
				for (const receipt of [...confirmedReceipts].reverse()) {
					try {
						await generationService.undoConfirmation(receipt);
						remaining.splice(remaining.indexOf(receipt), 1);
					} catch {
						break;
					}
				}
				setLastConfirmationReceipts(remaining);
			}
			setError(safeMessage(reason));
		} finally {
			setBusyAction(undefined);
		}
	};

	const replanStaleBatch = async (batch: StoryKernelGenerationBatch) => {
		if (!runStore) return;
		const chapter = chapters.find(item => item.resourceId === batch.sourceResourceId);
		if (!chapter) return;
		setPlanning(true);
		setPlanningProgress(0);
		setError('');
		try {
			const run = await planManuscriptExtractionRun({
				instruction: batch.instruction,
				targetTypes: batch.targetTypes,
				chapters: [{
					resourceId: chapter.resourceId,
					title: chapter.title
				}],
				loadSource,
				onChapterPlanned: completed => setPlanningProgress(completed)
			});
			await runStore.append(run);
			setRuns(await runStore.load());
			setSelectedRunId(run.id);
			setSelectedCandidateIds(new Set());
			setSelectedReconciliationFields({});
			setLastConfirmationReceipts([]);
			setNotice('已按最新正文重新规划本章；尚未调用 AI，请确认 Token 后点击开始。');
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setPlanning(false);
		}
	};

	const keepChapterDifference = async (batchId: string) => {
		if (!generationService || !generationStore) return;
		setResolvingCandidateId(batchId);
		setError('');
		try {
			await generationService.resolveChapterReconciliation(
				batchId,
				'difference-kept'
			);
			const loadedBatches = await generationStore.load();
			setBatches(loadedBatches);
			if (journeyStore) {
				const current = await journeyStore.load();
				const hasPendingDifference = loadedBatches.some(batch => {
					const reconciliation = batch.chapterReconciliation;
					return reconciliation?.status === 'pending'
						&& reconciliation.differences.length > 0
						&& current.state.outline.some(node => (
							node.id === reconciliation.planNodeId
							&& (node.revision ?? 1) === reconciliation.planRevision
						));
				});
				const synced = !hasPendingDifference
					&& current.state.storyOutline?.status === 'needs_review'
					? await journeyStore.save(
						current,
						updateStoryOutlineRoot(current.state, { status: 'draft' })
					)
					: current;
				setJourney(synced);
			}
			setSelectedReconciliationFields(current => {
				const next = { ...current };
				delete next[batchId];
				return next;
			});
			await refreshStaleState(loadedBatches);
			setNotice('已按作者决定保留正文与计划的差异；没有修改正文或大纲。');
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setResolvingCandidateId(undefined);
		}
	};

	const rejectCandidate = async (
		batchId: string,
		candidateId: string
	) => {
		if (!generationService || !generationStore) return;
		setResolvingCandidateId(candidateId);
		setError('');
		try {
			await generationService.reject(batchId, candidateId);
			const loadedBatches = await generationStore.load();
			setBatches(loadedBatches);
			setSelectedCandidateIds(current => {
				const next = new Set(current);
				next.delete(candidateId);
				return next;
			});
			setNotice('候选已拒绝，未写入 Story Kernel。');
		} catch (reason) {
			setError(safeMessage(reason));
		} finally {
			setResolvingCandidateId(undefined);
		}
	};

	const deferCandidate = (
		batch: StoryKernelGenerationBatch,
		candidate: StoryKernelGenerationCandidate
	) => {
		const quickCaptureType = candidate.resourceType === 'character'
			? 'character'
			: candidate.resourceType === 'foreshadowing'
				? 'foreshadowing'
				: ['location', 'item', 'faction', 'worldRule'].includes(candidate.resourceType)
					? 'world'
					: 'idea';
		openQuickCapture({
			type: quickCaptureType,
			text: `${candidate.title}\n${candidate.rationale}`.trim(),
			chapterId: batch.sourceResourceId
		});
		setNotice('已填入“稍后整理”；保存速记后可继续处理当前候选。');
	};

	const undoLastConfirmation = async () => {
		if (!generationService || !generationStore || lastConfirmationReceipts.length === 0) return;
		setBusyAction('undo');
		setError('');
		let remaining = [...lastConfirmationReceipts];
		try {
			for (const receipt of [...lastConfirmationReceipts].reverse()) {
				await generationService.undoConfirmation(receipt);
				remaining = remaining.filter(item => item !== receipt);
				setLastConfirmationReceipts([...remaining]);
			}
			const loadedBatches = await generationStore.load();
			setBatches(loadedBatches);
			await refreshStaleState(loadedBatches);
			setNotice(
				'已撤销刚才的资料确认；大纲更新仍保留，可从写入前快照恢复。'
			);
		} catch (reason) {
			setLastConfirmationReceipts(remaining);
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
						{planning ? <LoaderCircle className="spin" size={18} /> : <Clock3 size={18} />}
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
								setSelectedReconciliationFields({});
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
							{busyAction === 'run' ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}
							{selectedRun?.status === 'stopped' || selectedRun?.status === 'completed-with-errors'
								? '继续未完成批次'
								: '开始逐章整理'}
						</button>
						<button
							type="button"
							disabled={selectedRun?.status !== 'running' && busyAction !== 'run'}
							onClick={() => void stopRun()}
						>
							<CircleStop size={18} />停止
						</button>
					</div>
					{busyAction === 'run' ? (
						<p className="extraction-stream-status" role="status">
							<LoaderCircle className="spin" size={16} />
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
										<RotateCcw size={16} />使用最新正文
									</button>
								) : null}
							</article>
						))}
						{!selectedRun ? <p>先创建一个不计费的整理计划。</p> : null}
					</div>
				</section>
			</div>

			<section
				className="chapter-reconciliation-section"
				aria-labelledby="chapter-reconciliation-title"
			>
				<header>
					<div>
						<span>03</span>
						<div>
							<h2 id="chapter-reconciliation-title">计划与实际</h2>
							<small>正文不会自动服从计划；只更新你明确勾选的大纲字段</small>
						</div>
					</div>
					{journey?.state.storyOutline?.status === 'needs_review' ? (
						<strong className="chapter-needs-review">
							<GitCompareArrows size={16} />needs_review
						</strong>
					) : null}
				</header>
				<div className="chapter-reconciliation-list">
					{reconciliationBatches.map(batch => {
						const reconciliation = batch.chapterReconciliation;
						if (!reconciliation) return null;
						const plan = journey
							? findMaterializedChapterPlan(
								journey.state.outline,
								journey.state.locks.outlineNodeIds,
								batch.sourceResourceId
							)
							: undefined;
						const stale = staleBatchIds.has(batch.id);
						const selectedFields = selectedReconciliationFields[batch.id] ?? [];
						const firstEvidence = reconciliation.differences[0]?.evidence;
						return (
							<article
								className="chapter-reconciliation-card"
								data-stale={stale ? 'true' : 'false'}
								key={batch.id}
							>
								<header>
									<div>
										<span><ArrowRightLeft size={16} />{plan?.title ?? batch.sourceResourceId}</span>
										<strong>
											{reconciliation.status === 'pending'
												? '待作者决定'
												: reconciliation.status === 'outline-updated'
													? '已更新大纲'
													: reconciliation.status === 'difference-kept'
														? '已保留差异'
														: '准备修改正文'}
										</strong>
									</div>
									<small>
										{reconciliation.differences.length === 0
											? '正文与计划未发现明确差异'
											: `${reconciliation.differences.length} 个待比较字段`}
									</small>
								</header>
								<div className="chapter-plan-actual">
									<div>
										<span>计划</span>
										<p>{plan?.summary || '当前没有可用章节计划。'}</p>
									</div>
									<ChevronRight size={18} />
									<div>
										<span>实际正文</span>
										<p>{reconciliation.actual.summary || 'AI 未提取到明确的实际概要。'}</p>
									</div>
								</div>
								{stale ? (
									<div className="extraction-stale-warning">
										<span><AlertTriangle size={16} />正文或计划已变化，旧比较不可确认</span>
										<button
											type="button"
											disabled={planning || Boolean(busyAction) || props.readOnly}
											onClick={() => void replanStaleBatch(batch)}
										>
											<RotateCcw size={16} />用最新内容重新整理
										</button>
									</div>
								) : null}
								<div className="chapter-difference-list">
									{reconciliation.differences.map(difference => {
										const checked = selectedFields.includes(difference.field);
										return (
											<article key={difference.field}>
												<label>
													<input
														type="checkbox"
														aria-label={`更新大纲字段 ${reconciliationFieldLabels[difference.field]}`}
														checked={checked}
														disabled={
															stale
															|| plan?.locked !== false
															|| reconciliation.status !== 'pending'
															|| Boolean(busyAction)
														}
														onChange={() => setSelectedReconciliationFields(current => {
															const currentFields = current[batch.id] ?? [];
															return {
																...current,
																[batch.id]: currentFields.includes(difference.field)
																	? currentFields.filter(field => field !== difference.field)
																	: [...currentFields, difference.field]
															};
														})}
													/>
													<span>{reconciliationFieldLabels[difference.field]}</span>
												</label>
												<div>
													<small>计划</small>
													<p>{difference.planned || '未规划'}</p>
												</div>
												<ChevronRight size={16} />
												<div>
													<small>实际</small>
													<p>{difference.actual}</p>
												</div>
												<button
													type="button"
													aria-label={`查看 ${reconciliationFieldLabels[difference.field]} 正文依据`}
													onClick={event => {
														event.preventDefault();
														props.onOpenEvidence?.({
															resourceId: difference.evidence.resourceId,
															range: difference.evidence.range
														});
													}}
												>
													<ExternalLink size={16} />正文依据
												</button>
											</article>
										);
									})}
								</div>
								{plan?.locked ? (
									<p className="chapter-plan-locked">
										<ShieldCheck size={16} />章节计划已锁定；差异可查看，但 AI 候选不能更新。
									</p>
								) : null}
								<div className="chapter-reconciliation-actions">
									<button
										type="button"
										disabled={
											stale
											|| plan?.locked !== false
											|| reconciliation.status !== 'pending'
											|| reconciliation.differences.length === 0
											|| Boolean(busyAction)
											|| props.readOnly
										}
										onClick={() => {
											setSelectedReconciliationFields(current => ({
												...current,
												[batch.id]: reconciliation.differences.map(
													difference => difference.field
												)
											}));
											setNotice(
												'已选择本章全部差异字段；点击“创建快照并批量确认”后才会更新大纲。'
											);
										}}
									>
										<ArrowRightLeft size={16} />更新大纲
									</button>
									<button
										type="button"
										disabled={!firstEvidence}
										onClick={() => {
											if (firstEvidence) {
												props.onOpenEvidence?.({
													resourceId: firstEvidence.resourceId,
													range: firstEvidence.range
												});
											}
											setNotice('已定位正文差异；修改正文后，旧候选会自动变为 Stale。');
										}}
									>
										<FilePenLine size={16} />修改正文
									</button>
									<button
										type="button"
										disabled={
											stale
											|| reconciliation.status !== 'pending'
											|| Boolean(resolvingCandidateId)
											|| props.readOnly
										}
										onClick={() => void keepChapterDifference(batch.id)}
									>
										<Check size={16} />保留差异
									</button>
									<button
										type="button"
										disabled={reconciliation.status !== 'pending'}
										onClick={() => setNotice('差异保持待处理；正文与大纲均未修改。')}
									>
										<Clock3 size={16} />稍后处理
									</button>
								</div>
							</article>
						);
					})}
					{reconciliationBatches.length === 0 ? (
						<div className="chapter-reconciliation-empty">
							<GitCompareArrows size={22} />
							<strong>完成章节整理后显示计划与实际比较</strong>
							<span>没有可用章节计划时仍可继续提取 StoryForge 资料。</span>
						</div>
					) : null}
				</div>
			</section>

			<section className="extraction-candidate-queue" aria-labelledby="candidate-queue-title">
				<header>
					<div>
						<span>04</span>
						<div><h2 id="candidate-queue-title">资料与大纲候选</h2><small>AI 结果不会自动写入 Story Kernel 或大纲</small></div>
					</div>
					<div className="extraction-candidate-filters">
						<Filter size={16} />
						<select aria-label="按候选类型筛选" value={candidateType} onChange={event => setCandidateType(event.target.value as typeof candidateType)}>
							<option value="all">全部类型</option>
							{storyKernelGenerationResourceTypes.map(type => <option value={type} key={type}>{typeLabels[type]}</option>)}
						</select>
						<label><input type="checkbox" checked={conflictOnly} onChange={event => setConflictOnly(event.target.checked)} />只看冲突</label>
						<button
							type="button"
							disabled={
								totalSelectionCount === 0
								|| selectedHasStaleSource
								|| Boolean(busyAction)
								|| props.readOnly
							}
							onClick={() => void confirmSelected()}
						>
							{busyAction === 'confirm' ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
							创建快照并批量确认 {totalSelectionCount || ''}
						</button>
						{lastConfirmationReceipts.length > 0 ? (
							<button
								type="button"
								className="extraction-undo-button"
								disabled={Boolean(busyAction) || props.readOnly}
								onClick={() => void undoLastConfirmation()}
							>
								{busyAction === 'undo'
									? <LoaderCircle className="spin" size={16} />
									: <RotateCcw size={16} />}
								撤销资料确认
							</button>
						) : null}
					</div>
				</header>
				<div className="extraction-candidate-groups">
					{candidateGroups.map(group => (
						<section className="extraction-candidate-group" key={group.type}>
							<header>
								<div>
									<h3>{typeLabels[group.type]}</h3>
									<span>{group.entries.length} 个候选</span>
								</div>
								<small>
									{group.pendingCount} 待处理
									{group.conflictCount > 0 ? ` · ${group.conflictCount} 冲突` : ''}
									{group.resolvedCount > 0 ? ` · ${group.resolvedCount} 已处理` : ''}
									{group.lowConfidenceCount > 0 ? ` · ${group.lowConfidenceCount} 低置信` : ''}
								</small>
							</header>
							<div className="extraction-candidate-grid">
								{group.entries.map(({ batch, candidate }) => {
									const stale = staleBatchIds.has(batch.id);
									const evidence = candidate.evidence;
									return (
										<article
											key={candidate.id}
											data-conflict={candidate.conflicts.length > 0 ? 'true' : 'false'}
											data-stale={stale ? 'true' : 'false'}
										>
											<header>
												<label>
													<input
														type="checkbox"
														aria-label={`选择 ${candidate.title}`}
														disabled={
															stale
															|| !candidateConfirmable(candidate)
															|| Boolean(busyAction)
														}
														checked={selectedCandidateIds.has(candidate.id)}
														onChange={() => setSelectedCandidateIds(current => {
															const next = new Set(current);
															if (next.has(candidate.id)) next.delete(candidate.id);
															else next.add(candidate.id);
															return next;
														})}
													/>
													<span>{candidate.operation === 'create' ? '新建' : '更新'}</span>
												</label>
												<div>
													{candidate.confidence < 0.6 ? <em>低置信</em> : null}
													<strong>{Math.round(candidate.confidence * 100)}%</strong>
												</div>
											</header>
											<h4>{candidate.title}</h4>
											<p>{candidate.rationale}</p>
											<small>{batch.sourceResourceId}</small>
											{stale ? (
												<div className="extraction-stale-warning">
													<span>
														<AlertTriangle size={16} />正文已变化，请重新整理后再确认
													</span>
													<button
														type="button"
														disabled={planning || Boolean(busyAction) || props.readOnly}
														onClick={() => void replanStaleBatch(batch)}
													>
														<RotateCcw size={16} />用最新正文重新规划
													</button>
												</div>
											) : null}
											{evidence ? (
												<div className="extraction-evidence">
													<blockquote>{evidence.quotePreview}</blockquote>
													<button
														type="button"
														aria-label="查看正文依据"
														onClick={() => props.onOpenEvidence?.({
															resourceId: evidence.resourceId,
															range: evidence.range
														})}
													>
														<ExternalLink size={16} />查看正文依据
													</button>
												</div>
											) : null}
											{candidate.conflicts.map(conflict => (
												<p className="extraction-conflict" key={`${conflict.code}:${conflict.message}`}>
													<AlertTriangle size={16} />{conflict.message}
												</p>
											))}
											<div className="extraction-candidate-actions">
												<span className="extraction-candidate-state">
													{candidate.status === 'accepted'
														? '已写入'
														: candidate.status === 'rejected'
															? '已拒绝'
															: candidate.conflicts.length
																? '需处理冲突'
																: '待作者确认'}
													<ChevronRight size={16} />
												</span>
												{candidate.status === 'pending' ? (
													<>
														<button
															type="button"
															aria-label="稍后整理"
															disabled={Boolean(resolvingCandidateId)}
															onClick={() => deferCandidate(batch, candidate)}
														>
															<Clock3 size={16} />稍后整理
														</button>
														<button
															type="button"
															aria-label="拒绝候选"
															disabled={
																props.readOnly
																|| Boolean(resolvingCandidateId)
															}
															onClick={() => void rejectCandidate(batch.id, candidate.id)}
														>
															{resolvingCandidateId === candidate.id
																? <LoaderCircle className="spin" size={16} />
																: <CircleStop size={16} />}
															拒绝
														</button>
													</>
												) : null}
											</div>
										</article>
									);
								})}
							</div>
						</section>
					))}
					{visibleCandidateCount === 0 ? (
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
