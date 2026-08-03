import {
	DEFAULT_AI_PREFERENCES,
	STORYFORGE_SYSTEM_PROMPT,
	chooseDefaultModel,
	nextAiJobState,
	type AiBalance,
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
import { normalizeAiError } from '../errors/AiErrorPresentation';

export { normalizeAiError } from '../errors/AiErrorPresentation';

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

type SettingsOperationKind =
	| 'initialize'
	| 'save-key'
	| 'delete-key'
	| 'test-connection'
	| 'refresh-models'
	| 'refresh-balance';

export const useAiStore = create<AiStore>((set, get) => {
	let cancellationRequestJobId: string | undefined;
	let settingsOperation: {
		readonly kind: SettingsOperationKind;
		readonly promise: Promise<unknown>;
	} | undefined;
	let persistedPreferences = DEFAULT_AI_PREFERENCES;
	let pendingPreferences: AiProviderPreferences | undefined;
	let preferenceSavePromise: Promise<void> | undefined;

	const flushPendingPreferences = (): Promise<void> => {
		if (preferenceSavePromise) {
			return preferenceSavePromise;
		}
		const savePendingPreferences = async () => {
			while (pendingPreferences) {
				const requested = pendingPreferences;
				pendingPreferences = undefined;
				try {
					const saved = await desktopBridge.saveAiPreferences(requested);
					persistedPreferences = saved;
					if (!pendingPreferences) {
						const status = get().status;
						set({
							preferences: saved,
							status: status ? { ...status, preferences: saved } : status
						});
					}
				} catch (error) {
					if (!pendingPreferences) {
						const status = get().status;
						set({
							preferences: persistedPreferences,
							status: status
								? { ...status, preferences: persistedPreferences }
								: status,
							error: normalizeAiError(error)
						});
					}
				}
			}
		};
		const trackedPromise = savePendingPreferences().finally(() => {
			if (preferenceSavePromise === trackedPromise) {
				preferenceSavePromise = undefined;
			}
			if (pendingPreferences) {
				return flushPendingPreferences();
			}
		});
		preferenceSavePromise = trackedPromise;
		return trackedPromise;
	};

	const runSettingsOperation = <T>(
		kind: SettingsOperationKind,
		busyValue: () => T,
		operation: () => Promise<T>
	): Promise<T> => {
		const activeOperation = settingsOperation;
		if (activeOperation) {
			if (activeOperation.kind === kind) {
				return activeOperation.promise as Promise<T>;
			}
			return activeOperation.promise
				.catch(() => undefined)
				.then(() => runSettingsOperation(kind, busyValue, operation));
		}
		if (get().loading) {
			return Promise.resolve(busyValue());
		}
		set({ loading: true, error: undefined });
		const trackedPromise = (async () => {
				if (preferenceSavePromise) {
					await preferenceSavePromise;
				}
				return operation();
			})()
			.finally(() => {
				if (settingsOperation?.promise === trackedPromise) {
					settingsOperation = undefined;
					set({ loading: false });
				}
			});
		settingsOperation = { kind, promise: trackedPromise };
		return trackedPromise;
	};

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
					partial: event.finishReason === 'length'
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

		initialize() {
			if (get().initialized) {
				return Promise.resolve();
			}
			return runSettingsOperation('initialize', () => undefined, async () => {
				try {
					const [status, preferences, usageSummary] = await Promise.all([
						desktopBridge.getAiProviderStatus(),
						desktopBridge.getAiPreferences(),
						desktopBridge.getAiUsageSummary()
					]);
					persistedPreferences = preferences;
					set({
						initialized: true,
						status,
						preferences,
						usageSummary
					});
				} catch (error) {
					set({ initialized: true, error: normalizeAiError(error) });
				}
			});
		},

		saveKeyAndValidate(key) {
			return runSettingsOperation('save-key', () => undefined, async () => {
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
					persistedPreferences = preferences;
					set({
						status: { ...result.status, secret, preferences },
						preferences,
						models: result.models,
						balance: result.balance
					});
				} catch (error) {
					set({ error: normalizeAiError(error) });
					throw error;
				}
			});
		},

		deleteKey() {
			return runSettingsOperation(
				'delete-key',
				() => get().status?.secret ?? { configured: false, providerId: 'deepseek' },
				async () => {
					try {
						const currentJob = get().jobId;
						const wasActive = Boolean(currentJob)
							&& !['completed', 'cancelled', 'failed'].includes(get().jobState);
						if (currentJob && wasActive) {
							const cancelled = await desktopBridge.cancelAiJob(currentJob);
							const current = get();
							if (
								cancelled
								&& current.jobId === currentJob
								&& !['completed', 'cancelled', 'failed'].includes(current.jobState)
							) {
								set({
									jobState: 'cancelled',
									durationMs: current.startedAt
										? Date.now() - current.startedAt
										: undefined,
									partial: Boolean(current.output)
								});
							}
						}
						const secret = await desktopBridge.deleteDeepSeekKey();
						const status = get().status;
						set({
							status: status
								? { ...status, secret, lastValidatedAt: undefined }
								: undefined,
							models: [],
							balance: undefined,
							jobState: wasActive ? 'cancelled' : get().jobState,
							partial: Boolean(get().output)
						});
						return secret;
					} catch (error) {
						set({ error: normalizeAiError(error) });
						throw error;
					}
				}
			);
		},

		testConnection() {
			return runSettingsOperation('test-connection', () => undefined, async () => {
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
				persistedPreferences = preferences;
				set({
					status: { ...result.status, preferences },
					preferences,
					models: result.models,
					balance: result.balance
				});
				} catch (error) {
					set({ error: normalizeAiError(error) });
				}
			});
		},

		refreshModels() {
			return runSettingsOperation('refresh-models', () => undefined, async () => {
				try {
					const models = await desktopBridge.listDeepSeekModels(true);
				const currentPreferences = get().preferences;
				const defaultModelId = chooseDefaultModel(models, currentPreferences.defaultModelId);
				const preferences = defaultModelId
					&& defaultModelId !== currentPreferences.defaultModelId
					? await desktopBridge.saveAiPreferences({ ...currentPreferences, defaultModelId })
					: currentPreferences;
				persistedPreferences = preferences;
				const status = get().status;
				set({
					models,
					preferences,
					status: status ? { ...status, preferences } : status
				});
				} catch (error) {
					set({ error: normalizeAiError(error) });
				}
			});
		},

		refreshBalance() {
			return runSettingsOperation('refresh-balance', () => undefined, async () => {
				try {
					const balance = await desktopBridge.getDeepSeekBalance();
					set({ balance });
				} catch (error) {
					set({ error: normalizeAiError(error) });
				}
			});
		},

		updatePreferences(preferences) {
			const activeOperation = settingsOperation;
			if (activeOperation) {
				return activeOperation.promise
					.catch(() => undefined)
					.then(() => get().updatePreferences(preferences));
			}
			if (get().loading) {
				return Promise.resolve();
			}
			pendingPreferences = preferences;
			set({ preferences, error: undefined });
			return flushPendingPreferences();
		},

		setPrompt(prompt) {
			set({ prompt });
		},

		async startGeneration() {
			const state = get();
			const prompt = state.prompt.trim();
			const modelId = state.preferences.defaultModelId;
			if (state.loading) {
				return;
			}
			if (!state.status?.secret.configured || !modelId || !prompt) {
				set({ error: normalizeAiError('invalid_configuration') });
				return;
			}
			if (state.jobId && !['completed', 'cancelled', 'failed'].includes(state.jobState)) {
				return;
			}
			const jobId = crypto.randomUUID();
			const request: AiGenerateRequest = {
				jobId,
				jobType: 'storyforge-test',
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
						error: normalizeAiError(error),
						durationMs: Date.now() - (get().startedAt ?? Date.now()),
						partial: Boolean(get().output)
					});
				}
			}
		},

		async cancelGeneration() {
			const { jobId, jobState, output } = get();
			if (
				!jobId
				|| ['completed', 'cancelled', 'failed'].includes(jobState)
				|| cancellationRequestJobId === jobId
			) {
				return;
			}
			cancellationRequestJobId = jobId;
			set({ error: undefined });
			try {
				const cancelled = await desktopBridge.cancelAiJob(jobId);
				const current = get();
				if (
					current.jobId !== jobId
					|| ['completed', 'cancelled', 'failed'].includes(current.jobState)
				) return;
				if (cancelled) {
					set({
						jobState: 'cancelled',
						durationMs: current.startedAt
							? Date.now() - current.startedAt
							: undefined,
						partial: Boolean(output)
					});
				}
			} catch (error) {
				if (get().jobId === jobId) set({ error: normalizeAiError(error) });
			} finally {
				if (cancellationRequestJobId === jobId) cancellationRequestJobId = undefined;
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
