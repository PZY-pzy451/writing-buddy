import {
	AlertTriangle,
	Check,
	ClipboardList,
	RotateCcw,
	Send,
	Sparkles,
	X
} from 'lucide-react';
import { EditTransactionService } from '@writing-buddy/project';
import {
	DesktopStoryRepository,
	DeterministicContextPackBuilder,
	serializeContextPackForAi,
	toStoryChapterId,
	type ContextPack,
	type ContextPackRequest
} from '@writing-buddy/story-kernel';
import {
	buildSelectionRewriteMessages,
	nextAiJobState,
	parseSelectionRewriteResponse,
	type AiGenerateRequest,
	type AiJobState,
	type AiStreamEvent,
	type AiUsage
} from '@writing-buddy/ai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { CandidateDiffView } from './CandidateDiffView';
import { ContextPackPreview } from './ContextPackPreview';
import {
	createRewriteCandidate,
	isRewriteCandidateStale,
	loadGroundedContextCandidates,
	SelectionRewriteService,
	type RewriteCandidate
} from './SelectionRewriteService';
import './SelectionRewritePanel.css';

const rewriteService = new SelectionRewriteService(new EditTransactionService());
const contextBuilder = new DeterministicContextPackBuilder();
const actionInstructions: Readonly<Record<ContextPackRequest['actionType'], string>> = {
	polish: '保持事实、视角和人物语气，只润色当前选区。',
	concise: '压缩重复表达，只返回更精炼的当前选区。',
	grammar: '修正语病、标点和指代，不改变情节事实。',
	dialogue: '优化当前选区的对话自然度，保持人物既有语言风格。',
	pacing: '调整当前选区节奏，不扩写选区外内容。'
};

export interface SelectionRewritePanelProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly selection: { readonly start: number; readonly end: number; readonly text: string };
	readonly theme: 'vs' | 'vs-dark';
	readonly actionType: ContextPackRequest['actionType'];
	readonly onApply: (start: number, end: number, text: string) => void;
	readonly onReplaceDocument: (content: string) => void;
	readonly onSaveNote?: (candidate: RewriteCandidate) => void;
	readonly loadPack?: () => Promise<ContextPack>;
	readonly runRewrite?: (
		pack: ContextPack,
		onProgress: (output: string, state: AiJobState, usage?: AiUsage) => void
	) => Promise<{ readonly output: string; readonly usage?: AiUsage }>;
}

async function defaultRunRewrite(
	pack: ContextPack,
	onProgress: (output: string, state: AiJobState, usage?: AiUsage) => void
): Promise<{ readonly output: string; readonly usage?: AiUsage }> {
	const preferences = await desktopBridge.getAiPreferences();
	if (!preferences.defaultModelId) throw new Error('未配置可用的 DeepSeek 模型。');
	const jobId = crypto.randomUUID();
	const request: AiGenerateRequest = {
		jobId,
		jobType: 'selection-rewrite',
		providerId: 'deepseek',
		modelId: preferences.defaultModelId,
		messages: buildSelectionRewriteMessages(serializeContextPackForAi(pack)),
		options: {
			stream: true,
			thinkingMode: preferences.thinkingMode,
			reasoningEffort: preferences.thinkingMode === 'enabled' ? 'high' : undefined,
			maxOutputTokens: preferences.maxOutputTokens,
			responseFormat: 'json_object'
		}
	};
	return new Promise((resolve, reject) => {
		let output = '';
		let usage: AiUsage | undefined;
		let state: AiJobState = 'created';
		let settled = false;
		const finish = (result?: { readonly output: string; readonly usage?: AiUsage }, error?: Error) => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else if (result) resolve(result);
		};
		const listener = (event: AiStreamEvent) => {
			if (event.jobId !== jobId || settled) return;
			try {
				state = nextAiJobState(state, event);
			} catch {
				return;
			}
			if (event.type === 'content_delta') output += event.text;
			if (event.type === 'usage') usage = event.usage;
			onProgress(output, state, usage);
			if (event.type === 'completed') finish({ output, ...(usage ? { usage } : {}) });
			if (event.type === 'failed') finish(undefined, new Error(event.error.message));
			if (event.type === 'cancelled') finish(undefined, new Error('生成已取消。'));
		};
		void desktopBridge.startAiGeneration(request, listener).catch(reason => {
			finish(undefined, reason instanceof Error ? reason : new Error('AI 生成失败。'));
		});
	});
}

