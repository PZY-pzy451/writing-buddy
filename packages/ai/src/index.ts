import { createTextAnchor, hashText, type ReviewIssue } from '@writing-buddy/review';
import { z } from 'zod';

export const DEEPSEEK_PROVIDER_ID = 'deepseek' as const;
export const DEEPSEEK_DEFAULT_MODEL_ID = 'deepseek-v4-flash';
export const DEEPSEEK_PRO_MODEL_ID = 'deepseek-v4-pro';
export const DEEPSEEK_RETIRED_MODEL_IDS = ['deepseek-chat', 'deepseek-reasoner'] as const;
export const AI_MAX_OUTPUT_PRESETS = [512, 1024, 2048, 4096, 8192] as const;
export const AI_JOB_QUEUE_LIMIT = 3;
export const AI_CHAPTER_REVIEW_MAX_CHARS = 100_000;
export const STORYFORGE_SYSTEM_PROMPT = [
	'你是 StoryForge 的测试生成器。',
	'只回答用户在本面板明确输入的写作指令。',
	'不要请求、推断或提及任何项目、章节、路径、账户或历史信息。',
	'输出纯文本候选内容，不执行修改。'
].join('');
export const CHAPTER_REVIEW_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的中文小说审校器。',
	'只分析用户 JSON 中 content 字段提供的当前章节，不请求、推断或提及项目、路径、账户或历史信息。',
	'找出明确的错别字、语病、标点、重复、指代、逻辑或表达问题；不要续写正文。',
	'仅返回 JSON 对象：{"issues":[{"start":0,"end":1,"target":"原文片段","severity":"info|suggestion|warning|error","title":"简短标题","message":"问题说明","replacement":"可选替换文本"}]}。',
	'start 和 end 使用 JavaScript UTF-16 字符索引；每条 target 必须与 content 中对应原文完全一致，最多返回 50 条。'
].join('');
export const SELECTION_REWRITE_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的选区改写助手。',
	'只改写用户 JSON 中 P1 当前选区，不补写整章，不推断未提供的故事事实。',
	'其余 context 只用于保持人物状态、世界规则、剧情线和信息权限一致。',
	'仅返回 JSON 对象：{"suggestion":"改写候选","rationale":"简短依据","potentialImpact":"对上下文的潜在影响"}。',
	'候选只是建议，不得声称已经修改正文。'
].join('');

export type AiProviderId = typeof DEEPSEEK_PROVIDER_ID;
export type AiJobType = 'storyforge-test' | 'chapter-review' | 'selection-rewrite';
export type AiThinkingMode = 'disabled' | 'enabled';
export type AiReasoningEffort = 'high';
export type AiResponseFormat = 'text' | 'json_object';
export type AiJobState =
	| 'created'
	| 'queued'
	| 'connecting'
	| 'thinking'
	| 'streaming'
	| 'completed'
	| 'cancelled'
	| 'failed';

export type AiErrorCode =
	| 'invalid_configuration'
	| 'authentication_failed'
	| 'insufficient_balance'
	| 'invalid_request'
	| 'rate_limited'
	| 'provider_overloaded'
	| 'provider_server_error'
	| 'network_unavailable'
	| 'connection_timeout'
	| 'first_content_timeout'
	| 'stream_idle_timeout'
	| 'stream_parse_failed'
	| 'stream_incomplete'
	| 'empty_response'
	| 'cancelled'
	| 'secret_store_failed'
	| 'unknown';

export interface AiProviderCapabilities {
	readonly streaming: boolean;
	readonly modelDiscovery: boolean;
	readonly accountBalance: boolean;
	readonly thinkingMode: boolean;
	readonly jsonOutput: boolean;
	readonly toolCalls: boolean;
}

export interface AiProviderDefinition {
	readonly id: AiProviderId;
	readonly displayName: string;
	readonly capabilities: AiProviderCapabilities;
}

export class AiProviderRegistry {
	private readonly providers = new Map<AiProviderId, AiProviderDefinition>();

	register(provider: AiProviderDefinition): void {
		if (this.providers.has(provider.id)) {
			throw new Error('providerAlreadyRegistered');
		}
		this.providers.set(provider.id, provider);
	}

