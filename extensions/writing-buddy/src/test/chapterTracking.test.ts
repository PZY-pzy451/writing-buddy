/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { SerialOperationQueue, shouldRevealActiveChapter } from '../chapterTracking';

suite('chapter tracking', () => {
	test('reveals only while the tree is visible and the editor is still active', () => {
		assert.strictEqual(shouldRevealActiveChapter(true, true, true), true);
		assert.strictEqual(shouldRevealActiveChapter(false, true, true), false);
		assert.strictEqual(shouldRevealActiveChapter(true, false, true), false);
		assert.strictEqual(shouldRevealActiveChapter(true, true, false), false);
	});

	test('runs editor updates serially', async () => {
		const queue = new SerialOperationQueue();
		const order: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstGate = new Promise<void>(resolve => releaseFirst = resolve);

		const first = queue.enqueue(async () => {
			order.push('first:start');
			await firstGate;
			order.push('first:end');
		});
		const second = queue.enqueue(async () => {
			order.push('second');
		});

		await new Promise<void>(resolve => setImmediate(resolve));
		assert.deepStrictEqual(order, ['first:start']);
		releaseFirst?.();
		await Promise.all([first, second]);
		assert.deepStrictEqual(order, ['first:start', 'first:end', 'second']);
	});

	test('continues after a rejected editor update', async () => {
		const queue = new SerialOperationQueue();
		const first = queue.enqueue(async () => {
			throw new Error('simulated tracking failure');
		});
		let secondRan = false;
		const second = queue.enqueue(async () => {
			secondRan = true;
		});

		await assert.rejects(first, /simulated tracking failure/);
		await second;
		assert.strictEqual(secondRan, true);
	});
});