export function SelectionRewritePanel(props: SelectionRewritePanelProps): React.JSX.Element {
	const [pack, setPack] = useState<ContextPack>();
	const [candidate, setCandidate] = useState<RewriteCandidate>();
	const [draft, setDraft] = useState('');
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [usage, setUsage] = useState<AiUsage>();
	const [lastAppliedContent, setLastAppliedContent] = useState<string>();
	const [error, setError] = useState<string>();
	const loadPackOverride = props.loadPack;
	const projectRoot = props.projectRoot;
	const resourceId = props.resourceId;
	const actionType = props.actionType;
	const selection = props.selection;
	const sourceRevision = props.sourceRevision;

	const load = useCallback(async () => {
		if (loadPackOverride) return loadPackOverride();
		const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
		const candidates = await loadGroundedContextCandidates({
			repository,
			chapterId: toStoryChapterId(resourceId),
			selectionStart: selection.start
		});
		return contextBuilder.build({
			actionType,
			instruction: actionInstructions[actionType],
			selection: {
				...selection,
				resourceId,
				revision: sourceRevision
			},
			candidates,
			budgetTokens: 4_096
		});
	}, [
		actionType,
		loadPackOverride,
		projectRoot,
		resourceId,
		selection,
		sourceRevision
	]);

	useEffect(() => {
		let cancelled = false;
		const timer = window.setTimeout(() => {
			void load().then(value => {
				if (!cancelled) {
					setPack(value);
					setCandidate(undefined);
					setError(undefined);
				}
			}).catch(reason => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : '上下文构建失败。');
			});
		}, 0);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [load]);

	const stale = useMemo(() => candidate
		? isRewriteCandidateStale(candidate, props.sourceRevision, props.content)
		: false, [candidate, props.content, props.sourceRevision]);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);

	const generate = async () => {
		if (!pack || generating) return;
		setJobState('created');
		setStreamedLength(0);
		setUsage(undefined);
		setCandidate(undefined);
		setError(undefined);
		try {
			const result = await (props.runRewrite ?? defaultRunRewrite)(pack, (output, state, nextUsage) => {
				setStreamedLength(output.length);
				setJobState(state);
				if (nextUsage) setUsage(nextUsage);
			});
			const response = parseSelectionRewriteResponse(result.output);
			const next = createRewriteCandidate({ pack, response, ...(result.usage ? { usage: result.usage } : {}) });
			setCandidate(next);
			setDraft(next.suggestion);
			setUsage(result.usage);
			setJobState('completed');
		} catch (reason) {
			setJobState('failed');
			setError(reason instanceof Error ? reason.message : '生成候选失败。');
		}
	};

	const accept = (replacement: string) => {
		if (!candidate) return;
		try {
			const applied = rewriteService.accept(candidate, props.sourceRevision, props.content, replacement);
			props.onApply(candidate.range.start, candidate.range.end, applied.replacement);
			setLastAppliedContent(applied.content);
			setCandidate({ ...candidate, status: 'accepted' });
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '候选已经过期。');
		}
	};

	const undo = () => {
		if (!lastAppliedContent) return;
		try {
			const result = rewriteService.undo(lastAppliedContent);
			props.onReplaceDocument(result.content);
			setLastAppliedContent(undefined);
			setCandidate(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '无法撤销候选。');
		}
	};

	return (
		<section className="selection-rewrite-panel" aria-label="Grounded 选区改写">
			{pack ? <ContextPackPreview pack={pack} onChange={setPack} /> : <p className="rewrite-loading">正在构建 Context Pack…</p>}
			{error ? <p className="rewrite-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
			<button className="primary-button full-width" type="button" disabled={!pack || generating || candidate?.status === 'accepted'} onClick={() => void generate()}>
				{generating ? <Sparkles size={17} /> : <Send size={17} />}
				{generating ? `DeepSeek 流式生成中 · ${streamedLength} 字符` : '确认 Context Pack 并生成'}
			</button>
			{candidate ? (
				<section className="rewrite-candidate">
					<header>
						<div><span className="eyebrow">AUTHOR CANDIDATE</span><h3>改写候选</h3></div>
						{candidate.usage?.totalTokens ? <span>{candidate.usage.totalTokens} tokens</span> : null}
					</header>
					{stale ? <p className="rewrite-stale"><AlertTriangle size={15} />正文已变化，此候选不可接受。</p> : null}
					<CandidateDiffView original={candidate.original} modified={draft} theme={props.theme} />
					<label className="rewrite-draft"><span>可编辑候选（编辑后接受即为部分接受）</span><textarea value={draft} onChange={event => setDraft(event.target.value)} /></label>
					<div className="rewrite-rationale"><strong>依据</strong><p>{candidate.rationale}</p><strong>潜在影响</strong><p>{candidate.potentialImpact || '未发现对既有事实的直接影响。'}</p></div>
					<div className="rewrite-actions">
						<button type="button" disabled={stale || candidate.status !== 'candidate'} onClick={() => accept(candidate.suggestion)}><Check size={15} />全部接受</button>
						<button type="button" disabled={stale || candidate.status !== 'candidate' || draft === candidate.suggestion} onClick={() => accept(draft)}><ClipboardList size={15} />接受编辑内容</button>
						{props.onSaveNote ? <button type="button" onClick={() => props.onSaveNote?.(candidate)}><ClipboardList size={15} />保存到笔记</button> : null}
						<button type="button" onClick={() => setCandidate({ ...candidate, status: 'rejected' })}><X size={15} />拒绝</button>
					</div>
				</section>
			) : null}
			{candidate?.status === 'accepted' && lastAppliedContent ? (
				<button className="rewrite-undo" type="button" onClick={undo}><RotateCcw size={15} />撤销本次接受</button>
			) : null}
			{usage?.totalTokens && !candidate ? <small className="rewrite-usage">本次生成使用 {usage.totalTokens} tokens</small> : null}
		</section>
	);
}
