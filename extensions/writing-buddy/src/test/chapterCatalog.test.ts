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
				label: '第一章 停摆的时钟',
				relativePath: 'Volume 01/Chapter 001.md',
				scene: {
					location: '旧火车站',
					time: '23:40',
					pov: '林墨',
					characters: ['林墨', '徐青'],
					goal: '找到遗失的笔记本。',
					note: '车站的时钟停在了 23:17。'
				}
			},
			{
				id: 'chapter-002',
				label: '第二章 迷路的旅人',
				relativePath: 'Volume 01/Chapter 002.md',
				scene: {
					location: '第三站台',
					time: '23:52',
					pov: '徐青',
					characters: ['徐青', '林墨'],
					goal: '追踪偷走笔记本的人。',
					note: '午夜前有一班货运列车。'
				}
			},
			{
				id: 'chapter-003',
				label: '第三章 深夜的访客',
				relativePath: 'Volume 01/Chapter 003.md',
				scene: {
					location: '信号塔',
					time: '00:06',
					pov: '林墨',
					characters: ['林墨', '徐青'],
					goal: '找回车站日志。',
					note: '塔灯以三为一组闪烁。'
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
