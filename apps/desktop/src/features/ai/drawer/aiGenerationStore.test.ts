import {
	DEFAULT_AI_PREFERENCES,
	createDeepSeekProviderDefinition,
	type AiGenerateRequest,
	type AiStreamEvent
} from '@writing-buddy/ai';
import {
	createAiGenerationStore,
	type AiGenerationRuntime
} from './aiGenerationStore';

function runtime(
	output: string,
	onRequest?: (request: AiGenerateRequest) => void
): AiGenerationRuntime {
	return {
		getAiProviderStatus: () => Promise.resolve({
			provider: createDeepSeekProviderDefinition(),
			secret: { configured: true, providerId: 'deepseek' },
			preferences: DEFAULT_AI_PREFERENCES
		}),
		getAiPreferences: () => Promise.resolve(DEFAULT_AI_PREFERENCES),
		startAiGeneration: (
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => {
			onRequest?.(request);
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
			listener({ type: 'content_delta', jobId: request.jobId, text: output.slice(0, 12) });
			listener({ type: 'content_delta', jobId: request.jobId, text: output.slice(12) });
			listener({ type: 'completed', jobId: request.jobId });
			return Promise.resolve();
		},
		cancelAiJob: () => Promise.resolve(true)
	};
}

const chapterScope = {
	currentResourceType: 'chapter',
	baseRevision: 4,
	context: {
		project: { id: 'project-1', title: '阴间旅店', summary: '悬疑长篇' },
		currentResource: {
			id: 'chapter-1',
			title: '第四章 桥下的画师',
			summary: '桥下的雾缓慢散开。'
		}
	}
} as const;

describe('aiGenerationStore', () => {
	it('streams through the shared runtime, validates output and creates a preview', async () => {
		const output = JSON.stringify({ issues: [] });
		const store = createAiGenerationStore(runtime(output));
		store.getState().openAiAction('review.consistency', { instruction: '' }, chapterScope);
		await store.getState().startGeneration();

		expect(store.getState()).toMatchObject({
			state: 'preview',
			rawOutput: output,
			parsedOutput: { issues: [] },
				transaction: {
					actionId: 'review.consistency',
					resourceId: 'chapter-1',
					baseRevision: '4',
					status: 'preview'
				}
			});
		expect(store.getState().jobMetadata).toMatchObject({
			id: 'review.consistency',
			version: 1,
			schemaVersion: 1,
			modelId: DEFAULT_AI_PREFERENCES.defaultModelId
		});
	});

	it('previews exactly the context accepted by the fixed chapter-review contract', async () => {
		const requests: AiGenerateRequest[] = [];
		const store = createAiGenerationStore(runtime(
			JSON.stringify({ issues: [] }),
			request => requests.push(request)
		));
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		expect(store.getState().contextPack).toMatchObject({
			project: undefined,
			currentResource: {
				key: 'current-resource:chapter-1',
				included: true
			}
		});

		await store.getState().startGeneration();
		expect(JSON.parse(requests[0]?.messages[1]?.content ?? '{}')).toEqual({
			schemaVersion: 1,
			content: chapterScope.context.currentResource.summary
		});
	});

	it('keeps unavailable actions inspectable with an explicit reason', () => {
		const store = createAiGenerationStore(runtime('{}'));
		store.getState().openAiAction('review.consistency', {}, {
			context: {}
		});
		expect(store.getState()).toMatchObject({
			open: true,
			state: 'idle',
			unavailableReason: '请先打开作品'
		});
	});

	it('marks a preview stale when the source revision changes', async () => {
		const store = createAiGenerationStore(runtime(JSON.stringify({ issues: [] })));
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		await store.getState().startGeneration();
		store.getState().markStale(5);
		expect(store.getState()).toMatchObject({
			state: 'stale',
			transaction: { status: 'stale', errorCode: 'revisionChanged' }
		});
	});
});
