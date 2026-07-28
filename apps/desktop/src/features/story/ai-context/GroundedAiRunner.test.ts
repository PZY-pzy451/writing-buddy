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
});
