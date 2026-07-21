/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ChapterDefinition } from './chapterCatalog';
import { WritingStatistics } from './writingState';

export interface ProductHeaderState {
	readonly chapter: ChapterDefinition | undefined;
	readonly statistics: WritingStatistics;
	readonly isDirty: boolean | undefined;
	readonly openChapters?: ChapterDefinition[];
	readonly activeChapterId?: string;
}

/**
 * Creates a Writing Buddy product header panel with chapter tabs.
 * This provides a tabbed interface for switching between open chapters.
 */
export class ProductHeader implements vscode.Disposable {
	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];
	private state: ProductHeaderState = {
		chapter: undefined,
		statistics: { currentChapterWords: 0, novelWords: 0 },
		isDirty: undefined,
		openChapters: [],
		activeChapterId: undefined
	};

	constructor(private readonly context: vscode.ExtensionContext) {
		this.panel = vscode.window.createWebviewPanel(
			'writingBuddy.productHeader',
			vscode.l10n.t('Writing Buddy'),
			{ viewColumn: vscode.ViewColumn.One, preserveFocus: true },
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: []
			}
		);

		this.disposables.push(
			this.panel.webview.onDidReceiveMessage(message => {
				this.handleMessage(message);
			})
		);

		this.disposables.push(this.panel);
		this.render();
	}

	update(state: ProductHeaderState): void {
		this.state = state;
		this.render();
	}

	reveal(): void {
		this.panel.reveal(vscode.ViewColumn.One, true);
	}

	private handleMessage(message: { command: string; chapterId?: string }): void {
		switch (message.command) {
			case 'openChapter':
				if (message.chapterId) {
					void vscode.commands.executeCommand('writingBuddy.openChapter', message.chapterId);
				}
				break;
			case 'closeChapter':
				if (message.chapterId) {
					// TODO: Implement close chapter
				}
				break;
			case 'prevChapter':
				void vscode.commands.executeCommand('writingBuddy.prevChapter');
				break;
			case 'nextChapter':
				void vscode.commands.executeCommand('writingBuddy.nextChapter');
				break;
			case 'focusMode':
				void vscode.commands.executeCommand('writingBuddy.focusMode');
				break;
			case 'outline':
				// TODO: Show outline
				break;
			case 'polish':
				// TODO: Polish mode
				break;
			case 'review':
				// TODO: Review mode
				break;
			case 'version':
				// TODO: Version history
				break;
			case 'markComplete':
				// TODO: Mark chapter complete
				break;
		}
	}

	private render(): void {
		const nonce = this.getNonce();
		this.panel.webview.html = this.getHtml(nonce);
	}

	private getHtml(nonce: string): string {
		const { chapter, statistics, isDirty, openChapters, activeChapterId } = this.state;
		const chapterTitle = chapter?.label ?? vscode.l10n.t('未选择章节');
		const volume = chapter?.volume ?? vscode.l10n.t('第一卷 灰城之下');
		const saveStatus = isDirty === true ? vscode.l10n.t('未保存') : isDirty === false ? vscode.l10n.t('已保存') : '';
		const saveClass = isDirty === true ? 'unsaved' : 'saved';
		const wordCount = chapter?.wordCount ?? statistics.currentChapterWords;
		const targetWordCount = 3000; // 目标字数

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
		}

		.header {
			border-bottom: 1px solid var(--vscode-panel-border);
			background: var(--vscode-editor-background);
		}

		.tabs {
			display: flex;
			align-items: center;
			padding: 0 12px;
			gap: 4px;
			overflow-x: auto;
		}

		.tab {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 8px 16px;
			background: transparent;
			border: none;
			border-bottom: 2px solid transparent;
			cursor: pointer;
			font-size: 0.95em;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
		}

		.tab:hover {
			background: var(--vscode-toolbar-hoverBackground);
			color: var(--vscode-foreground);
		}

		.tab.active {
			color: var(--vscode-foreground);
			border-bottom-color: var(--vscode-button-background);
			font-weight: 500;
		}

		.tab .close {
			opacity: 0;
			margin-left: 4px;
			padding: 2px;
			border-radius: 2px;
		}

		.tab:hover .close {
			opacity: 1;
		}

		.tab .close:hover {
			background: var(--vscode-toolbar-hoverBackground);
		}

		.content {
			padding: 12px 24px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
		}

		.breadcrumb {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 1.1em;
		}

		.breadcrumb .separator {
			color: var(--vscode-descriptionForeground);
		}

		.breadcrumb .current {
			font-weight: 600;
		}

		.stats {
			display: flex;
			align-items: center;
			gap: 16px;
			color: var(--vscode-descriptionForeground);
		}

		.stats .word-progress {
			font-size: 0.9em;
		}

		.stats .save-status {
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 0.9em;
		}

		.stats .save-status.saved {
			background: var(--vscode-gitDecoration-addedResourceForeground);
			color: var(--vscode-editor-background);
		}

		.stats .save-status.unsaved {
			background: var(--vscode-gitDecoration-modifiedResourceForeground);
			color: var(--vscode-editor-background);
		}

		.controls {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.controls button {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.controls button:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		.controls button.primary {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.controls button.primary:hover {
			background: var(--vscode-button-hoverBackground);
		}

		.controls .nav-btn {
			padding: 4px 8px;
		}

		@media (max-width: 768px) {
			.content {
				flex-direction: column;
				align-items: flex-start;
			}

			.stats {
				margin-top: 8px;
			}
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="tabs">
			${openChapters?.map(ch => `
				<button class="tab ${ch.id === activeChapterId ? 'active' : ''}" onclick="switchChapter('${ch.id}')">
					<span>${this.escapeHtml(ch.label)}</span>
					<span class="close" onclick="event.stopPropagation(); closeChapter('${ch.id}')">×</span>
				</button>
			`).join('') || `
				<button class="tab active">
					<span>${this.escapeHtml(chapterTitle)}</span>
				</button>
			`}
		</div>

		<div class="content">
			<div class="breadcrumb">
				<span class="novel">${this.escapeHtml(vscode.l10n.t('我的小说'))}</span>
				<span class="separator">/</span>
				<span class="volume">${this.escapeHtml(volume)}</span>
				<span class="separator">/</span>
				<span class="current">${this.escapeHtml(chapterTitle)}</span>
			</div>

			<div class="stats">
				<span class="word-progress">${this.escapeHtml(vscode.l10n.t('{0} / {1} 字', wordCount, targetWordCount))}</span>
				<span class="separator">·</span>
				<span class="save-status ${saveClass}">${this.escapeHtml(saveStatus || vscode.l10n.t('最后保存 10:42'))}</span>
			</div>

			<div class="controls">
				<button onclick="sendCommand('outline')" title="${this.escapeHtml(vscode.l10n.t('章纲'))}">
					${this.escapeHtml(vscode.l10n.t('章纲'))}
				</button>
				<button onclick="sendCommand('polish')" title="${this.escapeHtml(vscode.l10n.t('润色'))}">
					${this.escapeHtml(vscode.l10n.t('润色'))}
				</button>
				<button onclick="sendCommand('review')" title="${this.escapeHtml(vscode.l10n.t('审查'))}">
					${this.escapeHtml(vscode.l10n.t('审查'))}
				</button>
				<button onclick="sendCommand('version')" title="${this.escapeHtml(vscode.l10n.t('版本'))}">
					${this.escapeHtml(vscode.l10n.t('版本'))}
				</button>
				<button class="primary" onclick="sendCommand('markComplete')" title="${this.escapeHtml(vscode.l10n.t('标记完成'))}">
					${this.escapeHtml(vscode.l10n.t('标记完成'))}
				</button>
			</div>
		</div>
	</div>

	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();

		function sendCommand(command, chapterId) {
			vscode.postMessage({ command, chapterId });
		}

		function switchChapter(chapterId) {
			vscode.postMessage({ command: 'openChapter', chapterId });
		}

		function closeChapter(chapterId) {
			vscode.postMessage({ command: 'closeChapter', chapterId });
		}
	</script>
</body>
</html>`;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
