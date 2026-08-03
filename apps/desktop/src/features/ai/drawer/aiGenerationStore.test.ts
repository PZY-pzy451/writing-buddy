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

const nextChapterScope = {
	...chapterScope,
	baseRevision: 9,
	context: {
		...chapterScope.context,
		currentResource: {
			id: 'chapter-2',
			title: '第五章 雨停以后',
			summary: '雨停以后，旧桥下只剩一把伞。'
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

	it('starts one provider request for 100 same-tick generation calls', async () => {
		const requests: AiGenerateRequest[] = [];
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const store = createAiGenerationStore({
			...runtime(
				JSON.stringify({ issues: [] }),
				request => requests.push(request)
			),
			cancelAiJob
		});
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		await Promise.all(Array.from({ length: 100 }, () => (
			store.getState().startGeneration()
		)));

		expect(requests).toHaveLength(1);
		expect(cancelAiJob).not.toHaveBeenCalled();
		expect(store.getState().state).toBe('preview');
	});

	it('redacts an unknown start failure and allows an explicit retry', async () => {
		const output = JSON.stringify({ issues: [] });
		const fallback = runtime(output);
		const startAiGeneration = vi.fn(fallback.startAiGeneration)
			.mockRejectedValueOnce(new Error('raw provider implementation detail'));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration });
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		await store.getState().startGeneration();
		expect(store.getState()).toMatchObject({
			state: 'failed',
			error: 'AI 请求失败。'
		});
		await store.getState().startGeneration();

		expect(startAiGeneration).toHaveBeenCalledTimes(2);
		expect(store.getState().state).toBe('preview');
	});

	it('does not attach a validating request to an action opened later', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let resolveStatus: ((status: Awaited<ReturnType<AiGenerationRuntime['getAiProviderStatus']>>) => void) | undefined;
		const getAiProviderStatus = vi.fn(() => new Promise<
			Awaited<ReturnType<AiGenerationRuntime['getAiProviderStatus']>>
		>(resolve => {
			resolveStatus = resolve;
		}));
		const startAiGeneration = vi.fn(fallback.startAiGeneration);
		const store = createAiGenerationStore({
			...fallback,
			getAiProviderStatus,
			startAiGeneration
		});
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		const firstAttempt = store.getState().startGeneration();
		expect(store.getState().state).toBe('validating_context');
		store.getState().openAiAction('review.consistency', {}, nextChapterScope);
		resolveStatus?.(await fallback.getAiProviderStatus());
		await firstAttempt;

		expect(startAiGeneration).not.toHaveBeenCalled();
		expect(store.getState()).toMatchObject({
			state: 'idle',
			contextPack: {
				currentResource: { resourceId: 'chapter-2' }
			}
		});
	});

	it('deduplicates 100 cancellations and ignores their stale completion', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		const jobs: Array<{
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		}> = [];
		const cancellations: Array<(cancelled: boolean) => void> = [];
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			jobs.push({ request, listener, resolve });
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn(() => new Promise<boolean>(resolve => cancellations.push(resolve)));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		const firstGeneration = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));
		const cancelAttempts = Array.from({ length: 100 }, () => (
			store.getState().cancelGeneration()
		));
		expect(cancelAiJob).toHaveBeenCalledOnce();

		const first = jobs[0];
		if (!first) throw new Error('first drawer job missing');
		first.listener({ type: 'cancelled', jobId: first.request.jobId });
		store.getState().openAiAction('review.consistency', {}, nextChapterScope);
		const secondGeneration = store.getState().startGeneration();
		await vi.waitFor(() => expect(jobs).toHaveLength(2));
		const second = jobs[1];
		if (!second) throw new Error('second drawer job missing');

		cancellations[0]?.(true);
		await Promise.all(cancelAttempts);
		expect(store.getState()).toMatchObject({
			jobId: second.request.jobId,
			state: 'connecting'
		});

		second.listener({
			type: 'content_delta',
			jobId: second.request.jobId,
			text: JSON.stringify({ issues: [] })
		});
		second.listener({ type: 'completed', jobId: second.request.jobId });
		first.resolve();
		second.resolve();
		await Promise.all([firstGeneration, secondGeneration]);
		expect(store.getState()).toMatchObject({ state: 'preview' });
	});

	it('localizes a drawer cancellation failure and permits retry', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let resolveGeneration: (() => void) | undefined;
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
		} | undefined;
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			resolveGeneration = resolve;
			activeJob = { request, listener };
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn()
			.mockRejectedValueOnce(new Error('raw drawer cancellation detail'))
			.mockResolvedValueOnce(true);
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);

		const generation = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));
		await store.getState().cancelGeneration();
		expect(store.getState()).toMatchObject({
			state: 'connecting',
			error: 'AI 请求失败。'
		});
		await store.getState().cancelGeneration();
		expect(cancelAiJob).toHaveBeenCalledTimes(2);
		expect(store.getState()).toMatchObject({
			state: 'cancelled',
			error: undefined
		});

		if (!activeJob) throw new Error('drawer cancellation job missing');
		resolveGeneration?.();
		await generation;
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
