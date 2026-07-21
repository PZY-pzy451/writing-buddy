/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { chapters, findChapterById, findChapterByRelativePath } from '../chapterCatalog';

suite('chapterCatalog', () => {
	test('contains the three frozen demo chapters in volume order', () => {
		assert.deepStrictEqual(chapters.map(chapter => chapter.id), ['chapter-001', 'chapter-002', 'chapter-003']);
	});

	test('exposes stable labels, relative paths, and scene metadata', () => {
		assert.deepStrictEqual(chapters.map(chapter => ({
			id: chapter.id,
			label: chapter.label,
			relativePath: chapter.relativePath,
			scene: chapter.scene
		})), [
			{
				id: 'chapter-001',
				label: 'Chapter 001',
				relativePath: 'Volume 01/Chapter 001.md',
				scene: {
					location: 'Old Railway Station',
					time: '23:40',
					pov: 'Lin Mo',
					characters: ['Lin Mo', 'Xu Qing'],
					goal: 'Find the missing notebook.',
					note: 'The station clock stopped at 23:17.'
				}
			},
			{
				id: 'chapter-002',
				label: 'Chapter 002',
				relativePath: 'Volume 01/Chapter 002.md',
				scene: {
					location: 'Platform Three',
					time: '23:52',
					pov: 'Xu Qing',
					characters: ['Xu Qing', 'Lin Mo'],
					goal: 'Trace the notebook thief.',
					note: 'A freight train is due before midnight.'
				}
			},
			{
				id: 'chapter-003',
				label: 'Chapter 003',
				relativePath: 'Volume 01/Chapter 003.md',
				scene: {
					location: 'Signal Tower',
					time: '00:06',
					pov: 'Lin Mo',
					characters: ['Lin Mo', 'Xu Qing'],
					goal: 'Recover the station log.',
					note: 'The tower lamp flashes in groups of three.'
				}
			}
		]);
	});

	test('looks up a chapter by normalized relative path', () => {
		assert.strictEqual(findChapterByRelativePath('Volume 01\\Chapter 002.md')?.id, 'chapter-002');
	});

	test('looks up a chapter by a case-insensitive Windows-compatible relative path', () => {
		assert.strictEqual(findChapterByRelativePath('volume 01/chapter 003.MD')?.id, 'chapter-003');
	});

	test('returns no chapter for unrelated markdown', () => {
		assert.strictEqual(findChapterByRelativePath('Notes/README.md'), undefined);
	});

	test('looks up a chapter by stable id', () => {
		assert.strictEqual(findChapterById('chapter-002')?.relativePath, 'Volume 01/Chapter 002.md');
	});
});
