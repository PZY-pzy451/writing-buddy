import {
	AlertTriangle,
	Check,
	DatabaseZap,
	FileSearch,
	LoaderCircle,
	X
} from 'lucide-react';
import {
	AI_CHAPTER_REVIEW_MAX_CHARS,
	buildStoryExtractionMessages,
	nextAiJobState,
	type AiGenerateRequest,
	type AiJobState,
	type AiStreamEvent
} from '@writing-buddy/ai';
import {
	createStoryId,
	parseEvidenceRef,
	parseStoryPosition,
	toStoryChapterId,
	type PendingFact
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import { describeAiFailure } from '../../ai/errors/AiErrorPresentation';
import { PendingFactStore, StoryExtractionService } from './StoryExtractionService';
import './PendingFactsReview.css';

export interface PendingFactsReviewProps {
	readonly projectRoot: string;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly content: string;
	readonly selection?: { readonly start: number; readonly end: number; readonly text: string };
	readonly store?: PendingFactStore;
	readonly runExtraction?: typeof generateExtraction;
}

const knownAiExtractionErrors = new Set([
	'invalid_configuration',
	'authentication_failed',
	'insufficient_balance',
	'invalid_request',
	'rate_limited',
	'provider_overloaded',
	'provider_server_error',
	'network_unavailable',
	'connection_timeout',
	'first_content_timeout',
	'stream_idle_timeout',
	'stream_parse_failed',
	'stream_incomplete',
	'empty_response',
	'cancelled',
	'secret_store_failed'
]);

function storyExtractionErrorMessage(reason: unknown, fallback: string): string {
	const code = reason instanceof Error ? reason.message : String(reason);
	if (code === 'invalidStoryExtractionInput' || code === 'invalidChapterId') {
		return '当前选区或章节无法发送给 AI。请重新选择非空正文；单次最多提取 100,000 字。';
	}
	if (code.startsWith('invalidStoryExtractionResponse:')) {
		return 'AI 返回的事实结构不完整，本次没有写入项目。请使用相同范围重新提取。';
	}
	if (code === 'invalidPendingFactsFile') {
		return '待确认事实文件无法读取。请先从历史或备份恢复该文件，再重新打开作品。';
	}
	if (code === 'externalChange') {
		return '待确认事实已在其他位置发生变化。请重新打开当前章节后再操作。';
	}
	if (knownAiExtractionErrors.has(code)) {
		const failure = describeAiFailure(reason);
		return `${failure.message} ${failure.guidance}`;
	}
	return fallback;
}

async function generateExtraction(
	content: string,
	resourceId: string,
	sourceRevision: string,
	onState: (state: AiJobState, output: string) => void
): Promise<string> {
	const preferences = await desktopBridge.getAiPreferences();
	if (!preferences.defaultModelId) throw new Error('未配置可用的 DeepSeek 模型。');
	const jobId = crypto.randomUUID();
	const request: AiGenerateRequest = {
		jobId,
		jobType: 'story-extraction',
		providerId: 'deepseek',
		modelId: preferences.defaultModelId,
		messages: buildStoryExtractionMessages({ content, resourceId, sourceRevision }),
		options: {
			stream: true,
			thinkingMode: preferences.thinkingMode,
			reasoningEffort: preferences.thinkingMode === 'enabled' ? 'high' : undefined,
			maxOutputTokens: preferences.maxOutputTokens,
			responseFormat: 'json_object'
		}
	};
	return new Promise((resolve, reject) => {
		let state: AiJobState = 'created';
		let output = '';
		let settled = false;
		const listener = (event: AiStreamEvent) => {
			if (settled || event.jobId !== jobId) return;
			try {
				state = nextAiJobState(state, event);
			} catch {
				return;
			}
			if (event.type === 'content_delta') output += event.text;
			onState(state, output);
			if (event.type === 'completed') {
				settled = true;
				resolve(output);
			} else if (event.type === 'failed') {
				settled = true;
				reject(new Error(event.error.message));
			} else if (event.type === 'cancelled') {
				settled = true;
				reject(new Error('提取已取消。'));
			}
		};
		void desktopBridge.startAiGeneration(request, listener).catch(reason => {
			if (settled) return;
			settled = true;
			reject(reason instanceof Error ? reason : new Error('AI 提取失败。'));
		});
	});
}

export function PendingFactsReview(props: PendingFactsReviewProps): React.JSX.Element {
	const store = useMemo(
		() => props.store ?? new PendingFactStore(props.projectRoot, desktopBridge),
		[props.projectRoot, props.store]
	);
	const service = useMemo(() => new StoryExtractionService(store), [store]);
	const storyResourceId = useMemo(() => {
		try {
			return toStoryChapterId(props.resourceId);
		} catch {
			return '';
		}
	}, [props.resourceId]);
	const extractionContent = props.selection?.text || props.content;
	const inputProblem = !storyResourceId
		? '当前章节标识不可用，请关闭后重新打开该章节。'
		: !extractionContent.trim()
			? '请选择非空正文，或先写入并保存当前章节。'
			: extractionContent.length > AI_CHAPTER_REVIEW_MAX_CHARS
				? '当前范围超过 100,000 字，请缩小选区后再提取。'
				: '';
	const [facts, setFacts] = useState<readonly PendingFact[]>([]);
	const [jobState, setJobState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const generatingRef = useRef(false);
	const generating = !['created', 'completed', 'cancelled', 'failed'].includes(jobState);

	useEffect(() => {
		let cancelled = false;
		void store.load().then(items => {
			if (!cancelled) setFacts(items);
		}).catch(reason => {
			if (!cancelled) setError(storyExtractionErrorMessage(
				reason,
				'待确认事实读取失败。请重新打开作品后再试。'
			));
		});
		return () => {
			cancelled = true;
		};
	}, [store]);

	const extract = async () => {
		if (generatingRef.current || generating || inputProblem) return;
		generatingRef.current = true;
		const selected = props.selection?.text
			? { content: props.selection.text, baseOffset: props.selection.start }
			: { content: props.content, baseOffset: 0 };
		setError('');
		setNotice('');
		setStreamedLength(0);
		setJobState('created');
		try {
			const response = await (props.runExtraction ?? generateExtraction)(
				selected.content,
				storyResourceId,
				String(props.sourceRevision),
				(state, output) => {
					setJobState(state);
					setStreamedLength(output.length);
				}
			);
			const staged = await service.stageFromResponse({
				resourceId: storyResourceId,
				sourceRevision: String(props.sourceRevision),
				content: selected.content,
				baseOffset: selected.baseOffset,
				response
			});
			setFacts(await store.load());
			setJobState('completed');
			setNotice(staged.length > 0
				? `已提取 ${staged.length} 条待确认事实；确认前不会写入正式资料。`
				: '提取完成，当前范围没有可定位的新事实。');
		} catch (reason) {
			setJobState('failed');
			setError(storyExtractionErrorMessage(
				reason,
				'AI 事实提取未完成，本次没有写入项目。请重试。'
			));
		} finally {
			generatingRef.current = false;
		}
	};

	const replaceFact = (fact: PendingFact) => {
		setFacts(current => current.map(candidate => candidate.id === fact.id ? fact : candidate));
	};

	const visibleFacts = facts.filter(fact => (
		fact.sourceResourceId === storyResourceId && fact.status === 'pending'
	));

	return (
		<section className="pending-facts-review" aria-label="AI 故事事实提取">
			<header>
				<div>
					<span className="eyebrow">PENDING FACTS</span>
					<h3>故事事实提取</h3>
				</div>
				<span className="pending-facts-count">{visibleFacts.length} 条待确认</span>
			</header>
			<p className="pending-facts-note">
				<FileSearch size={16} />
				{props.selection?.text
					? '只发送当前选区；提取结果不会自动进入 Story Kernel。'
					: '未选择正文，将发送当前章节；提取结果不会自动进入 Story Kernel。'}
			</p>
			<button
				className="secondary-button full-width"
				type="button"
				disabled={Boolean(inputProblem) || generating}
				onClick={() => void extract()}
			>
				{generating ? <LoaderCircle className="spin" size={18} /> : <DatabaseZap size={18} />}
				{generating ? `正在提取 · ${streamedLength} 字符` : '用 DeepSeek 提取待确认事实'}
			</button>
			{inputProblem ? <p className="pending-facts-error" role="alert"><AlertTriangle size={16} />{inputProblem}</p> : null}
			{error ? <p className="pending-facts-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
			{notice ? <p className="pending-facts-status" role="status"><Check size={16} />{notice}</p> : null}
			<div className="pending-facts-list">
				{visibleFacts.map(fact => (
					<PendingFactCard
						key={fact.id}
						fact={fact}
						onAccept={async (title, statement, narrativeOrder) => {
							if (!fact.suggestedRange || !fact.suggestedQuote) {
								setError('缺少可定位的正文证据，不能接受。');
								return;
							}
							const now = new Date().toISOString();
							const accepted = await service.accept({
								fact,
								title,
								statement,
								evidence: parseEvidenceRef({
									id: createStoryId('evidence'),
									origin: 'ai-extracted',
									resourceId: storyResourceId,
									range: fact.suggestedRange,
									revisionId: fact.sourceRevision,
									quotePreview: fact.suggestedQuote,
									confirmedByAuthor: true,
									confirmedAt: now
								}),
								storyPosition: parseStoryPosition({
									chapterId: storyResourceId,
									narrativeOrder
								})
							});
							replaceFact(accepted);
							setError('');
							setNotice('事实已由作者确认并保存。');
						}}
						onReject={async () => {
							replaceFact(await service.reject(fact));
							setError('');
							setNotice('事实候选已拒绝。');
						}}
						onError={reason => {
							setNotice('');
							setError(storyExtractionErrorMessage(
								reason,
								'事实状态保存失败，当前候选仍保持原状。请重新打开章节后再试。'
							));
						}}
					/>
				))}
				{visibleFacts.length === 0 ? (
					<p className="pending-facts-empty">当前章节没有待确认事实。</p>
				) : null}
			</div>
		</section>
	);
}

function PendingFactCard(props: {
	readonly fact: PendingFact;
	readonly onAccept: (title: string, statement: string, narrativeOrder: number) => Promise<void>;
	readonly onReject: () => Promise<void>;
	readonly onError: (reason: unknown) => void;
}): React.JSX.Element {
	const [title, setTitle] = useState(props.fact.title);
	const [statement, setStatement] = useState(props.fact.statement);
	const [narrativeOrder, setNarrativeOrder] = useState(0);
	const [busy, setBusy] = useState(false);

	const run = async (action: () => Promise<void>) => {
		setBusy(true);
		try {
			await action();
		} catch (reason) {
			props.onError(reason);
		} finally {
			setBusy(false);
		}
	};

	return (
		<article className="pending-fact-card">
			<div className="pending-fact-meta">
				<span>{props.fact.factType}</span>
				<span>{Math.round(props.fact.confidence * 100)}% 置信度</span>
			</div>
			<label>
				<span>标题</span>
				<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} />
			</label>
			<label>
				<span>事实陈述</span>
				<textarea value={statement} maxLength={4_000} onChange={event => setStatement(event.target.value)} />
			</label>
			<blockquote>{props.fact.suggestedQuote}</blockquote>
			<label>
				<span>叙事顺序</span>
				<input
					type="number"
					min={0}
					step={1}
					value={narrativeOrder}
					onChange={event => setNarrativeOrder(Number(event.target.value))}
				/>
			</label>
			<div className="pending-fact-actions">
				<button
					type="button"
					disabled={busy || !title.trim() || !statement.trim() || !Number.isSafeInteger(narrativeOrder)}
					onClick={() => void run(() => props.onAccept(title, statement, narrativeOrder))}
				>
					<Check size={16} />确认并接受
				</button>
				<button type="button" disabled={busy} onClick={() => void run(props.onReject)}>
					<X size={16} />拒绝
				</button>
			</div>
		</article>
	);
}
