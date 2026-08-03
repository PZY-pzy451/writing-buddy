import type { TextFile } from '@writing-buddy/domain';
import type { AiJobState } from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	PendingFactsReview,
	type PendingFactsReviewProps
} from './PendingFactsReview';
import {
	PendingFactStore,
	type PendingFactStoragePort
} from './StoryExtractionService';

const asyncTimeout = { timeout: 5_000 };

class MemoryStorage implements PendingFactStoragePort {
	private content: string | undefined;
	private hash = '';
	private nextWriteError = '';
	private writes = 0;

	get writeCount(): number {
		return this.writes;
	}

	failNextWrite(code: string): void {
		this.nextWriteError = code;
	}

	readText(): Promise<TextFile> {
		if (this.content === undefined) return Promise.reject(new Error('readFailed'));
		return Promise.resolve({
			content: this.content,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: this.hash
		});
	}

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		this.writes += 1;
		if (this.nextWriteError) {
			const code = this.nextWriteError;
			this.nextWriteError = '';
			return Promise.reject(new Error(code));
		}
		this.content = request.content;
		this.hash = `hash-${request.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			byteLength: request.content.length,
			modifiedAt: '2026-08-03T08:00:00.000Z'
		});
	}
}

function extractionResponse(content: string): string {
	return JSON.stringify({
		result: {
			facts: [{
				fact_type: 'character_state',
				name: '顾言保留信封',
				fact: '顾言决定保留蓝色信封。',
				confidence: 0.92,
				evidence: {
					start: 0,
					end: content.length,
					quote: content
				}
			}]
		}
	});
}

describe('PendingFactsReview', () => {
	it('canonicalizes project chapter IDs and closes extract-confirm workflow', async () => {
		const storage = new MemoryStorage();
		const store = new PendingFactStore('D:\\fixture', storage);
		const selection = '顾言决定保留蓝色信封';
		const runExtraction: NonNullable<PendingFactsReviewProps['runExtraction']> = vi.fn(
			(
				content: string,
				resourceId: string,
				sourceRevision: string,
				onState: (state: AiJobState, output: string) => void
			): Promise<string> => {
				expect(content).toBe(selection);
				expect(resourceId).toBe('chapter:chapter-a11ce001');
				expect(sourceRevision).toBe('9');
				onState('streaming', '{');
				return Promise.resolve(extractionResponse(content));
			}
		);

		render(
			<PendingFactsReview
				projectRoot="D:\\fixture"
				resourceId="chapter-a11ce001"
				sourceRevision={9}
				content={`前文。${selection}。后文。`}
				selection={{ start: 3, end: 3 + selection.length, text: selection }}
				store={store}
				runExtraction={runExtraction}
			/>
		);

		const extract = await screen.findByRole('button', {
			name: '用 DeepSeek 提取待确认事实'
		}, asyncTimeout);
		fireEvent.click(extract);
		fireEvent.click(extract);

		expect(await screen.findByRole('status', undefined, asyncTimeout))
			.toHaveTextContent('已提取 1 条待确认事实');
		expect(runExtraction).toHaveBeenCalledTimes(1);
		expect(screen.queryByText(/invalidStoryExtractionInput/u)).not.toBeInTheDocument();
		expect(screen.getByText('1 条待确认')).toBeInTheDocument();

		const accept = screen.getByRole('button', { name: '确认并接受' });
		for (let click = 0; click < 100; click += 1) fireEvent.click(accept);
		await waitFor(() => {
			expect(screen.getByRole('status')).toHaveTextContent('事实已由作者确认并保存');
			expect(screen.getByText('0 条待确认')).toBeInTheDocument();
		}, asyncTimeout);

		const [accepted] = await store.load();
		expect(storage.writeCount).toBe(2);
		expect(accepted).toMatchObject({
			status: 'accepted',
			sourceResourceId: 'chapter:chapter-a11ce001',
			suggestedRange: { start: 3, end: 3 + selection.length },
			evidence: { resourceId: 'chapter:chapter-a11ce001', confirmedByAuthor: true },
			storyPosition: { chapterId: 'chapter:chapter-a11ce001', narrativeOrder: 0 }
		});
	});

	it('keeps malformed AI output out of storage and hides internal error codes', async () => {
		const store = new PendingFactStore('D:\\fixture', new MemoryStorage());
		render(
			<PendingFactsReview
				projectRoot="D:\\fixture"
				resourceId="chapter-broken-response"
				sourceRevision={2}
				content="顾言打开蓝色信封。"
				store={store}
				runExtraction={() => Promise.resolve('not-json')}
			/>
		);

		fireEvent.click(await screen.findByRole('button', {
			name: '用 DeepSeek 提取待确认事实'
		}, asyncTimeout));

		expect(await screen.findByRole('alert', undefined, asyncTimeout))
			.toHaveTextContent('AI 返回的事实结构不完整');
		expect(screen.queryByText(/invalidStoryExtractionResponse/u)).not.toBeInTheDocument();
		expect(await store.load()).toEqual([]);
	});

	it('explains oversized input before a request can start', async () => {
		const runExtraction: NonNullable<PendingFactsReviewProps['runExtraction']> = vi.fn(
			() => Promise.resolve('')
		);
		render(
			<PendingFactsReview
				projectRoot="D:\\fixture"
				resourceId="chapter-large"
				sourceRevision={1}
				content={'文'.repeat(100_001)}
				store={new PendingFactStore('D:\\fixture', new MemoryStorage())}
				runExtraction={runExtraction}
			/>
		);

		const extract = await screen.findByRole('button', {
			name: '用 DeepSeek 提取待确认事实'
		}, asyncTimeout);
		expect(extract).toBeDisabled();
		expect(screen.getByRole('alert')).toHaveTextContent('超过 100,000 字');
		expect(runExtraction).not.toHaveBeenCalled();
	});

	it('keeps a fact pending when confirmation persistence conflicts', async () => {
		const storage = new MemoryStorage();
		const store = new PendingFactStore('D:\\fixture', storage);
		const content = '顾言决定保留蓝色信封';
		render(
			<PendingFactsReview
				projectRoot="D:\\fixture"
				resourceId="chapter-conflict"
				sourceRevision={4}
				content={content}
				store={store}
				runExtraction={() => Promise.resolve(extractionResponse(content))}
			/>
		);

		fireEvent.click(await screen.findByRole('button', {
			name: '用 DeepSeek 提取待确认事实'
		}, asyncTimeout));
		await screen.findByRole('button', { name: '确认并接受' }, asyncTimeout);
		storage.failNextWrite('externalChange');
		fireEvent.click(screen.getByRole('button', { name: '确认并接受' }));

		expect(await screen.findByRole('alert', undefined, asyncTimeout))
			.toHaveTextContent('待确认事实已在其他位置发生变化');
		expect(screen.getByText('1 条待确认')).toBeInTheDocument();
		expect((await store.load())[0]?.status).toBe('pending');
	});
});
