/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { calculateWritingStatistics, ChapterTextSnapshot, LatestAsyncResult, loadWritingStatistics, readTextDocumentText } from '../writingState';

const chapterSnapshots: readonly ChapterTextSnapshot[] = [
	{ chapterId: 'chapter-001', text: '一二' },
	{ chapterId: 'chapter-002', text: 'Writing Buddy' },
	{ chapterId: 'chapter-003', text: '三' }
];

suite('writingState', () => {
	test('replaces the active disk snapshot with live dirty text', () => {
		assert.deepStrictEqual(calculateWritingStatistics(chapterSnapshots, {
			chapterId: 'chapter-002',
			text: 'Writing Buddy 2026'
		}), {
			currentChapterWords: 3,
			novelWords: 6
		});
	});

	test('uses only the three disk snapshots when no chapter is active', () => {
		assert.deepStrictEqual(calculateWritingStatistics(chapterSnapshots, undefined), {
			currentChapterWords: 0,
			novelWords: 5
		});
	});

	test('ignores an active override outside the demo catalog', () => {
		assert.deepStrictEqual(calculateWritingStatistics(chapterSnapshots, {
			chapterId: 'unrelated',
			text: '不会计入总数'
		}), {
			currentChapterWords: 0,
			novelWords: 5
		});
	});

	test('loads disk snapshots and overrides only the active chapter', async () => {
		const diskText = new Map([
			['chapter-001', '灰'],
			['chapter-002', '雨'],
			['chapter-003', '城']
		]);
		const result = await loadWritingStatistics(
			['chapter-001', 'chapter-002', 'chapter-003'],
			async chapterId => diskText.get(chapterId)!,
			{ chapterId: 'chapter-002', text: 'Writing Buddy 2026' }
		);
		assert.deepStrictEqual(result, { currentChapterWords: 3, novelWords: 5 });
	});

	test('reads chapter snapshots through the text document adapter', async () => {
		const uri = { path: '/Volume 01/Chapter 001.md' };
		let openedUri: typeof uri | undefined;
		const text = await readTextDocumentText(uri, async candidate => {
			openedUri = candidate;
			return { getText: () => '林墨在站台等待。' };
		});

		assert.strictEqual(openedUri, uri);
		assert.strictEqual(text, '林墨在站台等待。');
	});

	test('publishes only the latest asynchronous refresh', async () => {
		const runner = new LatestAsyncResult<number>();
		const published: number[] = [];
		let finishFirst!: (value: number) => void;
		const failOnError = (error: unknown): void => assert.fail(String(error));
		const first = runner.run(() => new Promise(resolve => finishFirst = resolve), value => published.push(value), failOnError);
		const second = runner.run(async () => 2, value => published.push(value), failOnError);
		await second;
		finishFirst(1);
		await first;
		assert.deepStrictEqual(published, [2]);
	});

	test('does not publish or report errors after disposal', async () => {
		const runner = new LatestAsyncResult<number>();
		const published: number[] = [];
		const errors: unknown[] = [];
		let finish!: (value: number) => void;
		const refresh = runner.run(() => new Promise(resolve => finish = resolve), value => published.push(value), error => errors.push(error));
		runner.dispose();
		finish(1);
		await refresh;
		assert.deepStrictEqual(published, []);
		assert.deepStrictEqual(errors, []);
	});
});