	get(providerId: AiProviderId): AiProviderDefinition {
		const provider = this.providers.get(providerId);
		if (!provider) {
			throw new Error('providerNotFound');
		}
		return provider;
	}

	list(): readonly AiProviderDefinition[] {
		return [...this.providers.values()];
	}
}

export function createDeepSeekProviderDefinition(): AiProviderDefinition {
	return {
		id: DEEPSEEK_PROVIDER_ID,
		displayName: 'DeepSeek',
		capabilities: {
			streaming: true,
			modelDiscovery: true,
			accountBalance: true,
			thinkingMode: true,
			jsonOutput: true,
			toolCalls: false
		}
	};
}

export interface AiProviderPreferences {
	readonly providerId: AiProviderId;
	readonly defaultModelId?: string;
	readonly thinkingMode: AiThinkingMode;
	readonly reasoningEffort?: AiReasoningEffort;
	readonly maxOutputTokens: typeof AI_MAX_OUTPUT_PRESETS[number];
	readonly connectionTimeoutMs: number;
	readonly firstContentTimeoutMs: number;
	readonly streamIdleTimeoutMs: number;
}

export const DEFAULT_AI_PREFERENCES: AiProviderPreferences = {
	providerId: DEEPSEEK_PROVIDER_ID,
	defaultModelId: DEEPSEEK_DEFAULT_MODEL_ID,
	thinkingMode: 'disabled',
	maxOutputTokens: 2048,
	connectionTimeoutMs: 15_000,
	firstContentTimeoutMs: 180_000,
	streamIdleTimeoutMs: 120_000
};

const preferencesSchema = z.object({
	providerId: z.literal(DEEPSEEK_PROVIDER_ID).optional(),
	defaultModelId: z.string().min(1).max(128).optional(),
	thinkingMode: z.enum(['disabled', 'enabled']).optional(),
	reasoningEffort: z.literal('high').optional(),
	maxOutputTokens: z.union([
		z.literal(512),
		z.literal(1024),
		z.literal(2048),
		z.literal(4096),
		z.literal(8192)
	]).optional(),
	connectionTimeoutMs: z.number().int().min(1_000).max(60_000).optional(),
	firstContentTimeoutMs: z.number().int().min(1_000).max(300_000).optional(),
	streamIdleTimeoutMs: z.number().int().min(1_000).max(300_000).optional()
});

export function normalizeAiPreferences(input: unknown): AiProviderPreferences {
	const parsed = preferencesSchema.parse(input);
	const defaultModelId = parsed.defaultModelId
		&& !(DEEPSEEK_RETIRED_MODEL_IDS as readonly string[]).includes(parsed.defaultModelId)
		? parsed.defaultModelId
		: DEEPSEEK_DEFAULT_MODEL_ID;
	const thinkingMode = parsed.thinkingMode ?? DEFAULT_AI_PREFERENCES.thinkingMode;
	return {
		...DEFAULT_AI_PREFERENCES,
		...parsed,
		defaultModelId,
		thinkingMode,
		reasoningEffort: thinkingMode === 'enabled' ? 'high' : undefined
	};
}

export interface AiModel {
	readonly id: string;
	readonly ownedBy: string;
}

export interface AiBalance {
	readonly available: boolean;
	readonly balances: readonly {
		readonly currency: string;
		readonly totalBalance: string;
		readonly grantedBalance: string;
		readonly toppedUpBalance: string;
	}[];
}

export interface SecretStatus {
	readonly configured: boolean;
	readonly providerId: AiProviderId;
	readonly updatedAt?: string;
	readonly fingerprint?: string;
}

export interface AiProviderStatus {
	readonly provider: AiProviderDefinition;
	readonly secret: SecretStatus;
	readonly preferences: AiProviderPreferences;
	readonly lastValidatedAt?: string;
}

export interface AiConnectionTestResult {
	readonly status: AiProviderStatus;
	readonly models: readonly AiModel[];
	readonly balance: AiBalance;
}

