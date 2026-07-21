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

export interface AssistantHtmlInput {
	readonly nonce: string;
	readonly language: string;
	readonly labels: AssistantLabels;
	readonly scene: AssistantScene | undefined;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderContent(labels: AssistantLabels, scene: AssistantScene | undefined): string {
	if (!scene) {
		return `<main class="empty"><p>${escapeHtml(labels.noChapter)}</p></main>`;
	}

	const characters = scene.characters
		.map(character => `<li>${escapeHtml(character)}</li>`)
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
		<ul>${characters}</ul>
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

export function renderAssistantHtml(input: AssistantHtmlInput): string {
	const nonce = escapeHtml(input.nonce);
	return `<!DOCTYPE html>
<html lang="${escapeHtml(input.language)}">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		:root {
			color-scheme: light dark;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 16px;
			background: var(--vscode-sideBar-background);
			color: var(--vscode-foreground);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			line-height: 1.5;
		}

		.assistant {
			display: grid;
			gap: 12px;
			min-width: 0;
		}

		.scene-header,
		.card {
			min-width: 0;
			padding: 16px;
			border: var(--vscode-strokeThickness, 1px) solid var(--vscode-panel-border);
			border-radius: var(--vscode-cornerRadius-medium, 6px);
			background: var(--vscode-sideBar-background);
		}

		h1,
		h2,
		p,
		dl,
		dd,
		ul {
			margin: 0;
		}

		h1,
		h2 {
			font-size: var(--vscode-font-size);
			font-weight: 600;
		}

		h2 {
			margin-bottom: 8px;
		}

		.metadata {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 12px;
			margin-top: 12px;
		}

		dt {
			margin-bottom: 4px;
			color: var(--vscode-descriptionForeground);
		}

		dd,
		p,
		li {
			overflow-wrap: anywhere;
		}

		ul {
			display: grid;
			gap: 4px;
			padding-left: 24px;
		}

		.empty {
			padding: 24px 16px;
			color: var(--vscode-descriptionForeground);
			text-align: center;
		}

		@media (max-width: 260px) {
			body {
				padding: 8px;
			}

			.assistant {
				gap: 8px;
			}

			.scene-header,
			.card {
				padding: 12px;
			}

			.metadata {
				grid-template-columns: 1fr;
				gap: 8px;
			}
		}
	</style>
</head>
<body>
	${renderContent(input.labels, input.scene)}
</body>
</html>`;
}
