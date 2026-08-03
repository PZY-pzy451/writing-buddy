import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	BookOpenText,
	Check,
	GripVertical,
	LoaderCircle,
	LockKeyhole,
	LockKeyholeOpen,
	MessageCircleQuestion,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
	X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from '@writing-buddy/ai';
import { flattenChapters } from '@writing-buddy/domain';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { runGroundedJsonJob } from '../story/ai-context/GroundedAiRunner';
import { AiJobCancelButton } from '../story/ai-context/AiJobCancelButton';
import {
	addStoryElement,
	advanceCreationJourney,
	answerCreationGuidanceQuestion,
	confirmStoryCore,
	moveStoryElement,
	moveStoryOutlineNode,
	removeStoryElement,
	resolveJourneyImpact,
	selectStoryDirections,
	serializeCreationJourneyState,
	setCreationGuidanceQuestion,
	setGeneratedGenreOutline,
	setGeneratedStoryCore,
	setJourneyChapterProposals,
	setStoryDirections,
	setStoryOutline,
	toggleJourneyLock,
	updateJourneyChapterProposal,
	updateGenreToOutlineInput,
	updateStoryCore,
	updateStoryDirection,
	updateStoryElement,
	updateStoryOutlineNode,
	type CreationJourneyStage,
	type CreationJourneyState,
	type JourneyImpact,
	type StoryCore,
	type StoryElement
} from './CreationJourneyModel';
import { GenreToOutlineGenerationService } from './GenreToOutlineGenerationService';
import { GenreToOutlineStart } from './GenreToOutlineStart';
import { OutlineAlternativeGenerationService } from './OutlineAlternativeGenerationService';
import { OutlineHierarchyGenerationService } from './OutlineHierarchyGenerationService';
import {
	applyHierarchyExpansionPreview,
	buildHierarchyExpansionPreview,
	validateWritableHierarchy,
	type HierarchyExpansionPreview,
	type HierarchyExpansionTarget
} from './OutlineHierarchyExpansionModel';
import {
	applyOutlineCandidateSelection,
	createOutlineCandidatePreview,
	undoOutlineCandidateApply,
	type OutlineCandidateField,
	type OutlineCandidatePreview,
	type OutlineCandidateUndoReceipt,
	type OutlineGenerationStrategy,
	type OutlineImpactReport
} from './OutlineAuthorControlModel';
import { StructuredOutlineWorkspace } from './StructuredOutlineWorkspace';
import {
	createOutlineSemanticCheckInput,
	outlineQualityIssuesFromAi,
	runLocalOutlineChecks,
	type OutlineManuscriptState,
	type OutlineQualityIssue
} from './OutlineQualityCheckModel';
import {
	CreationJourneyStore,
	type LoadedCreationJourney
} from './CreationJourneyStore';

const stageOrder: readonly CreationJourneyStage[] = [
	'elements',
	'core',
	'directions',
	'outline',
	'chapters',
	'writing'
];

const stageCopy: Readonly<Record<CreationJourneyStage, {
	readonly short: string;
	readonly title: string;
	readonly description: string;
}>> = {
	elements: {
		short: '灵感',
		title: '先把脑中的碎片放下来',
		description: '记录 3–8 个要素。它们不需要完整，也不需要先分类成资料库。'
	},
	core: {
		short: '故事核心',
		title: '把碎片收束成一个故事核心',
		description: 'AI 只负责整理候选。每个字段都可以修改，确认权属于你。'
	},
	directions: {
		short: '故事方向',
		title: '比较三个真正不同的方向',
		description: '选择一个方向，或选择两个交给下一步合并。'
	},
	outline: {
		short: '故事总纲',
		title: '调整故事节点的顺序',
		description: '拖动节点，或使用上下移动按钮。总纲仍然是可编辑草稿。'
	},
	chapters: {
		short: '章节',
		title: '确认前三章怎样承接总纲',
		description: '确认后会一次性创建三章；任何一步失败都会回滚。'
	},
	writing: {
		short: '正文',
		title: '前三章已经准备好',
		description: '现在可以进入第一章，把计划变成真正的正文。'
	}
};

const elementCategories: readonly {
	readonly id: StoryElement['category'];
	readonly label: string;
}[] = [
	{ id: 'character', label: '人物' },
	{ id: 'place', label: '地点' },
	{ id: 'object', label: '物品' },
	{ id: 'event', label: '事件' },
	{ id: 'mood', label: '氛围' },
	{ id: 'theme', label: '主题' },
	{ id: 'question', label: '疑问' },
	{ id: 'other', label: '其他' }
];

const coreFields: readonly {
	readonly key: Exclude<keyof StoryCore, 'confirmedAt'>;
	readonly label: string;
	readonly placeholder: string;
	readonly multiline?: boolean;
}[] = [
	{ key: 'oneSentence', label: '一句话故事', placeholder: '谁必须做什么，否则会失去什么？', multiline: true },
	{ key: 'protagonist', label: '主角', placeholder: '主角是谁，现在处于什么状态？' },
	{ key: 'goal', label: '目标', placeholder: '主角真正想完成什么？' },
	{ key: 'obstacle', label: '核心阻力', placeholder: '什么持续阻止主角？', multiline: true },
	{ key: 'stakes', label: '失败代价', placeholder: '失败会失去什么？', multiline: true },
	{ key: 'mystery', label: '核心悬念', placeholder: '读者最想知道的答案是什么？', multiline: true },
	{ key: 'readerExperience', label: '读者体验', placeholder: '希望读者感到什么？' },
	{ key: 'endingDirection', label: '结局方向', placeholder: '故事最终倾向怎样的选择或代价？', multiline: true }
];

function coreForAi(core: StoryCore): Omit<StoryCore, 'confirmedAt'> {
	return {
		oneSentence: core.oneSentence,
		protagonist: core.protagonist,
		goal: core.goal,
		obstacle: core.obstacle,
		stakes: core.stakes,
		mystery: core.mystery,
		readerExperience: core.readerExperience,
		endingDirection: core.endingDirection
	};
}

type JourneyStageAiOperation =
	| 'organize-core'
	| 'generate-directions'
	| 'generate-outline'
	| 'split-chapters';

type GuidanceQuestionInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-guidance-question' }
>;

type RegeneratePartInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'regenerate-part' }
>;

type GenerateOutlineAlternativesInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-outline-alternatives' }
>;

