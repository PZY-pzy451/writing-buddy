import {
	AlertTriangle,
	Check,
	ClipboardList,
	Compass,
	RotateCcw,
	Send,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildManuscriptContinuationMessages,
	parseManuscriptContinuationResponse,
	type AiJobState,
	type AiUsage
} from '@writing-buddy/ai';
import {
	areEditContentsEquivalent,
	EditTransactionService
} from '@writing-buddy/project';
import {
	DesktopStoryRepository,
	DeterministicContextPackBuilder,
	serializeContextPackForAi,
	toStoryChapterId,
	withContextItemIncluded,
	type ContextPack,
	type ManuscriptContinuationMode,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { CandidateDiffView } from './CandidateDiffView';
import { ContextPackPreview } from './ContextPackPreview';
import { AiJobCancelButton } from './AiJobCancelButton';
import {
	buildContinuationDiff,
	ContinuationService,
	createContinuationCandidate,
	formatContinuationInsertion,
	isContinuationCandidateStale,
	type ContinuationCandidate,
	type ContinuationCandidateBatch
} from './ManuscriptContinuationService';
import { resolveManuscriptContinuationTarget } from './ManuscriptContinuationTarget';
import { loadGroundedContextCandidates } from './SelectionRewriteService';
import { runGroundedJsonJob } from './GroundedAiRunner';
import './AiActionPanels.css';

const contextBuilder = new DeterministicContextPackBuilder();
const emptyContinuationSourceMessage = '当前光标前还没有正文。请先输入一句开头，或创建场景后让 AI 起草。';

const modeInstructions: Readonly<Record<ManuscriptContinuationMode, string>> = {
	'continue-paragraph': '沿着当前段落的动作、感官与叙事视角续写一小段，不引入上下文中没有依据的新设定。',
	'finish-scene': '收束当前场景的目标与冲突，给出一个可继续衔接下一场的场景结尾。',
	'three-directions': '基于同一处光标生成三种实质不同的后续走向，分别强调推进、悬念或人物选择。'
};

type ContinuationProgress = (
	output: string,
	state: AiJobState,
	usage?: AiUsage
) => void;

export interface ManuscriptContinuationPanelProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly cursorOffset: number;
	readonly mode: ManuscriptContinuationMode;
	readonly readOnly: boolean;
	readonly theme: 'vs' | 'vs-dark';
	readonly onApply: (start: number, end: number, text: string) => void;
	readonly onReplaceDocument: (content: string) => void;
	readonly onBeforeApply?: (label: string) => Promise<void>;
	readonly onPendingDraft?: (
		candidate: ContinuationCandidate,
		batch: ContinuationCandidateBatch,
		insertion: string
	) => void;
	readonly loadPack?: (guidance: string) => Promise<ContextPack>;
	readonly runContinuation?: (
		pack: ContextPack,
		onProgress: ContinuationProgress
	) => Promise<{ readonly output: string; readonly usage?: AiUsage }>;
}