export function chooseDefaultModel(
	models: readonly AiModel[],
	savedModelId?: string
): string | undefined {
	if (savedModelId && models.some(model => model.id === savedModelId)) {
		return savedModelId;
	}
	if (models.some(model => model.id === DEEPSEEK_DEFAULT_MODEL_ID)) {
		return DEEPSEEK_DEFAULT_MODEL_ID;
	}
	return models[0]?.id;
}

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
	readonly role: AiRole;
	readonly content: string;
}

export interface AiGenerationOptions {
	readonly stream: true;
	readonly thinkingMode: AiThinkingMode;
	readonly reasoningEffort?: AiReasoningEffort;
	readonly maxOutputTokens: typeof AI_MAX_OUTPUT_PRESETS[number];
	readonly responseFormat: AiResponseFormat;
}

export interface AiGenerateRequest {
	readonly jobId: string;
	readonly jobType: AiJobType;
	readonly providerId: AiProviderId;
	readonly modelId: string;
	readonly messages: readonly AiMessage[];
	readonly options: AiGenerationOptions;
}

export interface AiUsage {
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly totalTokens?: number;
	readonly cachedInputTokens?: number;
}

export interface PublicAiError {
	readonly code: AiErrorCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly httpStatus?: number;
}

export type AiStreamEvent =
	| { readonly type: 'job_started'; readonly jobId: string }
	| { readonly type: 'connection_opened'; readonly jobId: string }
	| { readonly type: 'thinking_started'; readonly jobId: string }
	| { readonly type: 'content_delta'; readonly jobId: string; readonly text: string }
	| { readonly type: 'usage'; readonly jobId: string; readonly usage: AiUsage }
	| { readonly type: 'completed'; readonly jobId: string; readonly finishReason?: string }
	| { readonly type: 'cancelled'; readonly jobId: string }
	| { readonly type: 'failed'; readonly jobId: string; readonly error: PublicAiError };

const terminalStates: readonly AiJobState[] = ['completed', 'cancelled', 'failed'];

export function nextAiJobState(current: AiJobState, event: AiStreamEvent): AiJobState {
	const requested: AiJobState = (() => {
		switch (event.type) {
			case 'job_started':
			case 'connection_opened':
				return 'connecting';
			case 'thinking_started':
				return 'thinking';
			case 'content_delta':
				return 'streaming';
			case 'completed':
				return 'completed';
			case 'cancelled':
				return 'cancelled';
			case 'failed':
				return 'failed';
			case 'usage':
				return current;
		}
	})();
	if (requested === current) {
		return current;
	}
	const allowed: Readonly<Record<AiJobState, readonly AiJobState[]>> = {
		created: ['queued', 'connecting', 'cancelled', 'failed'],
		queued: ['connecting', 'cancelled', 'failed'],
		connecting: ['thinking', 'streaming', 'completed', 'cancelled', 'failed'],
		thinking: ['streaming', 'completed', 'cancelled', 'failed'],
		streaming: ['completed', 'cancelled', 'failed'],
		completed: [],
		cancelled: [],
		failed: []
	};
	if (terminalStates.includes(current) || !allowed[current].includes(requested)) {
		throw new Error('invalidJobTransition');
	}
	return requested;
}

export function shouldRetryAiFailure(input: {
	readonly errorCode: AiErrorCode;
	readonly retryCount: number;
	readonly receivedContent: boolean;
}): boolean {
	return !input.receivedContent
		&& input.retryCount < 2
		&& ['network_unavailable', 'rate_limited', 'provider_server_error', 'provider_overloaded']
			.includes(input.errorCode);
}

export function canQueueAiJob(queuedJobs: number): boolean {
	return Number.isInteger(queuedJobs)
		&& queuedJobs >= 0
		&& queuedJobs < AI_JOB_QUEUE_LIMIT;
}

export interface AiUsageRecord extends AiUsage {
	readonly timestamp: string;
	readonly providerId: AiProviderId;
	readonly modelId: string;
	readonly jobType: AiJobType;
	readonly durationMs: number;
	readonly status: 'completed' | 'cancelled' | 'failed';
}

export interface AiUsageSummary {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly totalTokens: number;
	readonly requests: number;
}

