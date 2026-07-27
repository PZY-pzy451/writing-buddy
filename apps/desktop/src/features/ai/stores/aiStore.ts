import {
	DEFAULT_AI_PREFERENCES,
	chooseDefaultModel,
	nextAiJobState,
	publicAiErrorMessage,
	type AiBalance,
	type AiErrorCode,
	type AiGenerateRequest,
	type AiJobState,
	type AiModel,
	type AiProviderPreferences,
	type AiProviderStatus,
	type AiStreamEvent,
	type AiUsage,
	type AiUsageSummary,
	type PublicAiError,
	type SecretStatus
} from '@writing-buddy/ai';
import { create } from 'zustand';
import { desktopBridge } from '../../../platform/bridge';

const STORYFORGE_SYSTEM_PROMPT = [
	'你是 StoryForge 的测试生成器。',
	'只回答用户在本面板明确输入的写作指令。',
	'不要请求、推断或提及任何项目、章节、路径、账户或历史信息。',
	'输出纯文本候选内容，不执行修改。'
].join('');

interface AiStore {
	readonly initialized: boolean;
	readonly loading: boolean;
	readonly status?: AiProviderStatus;
	readonly preferences: AiProviderPreferences;
	readonly models: readonly AiModel[];
	readonly balance?: AiBalance;
	readonly usageSummary: AiUsageSummary;
	readonly prompt: string;
	readonly output: string;
	readonly jobId?: string;
	readonly jobState: AiJobState;
	readonly jobUsage?: AiUsage;
	readonly startedAt?: number;
	readonly durationMs?: number;
	readonly partial: boolean;
	readonly error?: PublicAiError;
	readonly initialize: () => Promise<void>;
	readonly saveKeyAndValidate: (key: string) => Promise<void>;
	readonly deleteKey: () => Promise<SecretStatus>;
	readonly testConnection: () => Promise<void>;
	readonly refreshModels: () => Promise<void>;
	readonly refreshBalance: () => Promise<void>;
	readonly updatePreferences: (preferences: AiProviderPreferences) => Promise<void>;
	readonly setPrompt: (prompt: string) => void;
	readonly startGeneration: () => Promise<void>;
	readonly cancelGeneration: () => Promise<void>;
	readonly clearResult: () => void;
}

const emptyUsageSummary: AiUsageSummary = {
	inputTokens: 0,
	outputTokens: 0,
	totalTokens: 0,
	requests: 0
};

function normalizeError(error: unknown): PublicAiError {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const candidate = error as Partial<PublicAiError>;
		const code = candidate.code as AiErrorCode;
		return {
			code,
			message: candidate.message ?? publicAiErrorMessage(code),
			retryable: candidate.retryable ?? false,
			httpStatus: candidate.httpStatus
		};
	}
	const raw = error instanceof Error ? error.message : String(error);
	const knownCodes: readonly AiErrorCode[] = [
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
	];
	const code = knownCodes.find(candidate => raw.includes(candidate)) ?? 'unknown';
	return { code, message: publicAiErrorMessage(code), retryable: false };
}

