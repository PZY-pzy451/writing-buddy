/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Frozen Phase 0.3 word count algorithm.
 *
 * Rules:
 *   - Each CJK character (Han, Hiragana, Katakana, Hangul) counts as 1.
 *   - Each contiguous ASCII letter sequence counts as 1.
 *   - Each contiguous digit sequence counts as 1.
 *   - Punctuation, whitespace, newlines, tabs, and Markdown markers count as 0.
 *
 * No full Markdown parsing is performed.
 */
const wordPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[A-Za-z0-9]+/gu;

export function countWritingUnits(text: string): number {
	if (text.length === 0) {
		return 0;
	}
	let count = 0;
	for (const _match of text.matchAll(wordPattern)) {
		count++;
	}
	return count;
}