export function aggregateAiUsage(records: readonly AiUsageRecord[]): AiUsageSummary {
	return records.reduce<AiUsageSummary>((summary, record) => ({
		inputTokens: summary.inputTokens + (record.inputTokens ?? 0),
		outputTokens: summary.outputTokens + (record.outputTokens ?? 0),
		totalTokens: summary.totalTokens + (record.totalTokens
			?? (record.inputTokens ?? 0) + (record.outputTokens ?? 0)),
		requests: summary.requests + 1
	}), { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 });
}

const chapterReviewResponseSchema = z.object({
	issues: z.array(z.object({
		start: z.number().int().nonnegative(),
		end: z.number().int().nonnegative(),
		target: z.string().min(1).max(4_000),
		severity: z.enum(['info', 'suggestion', 'warning', 'error']),
		title: z.string().min(1).max(80),
		message: z.string().min(1).max(500),
		replacement: z.string().max(4_000).optional()
	}).strict()).max(50)
}).strict();

const selectionRewriteResponseSchema = z.object({
	suggestion: z.string().min(1).max(12_000),
	rationale: z.string().min(1).max(1_000),
	potentialImpact: z.string().max(1_000).optional().default('')
}).strict();

export interface SelectionRewriteResponse {
	readonly suggestion: string;
	readonly rationale: string;
	readonly potentialImpact: string;
}

export function buildSelectionRewriteMessages(contextPackJson: string): readonly AiMessage[] {
	const payload = JSON.parse(contextPackJson) as unknown;
	if (
		!payload
		|| typeof payload !== 'object'
		|| !('schemaVersion' in payload)
		|| payload.schemaVersion !== 1
		|| !('context' in payload)
		|| !Array.isArray(payload.context)
		|| contextPackJson.length > 40_000
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(contextPackJson)
	) {
		throw new Error('invalidSelectionRewriteContext');
	}
	return [
		{ role: 'system', content: SELECTION_REWRITE_SYSTEM_PROMPT },
		{ role: 'user', content: contextPackJson }
	];
}

export function parseSelectionRewriteResponse(response: string): SelectionRewriteResponse {
	return selectionRewriteResponseSchema.parse(JSON.parse(response));
}

export function buildChapterReviewMessages(content: string): readonly AiMessage[] {
	if (!content.trim() || content.length > AI_CHAPTER_REVIEW_MAX_CHARS) {
		throw new Error('invalidReviewContent');
	}
	return [
		{ role: 'system', content: CHAPTER_REVIEW_SYSTEM_PROMPT },
		{
			role: 'user',
			content: JSON.stringify({ schemaVersion: 1, content })
		}
	];
}

export function parseChapterReviewResponse(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly response: string;
}): readonly ReviewIssue[] {
	const parsed = chapterReviewResponseSchema.parse(JSON.parse(input.response));
	const now = new Date().toISOString();
	return parsed.issues.flatMap((candidate, index): readonly ReviewIssue[] => {
		let start = candidate.start;
		let end = candidate.end;
		if (end < start || input.content.slice(start, end) !== candidate.target) {
			const first = input.content.indexOf(candidate.target);
			const second = first >= 0
				? input.content.indexOf(candidate.target, first + Math.max(1, candidate.target.length))
				: -1;
			if (first < 0 || second >= 0) {
				return [];
			}
			start = first;
			end = first + candidate.target.length;
		}
		return [{
			id: `ai-review:${input.resourceId}:${start}:${hashText(`${candidate.title}:${candidate.target}:${index}`)}`,
			projectId: input.projectId,
			resourceId: input.resourceId,
			ruleId: 'ai-chapter-review',
			severity: candidate.severity,
			status: 'open',
			title: candidate.title,
			message: candidate.message,
			anchor: createTextAnchor(input.content, start, end),
			...(candidate.replacement === undefined ? {} : { replacement: candidate.replacement }),
			createdAt: now,
			updatedAt: now,
			origin: 'ai'
		}];
	});
}

