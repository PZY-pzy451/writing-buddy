/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { countWords } from '../wordCount';

suite('countWords', () => {
	test('counts every CJK character', () => {
		assert.strictEqual(countWords('灰城夜雨'), 4);
	});

	test('counts contiguous ASCII letters and digits as tokens', () => {
		assert.strictEqual(countWords('Writing Buddy 2026'), 3);
	});

	test('ignores whitespace punctuation and markdown markers', () => {
		assert.strictEqual(countWords('# **，。！**\n\t---'), 0);
	});

	test('combines CJK characters and ASCII tokens', () => {
		assert.strictEqual(countWords('第12章 Writing Buddy'), 5);
	});
});
