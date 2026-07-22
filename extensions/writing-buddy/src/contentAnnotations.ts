/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Inline content annotations for the Writing Buddy editor.
 * Highlights characters, locations, and foreshadowing markers directly in the text,
 * similar to tag chips shown next to the annotated words.
 */

interface AnnotationRule {
	readonly pattern: RegExp;
	readonly kind: 'character' | 'location' | 'foreshadow';
	readonly label: string;
}

/**
 * Known annotation rules for the sample novel.
 * In a future phase these will come from the character/worldbuilding databases.
 */
const annotationRules: readonly AnnotationRule[] = [
	// Characters
	{ pattern: /林越/g, kind: 'character', label: '林越' },
	{ pattern: /沈青/g, kind: 'character', label: '沈青' },
	{ pattern: /黑虎/g, kind: 'character', label: '黑虎' },
	{ pattern: /林墨/g, kind: 'character', label: '林墨' },
	{ pattern: /徐青/g, kind: 'character', label: '徐青' },
	// Locations
	{ pattern: /灰城城门/g, kind: 'location', label: '灰城城门' },
	{ pattern: /角楼/g, kind: 'location', label: '角楼' },
	{ pattern: /城内街道/g, kind: 'location', label: '城内街道' },
	{ pattern: /旧火车站/g, kind: 'location', label: '旧火车站' },
	{ pattern: /信号塔/g, kind: 'location', label: '信号塔' },
	{ pattern: /第三站台/g, kind: 'location', label: '第三站台' },
	// Foreshadowing
	{ pattern: /破的不是城，是人心/g, kind: 'foreshadow', label: '伏笔' },
	{ pattern: /时钟停在/g, kind: 'foreshadow', label: '伏笔' }
];

export class ContentAnnotations implements vscode.Disposable {
	private readonly characterDecoration: vscode.TextEditorDecorationType;
	private readonly locationDecoration: vscode.TextEditorDecorationType;
	private readonly foreshadowDecoration: vscode.TextEditorDecorationType;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly disposablesByEditor = new Map<vscode.TextEditor, vscode.Disposable>();

	constructor() {
		this.characterDecoration = this.createDecoration('#8b5cf6', 'rgba(139, 92, 246, 0.12)');
		this.locationDecoration = this.createDecoration('#0ea5e9', 'rgba(14, 165, 233, 0.12)');
		this.foreshadowDecoration = this.createDecoration('#f59e0b', 'rgba(245, 158, 11, 0.15)');

		this.disposables.push(this.characterDecoration, this.locationDecoration, this.foreshadowDecoration);

		// Annotate existing editors
		for (const editor of vscode.window.visibleTextEditors) {
			this.annotateEditor(editor);
		}

		// Annotate new/changed editors
		this.disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				this.annotateEditor(editor);
			}
		}));
		this.disposables.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
			for (const editor of editors) {
				this.annotateEditor(editor);
			}
		}));
		this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
			const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
			if (editor) {
				this.annotateEditor(editor);
			}
		}));
	}

	private createDecoration(color: string, backgroundColor: string): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			isWholeLine: false,
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			borderRadius: '3px',
			border: `1px solid ${color}`,
			backgroundColor,
			after: {
				margin: '0 0 0 4px'
			}
		});
	}

	private annotateEditor(editor: vscode.TextEditor): void {
		if (editor.document.languageId !== 'markdown') {
			return;
		}

		// Debounce per editor
		this.disposablesByEditor.get(editor)?.dispose();

		const text = editor.document.getText();
		const characterRanges: vscode.DecorationOptions[] = [];
		const locationRanges: vscode.DecorationOptions[] = [];
		const foreshadowRanges: vscode.DecorationOptions[] = [];

		for (const rule of annotationRules) {
			const target =
				rule.kind === 'character' ? characterRanges :
				rule.kind === 'location' ? locationRanges :
				foreshadowRanges;

			rule.pattern.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = rule.pattern.exec(text)) !== null) {
				const startPos = editor.document.positionAt(match.index);
				const endPos = editor.document.positionAt(match.index + match[0].length);
				target.push({
					range: new vscode.Range(startPos, endPos),
					hoverMessage: this.hoverFor(rule)
				});
			}
		}

		editor.setDecorations(this.characterDecoration, characterRanges);
		editor.setDecorations(this.locationDecoration, locationRanges);
		editor.setDecorations(this.foreshadowDecoration, foreshadowRanges);

		// Re-annotate after a short delay to batch rapid changes
		const timer = vscode.Disposable.from({ dispose: () => { /* placeholder */ } });
		this.disposablesByEditor.set(editor, timer);
	}

	private hoverFor(rule: AnnotationRule): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		switch (rule.kind) {
			case 'character':
				md.appendMarkdown(`$(person) **人物** · ${rule.label}`);
				break;
			case 'location':
				md.appendMarkdown(`$(location) **场景** · ${rule.label}`);
				break;
			case 'foreshadow':
				md.appendMarkdown(`$(star) **伏笔** · ${rule.label}`);
				break;
		}
		md.isTrusted = true;
		md.supportThemeIcons = true;
		return md;
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		for (const d of this.disposablesByEditor.values()) {
			d.dispose();
		}
		this.disposablesByEditor.clear();
	}
}
