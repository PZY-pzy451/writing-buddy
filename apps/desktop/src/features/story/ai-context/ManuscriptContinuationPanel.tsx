import {
	AlertTriangle,
	Check,
	Compass,
	RotateCcw,
	Send,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildManuscriptContinuationMessages,
	parseManuscriptContinuationResponse,
	type AiJobState
} from '@writing-buddy/ai';
import { EditTransactionService } from '@writing-buddy/project';
import {
	DesktopStoryRepository,
	DeterministicContextPackBuilder,
	serializeContextPackForAi,
	toStoryChapterId,
	type ContextPack,
	type ManuscriptContinuationMode,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { ContextPackPreview } from './ContextPackPreview';
import {
	ContinuationService,
	createContinuationCandidate,
	isContinuationCandidateStale,
	type ContinuationCandidateBatch
} from './ManuscriptContinuationService';
import { loadGroundedContextCandidates } from './SelectionRewriteService';
import { runGroundedJsonJob } from './GroundedAiRunner';
import './AiActionPanels.css';

const continuationService = new ContinuationService(new EditTransactionService());
const contextBuilder = new DeterministicContextPackBuilder();

const modeInstructions: Readonly<Record<ManuscriptContinuationMode, string>> = {
	'continue-paragraph': '沿着当前段落的动作、感官与叙事视角续写一小段，不引入上下文中没有依据的新设定。',
	'finish-scene': '收束当前场景的目标与冲突，给出一个可继续衔接下一场的场景结尾。',
	'three-directions': '基于同一处光标生成三种实质不同的后续走向，分别强调推进、悬念或人物选择。'
};

export interface ManuscriptContinuationPanelProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly cursorOffset: number;
	readonly mode: ManuscriptContinuationMode;
	readonly readOnly: boolean;
	readonly onApply: (start: number, end: number, text: string) => void;
	readonly onReplaceDocument: (content: string) => void;
}

