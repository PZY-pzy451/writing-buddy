/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { PolishSuggestion, renderAssistantHtml } from './assistantHtml';
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
			scene: this.activeChapter?.scene,
			suggestions: this.getSuggestions()
		});
	}

	private getSuggestions(): readonly PolishSuggestion[] {
		if (!this.activeChapter) {
			return [];
		}

		// Prototype suggestions; real AI-driven suggestions arrive in a later phase.
		return [
			{
				index: 1,
				total: 5,
				original: '他回头看了一眼身后的队伍，眼神平静，却没人能看懂他在想什么。',
				suggested: '他回头扫了一眼身后的队伍，眼神平静，没人能看出他心里在盘算什么。',
				reason: '优化口语节奏，避免重复用词"看"和"想"。',
				scope: '无'
			},
			{
				index: 2,
				total: 5,
				original: '城门在雨中发出不堪重负的呻吟。',
				suggested: '城门在雨中发出不堪重负的吱呀声。',
				reason: '"呻吟"与城门意象略有不搭，改用拟声词更贴切。',
				scope: '无'
			}
		];
	}
}
