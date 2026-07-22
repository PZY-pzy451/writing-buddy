/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface AssistantLabels {
	readonly currentScene: string;
	readonly location: string;
	readonly time: string;
	readonly pointOfView: string;
	readonly characters: string;
	readonly sceneGoal: string;
	readonly notes: string;
	readonly noChapter: string;
}

export interface AssistantScene {
	readonly location: string;
	readonly time: string;
	readonly pov: string;
	readonly characters: readonly string[];
	readonly goal: string;
	readonly note: string;
}

export interface PolishSuggestion {
	readonly index: number;
	readonly total: number;
	readonly original: string;
	readonly suggested: string;
	readonly reason: string;
	readonly scope: string;
}

export interface AssistantHtmlInput {
	readonly nonce: string;
	readonly language: string;
	readonly labels: AssistantLabels;
	readonly scene: AssistantScene | undefined;
	readonly suggestions?: readonly PolishSuggestion[];
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderContextTab(labels: AssistantLabels, scene: AssistantScene | undefined): string {
	if (!scene) {
		return `<main class="empty"><p>${escapeHtml(labels.noChapter)}</p></main>`;
	}

	const characters = scene.characters
		.map(character => `<span class="chip">${escapeHtml(character)}</span>`)
		.join('');

	return `<main class="assistant">
	<header class="scene-header">
		<h1>${escapeHtml(labels.currentScene)}</h1>
		<dl class="metadata">
			<div><dt>${escapeHtml(labels.location)}</dt><dd>${escapeHtml(scene.location)}</dd></div>
			<div><dt>${escapeHtml(labels.time)}</dt><dd>${escapeHtml(scene.time)}</dd></div>
			<div><dt>${escapeHtml(labels.pointOfView)}</dt><dd>${escapeHtml(scene.pov)}</dd></div>
		</dl>
	</header>
	<section class="card">
		<h2>${escapeHtml(labels.characters)}</h2>
		<div class="chips">${characters}</div>
	</section>
	<section class="card">
		<h2>${escapeHtml(labels.sceneGoal)}</h2>
		<p>${escapeHtml(scene.goal)}</p>
	</section>
	<section class="card">
		<h2>${escapeHtml(labels.notes)}</h2>
		<p>${escapeHtml(scene.note)}</p>
	</section>
</main>`;
}

function renderSuggestionsTab(suggestions: readonly PolishSuggestion[]): string {
	if (suggestions.length === 0) {
		return `<main class="empty"><p>暂无润色建议。</p></main>`;
	}

	const items = suggestions.map(s => `
	<section class="suggestion">
		<header class="suggestion-header">
			<h2>润色建议 ${s.index} / ${s.total}</h2>
		</header>
		<div class="suggestion-body">
			<div class="block">
				<strong class="block-label">原文</strong>
				<p class="original">${escapeHtml(s.original)}</p>
			</div>
			<div class="block">
				<strong class="block-label">建议</strong>
				<p class="suggested">${escapeHtml(s.suggested)}</p>
			</div>
			<div class="block meta">
				<div><span class="meta-label">修改原因</span><p>${escapeHtml(s.reason)}</p></div>
				<div><span class="meta-label">影响范围</span><p>${escapeHtml(s.scope)}</p></div>
			</div>
			<div class="actions">
				<span class="btn secondary">查看对比</span>
				<span class="btn primary">接受</span>
				<span class="btn secondary">忽略</span>
			</div>
		</div>
	</section>`).join('');

	return `<main class="suggestions">${items}</main>`;
}

function renderReviewTab(): string {
	return `<main class="empty"><p>审查结果将在后续版本提供。</p></main>`;
}

function renderQuickActions(): string {
	const actions = ['润色', '精简', '语病', '对话', '节奏', '更多'];
	const buttons = actions.map(a => `<span class="btn quick">${a}</span>`).join('');
	return `<footer class="quick-actions"><h2>快速操作</h2><div class="quick-grid">${buttons}</div></footer>`;
}

export function renderAssistantHtml(input: AssistantHtmlInput): string {
	const nonce = escapeHtml(input.nonce);
	const suggestions = input.suggestions ?? [];

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
			padding: 0;
			background: var(--vscode-sideBar-background);
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			line-height: 1.6;
			display: flex;
			flex-direction: column;
			height: 100vh;
		}

