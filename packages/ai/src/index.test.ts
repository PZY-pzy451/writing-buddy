import {
	AiProviderRegistry,
	DEFAULT_AI_PREFERENCES,
	aggregateAiUsage,
	buildChapterReviewMessages,
	buildSelectionRewriteMessages,
	canQueueAiJob,
	chooseDefaultModel,
	createDeepSeekProviderDefinition,
	nextAiJobState,
	normalizeAiPreferences,
	parseChapterReviewResponse,
	parseSelectionRewriteResponse,
	SELECTION_REWRITE_SYSTEM_PROMPT,
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

	it('builds an isolated chapter-review request and anchors validated AI issues', () => {
		const content = '林墨推开门。。雨声突然停了。';
		const messages = buildChapterReviewMessages(content);
		expect(messages).toHaveLength(2);
		expect(messages[1]?.content).toContain(content);
		expect(messages[1]?.content).not.toContain('projectId');

		const issues = parseChapterReviewResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content,
			response: JSON.stringify({
				issues: [{
					start: 4,
					end: 7,
					target: '门。。',
					severity: 'warning',
					title: '重复标点',
					message: '句末标点重复。',
					replacement: '门。'
				}]
			})
		});
		expect(issues).toMatchObject([{
			resourceId: 'chapter',
			origin: 'ai',
			anchor: { target: '门。。' },
			replacement: '门。'
		}]);
	});

	it('drops AI review candidates that cannot be uniquely anchored', () => {
		const content = '雨声。雨声。';
		expect(parseChapterReviewResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content,
			response: JSON.stringify({
				issues: [{
					start: 99,
					end: 101,
					target: '雨声',
					severity: 'suggestion',
					title: '重复',
					message: '可能重复。'
				}]
			})
		})).toEqual([]);
	});

	it('builds and validates the grounded selection rewrite contract', () => {
		const messages = buildSelectionRewriteMessages(JSON.stringify({
			schemaVersion: 1,
			actionType: 'polish',
			context: [{ priority: 'P1', kind: 'selection', title: '当前选区', content: '雨落在站台。' }]
		}));
		expect(messages[0]?.content).toBe(SELECTION_REWRITE_SYSTEM_PROMPT);
		expect(parseSelectionRewriteResponse(JSON.stringify({
			suggestion: '雨丝落上寂静的站台。',
			rationale: '收紧意象。',
			potentialImpact: '不改变情节。'
		})).suggestion).toContain('站台');
		expect(() => buildSelectionRewriteMessages(JSON.stringify({
			schemaVersion: 1,
			context: [],
			projectRoot: 'D:\\private'
		}))).toThrow('invalidSelectionRewriteContext');
	});
});
