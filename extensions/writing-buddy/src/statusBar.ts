/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition } from './chapterCatalog';
import { WritingStatistics } from './writingState';

export class WriterStatusBar implements vscode.Disposable {
	private readonly workItem = vscode.window.createStatusBarItem('writingBuddy.work', vscode.StatusBarAlignment.Left, 1000);
	private readonly chapterWordsItem = vscode.window.createStatusBarItem('writingBuddy.chapterWords', vscode.StatusBarAlignment.Right, 100);
	private readonly novelWordsItem = vscode.window.createStatusBarItem('writingBuddy.novelWords', vscode.StatusBarAlignment.Right, 99);
	private readonly saveItem = vscode.window.createStatusBarItem('writingBuddy.saveState', vscode.StatusBarAlignment.Right, 98);

	private readonly items = [this.workItem, this.chapterWordsItem, this.novelWordsItem, this.saveItem];

	constructor() {
		this.workItem.name = vscode.l10n.t('当前作品和章节');
		this.chapterWordsItem.name = vscode.l10n.t('本章字数');
		this.novelWordsItem.name = vscode.l10n.t('全书字数');
		this.saveItem.name = vscode.l10n.t('保存状态');
	}

	update(chapter: ChapterDefinition | undefined, statistics: WritingStatistics, isDirty: boolean | undefined): void {
		const workText = chapter
			? vscode.l10n.t('当前作品：{0} | 当前章节：{1}', vscode.l10n.t('我的小说'), chapter.label)
			: vscode.l10n.t('当前作品：{0}', vscode.l10n.t('我的小说'));
		this.setItem(this.workItem, workText);

		this.setItem(this.chapterWordsItem, vscode.l10n.t('本章 {0} 字', statistics.currentChapterWords));
		this.setItem(this.novelWordsItem, vscode.l10n.t('全书 {0} 字', statistics.novelWords));

		if (isDirty === undefined) {
			this.saveItem.hide();
		} else {
			const icon = isDirty ? '$(circle-filled)' : '$(check)';
			const text = isDirty ? vscode.l10n.t('未保存') : vscode.l10n.t('已保存');
			this.setItem(this.saveItem, `${icon} ${text}`);
		}
	}

	private setItem(item: vscode.StatusBarItem, text: string, accessibleText: string = text): void {
		item.text = text;
		item.tooltip = accessibleText;
		item.accessibilityInformation = { label: accessibleText };
		item.show();
	}

	dispose(): void {
		for (const item of this.items) {
			item.dispose();
		}
	}
}
