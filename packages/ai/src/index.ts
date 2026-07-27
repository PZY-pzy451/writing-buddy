import { createTextAnchor, type ReviewIssue } from '@writing-buddy/review';
import { z } from 'zod';

export const DEEPSEEK_PROVIDER_ID = 'deepseek' as const;
export const DEEPSEEK_DEFAULT_MODEL_ID = 'deepseek-v4-flash';
export const DEEPSEEK_PRO_MODEL_ID = 'deepseek-v4-pro';
export const DEEPSEEK_RETIRED_MODEL_IDS = ['deepseek-chat', 'deepseek-reasoner'] as const;
export const AI_MAX_OUTPUT_PRESETS = [512, 1024, 2048, 4096, 8192] as const;
export const AI_JOB_QUEUE_LIMIT = 3;

export type AiProviderId = typeof DEEPSEEK_PROVIDER_ID;
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
	readonly jobType: 'storyforge-test';
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
