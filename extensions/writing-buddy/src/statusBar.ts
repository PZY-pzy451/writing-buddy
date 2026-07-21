/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition } from './chapterCatalog';
import { createWriterStatusPresentation } from './statusBarPresentation';
import { WritingStatistics } from './writingState';

const focusModeCommand = 'writingBuddy.focusMode';

export class WriterStatusBar implements vscode.Disposable {
	private readonly workItem = vscode.window.createStatusBarItem('writingBuddy.work', vscode.StatusBarAlignment.Left, 1000);
	private readonly chapterWordsItem = vscode.window.createStatusBarItem('writingBuddy.chapterWords', vscode.StatusBarAlignment.Left, 999);
	private readonly novelWordsItem = vscode.window.createStatusBarItem('writingBuddy.novelWords', vscode.StatusBarAlignment.Left, 998);
	private readonly saveItem = vscode.window.createStatusBarItem('writingBuddy.saveState', vscode.StatusBarAlignment.Left, 997);
	private readonly focusItem = vscode.window.createStatusBarItem('writingBuddy.focusMode', vscode.StatusBarAlignment.Left, 996);
	private readonly items = [this.workItem, this.chapterWordsItem, this.novelWordsItem, this.saveItem, this.focusItem];

	constructor() {
		this.workItem.name = vscode.l10n.t('当前小说和章节');
		this.chapterWordsItem.name = vscode.l10n.t('当前章节字数');
		this.novelWordsItem.name = vscode.l10n.t('全书字数');
		this.saveItem.name = vscode.l10n.t('章节保存状态');
		this.focusItem.name = vscode.l10n.t('专注模式');
		this.focusItem.command = focusModeCommand;
		this.update(undefined, { currentChapterWords: 0, novelWords: 0 }, undefined);
	}

	update(chapter: ChapterDefinition | undefined, statistics: WritingStatistics, isDirty: boolean | undefined): void {
		const presentation = createWriterStatusPresentation({
			chapterLabel: chapter?.label,
			currentChapterWords: statistics.currentChapterWords,
			novelWords: statistics.novelWords,
			isDirty
	}, {
		work: chapterLabel => chapterLabel
			? vscode.l10n.t('我的小说 › {0}', chapterLabel)
			: vscode.l10n.t('我的小说'),
		chapterWords: wordCount => vscode.l10n.t('本章 {0} 字', wordCount),
		novelWords: wordCount => vscode.l10n.t('全书 {0} 字', wordCount),
		save: dirty => dirty ? vscode.l10n.t('未保存') : vscode.l10n.t('已保存'),
		focus: vscode.l10n.t('专注')
	});

		this.setItem(this.workItem, presentation.work);
		this.setItem(this.chapterWordsItem, presentation.chapterWords);
		this.setItem(this.novelWordsItem, presentation.novelWords);
		this.setItem(this.focusItem, `$(screen-full) ${presentation.focus}`, vscode.l10n.t('Toggle focus mode'));

		if (presentation.save === undefined) {
			this.saveItem.hide();
		} else {
			const icon = isDirty ? '$(circle-filled)' : '$(check)';
			this.setItem(this.saveItem, `${icon} ${presentation.save}`, presentation.save);
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
