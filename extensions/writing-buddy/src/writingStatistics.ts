/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition, chapters } from './chapterCatalog';
import { LatestAsyncResult, loadWritingStatistics, readTextDocumentText, WritingStatistics } from './writingState';

const textChangeDebounceMilliseconds = 75;

function emptyStatistics(): WritingStatistics {
	return { currentChapterWords: 0, novelWords: 0, perChapter: new Map() };
}

export class WritingStatisticsService implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private readonly changeEmitter = new vscode.EventEmitter<WritingStatistics>();
	private readonly refreshRunner = new LatestAsyncResult<WritingStatistics>();
	private refreshTimer: ReturnType<typeof setTimeout> | undefined;
	private disposed = false;
	private value: WritingStatistics = emptyStatistics();

	readonly onDidChange = this.changeEmitter.event;

	constructor(
		private readonly sampleNovelUri: vscode.Uri,
		private readonly getChapterForDocument: (documentUri: vscode.Uri) => ChapterDefinition | undefined
	) {
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor(editor => {
				this.scheduleRefresh(0, editor);
			}),
			vscode.workspace.onDidChangeTextDocument(event => {
				if (this.getChapterForDocument(event.document.uri)) {
					this.scheduleRefresh(textChangeDebounceMilliseconds);
				}
			}),
			vscode.workspace.onDidSaveTextDocument(document => {
				if (this.getChapterForDocument(document.uri)) {
					this.scheduleRefresh(0);
				}
			}),
			vscode.workspace.onDidCloseTextDocument(document => {
				if (this.getChapterForDocument(document.uri)) {
					this.scheduleRefresh(0);
				}
			})
		);
	}

	get statistics(): WritingStatistics {
		return this.value;
	}

	get currentChapterWords(): number {
		return this.value.currentChapterWords;
	}

	wordsForChapter(chapterId: string): number {
		return this.value.perChapter.get(chapterId) ?? 0;
	}

	async refreshNow(): Promise<void> {
		this.cancelScheduledRefresh();
		await this.refreshRunner.run(
			async () => {
				const activeEditor = vscode.window.activeTextEditor;
				const activeChapter = activeEditor ? this.getChapterForDocument(activeEditor.document.uri) : undefined;
				const activeOverride = activeChapter && activeEditor
					? { chapterId: activeChapter.id, text: activeEditor.document.getText() }
					: undefined;
				return loadWritingStatistics(
					chapters.map(chapter => chapter.id),
					async chapterId => {
						const chapter = chapters.find(candidate => candidate.id === chapterId)!;
						const uri = vscode.Uri.joinPath(this.sampleNovelUri, ...chapter.relativePath.split('/'));
						return readTextDocumentText(uri, candidate => vscode.workspace.openTextDocument(candidate));
					},
					activeOverride
				);
			},
			statistics => {
				this.value = statistics;
				this.changeEmitter.fire(statistics);
			},
			error => console.error('Writing Buddy statistics refresh failed.', error)
		);
	}

	private scheduleRefresh(delay: number, editorHint?: vscode.TextEditor): void {
		if (this.disposed) {
			return;
		}

		this.refreshRunner.invalidate();
		this.cancelScheduledRefresh();
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined;
			if (editorHint) {
				const chapter = this.getChapterForDocument(editorHint.document.uri);
				if (chapter) {
					// The hint lets us warm the active-chapter override before the
					// async refresh resolves, keeping the bottom status in sync.
				}
			}
			void this.refreshNow();
		}, delay);
	}

	private cancelScheduledRefresh(): void {
		if (this.refreshTimer !== undefined) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = undefined;
		}
	}

	dispose(): void {
		this.disposed = true;
		this.cancelScheduledRefresh();
		this.refreshRunner.dispose();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.changeEmitter.dispose();
	}
}
