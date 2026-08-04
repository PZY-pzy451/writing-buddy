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
	source: {
		projectRoot: 'C:/novels/inn',
		projectId: 'project-1',
		resourceId: 'chapter-1',
		resourcePath: 'manuscript/chapter-1.md',
		modelUri: 'writing-buddy://project-1/chapter-1'
	},
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
	source: {
		...chapterScope.source,
		resourceId: 'chapter-2',
		resourcePath: 'manuscript/chapter-2.md',
		modelUri: 'writing-buddy://project-1/chapter-2'
	},
	context: {
		...chapterScope.context,
		currentResource: {
			id: 'chapter-2',
			title: '第五章 雨停以后',
			summary: '雨停以后，旧桥下只剩一把伞。'
		}
	}
} as const;

const characterScope = {
	currentResourceType: 'character-center',
	baseRevision: 7,
	source: {
		projectRoot: 'C:/novels/inn',
		projectId: 'project-1',
		resourceId: 'chapter:source',
		resourcePath: 'manuscript/source.md',
		modelUri: 'writing-buddy://project-1/source'
	},
	context: {
		project: { id: 'project-1', title: 'Inn', summary: 'Suspense novel' },
		currentResource: {
			id: 'chapter:source',
			title: 'Source chapter',
			summary: 'A bounded chapter used for character analysis.'
		},
		entities: [{
			id: 'character:secret',
			title: 'Secret character note',
			summary: 'An author-only identity detail.',
			authorSecret: true
		}]
	}
} as const;

