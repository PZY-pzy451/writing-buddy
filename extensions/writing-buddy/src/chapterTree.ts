/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition, chapters } from './chapterCatalog';
import { shouldRevealActiveChapter } from './chapterTracking';

export type ChapterTreeElement =
	| TodayWritingElement
	| VolumeElement
	| ChapterElement
	| PlaceholderElement;

interface TodayWritingElement {
	readonly kind: 'today';
	readonly id: 'today-writing';
}

interface VolumeElement {
	readonly kind: 'volume';
	readonly id: 'volume-01';
}

interface ChapterElement {
	readonly kind: 'chapter';
	readonly id: string;
	readonly chapter: ChapterDefinition;
}

interface PlaceholderElement {
	readonly kind: 'placeholder';
	readonly id: 'characters' | 'worldbuilding' | 'timeline' | 'notes';
}

const todayWritingElement: TodayWritingElement = { kind: 'today', id: 'today-writing' };
const volumeElement: VolumeElement = { kind: 'volume', id: 'volume-01' };
const chapterElements: readonly ChapterElement[] = chapters.map(chapter => ({ kind: 'chapter', id: chapter.id, chapter }));

const placeholderElements: readonly PlaceholderElement[] = [
	{ kind: 'placeholder', id: 'characters' },
	{ kind: 'placeholder', id: 'worldbuilding' },
	{ kind: 'placeholder', id: 'timeline' },
	{ kind: 'placeholder', id: 'notes' }
];

export class ChapterTreeDataProvider implements vscode.TreeDataProvider<ChapterTreeElement>, vscode.Disposable {
	private readonly changeEmitter = new vscode.EventEmitter<ChapterTreeElement | undefined>();
	private activeChapterId: string | undefined;
	private chapterWordCounts: Map<string, number> = new Map();

	readonly onDidChangeTreeData = this.changeEmitter.event;

	dispose(): void {
		this.changeEmitter.dispose();
	}

	getTreeItem(element: ChapterTreeElement): vscode.TreeItem {
		switch (element.kind) {
			case 'today': {
				const item = new vscode.TreeItem(vscode.l10n.t('今日写作'), vscode.TreeItemCollapsibleState.None);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('calendar');
				item.contextValue = 'writingBuddy.today';
				return item;
			}
			case 'volume': {
				const item = new vscode.TreeItem(vscode.l10n.t('第一卷'), vscode.TreeItemCollapsibleState.Expanded);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('folder-opened');
				return item;
			}
			case 'chapter': {
				const wordCount = this.chapterWordCounts.get(element.id);
				const wordCountText = wordCount !== undefined ? `${wordCount}字` : '';
				const isActive = element.id === this.activeChapterId;
				const item = new vscode.TreeItem(
					this.getChapterLabel(element.chapter),
					vscode.TreeItemCollapsibleState.None
				);
				item.id = element.id;
				item.contextValue = isActive ? 'writingBuddy.chapter.active' : 'writingBuddy.chapter';
				item.iconPath = new vscode.ThemeIcon(isActive ? 'edit' : 'file-text');
				item.description = wordCountText;
				item.tooltip = wordCountText ? `${element.chapter.label} - ${wordCountText}` : element.chapter.label;
				item.command = {
					command: 'writingBuddy.openChapter',
					title: vscode.l10n.t('打开章节'),
					arguments: [element.chapter.id]
				};
				return item;
			}
			case 'placeholder': {
				const item = new vscode.TreeItem(this.getPlaceholderLabel(element), vscode.TreeItemCollapsibleState.None);
				item.id = `placeholder-${element.id}`;
				item.iconPath = new vscode.ThemeIcon(this.getPlaceholderIcon(element));
				item.tooltip = vscode.l10n.t('后续开放');
				return item;
			}
		}
	}

	getChildren(element?: ChapterTreeElement): ChapterTreeElement[] {
		if (!element) {
			return [todayWritingElement, volumeElement, ...placeholderElements];
		}

		switch (element.kind) {
			case 'volume':
				return [...chapterElements];
			case 'today':
			case 'chapter':
			case 'placeholder':
				return [];
		}
	}

	getParent(element: ChapterTreeElement): ChapterTreeElement | undefined {
		switch (element.kind) {
			case 'chapter':
				return volumeElement;
			case 'today':
			case 'volume':
			case 'placeholder':
				return undefined;
		}
	}

	setActiveChapter(chapterId: string | undefined): void {
		if (this.activeChapterId === chapterId) {
			return;
		}

		this.activeChapterId = chapterId;
		this.changeEmitter.fire(undefined);
	}

	updateChapterWordCount(chapterId: string, wordCount: number): void {
		this.chapterWordCounts.set(chapterId, wordCount);
		this.changeEmitter.fire(undefined);
	}

	clearChapterWordCounts(): void {
		if (this.chapterWordCounts.size === 0) {
			return;
		}
		this.chapterWordCounts.clear();
		this.changeEmitter.fire(undefined);
	}

	async revealActiveChapter(treeView: vscode.TreeView<ChapterTreeElement>, editorStillActive: boolean, revealRequested: boolean): Promise<void> {
		if (!shouldRevealActiveChapter(treeView.visible, editorStillActive, revealRequested)) {
			return;
		}

		const activeElement = chapterElements.find(element => element.id === this.activeChapterId);
		if (activeElement) {
			await treeView.reveal(activeElement, { select: true, focus: false, expand: 2 });
		}
	}

	private getChapterLabel(chapter: ChapterDefinition): string {
		return chapter.label;
	}

	private getPlaceholderLabel(element: PlaceholderElement): string {
		switch (element.id) {
			case 'characters': return vscode.l10n.t('人物');
			case 'worldbuilding': return vscode.l10n.t('世界观');
			case 'timeline': return vscode.l10n.t('时间线');
			case 'notes': return vscode.l10n.t('笔记');
		}
	}

	private getPlaceholderIcon(element: PlaceholderElement): string {
		switch (element.id) {
			case 'characters': return 'person';
			case 'worldbuilding': return 'globe';
			case 'timeline': return 'history';
			case 'notes': return 'note';
		}
	}
}
