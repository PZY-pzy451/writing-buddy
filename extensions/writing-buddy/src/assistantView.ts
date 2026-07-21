/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { renderAssistantHtml } from './assistantHtml';
import { ChapterDefinition } from './chapterCatalog';
import { OwnedValue } from './ownedValue';

function createNonce(): string {
	return randomBytes(16).toString('hex');
}

export class AssistantViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
	private readonly view = new OwnedValue<vscode.WebviewView>();
	private viewDisposal: vscode.Disposable | undefined;
	private activeChapter: ChapterDefinition | undefined;

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.viewDisposal?.dispose();
		this.viewDisposal = undefined;
		this.view.set(webviewView);
		webviewView.webview.options = { enableScripts: false };
		this.viewDisposal = webviewView.onDidDispose(() => this.clearView(webviewView));
		this.render();
	}

	setActiveChapter(chapter: ChapterDefinition | undefined): void {
		this.activeChapter = chapter;
		this.render();
	}

	dispose(): void {
		this.viewDisposal?.dispose();
		this.viewDisposal = undefined;
		const view = this.view.value;
		if (view) {
			this.view.clear(view);
		}
	}

	private clearView(webviewView: vscode.WebviewView): void {
		if (this.view.value !== webviewView) {
			return;
		}

		this.view.clear(webviewView);
		this.viewDisposal = undefined;
	}

	private render(): void {
		const view = this.view.value;
		if (!view) {
			return;
		}

		view.webview.html = renderAssistantHtml({
			nonce: createNonce(),
			language: vscode.env.language,
			labels: {
				currentScene: vscode.l10n.t('当前场景'),
				location: vscode.l10n.t('地点'),
				time: vscode.l10n.t('时间'),
				pointOfView: vscode.l10n.t('视角'),
				characters: vscode.l10n.t('出场人物'),
				sceneGoal: vscode.l10n.t('场景目标'),
				notes: vscode.l10n.t('备注'),
				noChapter: vscode.l10n.t('打开章节以查看写作上下文。')
			},
			scene: this.activeChapter?.scene
		});
	}
}