export function publicAiErrorMessage(code: AiErrorCode): string {
	const messages: Readonly<Record<AiErrorCode, string>> = {
		invalid_configuration: 'AI 配置不完整。',
		authentication_failed: 'API Key 无效或已经失效。',
		insufficient_balance: 'DeepSeek 余额不足。',
		invalid_request: '请求格式、模型或参数不受支持。',
		rate_limited: '请求过多，请稍后再试。',
		provider_overloaded: 'DeepSeek 当前繁忙，请稍后重试。',
		provider_server_error: 'DeepSeek 服务异常。',
		network_unavailable: '无法连接 DeepSeek，请检查网络。',
		connection_timeout: '连接 DeepSeek 超时。',
		first_content_timeout: '等待首段内容超时。',
		stream_idle_timeout: '生成流长时间没有新内容。',
		stream_parse_failed: 'DeepSeek 返回了无法解析的流。',
		stream_incomplete: '生成连接提前中断。',
		empty_response: 'DeepSeek 没有返回候选内容。',
		cancelled: '生成已停止。',
		secret_store_failed: 'Windows 凭据管理器操作失败。',
		unknown: 'AI 请求失败。'
	};
	return messages[code];
}

// Existing local-only selection workflow. Phase 1.0A keeps this fake provider
// but deliberately removes its network bridge.
export interface AiRequest {
	readonly requestId: string;
	readonly model: string;
	readonly messages: readonly AiMessage[];
	readonly task: 'polish' | 'shorten' | 'grammar' | 'dialogue' | 'rhythm' | 'review';
}

export interface AiSuggestion {
	readonly original: string;
	readonly replacement: string;
	readonly reason: string;
	readonly scope: string;
}

export interface AiProvider {
	readonly id: string;
	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion>;
}

const responseSchema = z.object({
	replacement: z.string(),
	reason: z.string().min(1),
	scope: z.string().min(1).default('当前选区')
});

export function buildSelectionContext(input: {
	readonly projectTitle: string;
	readonly chapterTitle: string;
	readonly selection: string;
	readonly before: string;
	readonly after: string;
}): readonly AiMessage[] {
	return [
		{
			role: 'system',
			content: '你是 Writing Buddy 的写作助手。只针对作者明确选择的文字提出建议，不扩展、泄露或虚构未提供的全文。返回 JSON。'
		},
		{
			role: 'user',
			content: JSON.stringify({
				project: input.projectTitle,
				chapter: input.chapterTitle,
				selection: input.selection,
				localContext: { before: input.before, after: input.after },
				responseSchema: { replacement: 'string', reason: 'string', scope: 'string' }
			})
		}
	];
}

export function parseAiSuggestion(original: string, response: string): AiSuggestion {
	const parsed = responseSchema.parse(JSON.parse(response));
	return { original, ...parsed };
}

export class FakeAiProvider implements AiProvider {
	readonly id = 'fake';

	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion> {
		if (signal?.aborted) {
			return Promise.reject(new DOMException('Cancelled', 'AbortError'));
		}
		let selectionMessage = '';
		for (let index = request.messages.length - 1; index >= 0; index--) {
			const message = request.messages[index];
			if (message?.role === 'user') {
				selectionMessage = message.content;
				break;
			}
		}
		let original = '';
		try {
			const decoded = JSON.parse(selectionMessage) as { selection?: string };
			original = decoded.selection ?? '';
		} catch {
			original = selectionMessage;
		}
		return Promise.resolve({
			original,
			replacement: original
				.replace(/非常非常/gu, '格外')
				.replace(/然后然后/gu, '随后')
				.replace(/[ \t]{2,}/gu, ' '),
			reason: '减少重复表达，让句子更紧凑。',
			scope: '当前选区'
		});
	}
}

export function suggestionToReviewIssue(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly start: number;
	readonly end: number;
	readonly content: string;
	readonly suggestion: AiSuggestion;
}): ReviewIssue {
	const now = new Date().toISOString();
	return {
		id: `ai:${input.resourceId}:${input.start}:${crypto.randomUUID()}`,
		projectId: input.projectId,
		resourceId: input.resourceId,
		ruleId: 'ai-suggestion',
		severity: 'suggestion',
		status: 'open',
		title: 'AI 润色建议',
		message: input.suggestion.reason,
		anchor: createTextAnchor(input.content, input.start, input.end),
		replacement: input.suggestion.replacement,
		createdAt: now,
		updatedAt: now,
		origin: 'ai'
	};
}