async function buildContinuationPack(
	props: Pick<
		ManuscriptContinuationPanelProps,
		'projectRoot' | 'resourceId' | 'sourceRevision' | 'content' | 'cursorOffset' | 'mode'
	>,
	guidance: string
): Promise<ContextPack> {
	const repository = new DesktopStoryRepository(props.projectRoot, desktopBridge);
	const chapterId = toStoryChapterId(props.resourceId);
	const scenes = await repository.list<StoryScene>('scene');
	const target = resolveManuscriptContinuationTarget(
		props.content,
		props.cursorOffset,
		props.mode
	);
	const scene = scenes.find(candidate => (
		candidate.chapterId === chapterId
		&& candidate.manuscriptRange.start <= target.cursorOffset
		&& target.cursorOffset <= candidate.manuscriptRange.end
	));
	const firstScene = [...scenes]
		.filter(candidate => candidate.chapterId === chapterId)
		.sort((left, right) => (
			left.narrativeOrder - right.narrativeOrder
			|| left.manuscriptRange.start - right.manuscriptRange.start
		))[0];
	if (props.mode === 'finish-scene' && !scene) {
		throw new Error('请先把光标放在已建立的场景中，再使用“完成场景”。');
	}
	const end = props.mode === 'finish-scene'
		? scene!.manuscriptRange.end
		: target.cursorOffset;
	const start = props.mode === 'finish-scene'
		? scene!.manuscriptRange.start
		: target.openingDraft
			? 0
			: Math.max(scene?.manuscriptRange.start ?? 0, target.cursorOffset - 4_000);
	const source = props.content.slice(start, end);
	if (!source.trim()) {
		throw new Error(emptyContinuationSourceMessage);
	}
	const candidates = await loadGroundedContextCandidates({
		repository,
		chapterId,
		selectionStart: target.openingDraft && firstScene
			? firstScene.manuscriptRange.start
			: Math.max(start, Math.min(target.cursorOffset, end - 1))
	});
	const trimmedGuidance = guidance.trim();
	const baseInstruction = target.openingDraft
		? props.mode === 'three-directions'
			? '当前章节尚无正文。依据已确认的章节与首个场景结构，生成三种实质不同的开篇走向；不得声称承接不存在的前文。'
			: '当前章节尚无正文。依据已确认的章节与首个场景结构起草本章开篇的一小段；不得声称承接不存在的前文。'
		: modeInstructions[props.mode];
	const instruction = trimmedGuidance
		? `${baseInstruction}\n作者明确要求：${trimmedGuidance}`
		: baseInstruction;
	return contextBuilder.build({
		actionType: props.mode,
		instruction,
		sourceKind: props.mode === 'finish-scene' ? 'scene-manuscript' : 'manuscript-excerpt',
		sourceTitle: props.mode === 'finish-scene'
			? '当前场景正文'
			: target.openingDraft
				? '章节与场景结构（尚无正文）'
				: '光标前文',
		selection: {
			text: source,
			resourceId: props.resourceId,
			revision: props.sourceRevision,
			start,
			end
		},
		candidates,
		budgetTokens: 4_096
	});
}

async function defaultRunContinuation(
	pack: ContextPack,
	onProgress: ContinuationProgress,
	onJobId: (jobId: string | undefined) => void
): Promise<{ readonly output: string; readonly usage?: AiUsage }> {
	return runGroundedJsonJob({
		jobType: 'manuscript-continuation',
		messages: buildManuscriptContinuationMessages(serializeContextPackForAi(pack)),
		onJobId,
		onProgress: progress => onProgress(
			progress.output,
			progress.state,
			progress.usage
		)
	});
}

function insertionLocation(content: string, cursorOffset: number): string {
	const safeOffset = Math.max(0, Math.min(cursorOffset, content.length));
	const before = content.slice(0, safeOffset);
	const line = before.split('\n').length;
	const lastBreak = before.lastIndexOf('\n');
	const column = safeOffset - lastBreak;
	return `插入位置：第 ${line} 行，第 ${column} 列`;
}

function withoutAuthorSecrets(pack: ContextPack): ContextPack {
	return pack.items
		.filter(item => item.authorSecret && item.included)
		.reduce(
			(current, item) => withContextItemIncluded(current, item.id, false),
			pack
		);
}

function continuationGenerationError(reason: unknown): string {
	if (!(reason instanceof Error)) return '续写候选生成失败。';
	if (reason.message.startsWith('invalidManuscriptContinuationResponse:')) {
		return 'AI 返回的正文候选结构不完整，未写入正文。请重试；若持续出现，请缩短本次作者指令。';
	}
	if (reason.message === 'invalidContinuationCandidateCount') {
		return 'AI 返回的候选数量不符合本次模式，未写入正文。请重新生成。';
	}
	return reason.message;
}

