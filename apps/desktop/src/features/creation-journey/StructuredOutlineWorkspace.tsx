import {
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	Bot,
	Check,
	CheckCircle2,
	ChevronRight,
	CircleDot,
	FilePlus2,
	GripVertical,
	Layers3,
	ListChecks,
	LockKeyhole,
	LockKeyholeOpen,
	Play,
	RotateCcw,
	Save,
	Sparkles,
	Trash2,
	X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
	addStoryOutlineNode,
	moveStoryOutlineNode,
	removeStoryOutlineNode,
	restoreStructuredOutlineSnapshot,
	toggleJourneyLock,
	updateStoryOutlineNode,
	updateStoryOutlineRoot,
	type CreationJourneyState,
	type StoryOutlineNode,
	type StoryOutlineRootPatch
} from './CreationJourneyModel';
import {
	diffOutlineCandidate,
	type OutlineCandidateField,
	type OutlineCandidatePreview,
	type OutlineGenerationStrategy,
	type OutlineImpactReport
} from './OutlineAuthorControlModel';
import {
	type HierarchyExpansionPreview,
	type HierarchyExpansionTarget
} from './OutlineHierarchyExpansionModel';
import type { OutlineQualityIssue } from './OutlineQualityCheckModel';

interface StructuredOutlineWorkspaceProps {
	readonly state: CreationJourneyState;
	readonly readOnly: boolean;
	readonly status: string;
	readonly onChange: (state: CreationJourneyState, immediate?: boolean) => void;
	readonly onSave: () => void | Promise<void>;
	readonly onGenerateAlternatives?: (
		nodeId: string,
		strategy: OutlineGenerationStrategy
	) => Promise<OutlineCandidatePreview>;
	readonly onApplyAlternative?: (
		preview: OutlineCandidatePreview,
		alternativeIndex: number,
		fields: readonly OutlineCandidateField[]
	) => Promise<OutlineImpactReport>;
	readonly onUndoAlternativeApply?: () => Promise<void>;
	readonly canUndoAlternativeApply?: boolean;
	readonly onGenerateHierarchy?: (
		target: HierarchyExpansionTarget,
		expectedCount: number
	) => Promise<HierarchyExpansionPreview>;
	readonly onConfirmHierarchy?: (preview: HierarchyExpansionPreview) => Promise<void>;
	readonly onMaterializeHierarchy?: () => Promise<boolean>;
	readonly onRunLocalOutlineCheck?: () => Promise<readonly OutlineQualityIssue[]>;
	readonly onRunAiOutlineCheck?: () => Promise<readonly OutlineQualityIssue[]>;
}

const rootFields: readonly {
	readonly key: keyof Pick<
		NonNullable<CreationJourneyState['storyOutline']>,
		| 'title'
		| 'genre'
		| 'premise'
		| 'themePromise'
		| 'protagonistGoal'
		| 'centralConflict'
		| 'stakes'
		| 'mysteryQuestion'
		| 'endingDirection'
	>;
	readonly label: string;
	readonly multiline?: boolean;
	readonly required?: boolean;
}[] = [
	{ key: 'title', label: '故事标题' },
	{ key: 'genre', label: '题材', required: true },
	{ key: 'premise', label: '故事前提', multiline: true },
	{ key: 'themePromise', label: '主题承诺', multiline: true },
	{ key: 'protagonistGoal', label: '主角目标', multiline: true },
	{ key: 'centralConflict', label: '核心冲突', multiline: true },
	{ key: 'stakes', label: '失败代价', multiline: true },
	{ key: 'mysteryQuestion', label: '悬念问题', multiline: true },
	{ key: 'endingDirection', label: '结局方向', multiline: true }
];

const nodeFields: readonly {
	readonly key: keyof Pick<
		StoryOutlineNode,
		'title' | 'summary' | 'goal' | 'conflict' | 'outcome' | 'hook' | 'povHint'
	>;
	readonly label: string;
	readonly maxLength: number;
	readonly multiline?: boolean;
}[] = [
	{ key: 'title', label: '节点标题', maxLength: 120 },
	{ key: 'summary', label: '一句话概要', maxLength: 3_000, multiline: true },
	{ key: 'goal', label: '节点目标', maxLength: 1_000, multiline: true },
	{ key: 'conflict', label: '核心冲突', maxLength: 2_000, multiline: true },
	{ key: 'outcome', label: '节点结果', maxLength: 2_000, multiline: true },
	{ key: 'hook', label: '结尾钩子', maxLength: 2_000, multiline: true },
	{ key: 'povHint', label: 'POV', maxLength: 500 }
];

const generationStrategies: readonly {
	readonly id: OutlineGenerationStrategy;
	readonly label: string;
}[] = [
	{ id: 'balanced', label: '平衡调整' },
	{ id: 'strengthen-conflict', label: '强化冲突' },
	{ id: 'character-driven', label: '人物驱动' },
	{ id: 'replace-hook', label: '替换钩子' },
	{ id: 'reduce-cliches', label: '减少套路' },
	{ id: 'tighten-pace', label: '收紧节奏' }
];

function statusLabel(status: StoryOutlineNode['status']): string {
	const labels: Readonly<Record<NonNullable<StoryOutlineNode['status']>, string>> = {
		planned: '计划中',
		ready_to_write: '可开始写作',
		drafting: '写作中',
		drafted: '初稿完成',
		revising: '修订中',
		complete: '已完成'
	};
	return labels[status ?? 'planned'];
}

