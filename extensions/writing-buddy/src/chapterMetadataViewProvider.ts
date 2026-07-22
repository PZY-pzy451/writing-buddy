/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { ChapterDefinition } from './chapterCatalog';
import { ChapterMetadata, renderChapterMetadataView } from './chapterMetadataView';
import { OwnedValue } from './ownedValue';

function createNonce(): string {
	return randomBytes(16).toString('hex');
}

/**
 * Renders a static "章节资料" webview that shows the metadata of the active chapter
 * and a fallback ("本章资料未设置") when the chapter has no metadata entry.
 */
export class ChapterMetadataViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
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

		view.webview.html = renderChapterMetadataView({
			nonce: createNonce(),
			language: vscode.env.language,
			title: this.activeChapter?.label ?? '',
			metadata: this.activeChapter?.scene as ChapterMetadata | undefined,
			hasChapter: this.activeChapter !== undefined
		});
	}
}
