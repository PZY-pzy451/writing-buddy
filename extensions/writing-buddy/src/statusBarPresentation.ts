/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface WriterStatusState {
	readonly chapterLabel: string | undefined;
	readonly currentChapterWords: number;
	readonly novelWords: number;
	readonly isDirty: boolean | undefined;
}

export interface WriterStatusFormatters {
	readonly work: (chapterLabel: string | undefined) => string;
	readonly chapterWords: (wordCount: number) => string;
	readonly novelWords: (wordCount: number) => string;
	readonly save: (isDirty: boolean) => string;
	readonly focus: string;
}

export interface WriterStatusPresentation {
	readonly work: string;
	readonly chapterWords: string;
	readonly novelWords: string;
	readonly save: string | undefined;
	readonly focus: string;
}

export function createWriterStatusPresentation(
	state: WriterStatusState,
	formatters: WriterStatusFormatters
): WriterStatusPresentation {
	return {
		work: formatters.work(state.chapterLabel),
		chapterWords: formatters.chapterWords(state.currentChapterWords),
		novelWords: formatters.novelWords(state.novelWords),
		save: state.chapterLabel !== undefined && state.isDirty !== undefined
			? formatters.save(state.isDirty)
			: undefined,
		focus: formatters.focus
	};
}