		/* Pure-CSS tab switching via radio buttons (no scripts) */
		.tab-state { position: absolute; opacity: 0; pointer-events: none; }
		.tabs {
			display: flex;
			border-bottom: 1px solid var(--vscode-panel-border);
			flex-shrink: 0;
		}
		.tabs label {
			flex: 1;
			padding: 10px 8px;
			text-align: center;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			border-bottom: 2px solid transparent;
		}
		.tabs label:hover { color: var(--vscode-foreground); }
		#tab-suggestions:checked ~ .tabs label[for="tab-suggestions"],
		#tab-review:checked ~ .tabs label[for="tab-review"],
		#tab-context:checked ~ .tabs label[for="tab-context"] {
			color: var(--vscode-foreground);
			border-bottom-color: var(--vscode-button-background);
			font-weight: 600;
		}

		.tab-panel { display: none; overflow-y: auto; flex: 1; padding: 12px; }
		#tab-suggestions:checked ~ #panel-suggestions,
		#tab-review:checked ~ #panel-review,
		#tab-context:checked ~ #panel-context { display: block; }

		.assistant { display: grid; gap: 10px; min-width: 0; }
		.scene-header, .card, .suggestion {
			min-width: 0;
			padding: 12px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			background: var(--vscode-sideBar-background);
		}
		h1, h2, p, dl, dd, ul { margin: 0; }
		h1, h2 { font-size: var(--vscode-font-size); font-weight: 600; }
		h2 { margin-bottom: 8px; }
		.block-label { display: block; font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
		.metadata { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
		dt { margin-bottom: 2px; color: var(--vscode-descriptionForeground); font-size: 0.85em; }
		dd { overflow-wrap: anywhere; }
		.chips { display: flex; flex-wrap: wrap; gap: 6px; }
		.chip {
			padding: 2px 10px;
			border-radius: 10px;
			background: rgba(139, 92, 246, 0.15);
			border: 1px solid #8b5cf6;
			font-size: 0.9em;
		}
		.empty { padding: 24px 12px; color: var(--vscode-descriptionForeground); text-align: center; }

		.suggestions { display: grid; gap: 10px; }
		.suggestion-header h2 { margin-bottom: 0; }
		.suggestion-body { display: grid; gap: 10px; margin-top: 8px; }
		.block p { overflow-wrap: anywhere; }
		.original { color: var(--vscode-descriptionForeground); }
		.meta { display: grid; gap: 6px; }
		.meta-label { display: block; font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 2px; }
		.actions { display: flex; gap: 8px; }
		.btn {
			padding: 5px 14px;
			border-radius: 4px;
			font-size: 0.9em;
			cursor: default;
			user-select: none;
		}
		.btn.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }

		.quick-actions {
			flex-shrink: 0;
			border-top: 1px solid var(--vscode-panel-border);
			padding: 12px;
		}
		.quick-actions h2 { margin-bottom: 8px; }
		.quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
		.btn.quick {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			padding: 8px;
			text-align: center;
		}

		@media (max-width: 260px) {
			.metadata { grid-template-columns: 1fr; }
			.actions { flex-wrap: wrap; }
		}
	</style>
</head>
<body>
	<input class="tab-state" type="radio" name="assistant-tab" id="tab-suggestions" checked>
	<input class="tab-state" type="radio" name="assistant-tab" id="tab-review">
	<input class="tab-state" type="radio" name="assistant-tab" id="tab-context">

	<nav class="tabs">
		<label for="tab-suggestions">建议</label>
		<label for="tab-review">审查</label>
		<label for="tab-context">上下文</label>
	</nav>

	<div class="tab-panel" id="panel-suggestions">
		${renderSuggestionsTab(suggestions)}
	</div>
	<div class="tab-panel" id="panel-review">
		${renderReviewTab()}
	</div>
	<div class="tab-panel" id="panel-context">
		${renderContextTab(input.labels, input.scene)}
	</div>

	${renderQuickActions()}
</body>
</html>`;
}