const characterInput = {
	instruction: 'Generate a character profile.',
	sourceResourceId: 'chapter:source'
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

	it('detaches every old job event while a replacement preview validates', async () => {
		const output = JSON.stringify({ issues: [] });
		const fallback = runtime(output);
		const status = await fallback.getAiProviderStatus();
		let resolveReplacementStatus: ((value: typeof status) => void) | undefined;
		const getAiProviderStatus = vi.fn()
			.mockResolvedValueOnce(status)
			.mockImplementationOnce(() => new Promise<typeof status>(resolve => {
				resolveReplacementStatus = resolve;
			}));
		const jobs: Array<{
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
		}> = [];
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => {
			jobs.push({ request, listener });
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
			return Promise.resolve();
		});
		const store = createAiGenerationStore({
			...fallback,
			getAiProviderStatus,
			startAiGeneration
		});
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		await store.getState().startGeneration();
		const first = jobs[0];
		if (!first) throw new Error('first preview job missing');
		first.listener({ type: 'content_delta', jobId: first.request.jobId, text: output });
		first.listener({ type: 'completed', jobId: first.request.jobId });
		expect(store.getState().state).toBe('preview');

		const replacement = store.getState().startGeneration();
		expect(store.getState()).toMatchObject({
			state: 'validating_context',
			jobId: undefined,
			jobMetadata: undefined,
			usage: undefined,
			rawOutput: '',
			parsedOutput: undefined,
			transaction: undefined
		});

		first.listener({
			type: 'content_delta',
			jobId: first.request.jobId,
			text: 'late output from the superseded preview'
		});
		first.listener({
			type: 'usage',
			jobId: first.request.jobId,
			usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
		});
		first.listener({ type: 'failed', jobId: first.request.jobId, error: {
			code: 'provider_overloaded',
			message: 'private old failure',
			retryable: true
		} });
		first.listener({ type: 'cancelled', jobId: first.request.jobId });
		first.listener({ type: 'completed', jobId: first.request.jobId });
		expect(store.getState()).toMatchObject({
			state: 'validating_context',
			rawOutput: '',
			usage: undefined,
			error: undefined,
			parsedOutput: undefined,
			transaction: undefined
		});

		resolveReplacementStatus?.(status);
		await vi.waitFor(() => expect(jobs).toHaveLength(2));
		const second = jobs[1];
		if (!second) throw new Error('replacement preview job missing');
		expect(second.request.jobId).not.toBe(first.request.jobId);
		second.listener({ type: 'content_delta', jobId: second.request.jobId, text: output });
		second.listener({ type: 'completed', jobId: second.request.jobId });
		await replacement;

		expect(store.getState()).toMatchObject({
			state: 'preview',
			jobId: second.request.jobId,
			parsedOutput: { issues: [] },
			transaction: { status: 'preview' }
		});
	});

	it.each([
		'missing_configuration',
		'status_failure',
		'preferences_failure'
	] as const)('never exposes a superseded preview after regeneration %s', async outcome => {
		const output = JSON.stringify({ issues: [] });
		const fallback = runtime(output);
		const status = await fallback.getAiProviderStatus();
		const preferences = await fallback.getAiPreferences();
		let statusCalls = 0;
		let preferenceCalls = 0;
		const getAiProviderStatus = vi.fn(() => {
			statusCalls += 1;
			if (statusCalls === 1) return Promise.resolve(status);
			if (outcome === 'status_failure') {
				return Promise.reject(new Error('private provider status failure'));
			}
			if (outcome === 'missing_configuration') {
				return Promise.resolve({
					...status,
					secret: { configured: false, providerId: 'deepseek' as const }
				});
			}
			return Promise.resolve(status);
		});
		const getAiPreferences = vi.fn(() => {
			preferenceCalls += 1;
			if (preferenceCalls > 1 && outcome === 'preferences_failure') {
				return Promise.reject(new Error('private preferences failure'));
			}
			return Promise.resolve(preferences);
		});
		const startAiGeneration = vi.fn(fallback.startAiGeneration);
		const store = createAiGenerationStore({
			...fallback,
			getAiProviderStatus,
			getAiPreferences,
			startAiGeneration
		});
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		await store.getState().startGeneration();
		expect(store.getState().state).toBe('preview');

		await store.getState().startGeneration();

		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(store.getState()).toMatchObject({
			state: 'failed',
			jobId: undefined,
			jobMetadata: undefined,
			usage: undefined,
			rawOutput: '',
			parsedOutput: undefined,
			transaction: undefined,
			repairInstruction: undefined
		});
		expect(typeof store.getState().error).toBe('string');
		expect(store.getState().error).not.toContain('private');
	});

	it('starts one clean replacement for 100 same-tick preview regenerations', async () => {
		const output = JSON.stringify({ issues: [] });
		const fallback = runtime(output);
		const status = await fallback.getAiProviderStatus();
		let resolveReplacementStatus: ((value: typeof status) => void) | undefined;
		const getAiProviderStatus = vi.fn()
			.mockResolvedValueOnce(status)
			.mockImplementationOnce(() => new Promise<typeof status>(resolve => {
				resolveReplacementStatus = resolve;
			}));
		const startAiGeneration = vi.fn(fallback.startAiGeneration);
		const store = createAiGenerationStore({
			...fallback,
			getAiProviderStatus,
			startAiGeneration
		});
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		await store.getState().startGeneration();
		expect(store.getState().state).toBe('preview');

		const replacements = Array.from({ length: 100 }, () => (
			store.getState().startGeneration()
		));
		expect(getAiProviderStatus).toHaveBeenCalledTimes(2);
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(store.getState()).toMatchObject({
			state: 'validating_context',
			jobId: undefined,
			parsedOutput: undefined,
			transaction: undefined
		});

		resolveReplacementStatus?.(status);
		await Promise.all(replacements);

		expect(startAiGeneration).toHaveBeenCalledTimes(2);
		expect(store.getState()).toMatchObject({
			state: 'preview',
			parsedOutput: { issues: [] },
			transaction: { status: 'preview' }
		});
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

	it.each([
		'validating_context',
		'queued',
		'connecting',
		'streaming',
		'validating_output',
		'applying'
	] as const)('freezes optional context across 100 toggles while %s', state => {
		const store = createAiGenerationStore(runtime(JSON.stringify({ candidates: [] })));
		store.getState().openAiAction(
			'character.generateProfile',
			characterInput,
			characterScope
		);
		store.setState({ state });

		for (let index = 0; index < 100; index += 1) {
			store.getState().setContextRecordIncluded('entity:character:secret', true);
		}

		expect(store.getState().contextPack?.entities[0]).toMatchObject({
			key: 'entity:character:secret',
			included: false
		});
	});

	it('invalidates an old preview when optional context changes and regenerates cleanly', async () => {
		const requests: AiGenerateRequest[] = [];
		const store = createAiGenerationStore(runtime(
			JSON.stringify({ issues: [] }),
			request => requests.push(request)
		));
		const optionalContextStore = createAiGenerationStore(runtime('{}'));
		optionalContextStore.getState().openAiAction(
			'character.generateProfile',
			characterInput,
			characterScope
		);
		const optionalContextPack = optionalContextStore.getState().contextPack;
		if (!optionalContextPack) throw new Error('optional context pack missing');
		store.getState().openAiAction(
			'review.consistency',
			{},
			chapterScope
		);
		store.setState({
			contextPack: { ...optionalContextPack, actionId: 'review.consistency' }
		});
		await store.getState().startGeneration();
		expect(store.getState()).toMatchObject({
			state: 'preview',
			parsedOutput: { issues: [] },
			transaction: { status: 'preview' }
		});

		store.getState().setContextRecordIncluded('entity:character:secret', true);

		expect(store.getState()).toMatchObject({
			state: 'idle',
			rawOutput: '',
			parsedOutput: undefined,
			transaction: undefined,
			jobId: undefined,
			jobMetadata: undefined,
			usage: undefined,
			error: undefined,
			contextPack: {
				entities: [{ key: 'entity:character:secret', included: true }]
			}
		});

		await store.getState().startGeneration();
		expect(requests).toHaveLength(2);
		expect(store.getState()).toMatchObject({
			state: 'preview',
			transaction: { status: 'preview' }
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
		store.getState().markStale({ ...chapterScope.source, revision: 5 });
		expect(store.getState()).toMatchObject({
			state: 'stale',
			transaction: { status: 'stale', errorCode: 'revisionChanged' }
		});
	});

	it.each([
		['project root', { ...chapterScope.source, projectRoot: 'D:/copied/inn' }],
		['project ID', { ...chapterScope.source, projectId: 'project-copy' }],
		['resource path', { ...chapterScope.source, resourcePath: 'drafts/chapter-1.md' }],
		['Monaco model', { ...chapterScope.source, modelUri: 'writing-buddy://copy/chapter-1' }]
	])('marks a same-revision preview stale after a %s change', async (_label, source) => {
		const store = createAiGenerationStore(runtime(JSON.stringify({ issues: [] })));
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		await store.getState().startGeneration();

		store.getState().markStale({ ...source, revision: chapterScope.baseRevision });

		expect(store.getState()).toMatchObject({
			state: 'stale',
			transaction: { status: 'stale', errorCode: 'sourceChanged' }
		});
	});

	it('cancels one stale in-flight job, ignores delayed output and blocks retry from old context', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		} | undefined;
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			activeJob = { request, listener, resolve };
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		const generation = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));

		for (let index = 0; index < 100; index += 1) {
			store.getState().markStale({
				...chapterScope.source,
				projectRoot: 'D:/copied/inn',
				revision: chapterScope.baseRevision
			});
		}

		await vi.waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		expect(store.getState()).toMatchObject({ state: 'stale', jobId: undefined });
		if (!activeJob) throw new Error('active drawer job missing');
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: JSON.stringify({ issues: [] })
		});
		activeJob.listener({ type: 'completed', jobId: activeJob.request.jobId });
		activeJob.resolve();
		await generation;
		await store.getState().startGeneration();

		expect(store.getState()).toMatchObject({
			state: 'stale',
			rawOutput: '',
			parsedOutput: undefined,
			transaction: undefined
		});
		expect(startAiGeneration).toHaveBeenCalledOnce();
	});

	it('fully resets one in-flight job and never revives a buffered stream delta', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		} | undefined;
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			activeJob = { request, listener, resolve };
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		const generation = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));
		if (!activeJob) throw new Error('active drawer job missing');
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: 'buffered source-only output'
		});

		for (let index = 0; index < 100; index += 1) {
			store.getState().reset();
		}

		await vi.waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		expect(store.getState()).toMatchObject({
			open: false,
			state: 'idle',
			rawOutput: '',
			jobId: undefined,
			scope: undefined,
			contextPack: undefined,
			transaction: undefined
		});
		await new Promise(resolve => window.setTimeout(resolve, 60));
		expect(store.getState().rawOutput).toBe('');

		activeJob.resolve();
		await generation;
		expect(store.getState().state).toBe('idle');
	});

	it('reopens one streaming job 100 times with one cancellation and the latest context', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		} | undefined;
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			activeJob = { request, listener, resolve };
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		const generation = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));
		if (!activeJob) throw new Error('active drawer job missing');
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: 'buffered output from the first chapter'
		});

		for (let index = 0; index < 100; index += 1) {
			store.getState().openAiAction('review.consistency', {}, nextChapterScope);
		}

		await vi.waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: 'late output after reopen'
		});
		activeJob.listener({ type: 'completed', jobId: activeJob.request.jobId });
		activeJob.resolve();
		await generation;
		await new Promise(resolve => window.setTimeout(resolve, 60));

		expect(store.getState()).toMatchObject({
			open: true,
			state: 'idle',
			jobId: undefined,
			rawOutput: '',
			contextPack: { currentResource: { resourceId: 'chapter-2' } }
		});
	});

	it.each(['success', 'failure'] as const)(
		'reuses a pending explicit cancellation when reopen ends in %s',
		async outcome => {
			const fallback = runtime(JSON.stringify({ issues: [] }));
			let resolveFirstGeneration: (() => void) | undefined;
			let firstJob: {
				request: AiGenerateRequest;
				listener: (event: AiStreamEvent) => void;
			} | undefined;
			const startAiGeneration = vi.fn()
				.mockImplementationOnce((
					request: AiGenerateRequest,
					listener: (event: AiStreamEvent) => void
				) => new Promise<void>(resolve => {
					resolveFirstGeneration = resolve;
					firstJob = { request, listener };
					listener({ type: 'job_started', jobId: request.jobId });
					listener({ type: 'connection_opened', jobId: request.jobId });
				}))
				.mockImplementation(fallback.startAiGeneration);
			const cancellations: Array<{
				resolve: (cancelled: boolean) => void;
				reject: (error: Error) => void;
			}> = [];
			const cancelAiJob = vi.fn(() => new Promise<boolean>((resolve, reject) => {
				cancellations.push({ resolve, reject });
			}));
			const store = createAiGenerationStore({
				...fallback,
				startAiGeneration,
				cancelAiJob
			});
			store.getState().openAiAction('review.consistency', {}, chapterScope);
			const firstGeneration = store.getState().startGeneration();
			await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));

			const stop = store.getState().cancelGeneration();
			for (let index = 0; index < 100; index += 1) {
				store.getState().openAiAction('review.consistency', {}, nextChapterScope);
			}
			if (!firstJob) throw new Error('first drawer job missing');
			firstJob.listener({
				type: 'content_delta',
				jobId: firstJob.request.jobId,
				text: 'late first-chapter output'
			});
			firstJob.listener({ type: 'completed', jobId: firstJob.request.jobId });

			for (const cancellation of cancellations) {
				if (outcome === 'success') cancellation.resolve(true);
				else cancellation.reject(new Error('private cancellation failure'));
			}
			await stop;
			resolveFirstGeneration?.();
			await firstGeneration;

			expect(cancelAiJob).toHaveBeenCalledOnce();
			expect(store.getState()).toMatchObject({
				open: true,
				state: 'idle',
				jobId: undefined,
				rawOutput: '',
				error: undefined,
				contextPack: { currentResource: { resourceId: 'chapter-2' } }
			});

			await store.getState().startGeneration();
			expect(startAiGeneration).toHaveBeenCalledTimes(2);
			expect(store.getState()).toMatchObject({
				state: 'preview',
				transaction: { resourceId: 'chapter-2', status: 'preview' }
			});
		}
	);

	it('closes one in-flight job across 100 actions and ignores every delayed event', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		let activeJob: {
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		} | undefined;
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => new Promise<void>(resolve => {
			activeJob = { request, listener, resolve };
			listener({ type: 'job_started', jobId: request.jobId });
			listener({ type: 'connection_opened', jobId: request.jobId });
		}));
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const store = createAiGenerationStore({ ...fallback, startAiGeneration, cancelAiJob });
		store.getState().openAiAction('review.consistency', {}, chapterScope);
		const generation = store.getState().startGeneration();
		await vi.waitFor(() => expect(store.getState().state).toBe('connecting'));
		if (!activeJob) throw new Error('active drawer job missing');
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: 'output buffered before close'
		});

		for (let index = 0; index < 100; index += 1) {
			store.getState().close();
		}

		await vi.waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		expect(store.getState()).toMatchObject({
			open: false,
			state: 'idle',
			jobId: undefined,
			scope: undefined,
			contextPack: undefined,
			rawOutput: ''
		});
		activeJob.listener({
			type: 'content_delta',
			jobId: activeJob.request.jobId,
			text: 'late output after close'
		});
		activeJob.listener({ type: 'completed', jobId: activeJob.request.jobId });
		activeJob.resolve();
		await generation;
		await new Promise(resolve => window.setTimeout(resolve, 60));

			expect(store.getState()).toMatchObject({
			open: false,
			state: 'idle',
			rawOutput: '',
			parsedOutput: undefined,
			transaction: undefined
		});
	});

	it('keeps a close-cancellation failure hidden and permits a fresh action', async () => {
		const fallback = runtime(JSON.stringify({ issues: [] }));
		const cancelAiJob = vi.fn(() => Promise.reject(new Error('private cancel failure')));
		const store = createAiGenerationStore({ ...fallback, cancelAiJob });
		store.setState({
			open: true,
			state: 'streaming',
			jobId: 'closing-job',
			error: undefined
		});

		store.getState().close();
		await vi.waitFor(() => expect(cancelAiJob).toHaveBeenCalledOnce());
		expect(store.getState()).toMatchObject({
			open: false,
			state: 'idle',
			jobId: undefined,
			error: undefined
		});

		store.getState().openAiAction('review.consistency', {}, nextChapterScope);
		await store.getState().startGeneration();

		expect(store.getState()).toMatchObject({
			open: true,
			state: 'preview',
			contextPack: { currentResource: { resourceId: 'chapter-2' } },
			transaction: { resourceId: 'chapter-2', status: 'preview' }
		});
		expect(cancelAiJob).toHaveBeenCalledOnce();
	});
});
