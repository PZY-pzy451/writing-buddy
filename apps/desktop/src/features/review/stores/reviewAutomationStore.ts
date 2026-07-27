import {
	buildChapterReviewMessages,
	nextAiJobState,
	parseChapterReviewResponse,
	type AiGenerateRequest,
	type AiJobState,
	type AiProviderPreferences,
	type AiStreamEvent,
	type AiUsage,
	type PublicAiError
} from '@writing-buddy/ai';
import type { ReviewIssue } from '@writing-buddy/review';
import { create } from 'zustand';
import { normalizeAiError } from '../../ai/stores/aiStore';
import { desktopBridge } from '../../../platform/bridge';

interface ReviewAutomationInput {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly preferences: AiProviderPreferences;
}

interface ReviewAutomationStore {
	readonly jobId?: string;
	readonly jobState: AiJobState;
	readonly usage?: AiUsage;
	readonly startedAt?: number;
	readonly durationMs?: number;
	readonly error?: PublicAiError;
	readonly run: (input: ReviewAutomationInput) => Promise<readonly ReviewIssue[] | undefined>;
	readonly cancel: () => Promise<void>;
	readonly reset: () => void;
}

const terminalStates: readonly AiJobState[] = ['completed', 'cancelled', 'failed'];

export const useReviewAutomationStore = create<ReviewAutomationStore>((set, get) => ({
	jobState: 'created',

	async run(input) {
		const activeJobId = get().jobId;
		if (activeJobId && !terminalStates.includes(get().jobState)) {
			await desktopBridge.cancelAiJob(activeJobId);
		}
		const modelId = input.preferences.defaultModelId;
		if (!modelId) {
			const error = normalizeAiError('invalid_configuration');
			set({ jobState: 'failed', error });
			throw new Error(error.message);
		}
		const jobId = crypto.randomUUID();
		const request: AiGenerateRequest = {
			jobId,
			jobType: 'chapter-review',
			providerId: 'deepseek',
			modelId,
			messages: buildChapterReviewMessages(input.content),
			options: {
				stream: true,
				thinkingMode: input.preferences.thinkingMode,
				reasoningEffort: input.preferences.thinkingMode === 'enabled' ? 'high' : undefined,
				maxOutputTokens: input.preferences.maxOutputTokens,
				responseFormat: 'json_object'
			}
		};
		set({
			jobId,
			jobState: 'created',
			usage: undefined,
			startedAt: Date.now(),
			durationMs: undefined,
			error: undefined
		});

		return new Promise<readonly ReviewIssue[] | undefined>((resolve, reject) => {
			let output = '';
			let settled = false;
			const finish = (
				result: readonly ReviewIssue[] | undefined,
				error?: PublicAiError
			) => {
				if (settled) {
					return;
				}
				settled = true;
				if (error) {
					reject(new Error(error.message));
				} else {
					resolve(result);
				}
			};
			const onEvent = (event: AiStreamEvent) => {
				if (event.jobId !== jobId || get().jobId !== jobId || settled) {
					return;
				}
				let jobState = get().jobState;
				try {
					jobState = nextAiJobState(jobState, event);
				} catch {
					return;
				}
				switch (event.type) {
					case 'content_delta':
						output += event.text;
						set({ jobState });
						break;
					case 'usage':
						set({ usage: event.usage });
						break;
					case 'completed':
						try {
							const issues = parseChapterReviewResponse({
								projectId: input.projectId,
								resourceId: input.resourceId,
								content: input.content,
								response: output
							});
							set({
								jobState,
								durationMs: Date.now() - (get().startedAt ?? Date.now())
							});
							finish(issues);
						} catch {
							const error: PublicAiError = {
								code: 'invalid_request',
								message: 'AI 返回的审校结果无法验证，请重试。',
								retryable: true
							};
							set({
								jobState: 'failed',
								durationMs: Date.now() - (get().startedAt ?? Date.now()),
								error
							});
							finish(undefined, error);
						}
						break;
					case 'cancelled':
						set({
							jobState,
							durationMs: Date.now() - (get().startedAt ?? Date.now())
						});
						finish(undefined);
						break;
					case 'failed':
						set({
							jobState,
							durationMs: Date.now() - (get().startedAt ?? Date.now()),
							error: event.error
						});
						finish(undefined, event.error);
						break;
					default:
						set({ jobState });
				}
			};
			void desktopBridge.startAiGeneration(request, onEvent).catch(cause => {
				const error = normalizeAiError(cause);
				set({
					jobState: 'failed',
					durationMs: Date.now() - (get().startedAt ?? Date.now()),
					error
				});
				finish(undefined, error);
			});
		});
	},

	async cancel() {
		const { jobId, jobState, startedAt } = get();
		if (!jobId || terminalStates.includes(jobState)) {
			return;
		}
		if (await desktopBridge.cancelAiJob(jobId)) {
			set({
				jobState: 'cancelled',
				durationMs: Date.now() - (startedAt ?? Date.now())
			});
		}
	},

	reset() {
		if (!get().jobId || terminalStates.includes(get().jobState)) {
			set({
				jobId: undefined,
				jobState: 'created',
				usage: undefined,
				startedAt: undefined,
				durationMs: undefined,
				error: undefined
			});
		}
	}
}));