function outlineErrorCopy(reason: unknown): string {
	const code = reason instanceof Error ? reason.message : '';
	const messages: Readonly<Record<string, string>> = {
		creationJourneyTargetLocked: '这个节点已锁定。请先解除锁定，再修改顺序或内容。',
		creationJourneyOutlineMinimum: '故事大纲至少保留 5 个节点。',
		creationJourneyOutlineLimit: '故事大纲最多包含 8 个节点。',
		creationJourneyOutlineInUse: '这个节点已经被章节引用，不能在此阶段删除。',
		creationJourneyOutlineInvalid: '当前输入不符合大纲字段限制，请检查后再试。',
		creationJourneyOutlineUndoInvalid: '当前大纲已发生不兼容变化，无法撤销这一步。',
		outlineCandidateStale: '节点在候选生成后已改变。请重新生成候选，避免覆盖新内容。',
		outlineCandidateUndoStale: '采用后又发生了新修改，无法安全撤销本次 AI 采用。',
		outlineCandidateSelectionRequired: '请至少选择一个发生变化的字段。',
		outlineCandidateFieldUnchanged: '只能采用实际发生变化的字段。',
		invalidCreationJourneyResponse: 'AI 返回的结构无法验证；当前大纲保持不变。',
		invalidSnapshotReason: '安全快照创建失败；候选尚未写入。',
		outlineHierarchyExpansionConflict: '候选与现有同级节点重名，请取消后重新生成。',
		outlineHierarchyPreviewStale: '结构在预览后发生变化，请重新生成拆分候选。',
		outlineHierarchyIncomplete: '每个卷都需要章节，每个章节都需要至少一个场景。',
		outlineHierarchyLocked: '请先解除卷、章或场景节点的锁定，再开始写作。',
		outlineHierarchyMaterializationInvalid: '当前卷、章、场景结构无法安全创建。',
		outlineSemanticCheckUnavailable: '请先生成并补全结构化大纲，再运行语义检查。',
		invalidCreationJourneyInput: '大纲内容过长或包含不安全字段，无法发送给 AI 检查。'
	};
	return messages[code] ?? '暂时无法完成这个大纲操作。';
}

function OutlineQualityIssueCard({
	issue,
	onLocate
}: {
	readonly issue: OutlineQualityIssue;
	readonly onLocate: (nodeId: string) => void;
}): React.JSX.Element {
	const severityLabel = issue.severity === 'error'
		? '错误'
		: issue.severity === 'warning' ? '警告' : '建议';
	return (
		<article className={`outline-quality-issue is-${issue.severity}`}>
			<button
				type="button"
				aria-label={`${issue.title}，定位节点`}
				onClick={() => onLocate(issue.nodeIds[0])}
			>
				<span><AlertTriangle size={18} />{severityLabel}</span>
				<strong>{issue.title}</strong>
				<ChevronRight size={18} />
			</button>
			<p>{issue.message}</p>
			<dl>
				<div><dt>影响</dt><dd>{issue.impact}</dd></div>
				<div><dt>建议</dt><dd>{issue.suggestedAction}</dd></div>
			</dl>
			{issue.evidence.length > 0 && (
				<ul aria-label="问题证据">
					{issue.evidence.map((evidence, index) => (
						<li key={`${evidence.nodeId}:${evidence.field}:${index}`}>
							<code>{evidence.field}</code>
							<span>{evidence.quote}</span>
						</li>
					))}
				</ul>
			)}
		</article>
	);
}

