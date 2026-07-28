import { describe, expect, it, vi } from 'vitest';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';
import {
	createManuscriptExtractionRun,
	extractionErrorCode,
	MANUSCRIPT_EXTRACTION_RUNS_PATH,
	ManuscriptExtractionRunner,
	ManuscriptExtractionRunStore,
	type ManuscriptExtractionSource,
	type ManuscriptExtractionStoragePort
} from './ManuscriptExtractionCenterService';

const timestamp = '2026-07-28T00:00:00.000Z';

class MemoryStorage implements ManuscriptExtractionStoragePort {
	content = '';
	hash = '';
	private revision = 0;

	readText(): Promise<TextFile> {
		if (!this.content) return Promise.reject(new Error('notFound'));
		return Promise.resolve({
			content: this.content,
			hash: this.hash,
			eol: 'lf',
			hasBom: false,
			encoding: 'utf-8'
		});
	}

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		if (request.expectedHash !== this.hash) {
			return Promise.reject(new Error('staleWrite'));
		}
		this.content = request.content;
		this.hash = `hash:${++this.revision}:${this.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			byteLength: new TextEncoder().encode(this.content).byteLength,
			modifiedAt: timestamp
		});
	}
}

function source(index: number, content = `第 ${index} 章的脱敏测试正文。`): ManuscriptExtractionSource {
	return {
		resourceId: `chapter:chapter-${String(index).padStart(4, '0')}`,
		title: `第 ${index} 章`,
		sourceRevision: `hash:${index}`,
		content
	};
}

function plan(sources: readonly ManuscriptExtractionSource[]) {
	return createManuscriptExtractionRun({
		id: 'extraction-run:run-0001',
		instruction: '只从正文提取有明确证据的结构化故事资料。',
		targetTypes: ['character', 'location', 'timelineEvent'],
		sources,
		now: timestamp
	});
}

describe('ManuscriptExtractionCenterService', () => {
	it('persists only operational metadata and deterministic token estimates', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const prose = '雨夜正文不应出现在批处理运行账本中。';
		const run = plan([source(1, prose), source(2)]);
		await store.append(run);

		expect(run.tokenEstimate).toBeGreaterThan(0);
		expect(run.tokenEstimate).toBe(
			run.chapters.reduce((total, chapter) => total + chapter.tokenEstimate, 0)
		);
		expect(MANUSCRIPT_EXTRACTION_RUNS_PATH).toContain('extraction-center');
		expect(storage.content).toContain('extraction-run:run-0001');
		expect(storage.content).not.toContain(prose);
		expect(storage.content).not.toContain('projectRoot');
		expect(storage.content).not.toContain('apiKey');
	});

	it('normalizes an interrupted persisted run without invoking a processor', async () => {
		const storage = new MemoryStorage();
		const running = {
			...plan([source(1)]),
			status: 'running',
			chapters: [{
				...plan([source(1)]).chapters[0],
				status: 'running',
				startedAt: timestamp
			}]
		};
		storage.content = `${JSON.stringify({
			schemaVersion: 1,
			updatedAt: timestamp,
			runs: [running]
		})}\n`;
		storage.hash = 'hash:running';
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const processor = vi.fn();

		const [restored] = await store.load('2026-07-28T01:00:00.000Z');

		expect(restored?.status).toBe('stopped');
		expect(restored?.chapters[0]?.status).toBe('interrupted');
		expect(processor).not.toHaveBeenCalled();
	});

	it('processes chapters sequentially, retains successes and reports safe failures', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const sources = [source(1), source(2), source(3)];
		const run = plan(sources);
		await store.append(run);
		const order: string[] = [];
		const runner = new ManuscriptExtractionRunner(store);

		const result = await runner.run({
			runId: run.id,
			loadSource: resourceId => Promise.resolve(
				sources.find(item => item.resourceId === resourceId)!
			),
			processChapter: ({ chapter }) => {
				order.push(chapter.resourceId);
				if (chapter.resourceId.endsWith('0002')) {
					return Promise.reject(new Error('network_unavailable'));
				}
				return Promise.resolve({
					candidateBatchId: `generation-batch:${chapter.resourceId.split(':')[1]}`,
					candidateCount: 2,
					conflictCount: 1
				});
			},
			now: (() => {
				let index = 0;
				return () => `2026-07-28T00:00:${String(index++).padStart(2, '0')}.000Z`;
			})()
		});

		expect(order).toEqual(sources.map(item => item.resourceId));
		expect(result.status).toBe('completed-with-errors');
		expect(result.chapters.map(chapter => chapter.status)).toEqual([
			'completed',
			'failed',
			'completed'
		]);
		expect(result.chapters[1]?.errorCode).toBe('network_unavailable');
		expect(storage.content).not.toContain(sources[0].content);
	});

	it('stops the active job while preserving completed chapter batches', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const sources = [source(1), source(2), source(3)];
		const run = plan(sources);
		await store.append(run);
		const runner = new ManuscriptExtractionRunner(store);
		let rejectActive: ((reason: Error) => void) | undefined;
		let notifySecond: (() => void) | undefined;
		const secondStarted = new Promise<void>(resolve => {
			notifySecond = resolve;
		});

		const running = runner.run({
			runId: run.id,
			loadSource: resourceId => Promise.resolve(
				sources.find(item => item.resourceId === resourceId)!
			),
			processChapter: async ({ chapter, onActiveCancel }) => {
				if (chapter.resourceId.endsWith('0001')) {
					return {
						candidateBatchId: 'generation-batch:first',
						candidateCount: 1,
						conflictCount: 0
					};
				}
				notifySecond?.();
				return new Promise((_, reject) => {
					rejectActive = reject;
					onActiveCancel(() => {
						reject(new Error('cancelled'));
						return Promise.resolve();
					});
				});
			}
		});
		await secondStarted;
		await runner.stop();
		rejectActive?.(new Error('cancelled'));
		const result = await running;

		expect(result.status).toBe('stopped');
		expect(result.chapters.map(chapter => chapter.status)).toEqual([
			'completed',
			'cancelled',
			'queued'
		]);
		expect(result.chapters[0]?.candidateBatchId).toBe('generation-batch:first');
	});

	it('marks stale sources before processing and can explicitly refresh them', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const original = source(1);
		const changed = { ...original, sourceRevision: 'hash:changed', content: '修订后的脱敏正文。' };
		const run = plan([original]);
		await store.append(run);
		const processor = vi.fn();
		const runner = new ManuscriptExtractionRunner(store);

		const stale = await runner.run({
			runId: run.id,
			loadSource: () => Promise.resolve(changed),
			processChapter: processor
		});
		expect(stale.chapters[0]?.status).toBe('stale');
		expect(processor).not.toHaveBeenCalled();

		const refreshed = await runner.refreshChapterSource(run.id, changed);
		expect(refreshed.status).toBe('stopped');
		expect(refreshed.chapters[0]).toMatchObject({
			status: 'queued',
			sourceRevision: 'hash:changed'
		});
	});

	it('keeps a thousand-chapter planning ledger bounded and prose-free', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const sources = Array.from({ length: 1_000 }, (_, index) => (
			source(index + 1, `脱敏章节内容 ${index + 1}`)
		));
		const startedAt = performance.now();
		await store.append(plan(sources));

		expect(performance.now() - startedAt).toBeLessThan(500);
		expect(storage.content.length).toBeLessThan(450_000);
		expect(storage.content).not.toContain('脱敏章节内容');
	});

	it('rejects corrupt persisted state instead of silently discarding it', async () => {
		const storage = new MemoryStorage();
		storage.content = '{"schemaVersion":1,"runs":[{"status":"running"}]}';
		storage.hash = 'hash:bad';
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);

		await expect(store.load()).rejects.toThrow('invalidManuscriptExtractionRun');
	});

	it('maps timeout and malformed provider responses to safe retryable codes', () => {
		expect(extractionErrorCode(new Error('connection_timeout'))).toBe('connection_timeout');
		expect(extractionErrorCode(new SyntaxError('Unexpected token in JSON')))
			.toBe('invalid-response');
		expect(extractionErrorCode(new Error('provider leaked internal diagnostics')))
			.toBe('unknown');
	});

	it('retries an explicitly resumed failed chapter without rerunning completions', async () => {
		const storage = new MemoryStorage();
		const store = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const original = source(1);
		const run = plan([original]);
		await store.append(run);
		const runner = new ManuscriptExtractionRunner(store);
		const processor = vi.fn()
			.mockRejectedValueOnce(new Error('connection_timeout'))
			.mockResolvedValueOnce({
				candidateBatchId: 'generation-batch:retry',
				candidateCount: 1,
				conflictCount: 0
			});

		const failed = await runner.run({
			runId: run.id,
			loadSource: () => Promise.resolve(original),
			processChapter: processor
		});
		expect(failed.chapters[0]).toMatchObject({
			status: 'failed',
			errorCode: 'connection_timeout'
		});

		const resumed = await runner.run({
			runId: run.id,
			loadSource: () => Promise.resolve(original),
			processChapter: processor
		});
		expect(resumed.status).toBe('completed');
		expect(resumed.chapters[0]).toMatchObject({
			status: 'completed',
			candidateBatchId: 'generation-batch:retry'
		});
		expect(processor).toHaveBeenCalledTimes(2);

		await runner.run({
			runId: run.id,
			loadSource: () => Promise.resolve(original),
			processChapter: processor
		});
		expect(processor).toHaveBeenCalledTimes(2);
	});

	it('surfaces stale ledger writes instead of overwriting concurrent state', async () => {
		const storage = new MemoryStorage();
		const firstStore = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		const staleStore = new ManuscriptExtractionRunStore('D:/Fixture', storage);
		await firstStore.append(plan([source(1)]));
		await staleStore.load();

		await firstStore.save([plan([source(2)])]);

		await expect(staleStore.save([plan([source(3)])])).rejects.toThrow('staleWrite');
	});
});