async function buildContinuationPack(
	props: Pick<
		ManuscriptContinuationPanelProps,
		'projectRoot' | 'resourceId' | 'sourceRevision' | 'content' | 'cursorOffset' | 'mode'
	>
): Promise<ContextPack> {
	const repository = new DesktopStoryRepository(props.projectRoot, desktopBridge);
	const chapterId = toStoryChapterId(props.resourceId);
	const scenes = await repository.list<StoryScene>('scene');
	const scene = scenes.find(candidate => (
		candidate.chapterId === chapterId
		&& candidate.manuscriptRange.start <= props.cursorOffset
		&& props.cursorOffset <= candidate.manuscriptRange.end
	));
	if (props.mode === 'finish-scene' && !scene) {
		throw new Error('请先把光标放在已建立的场景中，再使用“完成场景”。');
	}
	const end = props.mode === 'finish-scene'
		? scene!.manuscriptRange.end
		: props.cursorOffset;
	const start = props.mode === 'finish-scene'
		? scene!.manuscriptRange.start
		: Math.max(scene?.manuscriptRange.start ?? 0, props.cursorOffset - 4_000);
	const source = props.content.slice(start, end);
	if (!source.trim()) {
		throw new Error('光标前没有可用于续写的正文。');
	}
	const candidates = await loadGroundedContextCandidates({
		repository,
		chapterId,
		selectionStart: Math.max(start, Math.min(props.cursorOffset, end - 1))
	});
	return contextBuilder.build({
		actionType: props.mode,
		instruction: modeInstructions[props.mode],
		sourceKind: props.mode === 'finish-scene' ? 'scene-manuscript' : 'manuscript-excerpt',
		sourceTitle: props.mode === 'finish-scene' ? '当前场景正文' : '光标前文',
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

export function ManuscriptContinuationPanel(
	props: ManuscriptContinuationPanelProps
): React.JSX.Element {
	const [pack, setPack] = useState<ContextPack>();
	const [batch, setBatch] = useState<ContinuationCandidateBatch>();
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [lastAppliedContent, setLastAppliedContent] = useState<string>();
	const [error, setError] = useState<string>();
	const { content, cursorOffset, mode, projectRoot, resourceId, sourceRevision } = props;

	useEffect(() => {
		let cancelled = false;
		void buildContinuationPack({
			content,
			cursorOffset,
			mode,
			projectRoot,
			resourceId,
			sourceRevision
		}).then(value => {
			if (!cancelled) {
				setPack(value);
				setBatch(undefined);
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
	}, [content, cursorOffset, mode, projectRoot, resourceId, sourceRevision]);

	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);
	const packReady = pack?.source.resourceId === props.resourceId
		&& pack.source.revision === props.sourceRevision
		&& pack.actionType === props.mode
		&& (props.mode === 'finish-scene' || pack.source.end === props.cursorOffset);
	const stale = useMemo(() => batch
		? isContinuationCandidateStale(batch, props.sourceRevision, props.content)
		: false, [batch, props.content, props.sourceRevision]);

	const generate = async () => {
		if (!pack || generating || props.readOnly) return;
		setBatch(undefined);
		setError(undefined);
		setStreamedLength(0);
		setJobState('created');
		try {
			const result = await runGroundedJsonJob({
				jobType: 'manuscript-continuation',
				messages: buildManuscriptContinuationMessages(serializeContextPackForAi(pack)),
				onJobId: setActiveJobId,
				onProgress: progress => {
					setJobState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const candidates = parseManuscriptContinuationResponse(result.output, props.mode);
			setBatch(createContinuationCandidate({
				mode: props.mode,
				resourceId: props.resourceId,
				sourceRevision: props.sourceRevision,
				cursorOffset: props.cursorOffset,
				currentContent: props.content,
				response: { candidates }
			}));
			setJobState('completed');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '续写候选生成失败。');
		}
	};

	const accept = (candidateId: string) => {
		if (!batch) return;
		try {
			const result = continuationService.accept(
				batch,
				candidateId,
				props.sourceRevision,
				props.content
			);
			props.onApply(batch.cursorOffset, batch.cursorOffset, result.insertion);
			setLastAppliedContent(result.content);
			setBatch({ ...batch, status: 'accepted' });
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '候选已经过期。');
		}
	};

	const undo = () => {
		if (!lastAppliedContent) return;
		try {
			const result = continuationService.undo(lastAppliedContent);
			props.onReplaceDocument(result.content);
			setLastAppliedContent(undefined);
			setBatch(undefined);
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
					<strong>续写位置已锁定</strong>
					<span>光标偏移 {props.cursorOffset} · 生成只会产生候选，不会自动写入正文</span>
				</div>
			</div>
			{pack && packReady
				? <ContextPackPreview pack={pack} onChange={setPack} />
				: <p className="ai-action-loading"><Sparkles size={16} />正在构建续写上下文…</p>}
			{error ? <p className="ai-action-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
			<div className="ai-action-toolbar">
				<button
					className="primary-button"
					type="button"
					disabled={!packReady || generating || props.readOnly || batch?.status === 'accepted'}
					onClick={() => void generate()}
				>
					{generating ? <Sparkles size={17} /> : <Send size={17} />}
					{generating ? `DeepSeek 生成中 · ${streamedLength} 字符` : '确认资料并生成候选'}
				</button>
				{generating && activeJobId ? (
					<button
						className="secondary-button"
						type="button"
						onClick={() => void desktopBridge.cancelAiJob(activeJobId)}
					>
						<X size={16} />取消
					</button>
				) : null}
			</div>
			{batch ? (
				<div className="continuation-candidates">
					{stale ? (
						<p className="ai-action-stale">
							<AlertTriangle size={15} />正文或光标锚点已变化，请重新生成候选。
						</p>
					) : null}
					{batch.candidates.map((candidate, index) => (
						<article className="continuation-candidate" key={candidate.id}>
							<header>
								<span>方向 {index + 1}</span>
								<strong>{candidate.title}</strong>
							</header>
							<p className="continuation-copy">{candidate.content}</p>
							<p className="ai-action-rationale">{candidate.rationale}</p>
							<button
								type="button"
								disabled={stale || batch.status !== 'candidate' || props.readOnly}
								onClick={() => accept(candidate.id)}
							>
								<Check size={16} />插入此候选
							</button>
						</article>
					))}
					{batch.status === 'candidate' ? (
						<button
							className="ai-action-reject"
							type="button"
							onClick={() => setBatch({ ...batch, status: 'rejected' })}
						>
							<X size={15} />全部放弃
						</button>
					) : null}
				</div>
			) : null}
			{batch?.status === 'accepted' && lastAppliedContent ? (
				<button className="ai-action-undo" type="button" onClick={undo}>
					<RotateCcw size={15} />撤销本次插入
				</button>
			) : null}
		</section>
	);
}
