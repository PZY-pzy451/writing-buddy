/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { ChapterDefinition, chapters, findChapterById, findChapterByRelativePath } from './chapterCatalog';
import { ChapterMetadataViewProvider } from './chapterMetadataViewProvider';
import { SerialOperationQueue } from './chapterTracking';
import { ChapterTreeDataProvider, ChapterTreeElement } from './chapterTree';
import { ensureSampleNovel, isSampleNovelWorkspace } from './novelBootstrap';
import { WriterStatusBar } from './statusBar';
import { areFilePathsEqual } from './workspaceIdentity';
import { applyWriterShell } from './writerShell';
import { WritingStatisticsService } from './writingStatistics';

const layoutInitializedKey = 'writingBuddy.layoutInitialized';
const lastChapterIdKey = 'writingBuddy.lastChapterId';

async function initializeLayout(context: vscode.ExtensionContext): Promise<void> {
	if (context.workspaceState.get<boolean>(layoutInitializedKey, false)) {
		return;
	}

	await vscode.commands.executeCommand('workbench.view.extension.writingBuddyNavigation');
	await vscode.commands.executeCommand('workbench.view.extension.writingBuddyAssistant');
	await vscode.commands.executeCommand('workbench.action.closePanel');
	await context.workspaceState.update(layoutInitializedKey, true);
}

function getChapterForDocument(sampleNovelUri: vscode.Uri, documentUri: vscode.Uri): ChapterDefinition | undefined {
	if (sampleNovelUri.scheme !== 'file' || documentUri.scheme !== 'file') {
		return undefined;
	}

	const relativePath = path.relative(sampleNovelUri.fsPath, documentUri.fsPath);
	const chapter = findChapterByRelativePath(relativePath);
	if (!chapter) {
		return undefined;
	}

	const expectedUri = vscode.Uri.joinPath(sampleNovelUri, ...chapter.relativePath.split('/'));
	return areFilePathsEqual(expectedUri.fsPath, documentUri.fsPath, process.platform) ? chapter : undefined;
}

async function openChapter(context: vscode.ExtensionContext, sampleNovelUri: vscode.Uri, chapterId: string): Promise<void> {
	const chapter = findChapterById(chapterId);
	if (!chapter) {
		await vscode.window.showErrorMessage(vscode.l10n.t('The selected chapter could not be found.'));
		return;
	}

	const chapterUri = vscode.Uri.joinPath(sampleNovelUri, ...chapter.relativePath.split('/'));
	const document = await vscode.workspace.openTextDocument(chapterUri);
	await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Active });
	await context.workspaceState.update(lastChapterIdKey, chapter.id);
}

async function trackActiveChapter(
	context: vscode.ExtensionContext,
	sampleNovelUri: vscode.Uri,
	provider: ChapterTreeDataProvider,
	metadataView: ChapterMetadataViewProvider,
	treeView: vscode.TreeView<ChapterTreeElement>,
	editor: vscode.TextEditor | undefined,
	revealRequested: boolean
): Promise<void> {
	if (vscode.window.activeTextEditor !== editor) {
		return;
	}

	const chapter = editor ? getChapterForDocument(sampleNovelUri, editor.document.uri) : undefined;
	provider.setActiveChapter(chapter?.id);
	metadataView.setActiveChapter(chapter);
	if (chapter) {
		await context.workspaceState.update(lastChapterIdKey, chapter.id);
	}
	await provider.revealActiveChapter(treeView, vscode.window.activeTextEditor === editor, revealRequested);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	await applyWriterShell(context);

	const sampleNovelUri = await ensureSampleNovel(context);
	await vscode.commands.executeCommand('setContext', 'writingBuddy.ready', true);

	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.openChapter', async (chapterId: string) => {
		await openChapter(context, sampleNovelUri, chapterId);
	}));

	const chapterTreeProvider = new ChapterTreeDataProvider();
	context.subscriptions.push(chapterTreeProvider);
	const chapterTreeView = vscode.window.createTreeView('writingBuddy.novelStructure', {
		treeDataProvider: chapterTreeProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(chapterTreeView);

	const metadataView = new ChapterMetadataViewProvider();
	context.subscriptions.push(metadataView);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('writingBuddy.chapterMetadata', metadataView));

	const chapterTrackingQueue = new SerialOperationQueue();
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		void chapterTrackingQueue.enqueue(async () => {
			await trackActiveChapter(context, sampleNovelUri, chapterTreeProvider, metadataView, chapterTreeView, editor, true);
		}).catch(error => {
			console.error('Writing Buddy chapter tracking failed.', error);
		});
	}));

	if (isSampleNovelWorkspace(sampleNovelUri)) {
		await initializeLayout(context);

		const writingStatistics = new WritingStatisticsService(sampleNovelUri, documentUri => getChapterForDocument(sampleNovelUri, documentUri));
		context.subscriptions.push(writingStatistics);
		const writerStatusBar = new WriterStatusBar();
		context.subscriptions.push(writerStatusBar);

		const syncFromEditor = (): void => {
			const editor = vscode.window.activeTextEditor;
			const chapter = editor ? getChapterForDocument(sampleNovelUri, editor.document.uri) : undefined;
			const isDirty = chapter && editor ? editor.document.isDirty : undefined;
			writerStatusBar.update(chapter, writingStatistics.statistics, isDirty);
			for (const c of chapters) {
				chapterTreeProvider.updateChapterWordCount(c.id, writingStatistics.wordsForChapter(c.id));
			}
		};

		context.subscriptions.push(writingStatistics.onDidChange(syncFromEditor));
		await writingStatistics.refreshNow();
		syncFromEditor();

		// Restore priority:
		// 1. Code-OSS already restored an editor → trust it
		// 2. Else if we have a lastChapterId → open that chapter
		// 3. Else → open chapter-001
		const restoredEditor = vscode.window.activeTextEditor;
		const restoredChapter = restoredEditor
			? getChapterForDocument(sampleNovelUri, restoredEditor.document.uri)
			: undefined;

		if (restoredChapter) {
			await trackActiveChapter(context, sampleNovelUri, chapterTreeProvider, metadataView, chapterTreeView, restoredEditor, false);
		} else {
			const savedChapterId = context.workspaceState.get<string>(lastChapterIdKey);
			const initialChapter = findChapterById(savedChapterId ?? '') ?? chapters[0];
			await openChapter(context, sampleNovelUri, initialChapter.id);
		}
	}
}

export function deactivate(): void {
}