function journeyId(
	prefix:
		| 'journey-direction'
		| 'journey-outline'
		| 'journey-chapter'
		| 'journey-question'
		| 'journey-option'
): string {
	return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

function directionForAi(direction: CreationJourneyState['directions'][number]) {
	return {
		title: direction.title,
		premise: direction.premise,
		centralConflict: direction.centralConflict,
		endingPromise: direction.endingPromise,
		tone: direction.tone
	};
}

function outlineForAi(node: CreationJourneyState['outline'][number]) {
	return {
		title: node.title,
		summary: node.summary,
		purpose: node.purpose
	};
}

function outlineCandidateForAi(
	node: CreationJourneyState['outline'][number]
): GenerateOutlineAlternativesInput['target']['current'] {
	return {
		title: node.title,
		summary: node.summary,
		purpose: node.purpose,
		goal: node.goal ?? '',
		conflict: node.conflict ?? '',
		outcome: node.outcome ?? '',
		hook: node.hook ?? '',
		povHint: node.povHint ?? ''
	};
}

function outlineNeighborForAi(node: CreationJourneyState['outline'][number]) {
	return {
		title: node.title,
		summary: node.summary,
		purpose: node.purpose
	};
}

function chapterForAi(chapter: CreationJourneyState['chapters'][number]) {
	return {
		title: chapter.title,
		goal: chapter.goal,
		summary: chapter.summary,
		sourceNodeIds: [...chapter.sourceNodeIds]
	};
}

function guidanceAnswersForAi(state: CreationJourneyState) {
	return state.guidance.answers.slice(-12).map(answer => ({
		stage: answer.stage,
		answerText: answer.answerText
	}));
}

function lockedDecisionsForAi(state: CreationJourneyState) {
	return [
		...state.elements
			.filter(element => element.locked)
			.map(element => ({
				key: `element:${element.id}`,
				content: `${element.category}:${element.text}`
			})),
		...state.locks.coreFields.map(field => ({
			key: `core:${field}`,
			content: state.core[field]
		})),
		...state.locks.directionIds.flatMap(id => {
			const direction = state.directions.find(candidate => candidate.id === id);
			return direction ? [{
				key: `direction:${id}`,
				content: JSON.stringify(directionForAi(direction))
			}] : [];
		}),
		...state.locks.outlineNodeIds.flatMap(id => {
			const node = state.outline.find(candidate => candidate.id === id);
			return node ? [{
				key: `outline:${id}`,
				content: JSON.stringify(outlineForAi(node))
			}] : [];
		}),
		...state.locks.chapterIds.flatMap(id => {
			const chapter = state.chapters.find(candidate => candidate.id === id);
			return chapter ? [{
				key: `chapter:${id}`,
				content: JSON.stringify(chapterForAi(chapter))
			}] : [];
		})
	].slice(0, 24);
}

function guidanceContextForAi(state: CreationJourneyState): GuidanceQuestionInput['context'] {
	const elements = state.elements
		.filter(element => element.text.trim())
		.map(element => ({ category: element.category, text: element.text.trim() }));
	const coreComplete = Object.values(coreForAi(state.core)).every(value => value.trim());
	const directions = state.directions
		.filter(direction => Object.values(directionForAi(direction)).every(value => value.trim()))
		.map(directionForAi);
	const outline = state.outline
		.filter(node => Object.values(outlineForAi(node)).every(value => value.trim()))
		.map(outlineForAi);
	const chapters = state.chapters
		.filter(chapter => (
			chapter.title.trim()
			&& chapter.goal.trim()
			&& chapter.summary.trim()
		))
		.map(chapterForAi);
	return {
		...(elements.length >= 3 ? { elements } : {}),
		...(coreComplete ? { core: coreForAi(state.core) } : {}),
		...(directions.length > 0 ? { directions } : {}),
		...(outline.length > 0 ? { outline } : {}),
		...(chapters.length > 0 ? { chapters } : {})
	};
}

function impactTargetLabel(state: CreationJourneyState, impact: JourneyImpact): string {
	if (impact.targetKind === 'direction') {
		return state.directions.find(item => item.id === impact.targetId)?.title ?? '故事方向';
	}
	if (impact.targetKind === 'outline') {
		return state.outline.find(item => item.id === impact.targetId)?.title ?? '故事节点';
	}
	return state.chapters.find(item => item.id === impact.targetId)?.title ?? '章节提案';
}

function journeyErrorCopy(error: unknown): string {
	const code = error instanceof Error ? error.message.split(':')[0] : '';
	const copy: Readonly<Record<string, string>> = {
		creationJourneyTargetLocked: '这项决定已锁定。请先解锁，再修改或让 AI 重生成。',
		creationJourneyGuidanceQuestionInvalid: 'AI 返回的问题不完整，请重新生成。',
		creationJourneyGuidanceAnswerInvalid: '请选择一个答案，或填写你的自定义答案。',
		creationJourneyImpactNotPending: '这项影响已经处理，无需重复操作。',
		creationJourneyMaterializedChapterLocked: '章节正文已经创建，AI 不会自动重写；请保留当前内容并在正文中手动调整。',
		creationJourneyElementsIncomplete: '请先填写至少 3 个非空灵感要素。',
		creationJourneyCoreIncomplete: '故事核心还有空白字段，请补充或修改后再确认。',
		creationJourneyCoreConfirmationRequired: '请先确认故事核心。',
		creationJourneyDirectionDecisionRequired: '请先选择一个方向，或选择两个方向合并。',
		creationJourneyOutlineRequired: '故事总纲尚未准备好，不能拆分章节。',
		creationJourneyDirectionsInvalid: 'AI 返回的三个方向结构不完整，请重试。',
		creationJourneyOutlineInvalid: 'AI 返回的总纲结构不完整，请重试。',
		creationJourneyChaptersInvalid: 'AI 返回的章节结构不完整，请重试。',
		creationJourneyGenreRequired: '请先填写题材；其他条件都可以留空。',
		creationJourneyGenreInputInvalid: '题材条件超出允许范围，请缩短后重试。',
		invalidCreationJourneyResponse: 'AI 返回的结构未通过校验；已尝试修复一次，草稿和项目未改变。',
		outlineCandidateStale: '节点在候选生成后已改变，请重新生成候选。',
		outlineCandidateUndoStale: '采用后又发生了新修改，无法安全撤销本次 AI 采用。',
		outlineCandidateSelectionRequired: '请至少选择一个发生变化的字段。',
		outlineHierarchyTargetInvalid: '请选择可拆分的故事、卷或章节节点。',
		outlineHierarchyAlreadyMaterialized: '这个层级已经建立，已有内容不会被重复生成或覆盖。',
		outlineHierarchyCandidateCountInvalid: 'AI 返回的拆分数量不符合要求；已尝试修复一次，请重试。',
		outlineHierarchyDuplicateId: '拆分候选包含重复节点，请重新生成。',
		outlineHierarchyExpansionConflict: '候选与现有同级节点重名，请调整条件后重新生成。',
		outlineHierarchyPreviewStale: '结构在预览后发生变化，请重新生成拆分候选。',
		outlineHierarchyIncomplete: '每个卷都需要章节，每个章节都需要至少一个场景。',
		outlineHierarchyLocked: '当前结构包含锁定节点，不会覆盖；请先解除锁定再创建正文。',
		outlineHierarchyCanonicalConflict: '项目中已存在同名卷或章节，不会覆盖；请先修改名称。',
		outlineHierarchyMaterializationInvalid: '当前卷、章、场景结构无法安全创建。',
		outlineHierarchyMaterializationFailed: '卷、章、场景创建失败，项目已保持原状。',
		outlineHierarchyWriteFailed: '写入卷、章或场景时失败，项目已自动回滚。',
		outlineHierarchyVerificationFailed: '写入后的完整性检查失败，项目已自动回滚。',
		invalidSnapshotReason: '安全快照创建失败；候选尚未写入。',
		outlineSemanticCheckUnavailable: '请先补全结构化大纲，再运行语义检查。',
		invalidCreationJourneyInput: '大纲内容过长或包含不安全字段，无法发送给 AI 检查。',
		externalChange: '创作旅程已在其他窗口修改，请重新打开作品。',
		cancelled: '已取消本次 AI 请求，没有改动旅程。'
	};
	return copy[code] ?? (error instanceof Error ? error.message : '暂时无法完成这个操作。');
}

export function CreationJourneyPage(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const preferredStartRoute = useAppStore(state => state.creationJourneyStartRoute);
	const materialize = useAppStore(state => state.materializeCreationJourney);
	const materializeHierarchy = useAppStore(state => state.materializeOutlineHierarchy);
	const openResource = useAppStore(state => state.openResource);
	const setMode = useAppStore(state => state.setMode);
	const [state, setState] = useState<CreationJourneyState>();
	const [hash, setHash] = useState('');
	const [status, setStatus] = useState('正在读取创作旅程…');
	const [error, setError] = useState<string>();
	const [busyOperation, setBusyOperation] = useState<CreationJourneyAiInput['operation']>();
	const [jobId, setJobId] = useState<string>();
	const [draggedOutlineIndex, setDraggedOutlineIndex] = useState<number>();
	const [guidanceChoiceId, setGuidanceChoiceId] = useState<string>();
	const [customGuidanceAnswer, setCustomGuidanceAnswer] = useState('');
	const [impactPanelOpen, setImpactPanelOpen] = useState(false);
	const [impactSummaryDismissed, setImpactSummaryDismissed] = useState(false);
	const [busyImpactId, setBusyImpactId] = useState<string>();
	const [outlineAlternativeUndo, setOutlineAlternativeUndo] =
		useState<OutlineCandidateUndoReceipt>();
	const headingRef = useRef<HTMLHeadingElement>(null);
	const impactCloseRef = useRef<HTMLButtonElement>(null);
	const impactDialogRef = useRef<HTMLDivElement>(null);
	const impactOpenerRef = useRef<HTMLButtonElement>(null);
	const storeRef = useRef<CreationJourneyStore | undefined>(undefined);
	const loadedRef = useRef<LoadedCreationJourney | undefined>(undefined);
	const stateRef = useRef<CreationJourneyState | undefined>(undefined);
	const saveTimerRef = useRef<number | undefined>(undefined);
	const saveChainRef = useRef<Promise<void>>(Promise.resolve());
	const genreGenerationRequestRef = useRef(false);
	const genreCancellationRequestedRef = useRef(false);
	const genreCancellationGuardRef = useRef(false);
	const outlineAlternativeRequestRef = useRef(false);
	const hierarchyGenerationRequestRef = useRef(false);
	const outlineSemanticCheckRequestRef = useRef(false);

	useEffect(() => {
		if (!snapshot) return;
		let active = true;
		const store = new CreationJourneyStore(
			snapshot.root,
			snapshot.project.projectId,
			desktopBridge,
			undefined,
			preferredStartRoute
		);
		storeRef.current = store;
		void store.load().then(loaded => {
			if (!active) return;
			loadedRef.current = loaded;
			stateRef.current = loaded.state;
			setState(loaded.state);
			setHash(loaded.hash);
			setStatus(loaded.hash ? '已从项目恢复' : '尚未写入 AI 内容');
			if (!loaded.hash && !snapshot.readOnly) {
				const initialize = store.save(loaded, loaded.state).then(saved => {
					if (!active) return;
					loadedRef.current = saved;
					setHash(saved.hash);
					setStatus('创作旅程已保存到项目');
				}).catch(reason => {
					if (!active) return;
					setError(journeyErrorCopy(reason));
					setStatus('创作旅程初始化保存失败');
				});
				saveChainRef.current = initialize.then(() => undefined);
			}
		}).catch(reason => {
			if (!active) return;
			setError(journeyErrorCopy(reason));
			setStatus('无法读取创作旅程');
		});
		return () => {
			active = false;
			window.clearTimeout(saveTimerRef.current);
		};
	}, [preferredStartRoute, snapshot]);

	useEffect(() => {
		headingRef.current?.focus();
	}, [state?.stage]);

	const pendingImpactCount = state?.impacts.filter(impact => impact.status === 'pending').length ?? 0;

	useEffect(() => {
		if (!impactPanelOpen) return;
		impactCloseRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setImpactPanelOpen(false);
				window.setTimeout(() => impactOpenerRef.current?.focus());
				return;
			}
			if (event.key !== 'Tab') return;
			const focusable = Array.from(
				impactDialogRef.current?.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
				) ?? []
			);
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [impactPanelOpen]);

	const persistLatest = (): Promise<void> => {
		window.clearTimeout(saveTimerRef.current);
		const task = saveChainRef.current.then(async () => {
			const store = storeRef.current;
			const loaded = loadedRef.current;
			const latest = stateRef.current;
			if (!store || !loaded || !latest || latest.revision <= loaded.state.revision) return;
			setStatus('正在保存到项目…');
			try {
				const saved = await store.save(loaded, latest);
				loadedRef.current = saved;
				setHash(saved.hash);
				setStatus('已保存到项目');
				setError(undefined);
			} catch (reason) {
				setStatus('保存失败');
				setError(journeyErrorCopy(reason));
				throw reason;
			}
		});
		saveChainRef.current = task.catch(() => undefined);
		return task;
	};

	const applyState = (next: CreationJourneyState, immediate = false) => {
		const previousPending = stateRef.current?.impacts
			.filter(impact => impact.status === 'pending').length ?? 0;
		const nextPending = next.impacts.filter(impact => impact.status === 'pending').length;
		if (nextPending > previousPending) setImpactSummaryDismissed(false);
		stateRef.current = next;
		setState(next);
		setStatus('有尚未写入项目的更改');
		window.clearTimeout(saveTimerRef.current);
		if (immediate) {
			void persistLatest();
		} else {
			saveTimerRef.current = window.setTimeout(() => void persistLatest(), 320);
		}
	};

	const goToStage = (stage: CreationJourneyStage) => {
		if (!stateRef.current) return;
		try {
			applyState(advanceCreationJourney(stateRef.current, stage), true);
			setError(undefined);
		} catch (reason) {
			setError(journeyErrorCopy(reason));
		}
	};

	const runGenreToOutline = async () => {
		const current = stateRef.current;
		if (
			!current?.genreInput
			|| genreGenerationRequestRef.current
			|| busyOperation
		) {
			return;
		}
		if (!current.genreInput.genre.trim()) {
			setError(journeyErrorCopy(new Error('creationJourneyGenreRequired')));
			return;
		}
		genreGenerationRequestRef.current = true;
		genreCancellationRequestedRef.current = false;
		setBusyOperation('generate-from-genre');
		setError(undefined);
		setStatus('正在整理题材');
		try {
			await persistLatest();
			if (genreCancellationRequestedRef.current) throw new Error('cancelled');
			const brief = current.genreInput;
			const input: Extract<
				CreationJourneyAiInput,
				{ readonly operation: 'generate-from-genre' }
			> = {
				schemaVersion: 1,
				operation: 'generate-from-genre',
				genre: brief.genre.trim(),
				...(brief.premise?.trim() ? { premise: brief.premise.trim() } : {}),
				...(brief.scale ? { scale: brief.scale } : {}),
				tones: [...brief.tones],
				protagonistHints: [...brief.protagonistHints],
				requiredElements: [...brief.requiredElements],
				excludedElements: [...brief.excludedElements],
				...(brief.endingPreference
					? { endingPreference: brief.endingPreference }
					: {}),
				...(brief.audience?.trim() ? { audience: brief.audience.trim() } : {}),
				...(brief.structureTemplateId
					? { structureTemplateId: brief.structureTemplateId }
					: {})
			};
			const service = new GenreToOutlineGenerationService(async request => {
				if (request.repairAttempt === 1) {
					setStatus('正在校验并修复大纲结构（最后一次）');
				}
				const result = await runGroundedJsonJob({
					jobType: 'creation-journey',
					messages: buildCreationJourneyMessages(request),
					onJobId: id => {
						setJobId(id);
						if (id && genreCancellationRequestedRef.current) {
							void desktopBridge.cancelAiJob(id).then(accepted => {
								if (!accepted) {
									genreCancellationGuardRef.current = false;
									setError('没有找到正在生成的任务，请稍候后重试取消。');
								}
							}).catch(reason => {
								genreCancellationGuardRef.current = false;
								setError(journeyErrorCopy(reason));
							});
						}
					},
					onProgress: progress => {
						if (progress.state === 'thinking') {
							setStatus('正在构建故事核心');
						}
						if (progress.state === 'streaming') {
							setStatus('正在生成结构节点');
						}
					}
				});
				return result.output;
			});
			const response = await service.generate(input);
			const latest = stateRef.current;
			if (!latest) return;
			setStatus('正在校验大纲');
			const next = setGeneratedGenreOutline(latest, {
				outline: response.outline,
				storyBeats: response.storyBeats,
				suggestedCharacters: response.suggestedCharacters,
				suggestedWorldRules: response.suggestedWorldRules,
				warnings: response.warnings
			});
			applyState(next, true);
			setStatus('结构化大纲已保存为可编辑草稿');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus(
				reason instanceof Error && reason.message === 'cancelled'
					? '生成已取消；题材草稿保持不变'
					: '生成未写入；题材草稿保持不变'
			);
		} finally {
			genreGenerationRequestRef.current = false;
			genreCancellationRequestedRef.current = false;
			genreCancellationGuardRef.current = false;
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const cancelAi = async () => {
		if (genreCancellationGuardRef.current) return;
		genreCancellationGuardRef.current = true;
		genreCancellationRequestedRef.current = true;
		setError(undefined);
		try {
			if (!jobId) return;
			const accepted = await desktopBridge.cancelAiJob(jobId);
			if (!accepted) {
				genreCancellationGuardRef.current = false;
				setError('没有找到正在生成的任务，请稍候后重试取消。');
			}
		} catch (reason) {
			genreCancellationGuardRef.current = false;
			setError(journeyErrorCopy(reason));
		}
	};

	const runAi = async (operation: JourneyStageAiOperation) => {
		const current = stateRef.current;
		if (!current || busyOperation) return;
		setError(undefined);
		try {
			await persistLatest();
			const development = {
				guidanceAnswers: guidanceAnswersForAi(current),
				lockedDecisions: lockedDecisionsForAi(current)
			};
			const input: CreationJourneyAiInput = (() => {
				if (operation === 'organize-core') {
					return {
						schemaVersion: 1,
						operation,
						elements: current.elements.map(element => ({
							category: element.category,
							text: element.text.trim()
						})),
						...development
					};
				}
				const core = coreForAi(current.core);
				if (operation === 'generate-directions') {
					return { schemaVersion: 1, operation, core, ...development };
				}
				const selectedDirections = current.selectedDirectionIds.map(id => {
					const direction = current.directions.find(candidate => candidate.id === id);
					if (!direction) throw new Error('creationJourneyDirectionDecisionRequired');
					return directionForAi(direction);
				});
				if (operation === 'generate-outline') {
					return {
						schemaVersion: 1,
						operation,
						core,
						selectedDirections,
						...development
					};
				}
				return {
					schemaVersion: 1,
					operation,
					core,
					selectedDirections,
					outline: current.outline.map(outlineForAi),
					...development
				};
			})();
			const messages = buildCreationJourneyMessages(input);
			setBusyOperation(operation);
			setStatus('AI 正在生成候选，不会自动写入下一阶段…');
			const result = await runGroundedJsonJob({
				jobType: 'creation-journey',
				messages,
				onJobId: setJobId,
				onProgress: progress => {
					if (progress.state === 'thinking') setStatus('AI 正在思考当前这一步…');
					if (progress.state === 'streaming') setStatus('AI 正在返回结构化候选…');
				}
			});
			const response = parseCreationJourneyResponse(result.output, input);
			if (response.operation !== operation) {
				throw new Error('invalidCreationJourneyResponse');
			}
			const latest = stateRef.current;
			if (!latest) return;
			let next: CreationJourneyState;
			switch (response.operation) {
				case 'organize-core':
					next = setGeneratedStoryCore(latest, response.core);
					break;
				case 'generate-directions':
					next = setStoryDirections(latest, response.directions.map(direction => ({
						id: journeyId('journey-direction'),
						...direction
					})));
					break;
				case 'generate-outline':
					next = setStoryOutline(latest, response.nodes.map(node => ({
						id: journeyId('journey-outline'),
						...node
					})));
					break;
				case 'split-chapters':
					next = setJourneyChapterProposals(latest, response.chapters.map(chapter => {
						const sourceNodeIds = chapter.sourceNodeIndexes.map(index => latest.outline[index]?.id);
						if (sourceNodeIds.some(id => !id)) {
							throw new Error('invalidCreationJourneyResponse');
						}
						return {
							id: journeyId('journey-chapter'),
							title: chapter.title,
							goal: chapter.goal,
							summary: chapter.summary,
							sourceNodeIds
						};
					}));
					break;
			}
			applyState(next, true);
			setStatus('候选已加入旅程，请编辑并确认');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('本次候选未写入');
		} finally {
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const runGuidanceQuestion = async () => {
		const current = stateRef.current;
		if (!current || busyOperation || current.stage === 'writing') return;
		setError(undefined);
		try {
			const context = guidanceContextForAi(current);
			if (Object.keys(context).length === 0) {
				throw new Error('creationJourneyElementsIncomplete');
			}
			await persistLatest();
			const input: GuidanceQuestionInput = {
				schemaVersion: 1,
				operation: 'generate-guidance-question',
				stage: current.stage,
				context,
				guidanceAnswers: guidanceAnswersForAi(current),
				lockedDecisions: lockedDecisionsForAi(current)
			};
			setBusyOperation(input.operation);
			setStatus('AI 正在寻找当前最值得回答的一个问题…');
			const result = await runGroundedJsonJob({
				jobType: 'creation-journey',
				messages: buildCreationJourneyMessages(input),
				onJobId: setJobId,
				onProgress: progress => {
					if (progress.state === 'thinking') setStatus('AI 正在判断哪项选择最能推进故事…');
					if (progress.state === 'streaming') setStatus('AI 正在返回三个可比较的答案…');
				}
			});
			const response = parseCreationJourneyResponse(result.output, input);
			if (response.operation !== 'generate-guidance-question') {
				throw new Error('invalidCreationJourneyResponse');
			}
			const latest = stateRef.current;
			if (!latest) return;
			setGuidanceChoiceId(undefined);
			setCustomGuidanceAnswer('');
			applyState(setCreationGuidanceQuestion(latest, {
				id: journeyId('journey-question'),
				stage: current.stage,
				prompt: response.question.prompt,
				rationale: response.question.rationale,
				options: response.question.options.map(option => ({
					id: journeyId('journey-option'),
					label: option.label,
					description: option.description
				})) as [
					{ id: string; label: string; description: string },
					{ id: string; label: string; description: string },
					{ id: string; label: string; description: string }
				]
			}), true);
			setStatus('问题已保存到项目；请选择或写下你的答案。');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('本次问题未写入');
		} finally {
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const confirmGuidanceAnswer = () => {
		const current = stateRef.current;
		if (!current?.guidance.currentQuestion) return;
		try {
			const next = customGuidanceAnswer.trim()
				? answerCreationGuidanceQuestion(current, {
					source: 'custom',
					answerText: customGuidanceAnswer
				})
				: answerCreationGuidanceQuestion(current, {
					source: 'option',
					optionId: guidanceChoiceId ?? ''
				});
			applyState(next, true);
			setGuidanceChoiceId(undefined);
			setCustomGuidanceAnswer('');
			setStatus('你的答案已保存；它会作为后续 AI 建议的约束。');
			setError(undefined);
		} catch (reason) {
			setError(journeyErrorCopy(reason));
		}
	};

	const closeImpactPanel = () => {
		setImpactPanelOpen(false);
		window.setTimeout(() => impactOpenerRef.current?.focus());
	};

	const keepImpact = (impact: JourneyImpact) => {
		const current = stateRef.current;
		if (!current) return;
		try {
			applyState(resolveJourneyImpact(current, impact.id, 'kept'), true);
			setStatus('已保留当前内容；只处理了这一项影响。');
			setError(undefined);
		} catch (reason) {
			setError(journeyErrorCopy(reason));
		}
	};

	const buildRegenerateInput = (
		current: CreationJourneyState,
		impact: JourneyImpact
	): RegeneratePartInput => {
		const development = {
			guidanceAnswers: guidanceAnswersForAi(current),
			lockedDecisions: lockedDecisionsForAi(current)
		};
		if (impact.targetKind === 'direction') {
			const direction = current.directions.find(item => item.id === impact.targetId);
			if (!direction) throw new Error('creationJourneyDirectionNotFound');
			return {
				schemaVersion: 1,
				operation: 'regenerate-part',
				target: {
					kind: 'direction',
					id: direction.id,
					current: directionForAi(direction),
					context: { core: coreForAi(current.core) }
				},
				...development
			};
		}
		const selectedDirections = current.selectedDirectionIds.map(id => {
			const direction = current.directions.find(item => item.id === id);
			if (!direction) throw new Error('creationJourneyDirectionDecisionRequired');
			return directionForAi(direction);
		});
		if (impact.targetKind === 'outline') {
			const node = current.outline.find(item => item.id === impact.targetId);
			if (!node) throw new Error('creationJourneyOutlineNodeNotFound');
			return {
				schemaVersion: 1,
				operation: 'regenerate-part',
				target: {
					kind: 'outline',
					id: node.id,
					current: outlineForAi(node),
					context: {
						core: coreForAi(current.core),
						selectedDirections
					}
				},
				...development
			};
		}
		const chapter = current.chapters.find(item => item.id === impact.targetId);
		if (!chapter) throw new Error('creationJourneyChapterNotFound');
		if (chapter.resourceId) throw new Error('creationJourneyMaterializedChapterLocked');
		return {
			schemaVersion: 1,
			operation: 'regenerate-part',
			target: {
				kind: 'chapter',
				id: chapter.id,
				current: chapterForAi(chapter),
				context: {
					core: coreForAi(current.core),
					selectedDirections,
					outline: current.outline.map(node => ({
						id: node.id,
						...outlineForAi(node)
					}))
				}
			},
			...development
		};
	};

	const regenerateImpact = async (impact: JourneyImpact) => {
		const current = stateRef.current;
		if (!current || busyOperation) return;
		setError(undefined);
		try {
			await persistLatest();
			const input = buildRegenerateInput(current, impact);
			setBusyOperation('regenerate-part');
			setBusyImpactId(impact.id);
			setStatus(`AI 正在只重生成“${impactTargetLabel(current, impact)}”…`);
			const result = await runGroundedJsonJob({
				jobType: 'creation-journey',
				messages: buildCreationJourneyMessages(input),
				onJobId: setJobId,
				onProgress: progress => {
					if (progress.state === 'thinking') setStatus('AI 正在保留锁定决定并检查上游约束…');
					if (progress.state === 'streaming') setStatus('AI 正在返回这一项的替换候选…');
				}
			});
			const response = parseCreationJourneyResponse(result.output, input);
			if (response.operation !== 'regenerate-part') {
				throw new Error('invalidCreationJourneyResponse');
			}
			const latest = stateRef.current;
			if (!latest) return;
			let next: CreationJourneyState;
			if (response.target.kind === 'direction') {
				next = updateStoryDirection(
					latest,
					response.target.id,
					response.target.replacement
				);
			} else if (response.target.kind === 'outline') {
				next = updateStoryOutlineNode(
					latest,
					response.target.id,
					response.target.replacement
				);
			} else {
				next = updateJourneyChapterProposal(
					latest,
					response.target.id,
					response.target.replacement
				);
			}
			applyState(next, true);
			setStatus('这一项已更新；其他受影响内容保持原样。');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('这一项未更新，原内容保持不变。');
		} finally {
			setBusyImpactId(undefined);
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const generateOutlineAlternatives = async (
		nodeId: string,
		strategy: OutlineGenerationStrategy
	): Promise<OutlineCandidatePreview> => {
		const current = stateRef.current;
		if (
			!current?.storyOutline
			|| busyOperation
			|| outlineAlternativeRequestRef.current
		) {
			throw new Error('outlineCandidateGenerationBusy');
		}
		if (current.locks.outlineNodeIds.includes(nodeId)) {
			throw new Error('creationJourneyTargetLocked');
		}
		const targetIndex = current.outline.findIndex(node => node.id === nodeId);
		const target = current.outline[targetIndex];
		if (!target) throw new Error('creationJourneyOutlineNodeNotFound');
		outlineAlternativeRequestRef.current = true;
		setBusyOperation('generate-outline-alternatives');
		setError(undefined);
		setStatus(`AI 正在为“${target.title}”生成三个局部候选…`);
		try {
			await persistLatest();
			const latest = stateRef.current;
			if (!latest?.storyOutline || latest.revision !== current.revision) {
				throw new Error('outlineCandidateStale');
			}
			const latestTarget = latest.outline[targetIndex];
			if (!latestTarget || latestTarget.id !== nodeId) {
				throw new Error('outlineCandidateStale');
			}
			const root = latest.storyOutline;
			const previous = latest.outline[targetIndex - 1];
			const next = latest.outline[targetIndex + 1];
			const input: GenerateOutlineAlternativesInput = {
				schemaVersion: 1,
				operation: 'generate-outline-alternatives',
				strategy,
				target: {
					id: latestTarget.id,
					current: outlineCandidateForAi(latestTarget),
					context: {
						story: {
							genre: root.genre,
							premise: root.premise,
							...(root.themePromise
								? { themePromise: root.themePromise }
								: {}),
							...(root.protagonistGoal
								? { protagonistGoal: root.protagonistGoal }
								: {}),
							...(root.centralConflict
								? { centralConflict: root.centralConflict }
								: {}),
							...(root.stakes ? { stakes: root.stakes } : {}),
							...(root.mysteryQuestion
								? { mysteryQuestion: root.mysteryQuestion }
								: {}),
							...(root.endingDirection
								? { endingDirection: root.endingDirection }
								: {})
						},
						...(previous ? { previous: outlineNeighborForAi(previous) } : {}),
						...(next ? { next: outlineNeighborForAi(next) } : {})
					}
				},
				guidanceAnswers: guidanceAnswersForAi(latest),
				lockedDecisions: lockedDecisionsForAi(latest)
			};
			const service = new OutlineAlternativeGenerationService(async request => {
				if (request.repairAttempt === 1) {
					setStatus('正在校验并修复三个候选的字段结构（最后一次）');
				}
				const result = await runGroundedJsonJob({
					jobType: 'creation-journey',
					messages: buildCreationJourneyMessages(request),
					onJobId: setJobId,
					onProgress: progress => {
						if (progress.state === 'thinking') {
							setStatus('AI 正在保留锁定决定并比较相邻节点…');
						}
						if (progress.state === 'streaming') {
							setStatus('AI 正在返回三个可逐字段比较的候选…');
						}
					}
				});
				return result.output;
			});
			const response = await service.generate(input);
			const unchanged = stateRef.current;
			if (!unchanged || unchanged.revision !== latest.revision) {
				throw new Error('outlineCandidateStale');
			}
			const preview = createOutlineCandidatePreview(
				unchanged,
				response.targetId,
				response.alternatives
			);
			setStatus('三个候选已就绪；尚未写入任何字段。');
			return preview;
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('局部候选未写入，原节点保持不变。');
			throw reason;
		} finally {
			outlineAlternativeRequestRef.current = false;
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const applyOutlineAlternative = async (
		preview: OutlineCandidatePreview,
		alternativeIndex: number,
		fields: readonly OutlineCandidateField[]
	): Promise<OutlineImpactReport> => {
		const projectSnapshot = snapshot;
		if (!projectSnapshot) throw new Error('creationJourneyStateInvalid');
		if (projectSnapshot.readOnly) throw new Error('projectReadOnly');
		setError(undefined);
		setStatus('正在校验版本并创建安全快照…');
		try {
			await persistLatest();
			const beforeSnapshot = stateRef.current;
			if (!beforeSnapshot) throw new Error('creationJourneyStateInvalid');
			applyOutlineCandidateSelection(
				beforeSnapshot,
				preview,
				alternativeIndex,
				fields
			);
			await desktopBridge.createSnapshot(
				projectSnapshot.root,
				'beforeDestructiveOperation',
				`AI 大纲局部采用 · ${fields.length} 个字段`
			);
			const current = stateRef.current;
			const store = storeRef.current;
			const loaded = loadedRef.current;
			if (!current || !store || !loaded) {
				throw new Error('creationJourneyStateInvalid');
			}
			const result = applyOutlineCandidateSelection(
				current,
				preview,
				alternativeIndex,
				fields
			);
			const saved = await store.save(loaded, result.state);
			loadedRef.current = saved;
			stateRef.current = saved.state;
			setState(saved.state);
			setHash(saved.hash);
			setOutlineAlternativeUndo(result.undo);
			setStatus('已创建安全快照并原子写入所选字段。');
			return result.impact;
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('候选未写入，项目内容保持不变。');
			throw reason;
		}
	};

	const undoOutlineAlternative = async (): Promise<void> => {
		const receipt = outlineAlternativeUndo;
		if (!receipt) throw new Error('outlineCandidateUndoStale');
		const projectSnapshot = snapshot;
		if (!projectSnapshot) throw new Error('creationJourneyStateInvalid');
		if (projectSnapshot.readOnly) throw new Error('projectReadOnly');
		setError(undefined);
		setStatus('正在撤销本次 AI 采用…');
		try {
			await persistLatest();
			const beforeSnapshot = stateRef.current;
			if (!beforeSnapshot) throw new Error('creationJourneyStateInvalid');
			undoOutlineCandidateApply(beforeSnapshot, receipt);
			await desktopBridge.createSnapshot(
				projectSnapshot.root,
				'beforeDestructiveOperation',
				'撤销 AI 大纲局部采用'
			);
			const current = stateRef.current;
			const store = storeRef.current;
			const loaded = loadedRef.current;
			if (!current || !store || !loaded) {
				throw new Error('creationJourneyStateInvalid');
			}
			const restored = undoOutlineCandidateApply(current, receipt);
			const saved = await store.save(loaded, restored);
			loadedRef.current = saved;
			stateRef.current = saved.state;
			setState(saved.state);
			setHash(saved.hash);
			setOutlineAlternativeUndo(undefined);
			setStatus('已撤销本次 AI 采用；其他内容保持不变。');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('无法安全撤销；当前项目内容未改变。');
			throw reason;
		}
	};

	const generateHierarchyExpansion = async (
		target: HierarchyExpansionTarget,
		expectedCount: number
	): Promise<HierarchyExpansionPreview> => {
		if (hierarchyGenerationRequestRef.current) {
			throw new Error('aiGenerationInProgress');
		}
		const current = stateRef.current;
		if (!current?.storyOutline) throw new Error('creationJourneyOutlineRequired');
		if (snapshot?.readOnly) throw new Error('projectReadOnly');
		hierarchyGenerationRequestRef.current = true;
		setError(undefined);
		const operation = target.kind === 'story'
			? 'expand-to-volumes'
			: target.kind === 'volume'
				? 'expand-volume-to-chapters'
				: 'expand-chapter-to-scenes';
		setBusyOperation(operation);
		setStatus(target.kind === 'story'
			? '正在构建卷结构候选…'
			: target.kind === 'volume'
				? '正在拆分章节候选…'
				: '正在拆分场景候选…');
		try {
			const root = current.storyOutline;
			const story = {
				genre: root.genre,
				premise: root.premise,
				...(root.themePromise ? { themePromise: root.themePromise } : {}),
				...(root.protagonistGoal ? { protagonistGoal: root.protagonistGoal } : {}),
				...(root.centralConflict ? { centralConflict: root.centralConflict } : {}),
				...(root.stakes ? { stakes: root.stakes } : {}),
				...(root.mysteryQuestion ? { mysteryQuestion: root.mysteryQuestion } : {}),
				...(root.endingDirection ? { endingDirection: root.endingDirection } : {})
			};
			const parent = target.kind === 'story'
				? undefined
				: current.outline.find(node => node.id === target.id);
			if (target.kind !== 'story' && (!parent || parent.type !== target.kind)) {
				throw new Error('outlineHierarchyTargetInvalid');
			}
			const input = target.kind === 'story'
				? {
						schemaVersion: 1 as const,
						operation: 'expand-to-volumes' as const,
						expectedCount,
						story,
						storyBeats: current.outline
							.filter(node => (node.type ?? 'story_beat') === 'story_beat')
							.map(node => ({
								id: node.id,
								title: node.title,
								summary: node.summary,
								purpose: node.purpose
							})),
						lockedDecisions: lockedDecisionsForAi(current)
					}
				: target.kind === 'volume'
					? {
							schemaVersion: 1 as const,
							operation: 'expand-volume-to-chapters' as const,
							expectedCount,
							story,
							volume: {
								id: parent!.id,
								title: parent!.title,
								summary: parent!.summary,
								goal: parent!.goal ?? '',
								conflict: parent!.conflict ?? '',
								outcome: parent!.outcome ?? '',
								hook: parent!.hook ?? ''
							},
							lockedDecisions: lockedDecisionsForAi(current)
						}
					: {
							schemaVersion: 1 as const,
							operation: 'expand-chapter-to-scenes' as const,
							expectedCount,
							story,
							chapter: {
								id: parent!.id,
								title: parent!.title,
								summary: parent!.summary,
								goal: parent!.goal ?? '',
								conflict: parent!.conflict ?? '',
								outcome: parent!.outcome ?? '',
								hook: parent!.hook ?? '',
								...(parent!.povHint ? { povHint: parent!.povHint } : {})
							},
							lockedDecisions: lockedDecisionsForAi(current)
						};
			const service = new OutlineHierarchyGenerationService(async request => {
				if (request.repairAttempt === 1) {
					setStatus('正在修复拆分候选的字段结构（最后一次）…');
				}
				const result = await runGroundedJsonJob({
					jobType: 'creation-journey',
					messages: buildCreationJourneyMessages(request),
					onJobId: setJobId,
					onProgress: progress => {
						if (progress.state === 'thinking') {
							setStatus('AI 正在检查锁定决定与结构连续性…');
						}
						if (progress.state === 'streaming') {
							setStatus('AI 正在返回可确认的结构候选…');
						}
					}
				});
				return result.output;
			});
			const response = await service.generate(input);
			const unchanged = stateRef.current;
			if (!unchanged || unchanged.revision !== current.revision) {
				throw new Error('outlineHierarchyPreviewStale');
			}
			const candidates = response.operation === 'expand-to-volumes'
				? response.volumes
				: response.operation === 'expand-volume-to-chapters'
					? response.chapters
					: response.scenes.map(scene => ({
							title: scene.title,
							summary: scene.summary,
							goal: scene.goal,
							conflict: scene.obstacle,
							outcome: scene.change,
							hook: scene.hook,
							povHint: scene.povHint,
							locationHint: scene.locationHint,
							characterHints: scene.characterHints
						}));
			const preview = buildHierarchyExpansionPreview(
				unchanged,
				target,
				candidates,
				() => `journey-outline:${globalThis.crypto.randomUUID()}`
			);
			setStatus(`已生成 ${preview.createCount} 个候选；尚未写入项目结构。`);
			return preview;
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('拆分候选未采用，当前结构保持不变。');
			throw reason;
		} finally {
			hierarchyGenerationRequestRef.current = false;
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const confirmHierarchyExpansion = async (
		preview: HierarchyExpansionPreview
	): Promise<void> => {
		const current = stateRef.current;
		const store = storeRef.current;
		const loaded = loadedRef.current;
		if (!current || !store || !loaded) throw new Error('creationJourneyStateInvalid');
		const next = applyHierarchyExpansionPreview(current, preview);
		const saved = await store.save(loaded, next);
		loadedRef.current = saved;
		stateRef.current = saved.state;
		setState(saved.state);
		setHash(saved.hash);
		setStatus(`已确认 ${preview.createCount} 个${preview.childType === 'volume' ? '卷' : preview.childType === 'chapter' ? '章节' : '场景'}规划；尚未写入正文。`);
	};

	const createWritableHierarchy = async (): Promise<boolean> => {
		await persistLatest();
		const current = stateRef.current;
		const loaded = loadedRef.current;
		if (!current || !loaded) throw new Error('creationJourneyStateInvalid');
		validateWritableHierarchy(current);
		setStatus('正在创建安全快照并原子写入卷、章节和场景…');
		const ok = await materializeHierarchy(
			serializeCreationJourneyState(current),
			loaded.hash
		);
		if (!ok) setStatus('卷、章节和场景未创建，项目保持原样。');
		return ok;
	};

	const runLocalOutlineQualityCheck = async (): Promise<readonly OutlineQualityIssue[]> => {
		const current = stateRef.current;
		if (!current || !snapshot) throw new Error('creationJourneyStateInvalid');
		const relevantIds = new Set(
			current.outline
				.filter(node => node.type === 'chapter' && node.resourceId)
				.map(node => node.resourceId!)
		);
		const candidates = await Promise.all(flattenChapters(snapshot.project)
			.filter(chapter => relevantIds.has(chapter.id))
			.map(async (chapter): Promise<OutlineManuscriptState | undefined> => {
				try {
					const file = await desktopBridge.readText(snapshot.root, chapter.file);
					return {
						resourceId: chapter.id,
						status: chapter.status,
						hasContent: Boolean(file.content.trim())
					};
				} catch {
					return undefined;
				}
			}));
		return runLocalOutlineChecks(current, {
			baseline: loadedRef.current?.state,
			manuscripts: candidates.filter(
				(candidate): candidate is OutlineManuscriptState => Boolean(candidate)
			)
		});
	};

	const runAiOutlineQualityCheck = async (): Promise<readonly OutlineQualityIssue[]> => {
		const current = stateRef.current;
		if (
			!current
			|| busyOperation
			|| outlineSemanticCheckRequestRef.current
		) return [];
		outlineSemanticCheckRequestRef.current = true;
		setBusyOperation('check-outline-semantics');
		setError(undefined);
		setStatus('AI 正在只读检查大纲语义，不会修改节点…');
		try {
			const input = createOutlineSemanticCheckInput(current);
			const result = await runGroundedJsonJob({
				jobType: 'creation-journey',
				messages: buildCreationJourneyMessages(input),
				onJobId: setJobId,
				onProgress: progress => {
					if (progress.state === 'thinking') setStatus('AI 正在比较目标、代价与冲突升级…');
					if (progress.state === 'streaming') setStatus('AI 正在返回带证据的只读建议…');
				}
			});
			const response = parseCreationJourneyResponse(result.output, input);
			if (response.operation !== 'check-outline-semantics') {
				throw new Error('invalidCreationJourneyResponse');
			}
			setStatus(`AI 语义检查完成：${response.issues.length} 条建议，大纲未修改`);
			return outlineQualityIssuesFromAi(response);
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('AI 检查未完成；大纲保持不变');
			throw reason;
		} finally {
			outlineSemanticCheckRequestRef.current = false;
			setBusyOperation(undefined);
			setJobId(undefined);
		}
	};

	const createChapters = async () => {
		const current = stateRef.current;
		if (!current) return;
		setError(undefined);
		try {
			await persistLatest();
			const loaded = loadedRef.current;
			const latest = stateRef.current;
			if (!loaded || !latest) throw new Error('creationJourneyStateInvalid');
			setStatus('正在原子创建三章并验证…');
			const ok = await materialize(serializeCreationJourneyState(latest), loaded.hash);
			if (!ok) setStatus('章节未创建，项目保持原样');
		} catch (reason) {
			setError(journeyErrorCopy(reason));
			setStatus('章节未创建，项目保持原样');
		}
	};

	if (!snapshot) {
		return <div className="creation-journey-loading">请先打开作品。</div>;
	}
	if (!state) {
		return (
			<div className="creation-journey-loading" role="status">
				<LoaderCircle className="spin" size={24} />
				<span>{error ?? status}</span>
			</div>
		);
	}

	if (state.startRoute === 'genre' && !state.storyOutline && state.genreInput) {
		return (
			<section
				className="creation-journey genre-creation-journey"
				aria-labelledby="creation-journey-heading"
			>
				<header className="creation-journey-header">
					<div>
						<span className="eyebrow">NOVEL CREATION JOURNEY</span>
						<h1>从题材，到能继续掌控的故事结构</h1>
						<p>只使用你明确提供的条件；生成结果先成为可编辑草稿。</p>
					</div>
					<div className="creation-journey-save" role="status" aria-live="polite">
						<span className={status.includes('失败') ? 'is-error' : ''}>{status}</span>
						{hash && <small>项目内保存</small>}
					</div>
				</header>
				<div className="creation-journey-body">
					{error && (
						<div className="creation-journey-error" role="alert">
							<AlertTriangle size={18} />
							<span>{error}</span>
							<button type="button" aria-label="关闭错误" onClick={() => setError(undefined)}>
								<X size={16} />
							</button>
						</div>
					)}
					<GenreToOutlineStart
						input={state.genreInput}
						readOnly={snapshot.readOnly}
						busy={busyOperation === 'generate-from-genre'}
						status={status}
						onChange={patch => {
							const latest = stateRef.current;
							if (!latest) return;
							try {
								applyState(updateGenreToOutlineInput(latest, patch));
								setError(undefined);
							} catch (reason) {
								setError(journeyErrorCopy(reason));
							}
						}}
						onGenerate={() => void runGenreToOutline()}
						onCancel={() => void cancelAi()}
					/>
				</div>
			</section>
		);
	}

	if (state.startRoute === 'genre' && state.storyOutline) {
		return (
			<section
				className="creation-journey structured-outline-journey"
				aria-labelledby="creation-journey-heading"
			>
				{error && (
					<div className="creation-journey-error" role="alert">
						<AlertTriangle size={18} />
						<span>{error}</span>
						<button type="button" aria-label="关闭错误" onClick={() => setError(undefined)}>
							<X size={16} />
						</button>
					</div>
				)}
				<StructuredOutlineWorkspace
					state={state}
					readOnly={snapshot.readOnly}
					status={status}
					onChange={(next, immediate) => applyState(next, immediate)}
					onSave={persistLatest}
					onGenerateAlternatives={generateOutlineAlternatives}
					onApplyAlternative={applyOutlineAlternative}
					onUndoAlternativeApply={undoOutlineAlternative}
					canUndoAlternativeApply={Boolean(outlineAlternativeUndo)}
					onGenerateHierarchy={generateHierarchyExpansion}
					onConfirmHierarchy={confirmHierarchyExpansion}
					onMaterializeHierarchy={createWritableHierarchy}
					onRunLocalOutlineCheck={runLocalOutlineQualityCheck}
					onRunAiOutlineCheck={runAiOutlineQualityCheck}
				/>
			</section>
		);
	}

	const currentStageIndex = stageOrder.indexOf(state.stage);
	const incompleteElements = state.elements.some(element => !element.text.trim());
	const stale = state.stale.directions || state.stale.outline || state.stale.chapters;
	const pendingImpacts = state.impacts.filter(impact => impact.status === 'pending');
	const impactCounts = {
		direction: pendingImpacts.filter(impact => impact.targetKind === 'direction').length,
		outline: pendingImpacts.filter(impact => impact.targetKind === 'outline').length,
		chapter: pendingImpacts.filter(impact => impact.targetKind === 'chapter').length
	};
	const question = state.guidance.currentQuestion;

	return (
		<section className="creation-journey" aria-labelledby="creation-journey-heading">
			<header className="creation-journey-header">
				<div>
					<span className="eyebrow">NOVEL CREATION JOURNEY</span>
					<h1>从几个想法，到可以写的第一章</h1>
					<p>一次只做一个决定。AI 提供小份候选，你负责修改、选择和确认。</p>
				</div>
				<div className="creation-journey-save" role="status" aria-live="polite">
					<span className={status.includes('失败') ? 'is-error' : ''}>
						{status}
					</span>
					{hash && <small>项目内保存</small>}
				</div>
			</header>

			<nav className="creation-journey-progress" aria-label="创作旅程阶段">
				{stageOrder.map((stage, index) => (
					<button
						type="button"
						key={stage}
						className={[
							stage === state.stage ? 'is-current' : '',
							index < currentStageIndex ? 'is-complete' : ''
						].filter(Boolean).join(' ')}
						aria-current={stage === state.stage ? 'step' : undefined}
						disabled={index > currentStageIndex}
						onClick={() => goToStage(stage)}
					>
						<span>{index < currentStageIndex ? <Check size={16} /> : index + 1}</span>
						<strong>{stageCopy[stage].short}</strong>
					</button>
				))}
			</nav>

			<div className="creation-journey-body">
				<div className="creation-stage-heading">
					<span className="eyebrow">第 {currentStageIndex + 1} 步，共 6 步</span>
					<h2 id="creation-journey-heading" ref={headingRef} tabIndex={-1}>
						{stageCopy[state.stage].title}
					</h2>
					<p>{stageCopy[state.stage].description}</p>
					{state.stage !== 'writing' && (
						<button
							className="creation-guidance-trigger"
							type="button"
							disabled={
								Boolean(busyOperation)
								|| snapshot.readOnly
								|| Object.keys(guidanceContextForAi(state)).length === 0
							}
							onClick={() => void runGuidanceQuestion()}
						>
							{busyOperation === 'generate-guidance-question'
								? <LoaderCircle className="spin" size={18} />
								: <MessageCircleQuestion size={18} />}
							{question ? '换一个关键问题' : '让 AI 问一个关键问题'}
						</button>
					)}
				</div>

				{error && (
					<div className="creation-journey-error" role="alert">
						<AlertTriangle size={18} />
						<span>{error}</span>
						<button type="button" aria-label="关闭错误" onClick={() => setError(undefined)}>
							<X size={16} />
						</button>
					</div>
				)}

				{question && (
					<section className="creation-guidance-card" aria-labelledby="creation-guidance-question">
						<div className="creation-guidance-card-heading">
							<MessageCircleQuestion size={20} aria-hidden="true" />
							<span>
								<small>AI 只问一个问题 · {stageCopy[question.stage].short}</small>
								<h3 id="creation-guidance-question">{question.prompt}</h3>
							</span>
						</div>
						<p>{question.rationale}</p>
						<div className="creation-guidance-options">
							{question.options.map((option, index) => (
								<button
									type="button"
									key={option.id}
									className={guidanceChoiceId === option.id ? 'is-selected' : ''}
									aria-pressed={guidanceChoiceId === option.id}
									onClick={() => {
										setGuidanceChoiceId(option.id);
										setCustomGuidanceAnswer('');
									}}
								>
									<span>{index + 1}</span>
									<strong>{option.label}</strong>
									<small>{option.description}</small>
								</button>
							))}
						</div>
						<label className="creation-guidance-custom">
							<span>或者写下你的答案</span>
							<textarea
								value={customGuidanceAnswer}
								maxLength={1_000}
								placeholder="不必完整，一两句话也可以。"
								onChange={event => {
									setCustomGuidanceAnswer(event.target.value);
									if (event.target.value) setGuidanceChoiceId(undefined);
								}}
							/>
						</label>
						<div className="creation-guidance-actions">
							<small>确认后只会保存为后续建议的约束，不会自动改写故事。</small>
							<button
								className="primary-button"
								type="button"
								disabled={!guidanceChoiceId && !customGuidanceAnswer.trim()}
								onClick={confirmGuidanceAnswer}
							>
								<Check size={18} />确认这个答案
							</button>
						</div>
					</section>
				)}

				{stale && !impactSummaryDismissed && (
					<div className="creation-journey-stale" role="note">
						<RefreshCw size={18} />
						<span>
							<strong>上游内容已修改，下游草稿仍保持原样</strong>
							<small>
								方向 {impactCounts.direction} 项 · 提纲 {impactCounts.outline} 项 · 章节 {impactCounts.chapter} 项待处理
							</small>
						</span>
						<div className="creation-impact-summary-actions">
							<button
								ref={impactOpenerRef}
								type="button"
								onClick={() => setImpactPanelOpen(true)}
							>
								查看影响
							</button>
							<button type="button" onClick={() => setImpactSummaryDismissed(true)}>
								暂不更新
							</button>
						</div>
					</div>
				)}

				{stale && impactSummaryDismissed && (
					<button
						ref={impactOpenerRef}
						className="creation-impact-reopen"
						type="button"
						onClick={() => setImpactPanelOpen(true)}
					>
						<RefreshCw size={18} />
						{pendingImpactCount} 项影响待处理
					</button>
				)}

				{state.stage === 'elements' && (
					<div className="creation-elements-stage">
						<div className="creation-element-list">
							{state.elements.map((element, index) => (
								<article
									className={`creation-element-card${element.locked ? ' is-locked' : ''}`}
									key={element.id}
								>
									<div className="creation-element-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<label>
										<span className="sr-only">要素类型</span>
										<select
											value={element.category}
											disabled={element.locked}
											onChange={event => applyState(updateStoryElement(
												state,
												element.id,
												{ category: event.target.value as StoryElement['category'] }
											))}
										>
											{elementCategories.map(category => (
												<option key={category.id} value={category.id}>{category.label}</option>
											))}
										</select>
									</label>
									<label className="creation-element-text">
										<span className="sr-only">灵感要素 {index + 1}</span>
										<textarea
											value={element.text}
											disabled={element.locked}
											maxLength={500}
											placeholder="例如：一个只在雨夜出现的旧车站"
											onChange={event => applyState(updateStoryElement(
												state,
												element.id,
												{ text: event.target.value }
											))}
											onBlur={() => void persistLatest()}
										/>
									</label>
									<div className="creation-reorder-actions">
										<button
											type="button"
											aria-label={element.locked ? `解锁要素 ${index + 1}` : `锁定要素 ${index + 1}`}
											aria-pressed={element.locked}
											onClick={() => applyState(updateStoryElement(
												state,
												element.id,
												{ locked: !element.locked }
											), true)}
										>
											{element.locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
										</button>
										<button type="button" aria-label={`上移要素 ${index + 1}`} disabled={element.locked || index === 0} onClick={() => applyState(moveStoryElement(state, index, index - 1), true)}>
											<ArrowUp size={16} />
										</button>
										<button type="button" aria-label={`下移要素 ${index + 1}`} disabled={element.locked || index === state.elements.length - 1} onClick={() => applyState(moveStoryElement(state, index, index + 1), true)}>
											<ArrowDown size={16} />
										</button>
										<button type="button" aria-label={`删除要素 ${index + 1}`} disabled={element.locked || state.elements.length <= 3} onClick={() => applyState(removeStoryElement(state, element.id), true)}>
											<Trash2 size={16} />
										</button>
									</div>
								</article>
							))}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" disabled={state.elements.length >= 8} onClick={() => applyState(addStoryElement(state), true)}>
								<Plus size={18} />添加一个要素
							</button>
							<button className="primary-button" type="button" disabled={incompleteElements || Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('organize-core')}>
								{busyOperation === 'organize-core' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
								整理成故事核心
							</button>
						</div>
					</div>
				)}

				{state.stage === 'core' && (
					<div className="creation-core-stage">
						<div className="creation-ai-draft-label">
							<Sparkles size={18} />
							<span><strong>AI 整理候选</strong><small>以下内容尚未确认，可直接编辑。</small></span>
						</div>
						<div className="creation-core-grid">
							{coreFields.map(field => {
								const locked = state.locks.coreFields.includes(field.key);
								const inputId = `creation-core-${field.key}`;
								return (
									<div
										key={field.key}
										className={[
											'creation-core-field',
											field.multiline ? 'is-wide' : '',
											locked ? 'is-locked' : ''
										].filter(Boolean).join(' ')}
									>
										<div className="creation-field-heading">
											<label htmlFor={inputId}>{field.label}</label>
											<button
												type="button"
												aria-label={locked ? `解锁${field.label}` : `锁定${field.label}`}
												aria-pressed={locked}
												onClick={() => applyState(toggleJourneyLock(state, {
													kind: 'core',
													field: field.key
												}, !locked), true)}
											>
												{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
												{locked ? '已锁定' : '锁定'}
											</button>
										</div>
										{field.multiline ? (
											<textarea
												id={inputId}
												value={state.core[field.key]}
												disabled={locked}
												maxLength={field.key === 'oneSentence' ? 2_000 : 1_000}
												placeholder={field.placeholder}
												onChange={event => applyState(updateStoryCore(state, {
													[field.key]: event.target.value
												}))}
												onBlur={() => void persistLatest()}
											/>
										) : (
											<input
												id={inputId}
												value={state.core[field.key]}
												disabled={locked}
												maxLength={1_000}
												placeholder={field.placeholder}
												onChange={event => applyState(updateStoryCore(state, {
													[field.key]: event.target.value
												}))}
												onBlur={() => void persistLatest()}
											/>
										)}
									</div>
								);
							})}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('elements')}>返回灵感</button>
							<button className="primary-button" type="button" disabled={snapshot.readOnly} onClick={() => {
								try {
									const confirmed = confirmStoryCore(state);
									applyState(advanceCreationJourney(confirmed, 'directions'), true);
								} catch (reason) {
									setError(journeyErrorCopy(reason));
								}
							}}>
								<Check size={18} />确认故事核心
							</button>
						</div>
					</div>
				)}

				{state.stage === 'directions' && (
					<div className="creation-directions-stage">
						{state.directions.length === 0 ? (
							<div className="creation-ai-empty">
								<Sparkles size={28} />
								<h3>故事核心已经由你确认</h3>
								<p>现在可以让 AI 只生成三个方向。点击前不会产生请求。</p>
								<button className="primary-button" type="button" disabled={Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('generate-directions')}>
									{busyOperation === 'generate-directions' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
									生成 3 个故事方向
								</button>
							</div>
						) : (
							<>
								<div className="creation-direction-grid">
									{state.directions.map((direction, index) => {
										const selected = state.selectedDirectionIds.includes(direction.id);
										const selectionFull = state.selectedDirectionIds.length >= 2 && !selected;
										const locked = state.locks.directionIds.includes(direction.id);
										return (
											<article
												className={[
													'creation-direction-card',
													selected ? 'is-selected' : '',
													locked ? 'is-locked' : ''
												].filter(Boolean).join(' ')}
												key={direction.id}
											>
												<button
													type="button"
													className="creation-direction-select"
													aria-pressed={selected}
													disabled={selectionFull}
													onClick={() => {
														const ids = selected
															? state.selectedDirectionIds.length > 1
																? state.selectedDirectionIds.filter(id => id !== direction.id)
																: state.selectedDirectionIds
															: [...state.selectedDirectionIds, direction.id];
														try {
															applyState(selectStoryDirections(state, ids), true);
														} catch (reason) {
															setError(journeyErrorCopy(reason));
														}
													}}
												>
													<span>{selected ? <Check size={16} /> : index + 1}</span>
													<strong>{selected ? '已选择' : '选择此方向'}</strong>
												</button>
												<button
													className="creation-card-lock"
													type="button"
													aria-pressed={locked}
													onClick={() => applyState(toggleJourneyLock(state, {
														kind: 'direction',
														id: direction.id
													}, !locked), true)}
												>
													{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
													{locked ? '已锁定方向' : '锁定方向'}
												</button>
												<label><span>方向标题</span><input disabled={locked} value={direction.title} maxLength={120} onChange={event => applyState(updateStoryDirection(state, direction.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>故事前提</span><textarea disabled={locked} value={direction.premise} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { premise: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>核心冲突</span><textarea disabled={locked} value={direction.centralConflict} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { centralConflict: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>结局承诺</span><textarea disabled={locked} value={direction.endingPromise} maxLength={2_000} onChange={event => applyState(updateStoryDirection(state, direction.id, { endingPromise: event.target.value }))} onBlur={() => void persistLatest()} /></label>
												<label><span>整体气质</span><input disabled={locked} value={direction.tone} maxLength={500} onChange={event => applyState(updateStoryDirection(state, direction.id, { tone: event.target.value }))} onBlur={() => void persistLatest()} /></label>
											</article>
										);
									})}
								</div>
								<p className="creation-selection-hint">
									已选择 {state.selectedDirectionIds.length}/2 个方向
									{state.selectedDirectionIds.length === 2 ? '，下一步会合并两者。' : '。'}
								</p>
								<div className="creation-stage-actions">
									<button className="secondary-button" type="button" onClick={() => goToStage('core')}>返回故事核心</button>
									<button className="primary-button" type="button" disabled={state.selectedDirectionIds.length === 0 || Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('generate-outline')}>
										{busyOperation === 'generate-outline' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
										{state.selectedDirectionIds.length === 2 ? '合并并生成故事总纲' : '生成故事总纲'}
									</button>
								</div>
							</>
						)}
					</div>
				)}

				{state.stage === 'outline' && (
					<div className="creation-outline-stage">
						<div className="creation-outline-list">
							{state.outline.map((node, index) => {
								const locked = state.locks.outlineNodeIds.includes(node.id);
								return (
								<article
									key={node.id}
									className={[
										'creation-outline-card',
										draggedOutlineIndex === index ? 'is-dragging' : '',
										locked ? 'is-locked' : ''
									].filter(Boolean).join(' ')}
									draggable={!locked}
									onDragStart={() => setDraggedOutlineIndex(index)}
									onDragEnd={() => setDraggedOutlineIndex(undefined)}
									onDragOver={event => event.preventDefault()}
									onDrop={() => {
										if (draggedOutlineIndex === undefined || draggedOutlineIndex === index) return;
										applyState(moveStoryOutlineNode(state, draggedOutlineIndex, index), true);
										setDraggedOutlineIndex(undefined);
									}}
								>
									<div className="creation-outline-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<div className="creation-outline-fields">
										<button
											className="creation-card-lock"
											type="button"
											aria-pressed={locked}
											onClick={() => applyState(toggleJourneyLock(state, {
												kind: 'outline',
												id: node.id
											}, !locked), true)}
										>
											{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
											{locked ? '已锁定节点' : '锁定节点'}
										</button>
										<label><span>节点标题</span><input disabled={locked} value={node.title} maxLength={120} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
										<label><span>发生什么</span><textarea disabled={locked} value={node.summary} maxLength={3_000} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { summary: event.target.value }))} onBlur={() => void persistLatest()} /></label>
										<label><span>叙事作用</span><input disabled={locked} value={node.purpose} maxLength={1_000} onChange={event => applyState(updateStoryOutlineNode(state, node.id, { purpose: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									</div>
									<div className="creation-reorder-actions">
										<button type="button" aria-label={`上移总纲节点 ${index + 1}`} disabled={locked || index === 0} onClick={() => applyState(moveStoryOutlineNode(state, index, index - 1), true)}><ArrowUp size={16} /></button>
										<button type="button" aria-label={`下移总纲节点 ${index + 1}`} disabled={locked || index === state.outline.length - 1} onClick={() => applyState(moveStoryOutlineNode(state, index, index + 1), true)}><ArrowDown size={16} /></button>
									</div>
								</article>
								);
							})}
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('directions')}>返回故事方向</button>
							<button className="primary-button" type="button" disabled={Boolean(busyOperation) || snapshot.readOnly} onClick={() => void runAi('split-chapters')}>
								{busyOperation === 'split-chapters' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
								拆分为 3 个开篇章节
							</button>
						</div>
					</div>
				)}

				{state.stage === 'chapters' && (
					<div className="creation-chapters-stage">
						<div className="creation-chapter-grid">
							{state.chapters.map((chapter, index) => {
								const locked = state.locks.chapterIds.includes(chapter.id);
								return (
								<article
									className={`creation-chapter-card${locked ? ' is-locked' : ''}`}
									key={chapter.id}
								>
									<span className="creation-chapter-number">第 {index + 1} 章</span>
									<button
										className="creation-card-lock"
										type="button"
										aria-pressed={locked}
										onClick={() => applyState(toggleJourneyLock(state, {
											kind: 'chapter',
											id: chapter.id
										}, !locked), true)}
									>
										{locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}
										{locked ? '已锁定章节' : '锁定章节'}
									</button>
									<label><span>章节标题</span><input disabled={locked} value={chapter.title} maxLength={120} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { title: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<label><span>本章目标</span><textarea disabled={locked} value={chapter.goal} maxLength={1_000} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { goal: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<label><span>章节摘要</span><textarea disabled={locked} value={chapter.summary} maxLength={3_000} onChange={event => applyState(updateJourneyChapterProposal(state, chapter.id, { summary: event.target.value }))} onBlur={() => void persistLatest()} /></label>
									<small>承接 {chapter.sourceNodeIds.length} 个总纲节点</small>
								</article>
								);
							})}
						</div>
						<div className="creation-transaction-note">
							<Check size={18} />
							<span><strong>一次性安全创建</strong><small>三章、项目结构和旅程状态会一起验证；失败时全部恢复。</small></span>
						</div>
						<div className="creation-stage-actions">
							<button className="secondary-button" type="button" onClick={() => goToStage('outline')}>返回故事总纲</button>
							<button className="primary-button" type="button" disabled={snapshot.readOnly || state.stale.chapters || state.chapters.some(chapter => !chapter.title.trim() || !chapter.goal.trim() || !chapter.summary.trim())} onClick={() => void createChapters()}>
								<BookOpenText size={18} />创建 3 章并进入第一章
							</button>
						</div>
					</div>
				)}

				{state.stage === 'writing' && (
					<div className="creation-writing-stage">
						<BookOpenText size={34} />
						<h3>你的前三章已经存在于项目中</h3>
						<p>创作旅程仍然保留，可以随时回来查看决定过程。</p>
						<button className="primary-button" type="button" onClick={() => {
							const firstId = state.chapters[0]?.resourceId;
							const first = snapshot.project.volumes
								.flatMap(volume => volume.chapters)
								.find(chapter => chapter.id === firstId);
							if (!first) return;
							setMode('works');
							void openResource({
								id: first.id,
								type: 'chapter',
								title: first.title,
								path: first.file,
								projectId: snapshot.project.projectId
							});
						}}>
							<BookOpenText size={18} />打开第一章
						</button>
					</div>
				)}

				{impactPanelOpen && (
					<div
						className="creation-impact-overlay"
						onMouseDown={event => {
							if (event.target === event.currentTarget) closeImpactPanel();
						}}
					>
						<div
							ref={impactDialogRef}
							className="creation-impact-dialog"
							role="dialog"
							aria-modal="true"
							aria-labelledby="creation-impact-title"
						>
							<header>
								<span>
									<small>不会自动重写任何下游内容</small>
									<h3 id="creation-impact-title">查看上游修改的影响</h3>
								</span>
								<button
									ref={impactCloseRef}
									type="button"
									aria-label="关闭影响面板"
									onClick={closeImpactPanel}
								>
									<X size={18} />
								</button>
							</header>
							<div className="creation-impact-counts" aria-label="待处理影响统计">
								<span><strong>{impactCounts.direction}</strong>方向</span>
								<span><strong>{impactCounts.outline}</strong>提纲</span>
								<span><strong>{impactCounts.chapter}</strong>章节</span>
							</div>
							<div className="creation-impact-list">
								{pendingImpacts.length === 0 ? (
									<div className="creation-impact-empty">
										<Check size={20} />
										<strong>所有影响都已处理</strong>
										<p>保留或更新决定已经写入项目。</p>
									</div>
								) : pendingImpacts.map(impact => {
									const targetLocked = (
										(impact.targetKind === 'direction'
											&& state.locks.directionIds.includes(impact.targetId))
										|| (impact.targetKind === 'outline'
											&& state.locks.outlineNodeIds.includes(impact.targetId))
										|| (impact.targetKind === 'chapter'
											&& state.locks.chapterIds.includes(impact.targetId))
									);
									const chapter = impact.targetKind === 'chapter'
										? state.chapters.find(item => item.id === impact.targetId)
										: undefined;
									const materialized = Boolean(chapter?.resourceId);
									return (
										<article className="creation-impact-row" key={impact.id}>
											<div className="creation-impact-row-copy">
												<span>{impact.targetKind === 'direction'
													? '故事方向'
													: impact.targetKind === 'outline'
														? '提纲节点'
														: '章节提案'}</span>
												<strong>{impactTargetLabel(state, impact)}</strong>
												<small>上游决定发生变化，这一项可能需要重新核对。</small>
												{targetLocked && (
													<em><LockKeyhole size={16} />作者已锁定，AI 不会替换</em>
												)}
												{materialized && (
													<em><BookOpenText size={16} />正文已创建，只能保留并手动修改正文</em>
												)}
											</div>
											<div className="creation-impact-row-actions">
												<button
													type="button"
													disabled={Boolean(busyOperation)}
													onClick={() => keepImpact(impact)}
												>
													<Check size={18} />保留当前内容
												</button>
												{!materialized && (
													<button
														className="is-ai"
														type="button"
														disabled={Boolean(busyOperation) || targetLocked}
														onClick={() => void regenerateImpact(impact)}
													>
														{busyImpactId === impact.id
															? <LoaderCircle className="spin" size={18} />
															: <Sparkles size={18} />}
														AI 重新生成此项
													</button>
												)}
											</div>
										</article>
									);
								})}
							</div>
							<footer>
								<span>每次只处理一项；关闭面板不会丢失待处理内容。</span>
								<button type="button" onClick={closeImpactPanel}>完成查看</button>
							</footer>
						</div>
					</div>
				)}

				{busyOperation && jobId && (
					<AiJobCancelButton
						jobId={jobId}
						className="creation-ai-cancel"
						label="取消本次 AI 请求"
						pendingLabel="正在取消本次 AI 请求"
						showIcon
						onBeforeCancel={() => {
							if (busyOperation === 'generate-from-genre') {
								genreCancellationRequestedRef.current = true;
							}
						}}
						onErrorChange={setError}
					/>
				)}
			</div>
		</section>
	);
}
