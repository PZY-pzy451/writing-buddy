import {
	createAiPreviewTransaction,
	createDefaultAiActionRegistry,
	createDefaultPromptRegistry,
	buildAiContextPack,
	buildPromptMessages,
	rejectAiPreview,
	validateAiOutput,
	withAiContextRecordIncluded,
	type AiActionDefinition,
	type AiActionId,
	type AiActionJobMetadata,
	type AiContextPack,
	type AiContextScopeData,
	type AiPreviewTransaction
} from '@writing-buddy/ai-actions';
import {
	type AiGenerateRequest,
	type AiProviderPreferences,
	type AiProviderStatus,
	type AiStreamEvent,
	type AiUsage
} from '@writing-buddy/ai';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { desktopBridge } from '../../../platform/bridge';

export type AiGenerationDrawerState =
	| 'idle'
	| 'validating_context'
	| 'queued'
	| 'connecting'
	| 'streaming'
	| 'validating_output'
	| 'preview'
	| 'applying'
	| 'completed'
	| 'cancelled'
	| 'failed'
	| 'stale';

export interface AiActionOpenScope {
	readonly context: AiContextScopeData;
	readonly currentResourceType?: string;
	readonly baseRevision?: string | number;
}

export interface AiGenerationRuntime {
	readonly getAiProviderStatus: () => Promise<AiProviderStatus>;
	readonly getAiPreferences: () => Promise<AiProviderPreferences>;
	readonly startAiGeneration: (
		request: AiGenerateRequest,
		listener: (event: AiStreamEvent) => void
	) => Promise<void>;
	readonly cancelAiJob: (jobId: string) => Promise<boolean>;
}

export interface AiGenerationStore {
	readonly open: boolean;
	readonly expanded: boolean;
	readonly state: AiGenerationDrawerState;
	readonly definition?: AiActionDefinition;
	readonly input?: unknown;
	readonly scope?: AiActionOpenScope;
	readonly contextPack?: AiContextPack;
	readonly unavailableReason?: string;
	readonly jobId?: string;
	readonly jobMetadata?: AiActionJobMetadata;
	readonly usage?: AiUsage;
	readonly rawOutput: string;
	readonly parsedOutput?: unknown;
	readonly transaction?: AiPreviewTransaction;
	readonly error?: string;
	readonly repairInstruction?: string;
	readonly openAiAction: (
		actionId: AiActionId,
		input: unknown,
		scope: AiActionOpenScope
	) => void;
	readonly close: () => void;
	readonly toggleExpanded: () => void;
	readonly setContextRecordIncluded: (key: string, included: boolean) => void;
	readonly startGeneration: () => Promise<void>;
	readonly cancelGeneration: () => Promise<void>;
	readonly rejectPreview: () => void;
	readonly markStale: (currentRevision: string | number) => void;
	readonly reset: () => void;
}

const defaultRuntime: AiGenerationRuntime = {
	getAiProviderStatus: () => desktopBridge.getAiProviderStatus(),
	getAiPreferences: () => desktopBridge.getAiPreferences(),
	startAiGeneration: (request, listener) => desktopBridge.startAiGeneration(request, listener),
	cancelAiJob: jobId => desktopBridge.cancelAiJob(jobId)
};

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'object' && error && 'message' in error) {
		return String(error.message);
	}
	return String(error);
}

