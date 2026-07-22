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
	| NoteElement
	| TrashElement
	| SettingsElement
	| HelpElement
	| ResourceElement;

interface TodayWritingElement {
	readonly kind: 'today';
	readonly id: 'today-writing';
}

interface VolumeElement {
	readonly kind: 'volume';
	readonly id: string;
	readonly label: string;
}

interface ChapterElement {
	readonly kind: 'chapter';
	readonly id: string;
	readonly chapter: ChapterDefinition;
	readonly wordCount?: number;
}

interface NoteElement {
	readonly kind: 'note';
	readonly id: 'notes';
}

interface TrashElement {
	readonly kind: 'trash';
	readonly id: 'trash';
}

interface SettingsElement {
	readonly kind: 'settings';
	readonly id: 'settings';
}

interface HelpElement {
	readonly kind: 'help';
	readonly id: 'help';
}

interface ResourceElement {
	readonly kind: 'resource';
	readonly id: 'characters' | 'worldbuilding' | 'timeline' | 'notes';
}

// Tree structure
const todayWritingElement: TodayWritingElement = { kind: 'today', id: 'today-writing' };
const volumeElements: VolumeElement[] = [
	{ kind: 'volume', id: 'volume-01', label: '第一卷 灰城之下' },
	{ kind: 'volume', id: 'volume-02', label: '第二卷 北境风云' },
	{ kind: 'volume', id: 'volume-03', label: '第三卷 烽火将至' }
];
const chapterElements: readonly ChapterElement[] = chapters.map(chapter => ({ kind: 'chapter', id: chapter.id, chapter }));
const noteElement: NoteElement = { kind: 'note', id: 'notes' };
const trashElement: TrashElement = { kind: 'trash', id: 'trash' };
const settingsElement: SettingsElement = { kind: 'settings', id: 'settings' };
const helpElement: HelpElement = { kind: 'help', id: 'help' };

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
				const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('folder-opened');
				return item;
			}
			case 'chapter': {
				const wordCount = this.chapterWordCounts.get(element.id) ?? element.chapter.wordCount ?? 0;
				const wordCountText = wordCount > 0 ? `${wordCount}字` : '';
				const item = new vscode.TreeItem(
					this.getChapterLabel(element.chapter),
					vscode.TreeItemCollapsibleState.None
				);
				item.id = element.id;
				item.contextValue = 'writingBuddy.chapter';
				item.iconPath = new vscode.ThemeIcon(element.id === this.activeChapterId ? 'edit' : 'file-text');
				item.description = wordCountText;
				item.tooltip = `${element.chapter.label} - ${wordCountText}`;
				if (element.id === this.activeChapterId) {
					item.contextValue = 'writingBuddy.chapter.active';
				}
				item.command = {
					command: 'writingBuddy.openChapter',
					title: vscode.l10n.t('打开章节'),
					arguments: [element.chapter.id]
				};
				return item;
			}
			case 'note': {
				const item = new vscode.TreeItem(vscode.l10n.t('便签'), vscode.TreeItemCollapsibleState.None);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('note');
				item.contextValue = 'writingBuddy.note';
				return item;
			}
			case 'trash': {
				const item = new vscode.TreeItem(vscode.l10n.t('废稿箱'), vscode.TreeItemCollapsibleState.None);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('trash');
				item.contextValue = 'writingBuddy.trash';
				return item;
			}
			case 'settings': {
				const item = new vscode.TreeItem(vscode.l10n.t('设置'), vscode.TreeItemCollapsibleState.None);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('gear');
				item.contextValue = 'writingBuddy.settings';
				return item;
			}
			case 'help': {
				const item = new vscode.TreeItem(vscode.l10n.t('帮助'), vscode.TreeItemCollapsibleState.None);
				item.id = element.id;
				item.iconPath = new vscode.ThemeIcon('question');
				item.contextValue = 'writingBuddy.help';
				return item;
			}
			case 'resource': {
				const item = new vscode.TreeItem(this.getResourceLabel(element), vscode.TreeItemCollapsibleState.None);
				item.id = `resource-${element.id}`;
				item.iconPath = new vscode.ThemeIcon(this.getResourceIcon(element));
				return item;
			}
		}
	}

	getChildren(element?: ChapterTreeElement): ChapterTreeElement[] {
		if (!element) {
			return [todayWritingElement, ...volumeElements, noteElement, trashElement, settingsElement, helpElement];
		}

		switch (element.kind) {
			case 'volume':
				// Chapters belong to the first volume; other volumes are placeholders.
				return element.id === 'volume-01' ? [...chapterElements] : [];
			case 'today':
				// 今日写作可以显示今天创建的章节
				return [];
			case 'chapter':
			case 'note':
			case 'trash':
			case 'settings':
			case 'help':
			case 'resource':
				return [];
		}
	}

	getParent(element: ChapterTreeElement): ChapterTreeElement | undefined {
		switch (element.kind) {
			case 'today':
			case 'note':
			case 'trash':
			case 'settings':
			case 'help':
			case 'volume':
				return undefined;
			case 'chapter':
				return volumeElements[0]; // 假设所有章节都在第一卷
			case 'resource':
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
		// 从章节标签中提取数字部分
		const match = chapter.label.match(/第(\d+)章/);
		if (match) {
			const chapterNum = match[1];
			const title = chapter.label.replace(/第\d+章\s*/, '');
			return `第${chapterNum}章 ${title}`;
		}
		return chapter.label;
	}

	private getResourceLabel(element: ResourceElement): string {
		switch (element.id) {
			case 'characters':
				return vscode.l10n.t('人物');
			case 'worldbuilding':
				return vscode.l10n.t('世界观');
			case 'timeline':
				return vscode.l10n.t('时间线');
			case 'notes':
				return vscode.l10n.t('资料');
		}
	}

	private getResourceIcon(element: ResourceElement): string {
		switch (element.id) {
			case 'characters':
				return 'person';
			case 'worldbuilding':
				return 'globe';
			case 'timeline':
				return 'history';
			case 'notes':
				return 'note';
		}
	}
}
