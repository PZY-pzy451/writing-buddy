/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createWriterStatusPresentation, WriterStatusFormatters } from '../statusBarPresentation';

const formatters: WriterStatusFormatters = {
	work: chapterLabel => chapterLabel ? `My Novel > ${chapterLabel}` : 'My Novel',
	chapterWords: wordCount => `Chapter ${wordCount} words`,
	novelWords: wordCount => `Novel ${wordCount} words`,
	save: isDirty => isDirty ? 'Unsaved' : 'Saved',
	focus: 'Focus'
};

suite('statusBarPresentation', () => {
	test('formats the active chapter and saved statistics', () => {
		assert.deepStrictEqual(createWriterStatusPresentation({
			chapterLabel: 'Chapter 003',
			currentChapterWords: 248,
			novelWords: 742,
			isDirty: false
		}, formatters), {
			work: 'My Novel > Chapter 003',
			chapterWords: 'Chapter 248 words',
			novelWords: 'Novel 742 words',
			save: 'Saved',
			focus: 'Focus'
		});
	});

	test('derives unsaved state only for an active catalog chapter', () => {
		assert.deepStrictEqual({
			active: createWriterStatusPresentation({
				chapterLabel: 'Chapter 001',
				currentChapterWords: 10,
				novelWords: 30,
				isDirty: true
			}, formatters).save,
			inactive: createWriterStatusPresentation({
				chapterLabel: undefined,
				currentChapterWords: 0,
				novelWords: 30,
				isDirty: undefined
			}, formatters).save
		}, {
			active: 'Unsaved',
			inactive: undefined
		});
	});
});