export function createAiGenerationStore(
	runtime: AiGenerationRuntime = defaultRuntime
): StoreApi<AiGenerationStore> {
	const actions = createDefaultAiActionRegistry();
	const prompts = createDefaultPromptRegistry();
	let pendingDelta = '';
	let flushTimer: number | undefined;

	return createStore<AiGenerationStore>((set, get) => {
		const flushOutput = () => {
			if (!pendingDelta) return;
			const delta = pendingDelta;
			pendingDelta = '';
			if (flushTimer !== undefined) {
				window.clearTimeout(flushTimer);
				flushTimer = undefined;
			}
			set(state => ({ rawOutput: state.rawOutput + delta }));
		};
		const queueDelta = (text: string) => {
			pendingDelta += text;
			if (flushTimer === undefined) {
				flushTimer = window.setTimeout(flushOutput, 40);
			}
		};
		const onStreamEvent = (event: AiStreamEvent) => {
			const current = get();
			if (event.jobId !== current.jobId) return;
			switch (event.type) {
				case 'job_started':
				set({ state: 'queued' });
				break;
				case 'connection_opened':
					set({ state: 'connecting' });
					break;
				case 'thinking_started':
					set({ state: 'streaming' });
					break;
				case 'content_delta':
					queueDelta(event.text);
					set({ state: 'streaming' });
					break;
				case 'usage':
					set({ usage: event.usage });
					break;
				case 'cancelled':
					flushOutput();
					set({ state: 'cancelled' });
					break;
				case 'failed':
					flushOutput();
					set({ state: 'failed', error: event.error.message });
					break;
				case 'completed': {
					flushOutput();
					set({ state: 'validating_output' });
					const latest = get();
					try {
						if (!latest.definition || !latest.scope || !latest.contextPack) {
							throw new Error('missingAiActionState');
						}
						const parsedOutput = validateAiOutput(
							latest.definition.outputSchema,
							latest.rawOutput
						);
						const resourceId = latest.contextPack.currentResource?.resourceId
							?? latest.contextPack.project?.resourceId
							?? 'ai-preview';
						const transaction = createAiPreviewTransaction({
							actionId: latest.definition.id,
							resourceId,
							baseRevision: latest.scope.baseRevision ?? '0',
							applyPolicy: latest.definition.applyPolicy,
							candidate: parsedOutput
						});
						set({
							state: 'preview',
							parsedOutput,
							transaction,
							error: undefined,
							repairInstruction: undefined
						});
					} catch (error) {
						set({
							state: 'failed',
							error: errorMessage(error),
							repairInstruction: typeof error === 'object'
								&& error
								&& 'repairInstruction' in error
								? String(error.repairInstruction)
								: undefined
						});
					}
					break;
				}
			}
		};

		const initial = {
			open: false,
			expanded: false,
			state: 'idle' as const,
			rawOutput: ''
		};

		return {
			...initial,
			openAiAction(actionId, input, scope) {
				const activeJobId = get().jobId;
				if (activeJobId && ['queued', 'connecting', 'streaming'].includes(get().state)) {
					void runtime.cancelAiJob(activeJobId);
				}
				pendingDelta = '';
				if (flushTimer !== undefined) {
					window.clearTimeout(flushTimer);
					flushTimer = undefined;
				}
				const definition = actions.get(actionId);
				const validation = definition.inputSchema.safeParse(input);
				const availability = definition.availability({
					hasProject: Boolean(scope.context.project),
					currentResourceType: scope.currentResourceType,
					selectionLength: scope.context.selection?.summary.length
				});
				let contextPack: AiContextPack | undefined;
				let error: string | undefined;
				try {
					contextPack = buildAiContextPack(definition, scope.context);
				} catch (cause) {
					error = errorMessage(cause);
				}
				set({
					open: true,
					state: 'idle',
					definition,
					input,
					scope,
					contextPack,
					unavailableReason: availability.available ? undefined : availability.reason,
					rawOutput: '',
					parsedOutput: undefined,
					transaction: undefined,
					jobId: undefined,
					jobMetadata: undefined,
					usage: undefined,
					error: validation.success ? error : '动作输入不符合 Schema。',
					repairInstruction: undefined
				});
			},
			close() {
				set({ open: false });
			},
			toggleExpanded() {
				set(state => ({ expanded: !state.expanded }));
			},
			setContextRecordIncluded(key, included) {
				const pack = get().contextPack;
				if (!pack) return;
				try {
					set({
						contextPack: withAiContextRecordIncluded(pack, key, included),
						error: undefined
					});
				} catch (error) {
					set({ error: errorMessage(error) });
				}
			},
			async startGeneration() {
				const current = get();
				if (
					!current.definition
					|| !current.contextPack
					|| current.unavailableReason
					|| current.error
				) {
					return;
				}
				set({ state: 'validating_context', error: undefined, rawOutput: '' });
				try {
					if (current.jobId && ['queued', 'connecting', 'streaming'].includes(current.state)) {
						await runtime.cancelAiJob(current.jobId);
					}
					const [status, preferences] = await Promise.all([
						runtime.getAiProviderStatus(),
						runtime.getAiPreferences()
					]);
					const modelId = preferences.defaultModelId;
					if (!status.secret.configured || !modelId) {
						throw new Error('请先在设置中配置并验证 DeepSeek。');
					}
					const template = prompts.get(current.definition.promptTemplateId);
					const jobId = crypto.randomUUID();
					const request: AiGenerateRequest = {
						jobId,
						jobType: 'chapter-review',
						providerId: 'deepseek',
						modelId,
						messages: buildPromptMessages(
							template,
							current.input,
							current.contextPack
						),
						options: {
							stream: true,
							thinkingMode: preferences.thinkingMode,
							reasoningEffort: preferences.thinkingMode === 'enabled'
								? 'high'
								: undefined,
							maxOutputTokens: preferences.maxOutputTokens,
							responseFormat: 'json_object'
						}
					};
					const metadata = prompts.metadata(template.id, template.version);
					set({
						jobId,
						jobMetadata: {
							...metadata,
							actionId: current.definition.id,
							modelId
						},
						state: 'queued',
						rawOutput: '',
						parsedOutput: undefined,
						transaction: undefined,
						usage: undefined
					});
					await runtime.startAiGeneration(request, onStreamEvent);
				} catch (error) {
					set({ state: 'failed', error: errorMessage(error) });
				}
			},
			async cancelGeneration() {
				const { jobId, state } = get();
				if (!jobId || !['queued', 'connecting', 'streaming'].includes(state)) return;
				const cancelled = await runtime.cancelAiJob(jobId);
				if (cancelled) {
					flushOutput();
					set({ state: 'cancelled' });
				}
			},
			rejectPreview() {
				const transaction = get().transaction;
				if (!transaction) return;
				set({
					transaction: rejectAiPreview(transaction),
					state: 'completed'
				});
			},
			markStale(currentRevision) {
				const transaction = get().transaction;
				if (
					transaction?.status === 'preview'
					&& transaction.baseRevision !== String(currentRevision)
				) {
					set({
						transaction: {
							...transaction,
							status: 'stale',
							errorCode: 'revisionChanged'
						},
						state: 'stale'
					});
				}
			},
			reset() {
				const jobId = get().jobId;
				if (jobId && ['queued', 'connecting', 'streaming'].includes(get().state)) {
					void runtime.cancelAiJob(jobId);
				}
				set(initial);
			}
		};
	});
}

export const aiGenerationStore = createAiGenerationStore();

export function useAiGenerationStore<T>(
	selector: (state: AiGenerationStore) => T
): T {
	return useStore(aiGenerationStore, selector);
}