export function StructuredOutlineWorkspace({
	state,
	readOnly,
	status,
	onChange,
	onSave,
	onGenerateAlternatives,
	onApplyAlternative,
	onUndoAlternativeApply,
	canUndoAlternativeApply = false,
	onGenerateHierarchy,
	onConfirmHierarchy,
	onMaterializeHierarchy,
	onRunLocalOutlineCheck,
	onRunAiOutlineCheck
}: StructuredOutlineWorkspaceProps): React.JSX.Element {
	const root = state.storyOutline;
	const [selectedId, setSelectedId] = useState<string>();
	const [draggedId, setDraggedId] = useState<string>();
	const [history, setHistory] = useState<readonly CreationJourneyState[]>([]);
	const [localError, setLocalError] = useState<string>();
	const [generationStrategy, setGenerationStrategy] =
		useState<OutlineGenerationStrategy>('balanced');
	const [authorControlBusy, setAuthorControlBusy] = useState<
		'generating' | 'applying' | 'undoing'
	>();
	const [candidatePreview, setCandidatePreview] = useState<OutlineCandidatePreview>();
	const [candidateIndex, setCandidateIndex] = useState(0);
	const [selectedCandidateFields, setSelectedCandidateFields] =
		useState<readonly OutlineCandidateField[]>([]);
	const [impactReport, setImpactReport] = useState<OutlineImpactReport>();
	const [hierarchyPreview, setHierarchyPreview] = useState<HierarchyExpansionPreview>();
	const [hierarchyBusy, setHierarchyBusy] = useState<
		'generating' | 'confirming' | 'materializing'
	>();
	const [hierarchyCount, setHierarchyCount] = useState(3);
	const [materializationReviewOpen, setMaterializationReviewOpen] = useState(false);
	const [qualityOpen, setQualityOpen] = useState(false);
	const [qualityBusy, setQualityBusy] = useState<'local' | 'ai'>();
	const authorControlGuardRef = useRef(false);
	const hierarchyGuardRef = useRef(false);
	const [localQualityIssues, setLocalQualityIssues] =
		useState<readonly OutlineQualityIssue[]>([]);
	const [aiQualityIssues, setAiQualityIssues] =
		useState<readonly OutlineQualityIssue[]>([]);
	const [qualityCheckedRevision, setQualityCheckedRevision] = useState<number>();
	const [aiQualityCheckedRevision, setAiQualityCheckedRevision] = useState<number>();
	const qualityRequestRef = useRef<'local' | 'ai' | undefined>(undefined);
	const editSnapshotRef = useRef<{
		readonly key: string;
		readonly state: CreationJourneyState;
	} | undefined>(undefined);
	const candidateHeadingRef = useRef<HTMLHeadingElement>(null);
	const selectedNode = state.outline.find(node => node.id === selectedId);
	const storyBeats = state.outline.filter(
		node => (node.type ?? 'story_beat') === 'story_beat'
	);
	const hierarchyNodes = state.outline.filter(
		node => node.type === 'volume' || node.type === 'chapter' || node.type === 'scene'
	);
	const qualityStale = (
		qualityCheckedRevision !== undefined
		&& qualityCheckedRevision !== state.revision
	);
	const blockingLocalIssueCount = localQualityIssues.filter(
		issue => issue.severity === 'error'
	).length;

	useEffect(() => {
		if (candidatePreview) candidateHeadingRef.current?.focus();
	}, [candidatePreview]);

	if (!root) {
		return <div className="structured-outline-missing">尚未生成结构化大纲。</div>;
	}

	const remember = (snapshot: CreationJourneyState) => {
		setHistory(previous => [...previous.slice(-29), snapshot]);
	};

	const apply = (
		createNext: () => CreationJourneyState,
		options: { readonly immediate?: boolean; readonly remember?: boolean } = {}
	): CreationJourneyState | undefined => {
		try {
			const next = createNext();
			if (options.remember !== false) remember(state);
			onChange(next, options.immediate);
			setLocalError(undefined);
			return next;
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
			return undefined;
		}
	};

	const beginFieldEdit = (key: string) => {
		if (editSnapshotRef.current?.key === key) return;
		editSnapshotRef.current = { key, state };
	};

	const endFieldEdit = () => {
		const snapshot = editSnapshotRef.current;
		editSnapshotRef.current = undefined;
		if (snapshot && snapshot.state.revision !== state.revision) {
			remember(snapshot.state);
		}
	};

	const applyField = (key: string, createNext: () => CreationJourneyState) => {
		if (!editSnapshotRef.current) {
			editSnapshotRef.current = { key, state };
		}
		apply(createNext, { remember: false });
	};

	const moveNode = (nodeId: string, toIndex: number) => {
		const fromIndex = state.outline.findIndex(node => node.id === nodeId);
		if (fromIndex < 0 || fromIndex === toIndex) return;
		apply(
			() => moveStoryOutlineNode(state, fromIndex, toIndex),
			{ immediate: true }
		);
	};

	const undo = () => {
		const previous = history.at(-1);
		if (!previous) return;
		try {
			const restored = restoreStructuredOutlineSnapshot(state, previous);
			setHistory(items => items.slice(0, -1));
			onChange(restored, true);
			setLocalError(undefined);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		}
	};

	const lockedIds = new Set(state.locks.outlineNodeIds);
	const previewTarget = candidatePreview
		? state.outline.find(node => node.id === candidatePreview.targetId)
		: undefined;
	const selectedAlternative = candidatePreview?.alternatives[candidateIndex];
	const selectedDiffs = previewTarget && selectedAlternative
		? diffOutlineCandidate(previewTarget, selectedAlternative.replacement)
		: [];
	const changedDiffs = selectedDiffs.filter(diff => diff.changed);
	const hierarchyTarget: HierarchyExpansionTarget | undefined = !selectedNode
		? { kind: 'story' }
		: selectedNode.type === 'volume'
			? { kind: 'volume', id: selectedNode.id }
			: selectedNode.type === 'chapter'
				? { kind: 'chapter', id: selectedNode.id }
				: undefined;
	const hierarchyPrimaryLabel = !selectedNode
		? '拆分为卷'
		: selectedNode.type === 'volume'
			? '拆分为章节'
			: selectedNode.type === 'chapter'
				? '生成场景'
				: selectedNode.type === 'scene'
					? '开始写作'
					: undefined;
	const volumeCount = hierarchyNodes.filter(node => node.type === 'volume').length;
	const chapterCount = hierarchyNodes.filter(node => node.type === 'chapter').length;
	const sceneCount = hierarchyNodes.filter(node => node.type === 'scene').length;
	const hierarchyComplete = volumeCount > 0
		&& chapterCount > 0
		&& sceneCount > 0
		&& hierarchyNodes
			.filter(node => node.type === 'volume')
			.every(volume => hierarchyNodes.some(
				chapter => chapter.type === 'chapter' && chapter.parentId === volume.id
			))
		&& hierarchyNodes
			.filter(node => node.type === 'chapter')
			.every(chapter => hierarchyNodes.some(
				scene => scene.type === 'scene' && scene.parentId === chapter.id
			));

	const selectCandidate = (index: number, preview = candidatePreview) => {
		const target = preview
			? state.outline.find(node => node.id === preview.targetId)
			: undefined;
		const alternative = preview?.alternatives[index];
		setCandidateIndex(index);
		setSelectedCandidateFields(
			target && alternative
				? diffOutlineCandidate(target, alternative.replacement)
					.filter(diff => diff.changed)
					.map(diff => diff.field)
				: []
		);
	};

	const generateAlternatives = async () => {
		if (!selectedNode || !onGenerateAlternatives || authorControlGuardRef.current) return;
		authorControlGuardRef.current = true;
		setAuthorControlBusy('generating');
		setLocalError(undefined);
		setImpactReport(undefined);
		try {
			const preview = await onGenerateAlternatives(
				selectedNode.id,
				generationStrategy
			);
			setCandidatePreview(preview);
			selectCandidate(0, preview);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			authorControlGuardRef.current = false;
			setAuthorControlBusy(undefined);
		}
	};

	const applyAlternative = async () => {
		if (
			!candidatePreview
			|| !onApplyAlternative
			|| authorControlGuardRef.current
			|| selectedCandidateFields.length === 0
		) {
			return;
		}
		authorControlGuardRef.current = true;
		setAuthorControlBusy('applying');
		setLocalError(undefined);
		try {
			const report = await onApplyAlternative(
				candidatePreview,
				candidateIndex,
				selectedCandidateFields
			);
			setImpactReport(report);
			setCandidatePreview(undefined);
			setSelectedCandidateFields([]);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			authorControlGuardRef.current = false;
			setAuthorControlBusy(undefined);
		}
	};

	const undoAlternative = async () => {
		if (!onUndoAlternativeApply || authorControlGuardRef.current) return;
		authorControlGuardRef.current = true;
		setAuthorControlBusy('undoing');
		setLocalError(undefined);
		try {
			await onUndoAlternativeApply();
			setImpactReport(undefined);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			authorControlGuardRef.current = false;
			setAuthorControlBusy(undefined);
		}
	};

	const generateHierarchy = async () => {
		if (!hierarchyTarget || !onGenerateHierarchy || hierarchyGuardRef.current) return;
		hierarchyGuardRef.current = true;
		setHierarchyBusy('generating');
		setLocalError(undefined);
		try {
			setHierarchyPreview(await onGenerateHierarchy(hierarchyTarget, hierarchyCount));
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			hierarchyGuardRef.current = false;
			setHierarchyBusy(undefined);
		}
	};

	const confirmHierarchy = async () => {
		if (!hierarchyPreview || !onConfirmHierarchy || hierarchyGuardRef.current) return;
		hierarchyGuardRef.current = true;
		setHierarchyBusy('confirming');
		setLocalError(undefined);
		try {
			await onConfirmHierarchy(hierarchyPreview);
			setSelectedId(hierarchyPreview.candidates[0]?.id);
			setHierarchyPreview(undefined);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			hierarchyGuardRef.current = false;
			setHierarchyBusy(undefined);
		}
	};

	const materializeHierarchy = async () => {
		if (!onMaterializeHierarchy || hierarchyGuardRef.current || !hierarchyComplete) return;
		hierarchyGuardRef.current = true;
		setHierarchyBusy('materializing');
		setLocalError(undefined);
		try {
			const applied = await onMaterializeHierarchy();
			if (applied) setMaterializationReviewOpen(false);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			hierarchyGuardRef.current = false;
			setHierarchyBusy(undefined);
		}
	};

	const runLocalQualityCheck = async () => {
		if (!onRunLocalOutlineCheck || qualityRequestRef.current) return;
		qualityRequestRef.current = 'local';
		setQualityOpen(true);
		setQualityBusy('local');
		setLocalError(undefined);
		try {
			const result = await onRunLocalOutlineCheck();
			setLocalQualityIssues(result);
			setAiQualityIssues([]);
			setAiQualityCheckedRevision(undefined);
			setQualityCheckedRevision(state.revision);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			qualityRequestRef.current = undefined;
			setQualityBusy(undefined);
		}
	};

	const runAiQualityCheck = async () => {
		if (
			!onRunAiOutlineCheck
			|| qualityRequestRef.current
			|| qualityStale
			|| qualityCheckedRevision === undefined
			|| blockingLocalIssueCount > 0
		) return;
		qualityRequestRef.current = 'ai';
		setQualityBusy('ai');
		setLocalError(undefined);
		try {
			setAiQualityIssues(await onRunAiOutlineCheck());
			setAiQualityCheckedRevision(state.revision);
		} catch (reason) {
			setLocalError(outlineErrorCopy(reason));
		} finally {
			qualityRequestRef.current = undefined;
			setQualityBusy(undefined);
		}
	};

	return (
		<section className="structured-outline-workspace" aria-label="结构化大纲工作区">
			<header className="structured-outline-toolbar">
				<div>
					<span className="eyebrow">STRUCTURED OUTLINE</span>
					<h2 id="creation-journey-heading">{root.title ?? '未命名故事大纲'}</h2>
				</div>
				<div className="structured-outline-toolbar-actions">
					<button
						type="button"
						disabled={!onRunLocalOutlineCheck || Boolean(qualityBusy)}
						onClick={() => void runLocalQualityCheck()}
					>
						<ListChecks size={18} />检查大纲
					</button>
					<button
						type="button"
						disabled={readOnly || storyBeats.length >= 8}
						onClick={() => {
							const next = apply(
								() => addStoryOutlineNode(state),
								{ immediate: true }
							);
							const created = next?.outline.at(-1);
							if (created) setSelectedId(created.id);
						}}
					>
						<FilePlus2 size={18} />新增节点
					</button>
					<button
						type="button"
						aria-label="撤销大纲改动"
						disabled={readOnly || history.length === 0}
						onClick={undo}
					>
						<RotateCcw size={18} />撤销
					</button>
					<button
						type="button"
						className="secondary-button"
						disabled={readOnly}
						onClick={() => void onSave()}
					>
						<Save size={18} />保存大纲
					</button>
					{hierarchyTarget && !hierarchyPreview && !candidatePreview && (
						<label className="structured-outline-split-count">
							<span>数量</span>
							<input
								type="number"
								min={1}
								max={hierarchyTarget.kind === 'story'
									? 8
									: hierarchyTarget.kind === 'volume' ? 24 : 12}
								value={hierarchyCount}
								disabled={readOnly || Boolean(hierarchyBusy)}
								onChange={event => setHierarchyCount(Math.max(
									1,
									Math.min(Number(event.target.max), Number(event.target.value) || 1)
								))}
								aria-label="拆分候选数量"
							/>
						</label>
					)}
					{hierarchyPrimaryLabel && !hierarchyPreview && !candidatePreview && (
						<button
							type="button"
							className="primary-button"
							disabled={
								readOnly
								|| Boolean(hierarchyBusy)
								|| materializationReviewOpen
								|| (selectedNode?.type === 'scene' && !hierarchyComplete)
								|| (selectedNode?.type === 'scene' && Boolean(selectedNode.resourceId))
							}
							onClick={() => {
								if (selectedNode?.type === 'scene') {
									setMaterializationReviewOpen(true);
								} else {
									void generateHierarchy();
								}
							}}
						>
							{selectedNode?.type === 'scene'
								? <Play size={18} />
								: <Layers3 size={18} />}
							{hierarchyBusy === 'generating' ? '正在生成候选…' : hierarchyPrimaryLabel}
						</button>
					)}
				</div>
			</header>

			{localError && <div className="structured-outline-error" role="alert">{localError}</div>}

			{qualityOpen && (
				<section className="outline-quality-panel" aria-label="大纲检查结果">
					<header>
						<div>
							<span className="eyebrow">OUTLINE CHECK</span>
							<h3>大纲检查</h3>
							<p>本地规则发现结构硬错误；AI 只提供语义建议，不会修改节点。</p>
						</div>
						<button
							type="button"
							aria-label="关闭大纲检查"
							onClick={() => setQualityOpen(false)}
						>
							<X size={18} />
						</button>
					</header>
					{qualityStale && (
						<div className="outline-quality-stale" role="status">
							<AlertTriangle size={18} />
							<span>大纲已改变，当前结果已过期。请重新运行本地检查。</span>
						</div>
					)}
					<div className="outline-quality-summary" aria-live="polite">
						<span><ListChecks size={16} />本地 {localQualityIssues.length}</span>
						<span><Bot size={16} />AI {aiQualityIssues.length}</span>
						<span className={blockingLocalIssueCount > 0 ? 'has-error' : ''}>
							<AlertTriangle size={16} />错误 {blockingLocalIssueCount}
						</span>
					</div>
					<div className="outline-quality-columns">
						<section aria-labelledby="outline-local-quality-heading">
							<header>
								<div>
									<strong id="outline-local-quality-heading">本地规则</strong>
									<small>离线、确定性、不会调用 AI</small>
								</div>
								<button
									type="button"
									disabled={qualityBusy === 'local'}
									onClick={() => void runLocalQualityCheck()}
								>
									{qualityBusy === 'local' ? '检查中…' : '重新检查'}
								</button>
							</header>
							{qualityCheckedRevision !== undefined && localQualityIssues.length === 0 && (
								<p className="outline-quality-empty">
									<CheckCircle2 size={18} />本地结构检查通过。
								</p>
							)}
							<div className="outline-quality-list">
								{localQualityIssues.map(issue => (
									<OutlineQualityIssueCard
										key={issue.id}
										issue={issue}
										onLocate={nodeId => setSelectedId(nodeId)}
									/>
								))}
							</div>
						</section>
						<section aria-labelledby="outline-ai-quality-heading">
							<header>
								<div>
									<strong id="outline-ai-quality-heading">AI 建议</strong>
									<small>只有再次明确点击，才会调用 AI</small>
								</div>
								<button
									type="button"
									className="secondary-button"
									disabled={
										!onRunAiOutlineCheck
										|| qualityBusy === 'ai'
										|| qualityStale
										|| qualityCheckedRevision === undefined
										|| blockingLocalIssueCount > 0
									}
									onClick={() => void runAiQualityCheck()}
								>
									<Bot size={18} />{qualityBusy === 'ai' ? 'AI 检查中…' : 'AI 语义检查'}
								</button>
							</header>
							{blockingLocalIssueCount > 0 && (
								<p className="outline-quality-hint">先修复本地结构错误，再进行语义检查。</p>
							)}
							{aiQualityCheckedRevision === state.revision
								&& aiQualityIssues.length === 0
								&& qualityBusy !== 'ai'
								&& (
									<p className="outline-quality-empty">
										<CheckCircle2 size={18} />AI 没有发现需要提醒的语义问题。
									</p>
								)}
							<div className="outline-quality-list">
								{aiQualityIssues.map(issue => (
									<OutlineQualityIssueCard
										key={issue.id}
										issue={issue}
										onLocate={nodeId => setSelectedId(nodeId)}
									/>
								))}
							</div>
						</section>
					</div>
				</section>
			)}

			{hierarchyPreview && (
				<section className="outline-hierarchy-preview" aria-label="拆分预览">
					<header>
						<div>
							<span className="eyebrow">SPLIT PREVIEW</span>
							<h3>确认后才加入规划结构</h3>
						</div>
						<button
							type="button"
							aria-label="关闭拆分预览"
							onClick={() => setHierarchyPreview(undefined)}
						>
							<X size={18} />
						</button>
					</header>
					<div className="outline-hierarchy-preview-summary">
						<strong>预计创建 {hierarchyPreview.createCount} 个{
							hierarchyPreview.childType === 'volume'
								? '卷'
								: hierarchyPreview.childType === 'chapter' ? '章节' : '场景'
						}</strong>
						<span>保留现有 {hierarchyPreview.existingPreservedIds.length} 个</span>
						<span>保留锁定 {hierarchyPreview.lockedPreservedIds.length} 个</span>
						<span className={hierarchyPreview.conflicts.length ? 'has-conflict' : ''}>
							发现 {hierarchyPreview.conflicts.length} 个冲突
						</span>
					</div>
					<div className="outline-hierarchy-preview-list">
						{hierarchyPreview.candidates.map((candidate, index) => (
							<article key={candidate.id}>
								<span>{index + 1}</span>
								<div>
									<strong>{candidate.title}</strong>
									<p>{candidate.summary}</p>
									<small>目标：{candidate.goal || '待补充'} · 冲突：{candidate.conflict || '待补充'}</small>
								</div>
							</article>
						))}
					</div>
					{hierarchyPreview.conflicts.length > 0 && (
						<ul className="outline-hierarchy-conflicts">
							{hierarchyPreview.conflicts.map((conflict, index) => (
								<li key={`${conflict.code}-${index}`}>
									“{conflict.title}”与现有同级节点重复
								</li>
							))}
						</ul>
					)}
					<footer>
						<span>此步骤只保存规划投影，不创建正文文件。</span>
						<button type="button" onClick={() => setHierarchyPreview(undefined)}>
							取消
						</button>
						<button
							type="button"
							className="primary-button"
							disabled={
								hierarchyPreview.conflicts.length > 0
								|| Boolean(hierarchyBusy)
							}
							onClick={() => void confirmHierarchy()}
						>
							{hierarchyBusy === 'confirming' ? '正在确认…' : '确认拆分'}
						</button>
					</footer>
				</section>
			)}

			<div className="structured-outline-grid">
				<nav className="structured-outline-tree" aria-label="故事结构树">
					<header>
						<strong>故事结构</strong>
						<small>{storyBeats.length} 个故事节点 · {hierarchyNodes.length} 个层级节点</small>
					</header>
					<button
						type="button"
						className={!selectedNode ? 'is-selected' : ''}
						aria-label="选择故事总纲"
						onClick={() => setSelectedId(undefined)}
					>
						<CircleDot size={18} />
						<span>
							<strong>{root.title ?? '故事总纲'}</strong>
							<small>{root.genre}</small>
						</span>
						<ChevronRight size={16} />
					</button>
					<ol>
						{state.outline.map((node, index) => {
							const locked = lockedIds.has(node.id);
							return (
								<li key={node.id}>
									<button
										type="button"
										className={selectedId === node.id ? 'is-selected' : ''}
										aria-label={`选择${node.title || `未命名节点 ${index + 1}`}`}
										draggable={
											!readOnly
											&& !locked
											&& (node.type ?? 'story_beat') === 'story_beat'
										}
										onClick={() => setSelectedId(node.id)}
										onDragStart={() => setDraggedId(node.id)}
										onDragEnd={() => setDraggedId(undefined)}
										onDragOver={event => event.preventDefault()}
										onDrop={() => {
											if (draggedId) moveNode(draggedId, index);
											setDraggedId(undefined);
										}}
									>
										<span className="structured-outline-tree-index">
											{node.type === 'volume' ? '卷' : node.type === 'chapter' ? '章' : node.type === 'scene' ? '景' : index + 1}
										</span>
										<span>
											<strong>{node.title || '未命名节点'}</strong>
											<small>{statusLabel(node.status)}</small>
										</span>
										{locked
											? <LockKeyhole size={16} aria-label="已锁定" />
											: <GripVertical size={16} aria-hidden="true" />}
									</button>
								</li>
							);
						})}
					</ol>
				</nav>

				<main className="structured-outline-cards" aria-label="大纲卡片">
					<header>
						<div>
							<strong>故事节点</strong>
							<small>拖动卡片或使用方向按钮调整叙事顺序</small>
						</div>
						<span>{root.status === 'confirmed' ? <Check size={16} /> : <CircleDot size={16} />}{root.status === 'confirmed' ? '已确认' : '草稿'}</span>
					</header>
					<div className="structured-outline-card-list">
						{storyBeats.map((node, index) => {
							const locked = lockedIds.has(node.id);
							const previousLocked = index > 0 && lockedIds.has(storyBeats[index - 1].id);
							const nextLocked = (
								index < storyBeats.length - 1
								&& lockedIds.has(storyBeats[index + 1].id)
							);
							return (
								<article
									key={node.id}
									aria-label={`大纲卡片 ${index + 1} ${node.title || '未命名节点'}`}
									className={[
										'structured-outline-card',
										selectedId === node.id ? 'is-selected' : '',
										locked ? 'is-locked' : '',
										draggedId === node.id ? 'is-dragging' : ''
									].filter(Boolean).join(' ')}
									draggable={!readOnly && !locked}
									onClick={() => setSelectedId(node.id)}
									onDragStart={() => setDraggedId(node.id)}
									onDragEnd={() => setDraggedId(undefined)}
									onDragOver={event => event.preventDefault()}
									onDrop={() => {
										if (draggedId) moveNode(draggedId, index);
										setDraggedId(undefined);
									}}
								>
									<div className="structured-outline-card-order">
										<GripVertical size={18} aria-hidden="true" />
										<span>{index + 1}</span>
									</div>
									<div className="structured-outline-card-copy">
										<header>
											<strong data-testid="outline-card-title">
												{node.title || '未命名节点'}
											</strong>
											<span>{statusLabel(node.status)}</span>
											{locked && <LockKeyhole size={16} aria-label="已锁定" />}
										</header>
										<p>{node.summary || '尚未填写一句话概要。'}</p>
										<dl>
											<div><dt>目标</dt><dd>{node.goal || node.purpose || '待补充'}</dd></div>
											<div><dt>冲突</dt><dd>{node.conflict || '待补充'}</dd></div>
											<div><dt>结果</dt><dd>{node.outcome || '待补充'}</dd></div>
										</dl>
										{node.povHint && <small>POV · {node.povHint}</small>}
									</div>
									<div className="structured-outline-card-move">
										<button
											type="button"
											aria-label={`上移故事节点 ${index + 1}`}
											disabled={readOnly || locked || previousLocked || index === 0}
											onClick={event => {
												event.stopPropagation();
												moveNode(node.id, index - 1);
											}}
										>
											<ArrowUp size={18} />
										</button>
										<button
											type="button"
											aria-label={`下移故事节点 ${index + 1}`}
											disabled={
												readOnly
												|| locked
												|| nextLocked
										|| index === storyBeats.length - 1
											}
											onClick={event => {
												event.stopPropagation();
												moveNode(node.id, index + 1);
											}}
										>
											<ArrowDown size={18} />
										</button>
									</div>
								</article>
							);
						})}
					</div>
				</main>

				<aside className="structured-outline-inspector" aria-label="当前节点详情">
					{!selectedNode ? (
						<>
							<header>
								<div>
									<span className="eyebrow">STORY ROOT</span>
									<strong>故事总纲</strong>
								</div>
								<span>版本 {root.revision}</span>
							</header>
							<div className="structured-outline-inspector-fields">
								{rootFields.map(field => {
									const value = root[field.key] ?? '';
									const common = {
										'aria-label': field.label,
										value,
										disabled: readOnly,
										maxLength: field.key === 'title' ? 160 : field.key === 'genre' ? 240 : 2_000,
										onFocus: () => beginFieldEdit(`root:${field.key}`),
										onBlur: endFieldEdit,
										onChange: (
											event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
										) => {
											const nextValue = event.target.value;
											const patch = {
												[field.key]: (
													field.required || nextValue.trim()
														? nextValue
														: undefined
												)
											} as StoryOutlineRootPatch;
											applyField(
												`root:${field.key}`,
												() => updateStoryOutlineRoot(state, patch)
											);
										}
									};
									return (
										<label key={field.key}>
											<span>{field.label}{field.required && <em>必填</em>}</span>
											{field.multiline
												? <textarea {...common} rows={3} />
												: <input {...common} />}
										</label>
									);
								})}
							</div>
						</>
					) : (
						<>
							<header>
								<div>
									<span className="eyebrow">{
										selectedNode.type === 'volume'
											? `VOLUME ${(selectedNode.order ?? 0) + 1}`
											: selectedNode.type === 'chapter'
												? `CHAPTER ${(selectedNode.order ?? 0) + 1}`
												: selectedNode.type === 'scene'
													? `SCENE ${(selectedNode.order ?? 0) + 1}`
													: `STORY BEAT ${(selectedNode.order ?? 0) + 1}`
									}</span>
									<strong>{selectedNode.title || '未命名节点'}</strong>
								</div>
								<span>版本 {selectedNode.revision ?? 1}</span>
							</header>
							<div className="structured-outline-inspector-actions">
								<button
									type="button"
									disabled={readOnly}
									onClick={() => apply(
										() => toggleJourneyLock(state, {
											kind: 'outline',
											id: selectedNode.id
										}, !lockedIds.has(selectedNode.id)),
										{ immediate: true }
									)}
								>
									{lockedIds.has(selectedNode.id)
										? <LockKeyholeOpen size={18} />
										: <LockKeyhole size={18} />}
									{lockedIds.has(selectedNode.id)
										? '解除节点锁定'
										: '锁定此节点'}
								</button>
								<button
									type="button"
									disabled={
										readOnly
										|| lockedIds.has(selectedNode.id)
										|| storyBeats.length <= 5
										|| (selectedNode.type ?? 'story_beat') !== 'story_beat'
									}
									onClick={() => {
										const removed = apply(
											() => removeStoryOutlineNode(state, selectedNode.id),
											{ immediate: true }
										);
										if (removed) setSelectedId(undefined);
									}}
								>
									<Trash2 size={18} />删除节点
								</button>
							</div>
							{onGenerateAlternatives && (selectedNode.type ?? 'story_beat') === 'story_beat' && (
								<div className="structured-outline-ai-control">
									<div>
										<strong>局部 AI 候选</strong>
										<small>只生成建议，不会直接改写节点。</small>
									</div>
									<label>
										<span>调整方向</span>
										<select
											aria-label="局部生成策略"
											value={generationStrategy}
											disabled={
												readOnly
												|| lockedIds.has(selectedNode.id)
												|| Boolean(authorControlBusy)
											}
											onChange={event => setGenerationStrategy(
												event.target.value as OutlineGenerationStrategy
											)}
										>
											{generationStrategies.map(strategy => (
												<option key={strategy.id} value={strategy.id}>
													{strategy.label}
												</option>
											))}
										</select>
									</label>
									<button
										type="button"
										className="primary-button"
										disabled={
											readOnly
											|| lockedIds.has(selectedNode.id)
											|| Boolean(authorControlBusy)
										}
										onClick={() => void generateAlternatives()}
									>
										<Sparkles size={18} />
										{authorControlBusy === 'generating'
											? '正在生成…'
											: '生成 3 个局部候选'}
									</button>
									{lockedIds.has(selectedNode.id) && (
										<p>节点已锁定。AI 会继续把它作为上下文，但不能生成替换候选。</p>
									)}
								</div>
							)}
							<div className="structured-outline-inspector-fields">
								{nodeFields.map(field => {
									const value = selectedNode[field.key] ?? '';
									const common = {
										'aria-label': field.label,
										value,
										disabled: readOnly || lockedIds.has(selectedNode.id),
										maxLength: field.maxLength,
										onFocus: () => beginFieldEdit(`node:${selectedNode.id}:${field.key}`),
										onBlur: endFieldEdit,
										onChange: (
											event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
										) => {
											const nextValue = event.target.value;
											const patch: Partial<Omit<StoryOutlineNode, 'id'>> = {
												[field.key]: nextValue,
												...(field.key === 'goal' && !selectedNode.purpose
													? { purpose: nextValue }
													: {})
											};
											applyField(
												`node:${selectedNode.id}:${field.key}`,
												() => updateStoryOutlineNode(
													state,
													selectedNode.id,
													patch
												)
											);
										}
									};
									return (
										<label key={field.key}>
											<span>{field.label}</span>
											{field.multiline
												? <textarea {...common} rows={3} />
												: <input {...common} />}
										</label>
									);
								})}
								<label>
									<span>状态</span>
									<select
										aria-label="节点状态"
										value={selectedNode.status ?? 'planned'}
										disabled={readOnly || lockedIds.has(selectedNode.id)}
										onChange={event => apply(
											() => updateStoryOutlineNode(state, selectedNode.id, {
												status: event.target.value as NonNullable<StoryOutlineNode['status']>
											}),
											{ immediate: true }
										)}
									>
										<option value="planned">计划中</option>
										<option value="ready_to_write">可开始写作</option>
										<option value="drafting">写作中</option>
										<option value="drafted">初稿完成</option>
										<option value="revising">修订中</option>
										<option value="complete">已完成</option>
									</select>
								</label>
							</div>
							<div className="structured-outline-associations">
								<strong>关联资料</strong>
								<p>人物、地点、剧情线与伏笔将在作者明确选择后显示；本阶段不会自动创建资料。</p>
								<div>
									<span>人物 {selectedNode.characterIds?.length ?? 0}</span>
									<span>剧情线 {selectedNode.plotThreadIds?.length ?? 0}</span>
									<span>伏笔 {selectedNode.foreshadowingIds?.length ?? 0}</span>
								</div>
							</div>
						</>
					)}
				</aside>
			</div>

			{materializationReviewOpen && (
				<section
					className="outline-hierarchy-materialization-dialog"
					role="dialog"
					aria-modal="true"
					aria-labelledby="outline-materialization-title"
				>
					<div className="outline-hierarchy-materialization-card">
						<header>
							<div>
								<span className="eyebrow">ATOMIC APPLY</span>
								<h3 id="outline-materialization-title">创建可写卷、章节和场景</h3>
							</div>
							<button
								type="button"
								aria-label="关闭创建确认"
								onClick={() => setMaterializationReviewOpen(false)}
							>
								<X size={18} />
							</button>
						</header>
						<p>确认后将创建正式项目结构与正文场景锚点。失败时会整体回滚。</p>
						<dl>
							<div><dt>新卷</dt><dd>{volumeCount}</dd></div>
							<div><dt>新章节</dt><dd>{chapterCount}</dd></div>
							<div><dt>新场景</dt><dd>{sceneCount}</dd></div>
						</dl>
						<ul>
							<li>先校验项目与旅程版本</li>
							<li>锁定节点不会被覆盖</li>
							<li>写入前创建安全快照</li>
							<li>项目树、正文与 Story Scene 同步提交</li>
							<li>完成后可在 12 秒内撤销</li>
						</ul>
						<footer>
							<button
								type="button"
								onClick={() => setMaterializationReviewOpen(false)}
								disabled={Boolean(hierarchyBusy)}
							>
								返回检查
							</button>
							<button
								type="button"
								className="primary-button"
								disabled={Boolean(hierarchyBusy)}
								onClick={() => void materializeHierarchy()}
							>
								<Play size={18} />
								{hierarchyBusy === 'materializing'
									? '正在创建并验证…'
									: '确认创建并开始写作'}
							</button>
						</footer>
					</div>
				</section>
			)}

			{candidatePreview && selectedAlternative && previewTarget && (
				<section
					className="structured-outline-candidate-review"
					aria-label="局部候选审核"
				>
					<header>
						<div>
							<span className="eyebrow">FIELD DIFF</span>
							<h3 ref={candidateHeadingRef} tabIndex={-1}>
								比较“{previewTarget.title}”的局部候选
							</h3>
							<p>先比较字段，再决定采用哪些部分。未勾选内容保持原样。</p>
						</div>
						<button
							type="button"
							aria-label="关闭局部候选审核"
							onClick={() => {
								setCandidatePreview(undefined);
								setSelectedCandidateFields([]);
							}}
						>
							关闭
						</button>
					</header>
					<div className="structured-outline-candidate-tabs">
						<span>Current</span>
						<div role="tablist" aria-label="三个局部候选">
							{candidatePreview.alternatives.map((candidate, index) => (
								<button
									key={candidate.label}
									type="button"
									role="tab"
									aria-selected={candidateIndex === index}
									className={candidateIndex === index ? 'is-selected' : ''}
									onClick={() => selectCandidate(index)}
								>
									{String.fromCharCode(65 + index)} · {candidate.label}
								</button>
							))}
						</div>
					</div>
					<p className="structured-outline-candidate-rationale">
						{selectedAlternative.rationale}
					</p>
					<div className="structured-outline-field-diffs">
						{changedDiffs.map(diff => (
							<label key={diff.field} className="structured-outline-field-diff">
								<span className="structured-outline-field-diff-heading">
									<input
										type="checkbox"
										aria-label={`采用 ${diff.label}`}
										checked={selectedCandidateFields.includes(diff.field)}
										onChange={() => setSelectedCandidateFields(fields => (
											fields.includes(diff.field)
												? fields.filter(field => field !== diff.field)
												: [...fields, diff.field]
										))}
									/>
									<strong>{diff.label}</strong>
								</span>
								<span className="structured-outline-field-diff-values">
									<span>
										<small>当前</small>
										<em>{diff.before || '（空）'}</em>
									</span>
									<span>
										<small>候选 {String.fromCharCode(65 + candidateIndex)}</small>
										<em>{diff.after || '（空）'}</em>
									</span>
								</span>
							</label>
						))}
					</div>
					<footer>
						<span>{changedDiffs.length} 个字段发生变化</span>
						<button
							type="button"
							className="primary-button"
							disabled={
								selectedCandidateFields.length === 0
								|| Boolean(authorControlBusy)
							}
							onClick={() => void applyAlternative()}
						>
							{authorControlBusy === 'applying'
								? '正在创建快照并写入…'
								: `采用已选 ${selectedCandidateFields.length} 个字段`}
						</button>
					</footer>
				</section>
			)}

			{impactReport && (
				<section className="structured-outline-impact-report" aria-label="影响报告">
					<header>
						<div>
							<span className="eyebrow">IMPACT REPORT</span>
							<h3>本次局部采用的影响</h3>
						</div>
						<strong>{impactReport.changedFields.length} 个字段已采用</strong>
					</header>
					<p>以下内容只报告，不会自动重写。锁定节点和未选择字段均保持原样。</p>
					{impactReport.downstreamNodes.length > 0 && (
						<ul>
							{impactReport.downstreamNodes.map(node => (
								<li key={node.id}>
									<span>{node.title}</span>
									<small>{node.locked ? '已锁定 · 未修改' : '可能受影响 · 未修改'}</small>
								</li>
							))}
						</ul>
					)}
					{impactReport.materializedChapterIds.length === 0
						&& impactReport.materializedSceneIds.length === 0
						&& impactReport.draftAnchorIds.length === 0 && (
						<p>当前没有物化章节、场景或正文锚点；本次操作只更新所选大纲字段。</p>
					)}
					{canUndoAlternativeApply && onUndoAlternativeApply && (
						<button
							type="button"
							disabled={Boolean(authorControlBusy)}
							onClick={() => void undoAlternative()}
						>
							<RotateCcw size={18} />
							{authorControlBusy === 'undoing' ? '正在撤销…' : '撤销本次 AI 采用'}
						</button>
					)}
				</section>
			)}

			<footer className="structured-outline-status">
				<span>{status}</span>
				<span>{state.outline.length}/8 个节点 · 所有改动保存在当前项目</span>
			</footer>
		</section>
	);
}
