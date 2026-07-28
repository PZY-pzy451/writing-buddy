import {
	nextAiJobState,
	type AiGenerateRequest,
	type AiJobState,
	type AiJobType,
	type AiMessage,
	type AiStreamEvent,
	type AiUsage
} from '@writing-buddy/ai';
import { desktopBridge } from '../../../platform/bridge';
import { toAiRequestError } from '../../ai/errors/AiErrorPresentation';

export interface GroundedAiProgress {
	readonly output: string;
	readonly state: AiJobState;
	readonly usage?: AiUsage;
}

export async function runGroundedJsonJob(input: {
	readonly jobType: AiJobType;
	readonly messages: readonly AiMessage[];
	readonly onProgress: (progress: GroundedAiProgress) => void;
	readonly onJobId: (jobId: string | undefined) => void;
}): Promise<{ readonly output: string; readonly usage?: AiUsage }> {
	const preferences = await desktopBridge.getAiPreferences();
	if (!preferences.defaultModelId) {
		throw new Error('未配置可用的 DeepSeek 模型。');
	}
	const jobId = crypto.randomUUID();
	input.onJobId(jobId);
	const request: AiGenerateRequest = {
		jobId,
		jobType: input.jobType,
		providerId: 'deepseek',
		modelId: preferences.defaultModelId,
		messages: input.messages,
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
		const finish = (
			result?: { readonly output: string; readonly usage?: AiUsage },
			error?: Error
		) => {
			if (settled) return;
			settled = true;
			input.onJobId(undefined);
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
			input.onProgress({ output, state, ...(usage ? { usage } : {}) });
			if (event.type === 'completed') {
				finish({ output, ...(usage ? { usage } : {}) });
			}
			if (event.type === 'failed') finish(undefined, toAiRequestError(event.error));
			if (event.type === 'cancelled') finish(undefined, toAiRequestError('cancelled'));
		};
		void desktopBridge.startAiGeneration(request, listener).catch(reason => {
			finish(undefined, toAiRequestError(reason));
		});
	});
}
