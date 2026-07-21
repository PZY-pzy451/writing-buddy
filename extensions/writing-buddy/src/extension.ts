/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { AssistantViewProvider } from './assistantView';
import { ChapterDefinition, chapters, findChapterById, findChapterByRelativePath, getAdjacentChapter } from './chapterCatalog';
import { SerialOperationQueue } from './chapterTracking';
import { ChapterTreeDataProvider, ChapterTreeElement } from './chapterTree';
import { ensureSampleNovel, isSampleNovelWorkspace } from './novelBootstrap';
import { WriterStatusBar } from './statusBar';
import { areFilePathsEqual } from './workspaceIdentity';
import { ProductHeader } from './productHeader';
import { applyWriterShell } from './writerShell';
import { WritingStatisticsService } from './writingStatistics';

const sampleWorkspaceOpenedKey = 'writingBuddy.sampleWorkspaceOpened';
const layoutInitializedKey = 'writingBuddy.layoutInitialized';
const lastChapterIdKey = 'writingBuddy.lastChapterId';

async function openSampleNovel(context: vscode.ExtensionContext, sampleNovelUri: vscode.Uri): Promise<void> {
	await context.globalState.update(sampleWorkspaceOpenedKey, true);
	await vscode.commands.executeCommand('vscode.openFolder', sampleNovelUri, { forceReuseWindow: true });
}

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
	assistantProvider: AssistantViewProvider,
	treeView: vscode.TreeView<ChapterTreeElement>,
	editor: vscode.TextEditor | undefined,
	revealRequested = true
): Promise<void> {
	if (vscode.window.activeTextEditor !== editor) {
		return;
	}

	const chapter = editor ? getChapterForDocument(sampleNovelUri, editor.document.uri) : undefined;
	provider.setActiveChapter(chapter?.id);
	assistantProvider.setActiveChapter(chapter);
	if (!chapter) {
		return;
	}

	await context.workspaceState.update(lastChapterIdKey, chapter.id);
	await provider.revealActiveChapter(treeView, vscode.window.activeTextEditor === editor, revealRequested);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// Apply Writing Buddy product shell first to transform Code-OSS into writing-focused product
	await applyWriterShell(context);

	const sampleNovelUri = await ensureSampleNovel(context);
	// Automatic activation now waits for onStartupFinished so Workbench editor restoration wins; explicit commands can still activate earlier.
	await vscode.commands.executeCommand('setContext', 'writingBuddy.ready', true);
	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.openSampleNovel', async () => {
		await openSampleNovel(context, sampleNovelUri);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.focusMode', async () => {
		await vscode.commands.executeCommand('workbench.action.toggleZenMode');
	}));

	const chapterTreeProvider = new ChapterTreeDataProvider();
	context.subscriptions.push(chapterTreeProvider);
	const chapterTreeView = vscode.window.createTreeView('writingBuddy.novelStructure', {
		treeDataProvider: chapterTreeProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(chapterTreeView);
	const assistantProvider = new AssistantViewProvider();
	context.subscriptions.push(assistantProvider);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('writingBuddy.sceneAssistant', assistantProvider));
	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.openChapter', async (chapterId: string) => {
		await openChapter(context, sampleNovelUri, chapterId);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.prevChapter', async () => {
		const currentChapterId = context.workspaceState.get<string>(lastChapterIdKey);
		if (currentChapterId) {
			const prevChapter = getAdjacentChapter(currentChapterId, 'prev');
			if (prevChapter) {
				await openChapter(context, sampleNovelUri, prevChapter.id);
			}
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('writingBuddy.nextChapter', async () => {
		const currentChapterId = context.workspaceState.get<string>(lastChapterIdKey);
		if (currentChapterId) {
			const nextChapter = getAdjacentChapter(currentChapterId, 'next');
			if (nextChapter) {
				await openChapter(context, sampleNovelUri, nextChapter.id);
			}
		}
	}));
	const chapterTrackingQueue = new SerialOperationQueue();
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		void chapterTrackingQueue.enqueue(async () => {
			await trackActiveChapter(context, sampleNovelUri, chapterTreeProvider, assistantProvider, chapterTreeView, editor);
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
		const productHeader = new ProductHeader(context);
		context.subscriptions.push(productHeader);
		const updateWriterStatus = (): void => {
			const editor = vscode.window.activeTextEditor;
			const chapter = editor ? getChapterForDocument(sampleNovelUri, editor.document.uri) : undefined;
			writerStatusBar.update(chapter, writingStatistics.statistics, chapter && editor ? editor.document.isDirty : undefined);
			productHeader.update({
				chapter,
				statistics: writingStatistics.statistics,
				isDirty: chapter && editor ? editor.document.isDirty : undefined
			});
		};
		context.subscriptions.push(writingStatistics.onDidChange(updateWriterStatus));
		await writingStatistics.refreshNow();
		updateWriterStatus();
		productHeader.reveal();
		const restoredChapter = vscode.window.activeTextEditor
			? getChapterForDocument(sampleNovelUri, vscode.window.activeTextEditor.document.uri)
			: undefined;
		if (restoredChapter) {
			await trackActiveChapter(context, sampleNovelUri, chapterTreeProvider, assistantProvider, chapterTreeView, vscode.window.activeTextEditor, false);
			return;
		}

		const savedChapterId = context.workspaceState.get<string>(lastChapterIdKey);
		const initialChapter = findChapterById(savedChapterId ?? '') ?? chapters[0];
		await openChapter(context, sampleNovelUri, initialChapter.id);
		return;
	}

	if (!vscode.workspace.workspaceFolders && !context.globalState.get<boolean>(sampleWorkspaceOpenedKey, false)) {
		await openSampleNovel(context, sampleNovelUri);
	}
}

export function deactivate(): void {
}
