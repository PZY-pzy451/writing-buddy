/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ChapterDefinition {
	readonly id: string;
	readonly label: string;
	readonly relativePath: string;
	readonly wordCount?: number;
	readonly volume?: string;
	readonly scene: {
		readonly location: string;
		readonly time: string;
		readonly pov: string;
		readonly characters: readonly string[];
		readonly goal: string;
		readonly note: string;
	};
}

export const chapters: readonly ChapterDefinition[] = [
	{
		id: 'chapter-001',
		label: '第一章 停摆的时钟',
		relativePath: 'Volume 01/Chapter 001.md',
		wordCount: 2341,
		volume: '第一卷 灰城之下',
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
		wordCount: 2812,
		volume: '第一卷 灰城之下',
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
		wordCount: 2105,
		volume: '第一卷 灰城之下',
		scene: {
			location: '信号塔',
			time: '00:06',
			pov: '林墨',
			characters: ['林墨', '徐青'],
			goal: '找回车站日志。',
			note: '塔灯以三为一组闪烁。'
		}
	}
];

function normalizeRelativePath(relativePath: string): string {
	return relativePath.replaceAll('\\', '/').toLowerCase();
}

export function findChapterById(id: string): ChapterDefinition | undefined {
	return chapters.find(chapter => chapter.id === id);
}

export function findChapterByRelativePath(relativePath: string): ChapterDefinition | undefined {
	const normalizedPath = normalizeRelativePath(relativePath);
	return chapters.find(chapter => normalizeRelativePath(chapter.relativePath) === normalizedPath);
}

export function getAdjacentChapter(currentChapterId: string, direction: 'prev' | 'next'): ChapterDefinition | undefined {
	const currentIndex = chapters.findIndex(ch => ch.id === currentChapterId);
	if (currentIndex === -1) {
		return undefined;
	}

	const adjacentIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
	if (adjacentIndex < 0 || adjacentIndex >= chapters.length) {
		return undefined;
	}

	return chapters[adjacentIndex];
}
