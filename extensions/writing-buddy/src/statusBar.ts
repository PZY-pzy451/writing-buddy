/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition } from './chapterCatalog';
import { WritingStatistics } from './writingState';

export interface PendingSummary {
	readonly severe: number;
	readonly warning: number;
	readonly suggestion: number;
	readonly ignored: number;
}

export interface WriterStatusBarState {
	readonly chapter: ChapterDefinition | undefined;
	readonly statistics: WritingStatistics;
	readonly isDirty: boolean | undefined;
	readonly todayWords?: number;
	readonly targetWords?: number;
	readonly pending?: PendingSummary;
	readonly backgroundTasks?: number;
	readonly backupOk?: boolean;
}

export class WriterStatusBar implements vscode.Disposable {
	// Left side: pending issues and tasks
	private readonly pendingItem = vscode.window.createStatusBarItem('writingBuddy.pending', vscode.StatusBarAlignment.Left, 1000);
	private readonly diffItem = vscode.window.createStatusBarItem('writingBuddy.diff', vscode.StatusBarAlignment.Left, 999);
	private readonly tasksItem = vscode.window.createStatusBarItem('writingBuddy.tasks', vscode.StatusBarAlignment.Left, 998);
	private readonly backupRecordItem = vscode.window.createStatusBarItem('writingBuddy.backupRecord', vscode.StatusBarAlignment.Left, 997);

	// Right side: save state, word counts, backup status
	private readonly localSaveItem = vscode.window.createStatusBarItem('writingBuddy.localSave', vscode.StatusBarAlignment.Right, 100);
	private readonly backupItem = vscode.window.createStatusBarItem('writingBuddy.backup', vscode.StatusBarAlignment.Right, 99);
	private readonly chapterWordsItem = vscode.window.createStatusBarItem('writingBuddy.chapterWords', vscode.StatusBarAlignment.Right, 98);
	private readonly todayWordsItem = vscode.window.createStatusBarItem('writingBuddy.todayWords', vscode.StatusBarAlignment.Right, 97);
	private readonly workItem = vscode.window.createStatusBarItem('writingBuddy.work', vscode.StatusBarAlignment.Right, 96);

	private readonly items = [
		this.pendingItem, this.diffItem, this.tasksItem, this.backupRecordItem,
		this.localSaveItem, this.backupItem, this.chapterWordsItem, this.todayWordsItem, this.workItem
	];

	constructor() {
		this.pendingItem.name = vscode.l10n.t('待处理事项');
		this.diffItem.name = vscode.l10n.t('修改对比');
		this.tasksItem.name = vscode.l10n.t('后台任务');
		this.backupRecordItem.name = vscode.l10n.t('备份记录');
		this.localSaveItem.name = vscode.l10n.t('本地保存状态');
		this.backupItem.name = vscode.l10n.t('备份状态');
		this.chapterWordsItem.name = vscode.l10n.t('本章字数');
		this.todayWordsItem.name = vscode.l10n.t('今日字数');
		this.workItem.name = vscode.l10n.t('当前小说和章节');

		this.pendingItem.command = 'writingBuddy.showPending';
		this.diffItem.command = 'writingBuddy.showDiff';
		this.tasksItem.command = 'writingBuddy.showTasks';
		this.backupRecordItem.command = 'writingBuddy.showBackupRecords';

		this.update({
			chapter: undefined,
			statistics: { currentChapterWords: 0, novelWords: 0 },
			isDirty: undefined
		});
	}

	update(state: WriterStatusBarState): void {
		const { chapter, statistics, isDirty } = state;
		const pending = state.pending ?? { severe: 0, warning: 0, suggestion: 0, ignored: 0 };
		const totalPending = pending.severe + pending.warning + pending.suggestion;
		const todayWords = state.todayWords ?? 0;
		const targetWords = state.targetWords ?? 3000;
		const backgroundTasks = state.backgroundTasks ?? 0;
		const backupOk = state.backupOk ?? true;

		// Left: pending summary
		if (totalPending > 0) {
			this.setItem(this.pendingItem,
				vscode.l10n.t('待处理 {0}', totalPending),
				vscode.l10n.t('严重 {0} · 警告 {1} · 建议 {2} · 已忽略 {3}', pending.severe, pending.warning, pending.suggestion, pending.ignored)
			);
		} else {
			this.setItem(this.pendingItem, vscode.l10n.t('待处理 0'), vscode.l10n.t('没有待处理事项'));
		}

		this.setItem(this.diffItem, vscode.l10n.t('修改对比'), vscode.l10n.t('查看修改对比'));
		this.setItem(this.tasksItem,
			backgroundTasks > 0 ? vscode.l10n.t('后台任务 {0}', backgroundTasks) : vscode.l10n.t('后台任务'),
			vscode.l10n.t('查看后台任务')
		);
		this.setItem(this.backupRecordItem, vscode.l10n.t('备份记录'), vscode.l10n.t('查看备份记录'));

		// Right: save and backup state
		const saveIcon = isDirty ? '$(circle-filled)' : '$(check)';
		const saveText = isDirty ? vscode.l10n.t('未保存') : vscode.l10n.t('已保存到本地');
		this.setItem(this.localSaveItem, `${saveIcon} ${saveText}`, saveText);

		const backupIcon = backupOk ? '$(check)' : '$(warning)';
		const backupText = backupOk ? vscode.l10n.t('备份正常') : vscode.l10n.t('备份异常');
		this.setItem(this.backupItem, `${backupIcon} ${backupText}`, backupText);

		// Right: word counts
		this.setItem(this.chapterWordsItem,
			vscode.l10n.t('本章 {0} / {1}字', statistics.currentChapterWords.toLocaleString(), targetWords.toLocaleString()),
			vscode.l10n.t('本章字数 {0}，目标 {1}', statistics.currentChapterWords, targetWords)
		);
		this.setItem(this.todayWordsItem,
			vscode.l10n.t('今日 {0}字', todayWords.toLocaleString()),
			vscode.l10n.t('今日写作字数')
		);

		// Right: current work
		const workText = chapter
			? vscode.l10n.t('我的小说 › {0}', chapter.label)
			: vscode.l10n.t('我的小说');
		this.setItem(this.workItem, workText);
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