export function ManuscriptContinuationPanel(
	props: ManuscriptContinuationPanelProps
): React.JSX.Element {
	const service = useMemo(
		() => new ContinuationService(new EditTransactionService()),
		[]
	);
	const [guidance, setGuidance] = useState('');
	const [loadedGuidance, setLoadedGuidance] = useState<string>();
	const [pack, setPack] = useState<ContextPack>();
	const [batch, setBatch] = useState<ContinuationCandidateBatch>();
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [lastAppliedContent, setLastAppliedContent] = useState<string>();
	const [rejectedCandidateIds, setRejectedCandidateIds] = useState<ReadonlySet<string>>(
		() => new Set()
	);
	const [diffCandidateId, setDiffCandidateId] = useState<string>();
	const [acceptingCandidateId, setAcceptingCandidateId] = useState<string>();
	const acceptingRef = useRef(false);
	const [success, setSuccess] = useState<string>();
	const [error, setError] = useState<string>();
	const generatingRef = useRef(false);
	const contentRef = useRef(props.content);
	const revisionRef = useRef(props.sourceRevision);
	const loadPackOverride = props.loadPack;
	const projectRoot = props.projectRoot;
	const resourceId = props.resourceId;
	const sourceRevision = props.sourceRevision;
	const content = props.content;
	const cursorOffset = props.cursorOffset;
	const mode = props.mode;
	const target = useMemo(
		() => resolveManuscriptContinuationTarget(props.content, props.cursorOffset, props.mode),
		[props.content, props.cursorOffset, props.mode]
	);

	useEffect(() => {
		contentRef.current = props.content;
		revisionRef.current = props.sourceRevision;
	}, [props.content, props.sourceRevision]);

	const load = useCallback(async () => {
		if (loadPackOverride) return loadPackOverride(guidance);
		return buildContinuationPack({
			projectRoot,
			resourceId,
			sourceRevision,
			content,
			cursorOffset,
			mode
		}, guidance);
	}, [
		content,
		cursorOffset,
		guidance,
		loadPackOverride,
		mode,
		projectRoot,
		resourceId,
		sourceRevision
	]);

	useEffect(() => {
		if (batch) return;
		let cancelled = false;
		void load().then(value => {
			if (!cancelled) {
				setPack(withoutAuthorSecrets(value));
				setLoadedGuidance(guidance.trim());
				setJobState('created');
				setError(undefined);
			}
		}).catch(reason => {
			if (!cancelled) {
				setError(reason instanceof Error ? reason.message : '无法构建续写上下文。');
			}
		});
		return () => {
			cancelled = true;
		};
	}, [batch, guidance, load]);

	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const packReady = pack?.source.resourceId === props.resourceId
		&& pack.source.revision === props.sourceRevision
		&& pack.actionType === props.mode
		&& loadedGuidance === guidance.trim()
		&& (props.mode === 'finish-scene' || pack.source.end === target.cursorOffset);
	const stale = useMemo(() => batch && batch.status !== 'accepted'
		? isContinuationCandidateStale(batch, props.sourceRevision, props.content)
		: false, [batch, props.content, props.sourceRevision]);
	const includedGrounding = useMemo(() => pack?.items.filter(item => (
		item.included
		&& !item.required
		&& !item.authorSecret
	)) ?? [], [pack]);
	const includedSecrets = useMemo(() => pack?.items.filter(item => (
		item.included && item.authorSecret
	)) ?? [], [pack]);
	const emptyContextHint = error === emptyContinuationSourceMessage;

	const generate = async () => {
		if (
			!pack
			|| generatingRef.current
			|| generating
			|| props.readOnly
			|| !packReady
		) return;
		generatingRef.current = true;
		setBatch(undefined);
		setRejectedCandidateIds(new Set());
		setDiffCandidateId(undefined);
		setError(undefined);
		setSuccess(undefined);
		setStreamedLength(0);
		setJobState('queued');
		try {
			const onProgress: ContinuationProgress = (output, state) => {
				setJobState(state);
				setStreamedLength(output.length);
			};
			const result = props.runContinuation
				? await props.runContinuation(pack, onProgress)
				: await defaultRunContinuation(pack, onProgress, setActiveJobId);
			const candidates = parseManuscriptContinuationResponse(result.output, props.mode);
			const nextBatch = createContinuationCandidate({
				mode: props.mode,
				resourceId: props.resourceId,
				sourceRevision: props.sourceRevision,
				cursorOffset: target.cursorOffset,
				currentContent: props.content,
				response: { candidates }
			});
			setBatch(nextBatch);
			const candidate = nextBatch.candidates[0];
			if (
				props.onPendingDraft
				&& props.mode === 'continue-paragraph'
				&& candidate
			) {
				props.onPendingDraft(
					candidate,
					nextBatch,
					formatContinuationInsertion(
						props.content,
						nextBatch.cursorOffset,
						candidate.content
					)
				);
				setSuccess('AI 临时草稿已放到正文目标位置，可在原地修改、写入或丢弃。');
			}
			setJobState('completed');
		} catch (reason) {
			setJobState('failed');
			setError(continuationGenerationError(reason));
		} finally {
			generatingRef.current = false;
		}
	};

	const accept = async (candidateId: string) => {
		if (
			!batch
			|| acceptingRef.current
			|| rejectedCandidateIds.has(candidateId)
		) return;
		const candidate = batch.candidates.find(value => value.id === candidateId);
		if (!candidate) return;
		acceptingRef.current = true;
		setAcceptingCandidateId(candidateId);
		setError(undefined);
		setSuccess(undefined);
		try {
			await props.onBeforeApply?.(`AI 续写：${candidate.title}`);
			const currentContent = contentRef.current;
			const currentRevision = revisionRef.current;
			if (isContinuationCandidateStale(batch, currentRevision, currentContent)) {
				throw new Error('安全快照创建后正文已经变化，请重新生成候选。');
			}
			const result = service.accept(
				batch,
				candidateId,
				currentRevision,
				currentContent
			);
			props.onApply(batch.cursorOffset, batch.cursorOffset, result.insertion);
			setLastAppliedContent(result.content);
			setBatch({ ...batch, status: 'accepted' });
			setSuccess('安全快照已创建，候选已插入；如不满意可立即撤销。');
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '候选已经过期。');
		} finally {
			acceptingRef.current = false;
			setAcceptingCandidateId(undefined);
		}
	};

	const reject = (candidateId: string) => {
		setRejectedCandidateIds(current => new Set([...current, candidateId]));
		if (diffCandidateId === candidateId) setDiffCandidateId(undefined);
	};

	const undo = () => {
		if (
			!lastAppliedContent
			|| !areEditContentsEquivalent(props.content, lastAppliedContent)
		) {
			setError('正文在插入后又被编辑，已停止自动撤销以保护后续修改。');
			return;
		}
		try {
			const result = service.undo(props.content);
			props.onReplaceDocument(result.content);
			setLastAppliedContent(undefined);
			setBatch(undefined);
			setSuccess(undefined);
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '无法撤销本次续写。');
		}
	};

	return (
		<section className="ai-action-panel continuation-panel" aria-label="作者确认续写">
			<div className="ai-action-intro">
				<Compass size={18} />
				<div>
					<strong>{target.openingDraft ? '将从首个场景开始起草' : '续写位置已锁定'}</strong>
					<span>
						{insertionLocation(props.content, target.cursorOffset)}
						{' · '}
						{target.openingDraft
							? '依据已确认场景生成候选，确认前不会写入正文'
							: '生成只会产生候选，不会自动写入正文'}
					</span>
				</div>
			</div>
			<label className="continuation-guidance">
				<span>告诉 AI 接下来发生什么</span>
				<textarea
					value={guidance}
					maxLength={600}
					aria-label="告诉 AI 接下来发生什么"
					placeholder={target.openingDraft
						? '例如：从异常声音切入，保持克制悬疑'
						: '留空则让 AI 自由继续'}
					onChange={event => {
						setGuidance(event.target.value);
						setPack(undefined);
						setLoadedGuidance(undefined);
						setBatch(undefined);
						setRejectedCandidateIds(new Set());
						setDiffCandidateId(undefined);
						setSuccess(undefined);
					}}
				/>
				<small>{guidance.trim() && loadedGuidance === guidance.trim()
					? `作者明确要求：${guidance.trim()}`
					: guidance.trim()
						? '正在更新作者指令…'
						: target.openingDraft
							? '可选引导；不填写时会从首个已确认场景起草。'
							: '可选引导，不填写也可以自由续写。'}</small>
			</label>
			{pack && packReady
				? <ContextPackPreview
					pack={pack}
					disabled={generating}
					onChange={value => setPack(withoutAuthorSecrets(value))}
					/>
				: error
					? null
					: <p className="ai-action-loading"><Sparkles size={16} />正在构建续写上下文…</p>}
			{emptyContextHint ? (
				<p className="ai-action-hint" role="status">
					<Compass size={16} />{emptyContinuationSourceMessage}
				</p>
			) : null}
			{error && !emptyContextHint
				? <p className="ai-action-error" role="alert"><AlertTriangle size={16} />{error}</p>
				: null}
			{success ? <p className="ai-action-success" role="status"><Check size={16} />{success}</p> : null}
			<div className="ai-action-toolbar">
				<button
					className="primary-button"
					type="button"
					disabled={!packReady || generating || props.readOnly || batch?.status === 'accepted'}
					onClick={() => void generate()}
				>
					{generating ? <Sparkles size={18} /> : <Send size={18} />}
					{generating
						? `AI 生成中 · ${streamedLength} 字符`
						: target.openingDraft
							? '确认资料并生成开篇'
							: '确认资料并生成候选'}
				</button>
				{generating && activeJobId ? (
					<AiJobCancelButton
						jobId={activeJobId}
						className="secondary-button"
						showIcon
						onErrorChange={setError}
					/>
				) : null}
			</div>
			{batch && !(props.onPendingDraft && props.mode === 'continue-paragraph') ? (
				<div className="continuation-candidates">
					{stale ? (
						<p className="ai-action-stale">
							<AlertTriangle size={16} />正文或光标锚点已变化，请重新生成候选。
						</p>
					) : null}
					{batch.candidates.map((candidate, index) => {
						const rejected = rejectedCandidateIds.has(candidate.id);
						const insertion = formatContinuationInsertion(
							props.content,
							batch.cursorOffset,
							candidate.content
						);
						const diff = buildContinuationDiff(
							props.content,
							batch.cursorOffset,
							insertion
						);
						return (
							<article
								className={`continuation-candidate ${rejected ? 'is-rejected' : ''}`}
								key={candidate.id}
								aria-label={`候选：${candidate.title}`}
							>
								<header>
									<span>方向 {index + 1}</span>
									<strong>{candidate.title}</strong>
									{rejected ? <em>已拒绝</em> : null}
								</header>
								<p className="continuation-copy">{candidate.content}</p>
								<p className="ai-action-rationale">{candidate.rationale}</p>
								<div className="continuation-grounding">
									<strong>{insertionLocation(props.content, batch.cursorOffset)}</strong>
									{includedGrounding.length > 0 ? (
										<p>
											依据：{includedGrounding.map(item => item.title).join('、')}
										</p>
									) : <p>依据：仅使用当前正文与作者指令</p>}
									<p className={includedSecrets.length > 0 ? 'is-warning' : ''}>
										{includedSecrets.length > 0
											? `已明确使用作者秘密：${includedSecrets.map(item => item.title).join('、')}`
											: '未使用作者秘密'}
									</p>
								</div>
								{diffCandidateId === candidate.id && !rejected ? (
									<CandidateDiffView
										original={diff.original}
										modified={diff.modified}
										theme={props.theme}
									/>
								) : null}
								<div className="continuation-candidate-actions">
									<button
										type="button"
										disabled={rejected || stale || batch.status !== 'candidate' || props.readOnly || Boolean(acceptingCandidateId)}
										onClick={() => void accept(candidate.id)}
									>
										<Check size={16} />
										{acceptingCandidateId === candidate.id ? '创建快照中…' : '插入'}
									</button>
									<button
										type="button"
										disabled={rejected}
										aria-expanded={diffCandidateId === candidate.id}
										onClick={() => setDiffCandidateId(current => (
											current === candidate.id ? undefined : candidate.id
										))}
									>
										<ClipboardList size={16} />查看差异
									</button>
									<button
										type="button"
										disabled={rejected || batch.status !== 'candidate'}
										onClick={() => reject(candidate.id)}
									>
										<X size={16} />拒绝
									</button>
								</div>
							</article>
						);
					})}
					{batch.status === 'candidate' ? (
						<button
							className="ai-action-reject"
							type="button"
							onClick={() => setRejectedCandidateIds(
								new Set(batch.candidates.map(candidate => candidate.id))
							)}
						>
							<X size={16} />全部放弃
						</button>
					) : null}
				</div>
			) : null}
			{lastAppliedContent ? (
				<button
					className="ai-action-undo"
					type="button"
					disabled={!areEditContentsEquivalent(props.content, lastAppliedContent)}
					title={areEditContentsEquivalent(props.content, lastAppliedContent)
						? '恢复插入前的正文'
						: '正文已继续编辑；请使用编辑器原生撤销选择需要恢复的内容'}
					onClick={undo}
				>
					<RotateCcw size={16} />
					{areEditContentsEquivalent(props.content, lastAppliedContent)
						? '撤销本次插入'
						: '正文已继续编辑，自动撤销已停用'}
				</button>
			) : null}
		</section>
	);
}
