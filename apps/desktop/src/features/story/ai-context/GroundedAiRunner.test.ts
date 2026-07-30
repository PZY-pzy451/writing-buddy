import {
	DEFAULT_AI_PREFERENCES,
	type AiMessage
} from '@writing-buddy/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopBridge } from '../../../platform/bridge';
import { runGroundedJsonJob } from './GroundedAiRunner';

const messages: readonly AiMessage[] = [{
	role: 'user',
	content: '生成一个候选。'
}];

describe('runGroundedJsonJob error boundary', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps a structured Tauri rejection as an Error with public metadata', async () => {
		vi.spyOn(desktopBridge, 'getAiPreferences').mockResolvedValue({
			...DEFAULT_AI_PREFERENCES,
			defaultModelId: 'deepseek-chat'
		});
		vi.spyOn(desktopBridge, 'startAiGeneration').mockRejectedValue({
			code: 'network_unavailable',
			message: '无法连接 DeepSeek，请检查网络。',
			retryable: true
		});

		await expect(runGroundedJsonJob({
			jobType: 'character-analysis',
			messages,
			onProgress: vi.fn(),
			onJobId: vi.fn()
		})).rejects.toMatchObject({
			name: 'AiRequestError',
			code: 'network_unavailable',
			message: '无法连接 DeepSeek，请检查网络。',
			retryable: true
		});
	});

	it('rejects structured output that stopped at the token limit', async () => {
		vi.spyOn(desktopBridge, 'getAiPreferences').mockResolvedValue({
			...DEFAULT_AI_PREFERENCES,
			defaultModelId: 'deepseek-v4-flash'
		});
		vi.spyOn(desktopBridge, 'startAiGeneration').mockImplementation((request, listener) => {
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
			listener({ type: 'content_delta', jobId: request.jobId, text: '{"candidates":[' });
			listener({ type: 'completed', jobId: request.jobId, finishReason: 'length' });
			return Promise.resolve();
		});

		await expect(runGroundedJsonJob({
			jobType: 'character-analysis',
			messages,
			onProgress: vi.fn(),
			onJobId: vi.fn()
		})).rejects.toThrow('AI 输出达到最大 Token 上限');
	});
});