export const useAiStore = create<AiStore>((set, get) => {
	const onStreamEvent = (event: AiStreamEvent) => {
		const state = get();
		if (event.jobId !== state.jobId) {
			return;
		}
		let nextState = state.jobState;
		try {
			nextState = nextAiJobState(state.jobState, event);
		} catch {
			return;
		}
		switch (event.type) {
			case 'content_delta':
				set({ jobState: nextState, output: state.output + event.text });
				break;
			case 'usage':
				set({ jobUsage: event.usage });
				break;
			case 'completed':
				set({
					jobState: nextState,
					durationMs: state.startedAt ? Date.now() - state.startedAt : undefined,
					partial: false
				});
				void desktopBridge.getAiUsageSummary().then(usageSummary => set({ usageSummary }));
				break;
			case 'cancelled':
				set({
					jobState: nextState,
					durationMs: state.startedAt ? Date.now() - state.startedAt : undefined,
					partial: true
				});
				void desktopBridge.getAiUsageSummary().then(usageSummary => set({ usageSummary }));
				break;
			case 'failed':
				set({
					jobState: nextState,
					error: event.error,
					durationMs: state.startedAt ? Date.now() - state.startedAt : undefined,
					partial: Boolean(state.output)
				});
				void desktopBridge.getAiUsageSummary().then(usageSummary => set({ usageSummary }));
				break;
			default:
				set({ jobState: nextState });
		}
	};

	return {
		initialized: false,
		loading: false,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		usageSummary: emptyUsageSummary,
		prompt: '',
		output: '',
		jobState: 'created',
		partial: false,

		async initialize() {
			if (get().initialized || get().loading) {
				return;
			}
			set({ loading: true, error: undefined });
			try {
				const [status, preferences, usageSummary] = await Promise.all([
					desktopBridge.getAiProviderStatus(),
					desktopBridge.getAiPreferences(),
					desktopBridge.getAiUsageSummary()
				]);
				set({
					initialized: true,
					loading: false,
					status,
					preferences,
					usageSummary
				});
			} catch (error) {
				set({ initialized: true, loading: false, error: normalizeError(error) });
			}
		},

		async saveKeyAndValidate(key) {
			set({ loading: true, error: undefined });
			try {
				const secret = await desktopBridge.saveDeepSeekKey(key);
				const currentStatus = get().status;
				if (currentStatus) {
					set({ status: { ...currentStatus, secret } });
				}
				const result = await desktopBridge.testDeepSeekConnection();
				const defaultModelId = chooseDefaultModel(
					result.models,
					result.status.preferences.defaultModelId
				);
				const preferences = defaultModelId
					&& defaultModelId !== result.status.preferences.defaultModelId
					? await desktopBridge.saveAiPreferences({
						...result.status.preferences,
						defaultModelId
					})
					: result.status.preferences;
				set({
					loading: false,
					status: { ...result.status, secret, preferences },
					preferences,
					models: result.models,
					balance: result.balance
				});
			} catch (error) {
				set({ loading: false, error: normalizeError(error) });
				throw error;
			}
		},

		async deleteKey() {
			const currentJob = get().jobId;
			const wasActive = Boolean(currentJob)
				&& !['completed', 'cancelled', 'failed'].includes(get().jobState);
			if (currentJob && wasActive) {
				await desktopBridge.cancelAiJob(currentJob);
			}
			const secret = await desktopBridge.deleteDeepSeekKey();
			const status = get().status;
			set({
				status: status ? { ...status, secret, lastValidatedAt: undefined } : undefined,
				models: [],
				balance: undefined,
				jobState: wasActive ? 'cancelled' : get().jobState,
				partial: Boolean(get().output)
			});
			return secret;
		},

		async testConnection() {
			set({ loading: true, error: undefined });
			try {
				const result = await desktopBridge.testDeepSeekConnection();
				const defaultModelId = chooseDefaultModel(
					result.models,
					result.status.preferences.defaultModelId
				);
				const preferences = defaultModelId
					&& defaultModelId !== result.status.preferences.defaultModelId
					? await desktopBridge.saveAiPreferences({
						...result.status.preferences,
						defaultModelId
					})
					: result.status.preferences;
				set({
					loading: false,
					status: { ...result.status, preferences },
					preferences,
					models: result.models,
					balance: result.balance
				});
			} catch (error) {
				set({ loading: false, error: normalizeError(error) });
			}
		},

		async refreshModels() {
			set({ loading: true, error: undefined });
			try {
				const models = await desktopBridge.listDeepSeekModels(true);
				const currentPreferences = get().preferences;
				const defaultModelId = chooseDefaultModel(models, currentPreferences.defaultModelId);
				const preferences = defaultModelId
					&& defaultModelId !== currentPreferences.defaultModelId
					? await desktopBridge.saveAiPreferences({ ...currentPreferences, defaultModelId })
					: currentPreferences;
				set({ loading: false, models, preferences });
			} catch (error) {
				set({ loading: false, error: normalizeError(error) });
			}
		},

		async refreshBalance() {
			set({ loading: true, error: undefined });
			try {
				set({ loading: false, balance: await desktopBridge.getDeepSeekBalance() });
			} catch (error) {
				set({ loading: false, error: normalizeError(error) });
			}
		},

		async updatePreferences(preferences) {
			const previous = get().preferences;
			set({ preferences, error: undefined });
			try {
				const saved = await desktopBridge.saveAiPreferences(preferences);
				const status = get().status;
				set({
					preferences: saved,
					status: status ? { ...status, preferences: saved } : status
				});
			} catch (error) {
				set({ preferences: previous, error: normalizeError(error) });
			}
		},

		setPrompt(prompt) {
			set({ prompt });
		},

		async startGeneration() {
			const state = get();
			const prompt = state.prompt.trim();
			const modelId = state.preferences.defaultModelId;
			if (!state.status?.secret.configured || !modelId || !prompt) {
				set({ error: normalizeError('invalid_configuration') });
				return;
			}
			if (state.jobId && !['completed', 'cancelled', 'failed'].includes(state.jobState)) {
				await desktopBridge.cancelAiJob(state.jobId);
			}
			const jobId = crypto.randomUUID();
			const request: AiGenerateRequest = {
				jobId,
				providerId: 'deepseek',
				modelId,
				messages: [
					{ role: 'system', content: STORYFORGE_SYSTEM_PROMPT },
					{ role: 'user', content: prompt }
				],
				options: {
					stream: true,
					thinkingMode: state.preferences.thinkingMode,
					reasoningEffort: state.preferences.thinkingMode === 'enabled' ? 'high' : undefined,
					maxOutputTokens: state.preferences.maxOutputTokens,
					responseFormat: 'text'
				}
			};
			set({
				jobId,
				jobState: 'created',
				output: '',
				jobUsage: undefined,
				startedAt: Date.now(),
				durationMs: undefined,
				partial: false,
				error: undefined
			});
			try {
				await desktopBridge.startAiGeneration(request, onStreamEvent);
			} catch (error) {
				if (get().jobId === jobId && !['completed', 'cancelled', 'failed'].includes(get().jobState)) {
					set({
						jobState: 'failed',
						error: normalizeError(error),
						durationMs: Date.now() - (get().startedAt ?? Date.now()),
						partial: Boolean(get().output)
					});
				}
			}
		},

		async cancelGeneration() {
			const { jobId, jobState, output } = get();
			if (!jobId || ['completed', 'cancelled', 'failed'].includes(jobState)) {
				return;
			}
			const cancelled = await desktopBridge.cancelAiJob(jobId);
			if (cancelled) {
				set({
					jobState: 'cancelled',
					durationMs: get().startedAt ? Date.now() - get().startedAt! : undefined,
					partial: Boolean(output)
				});
			}
		},

		clearResult() {
			if (!['completed', 'cancelled', 'failed', 'created'].includes(get().jobState)) {
				return;
			}
			set({
				output: '',
				jobId: undefined,
				jobState: 'created',
				jobUsage: undefined,
				startedAt: undefined,
				durationMs: undefined,
				partial: false,
				error: undefined
			});
		}
	};
});
