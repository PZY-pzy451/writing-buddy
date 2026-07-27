import {
	AiProviderRegistry,
	DEFAULT_AI_PREFERENCES,
	aggregateAiUsage,
	canQueueAiJob,
	chooseDefaultModel,
	createDeepSeekProviderDefinition,
	nextAiJobState,
	normalizeAiPreferences,
	shouldRetryAiFailure
} from './index';

describe('AI core contracts', () => {
	it('registers DeepSeek once and exposes frozen capabilities', () => {
		const registry = new AiProviderRegistry();
		const provider = createDeepSeekProviderDefinition();
		registry.register(provider);

		expect(registry.get('deepseek')).toEqual(provider);
		expect(registry.list()).toEqual([provider]);
		expect(() => registry.register(provider)).toThrow('providerAlreadyRegistered');
		expect(provider.capabilities.toolCalls).toBe(false);
	});

	it('selects a saved model, then V4 Flash, then the first runtime model', () => {
		const models = [
			{ id: 'deepseek-v4-pro', ownedBy: 'deepseek' },
			{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' }
		];
		expect(chooseDefaultModel(models, 'deepseek-v4-pro')).toBe('deepseek-v4-pro');
		expect(chooseDefaultModel(models, 'missing')).toBe('deepseek-v4-flash');
		expect(chooseDefaultModel([{ id: 'future-model', ownedBy: 'deepseek' }])).toBe('future-model');
		expect(chooseDefaultModel([])).toBeUndefined();
	});

	it('normalizes preferences and rejects retired model defaults', () => {
		expect(normalizeAiPreferences({ maxOutputTokens: 8192 })).toMatchObject({
			...DEFAULT_AI_PREFERENCES,
			maxOutputTokens: 8192
		});
		expect(normalizeAiPreferences({ defaultModelId: 'deepseek-chat' }).defaultModelId)
			.toBe('deepseek-v4-flash');
	});

	it('enforces job transitions and retry boundaries', () => {
		expect(nextAiJobState('created', { type: 'job_started', jobId: 'job-1' })).toBe('connecting');
		expect(nextAiJobState('connecting', { type: 'thinking_started', jobId: 'job-1' })).toBe('thinking');
		expect(nextAiJobState('thinking', { type: 'content_delta', jobId: 'job-1', text: '雨' })).toBe('streaming');
		expect(nextAiJobState('streaming', { type: 'completed', jobId: 'job-1' })).toBe('completed');
		expect(() => nextAiJobState('completed', { type: 'content_delta', jobId: 'job-1', text: '重复' }))
			.toThrow('invalidJobTransition');

		expect(shouldRetryAiFailure({ errorCode: 'rate_limited', retryCount: 0, receivedContent: false })).toBe(true);
		expect(shouldRetryAiFailure({ errorCode: 'provider_server_error', retryCount: 1, receivedContent: false })).toBe(true);
		expect(shouldRetryAiFailure({ errorCode: 'network_unavailable', retryCount: 2, receivedContent: false })).toBe(false);
		expect(shouldRetryAiFailure({ errorCode: 'rate_limited', retryCount: 0, receivedContent: true })).toBe(false);
		expect(shouldRetryAiFailure({ errorCode: 'authentication_failed', retryCount: 0, receivedContent: false })).toBe(false);
		expect(canQueueAiJob(2)).toBe(true);
		expect(canQueueAiJob(3)).toBe(false);
	});

	it('aggregates only anonymous usage fields', () => {
		const summary = aggregateAiUsage([
			{
				timestamp: '2026-07-26T01:00:00.000Z',
				providerId: 'deepseek',
				modelId: 'deepseek-v4-flash',
				jobType: 'storyforge-test',
				inputTokens: 12,
				outputTokens: 8,
				totalTokens: 20,
				durationMs: 400,
				status: 'completed'
			},
			{
				timestamp: '2026-07-26T02:00:00.000Z',
				providerId: 'deepseek',
				modelId: 'deepseek-v4-flash',
				jobType: 'storyforge-test',
				inputTokens: 3,
				outputTokens: 2,
				totalTokens: 5,
				durationMs: 80,
				status: 'cancelled'
			}
		]);
		expect(summary).toEqual({
			inputTokens: 15,
			outputTokens: 10,
			totalTokens: 25,
			requests: 2
		});
	});
});
