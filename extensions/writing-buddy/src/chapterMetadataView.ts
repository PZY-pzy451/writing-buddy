/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ChapterMetadata {
	readonly location: string;
	readonly time: string;
	readonly pov: string;
	readonly characters: readonly string[];
	readonly goal: string;
	readonly notes: string;
}

export interface ChapterMetadataViewInput {
	readonly nonce: string;
	readonly language: string;
	readonly title: string;
	readonly metadata: ChapterMetadata | undefined;
	readonly hasChapter: boolean;
}

const NO_CHAPTER_TITLE = '未选择章节';
const NO_CHAPTER_HINT = '打开章节以查看写作上下文。';
const NO_METADATA_HINT = '本章资料未设置';
const FIELD_LABELS = {
	location: '场景',
	time: '时间',
	pov: '视角人物',
	characters: '出场人物',
	goal: '本章目标',
	notes: '备注'
} as const;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderEmpty(): string {
	return `<main class="empty"><p>${escapeHtml(NO_CHAPTER_HINT)}</p></main>`;
}

function renderNoMetadata(title: string): string {
	return `<main class="metadata">
		<header class="header"><h1>${escapeHtml(title)}</h1></header>
		<p class="hint">${escapeHtml(NO_METADATA_HINT)}</p>
	</main>`;
}

function renderMetadata(title: string, metadata: ChapterMetadata): string {
	const characterChips = metadata.characters
		.map(character => `<span class="chip">${escapeHtml(character)}</span>`)
		.join('');

	return `<main class="metadata">
		<header class="header"><h1>${escapeHtml(title)}</h1></header>
		<dl class="rows">
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.location)}</dt><dd>${escapeHtml(metadata.location)}</dd></div>
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.time)}</dt><dd>${escapeHtml(metadata.time)}</dd></div>
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.pov)}</dt><dd>${escapeHtml(metadata.pov)}</dd></div>
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.characters)}</dt><dd><div class="chips">${characterChips}</div></dd></div>
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.goal)}</dt><dd>${escapeHtml(metadata.goal)}</dd></div>
			<div class="row"><dt>${escapeHtml(FIELD_LABELS.notes)}</dt><dd>${escapeHtml(metadata.notes)}</dd></div>
		</dl>
	</main>`;
}

export function renderChapterMetadataView(input: ChapterMetadataViewInput): string {
	const nonce = escapeHtml(input.nonce);
	const title = input.title || NO_CHAPTER_TITLE;

	const body = !input.hasChapter
		? renderEmpty()
		: input.metadata
			? renderMetadata(title, input.metadata)
			: renderNoMetadata(title);

	return `<!DOCTYPE html>
<html lang="${escapeHtml(input.language)}">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		:root { color-scheme: light dark; }
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding: 16px;
			background: var(--vscode-sideBar-background);
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			line-height: 1.6;
		}
		h1 { font-size: 1.1em; font-weight: 600; margin: 0 0 12px 0; }
		.empty { padding: 32px 16px; text-align: center; color: var(--vscode-descriptionForeground); }
		.hint { color: var(--vscode-descriptionForeground); font-size: 0.95em; }
		.rows { display: grid; gap: 12px; }
		.row { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: start; }
		.row dt { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
		.row dd { margin: 0; overflow-wrap: anywhere; }
		.chips { display: flex; flex-wrap: wrap; gap: 6px; }
		.chip {
			padding: 2px 10px;
			border-radius: 10px;
			background: rgba(139, 92, 246, 0.15);
			border: 1px solid #8b5cf6;
			font-size: 0.9em;
		}
		@media (max-width: 260px) {
			.row { grid-template-columns: 1fr; gap: 4px; }
		}
	</style>
</head>
<body>
	${body}
</body>
</html>`;
}
