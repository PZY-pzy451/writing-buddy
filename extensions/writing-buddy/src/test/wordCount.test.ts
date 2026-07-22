/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { countWritingUnits } from '../wordCount';

suite('countWritingUnits', () => {
	test('counts every CJK character', () => {
		assert.strictEqual(countWritingUnits('灰城夜雨'), 4);
	});

	test('counts contiguous ASCII letters and digits as tokens', () => {
		assert.strictEqual(countWritingUnits('Writing Buddy 2026'), 3);
	});

	test('ignores whitespace punctuation and markdown markers', () => {
		assert.strictEqual(countWritingUnits('# **，。！**\n\t---'), 0);
	});

	test('combines CJK characters and ASCII tokens', () => {
		assert.strictEqual(countWritingUnits('第12章 Writing Buddy'), 5);
	});

	test('returns zero for empty text', () => {
		assert.strictEqual(countWritingUnits(''), 0);
	});

	test('matches the frozen reference samples', () => {
		assert.strictEqual(countWritingUnits('林墨'), 2);
		assert.strictEqual(countWritingUnits('，。！？'), 0);
		assert.strictEqual(countWritingUnits('林墨 Writing Buddy'), 4);
		assert.strictEqual(countWritingUnits('# 第一章'), 3);
	});
});
