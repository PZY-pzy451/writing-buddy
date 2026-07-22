/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { countWritingUnits } from './wordCount';

export interface ChapterTextSnapshot {
	readonly chapterId: string;
	readonly text: string;
}

export interface WritingStatistics {
	readonly currentChapterWords: number;
	readonly novelWords: number;
	readonly perChapter: ReadonlyMap<string, number>;
}

export interface TextDocumentSnapshot {
	getText(): string;
}

export async function readTextDocumentText<TUri>(
	uri: TUri,
	openTextDocument: (uri: TUri) => PromiseLike<TextDocumentSnapshot>
): Promise<string> {
	return (await openTextDocument(uri)).getText();
}

export class LatestAsyncResult<T> {
	private revision = 0;
	private disposed = false;

	async run(load: () => Promise<T>, publish: (value: T) => void, reportError: (error: unknown) => void): Promise<void> {
		const revision = ++this.revision;
		try {
			const value = await load();
			if (!this.disposed && revision === this.revision) {
				publish(value);
			}
		} catch (error) {
			if (!this.disposed && revision === this.revision) {
				reportError(error);
			}
		}
	}

	invalidate(): void {
		this.revision++;
	}

	dispose(): void {
		this.disposed = true;
		this.invalidate();
	}
}

export function calculateWritingStatistics(
	chapters: readonly ChapterTextSnapshot[],
	activeChapter: ChapterTextSnapshot | undefined
): WritingStatistics {
	const perChapter = new Map<string, number>();
	let currentChapterWords = 0;
	let novelWords = 0;

	for (const chapter of chapters) {
		const isActiveChapter = chapter.chapterId === activeChapter?.chapterId;
		const text = isActiveChapter && activeChapter ? activeChapter.text : chapter.text;
		const chapterWords = countWritingUnits(text);
		perChapter.set(chapter.chapterId, chapterWords);
		novelWords += chapterWords;
		if (isActiveChapter) {
			currentChapterWords = chapterWords;
		}
	}

	return { currentChapterWords, novelWords, perChapter };
}

export async function loadWritingStatistics(
	chapterIds: readonly string[],
	readDiskText: (chapterId: string) => Promise<string>,
	activeChapter: ChapterTextSnapshot | undefined
): Promise<WritingStatistics> {
	const diskSnapshots = await Promise.all(chapterIds.map(async chapterId => ({
		chapterId,
		text: await readDiskText(chapterId)
	})));
	return calculateWritingStatistics(diskSnapshots, activeChapter);
}
