/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Status bar items that should be hidden to remove development-oriented UI.
 * These are technical indicators that don't belong in a writing product.
 */
const DEVELOPMENT_STATUS_BAR_ITEMS = [
	'status.editor.encoding',      // UTF-8
	'status.editor.eol',           // LF/CRLF
	'status.editor.indentation',   // Spaces: 4
	'status.editor.selection',     // Ln 9, Col 33
	'status.editor.mode',          // Markdown
	'status.editor.info',          // File info
	'status.editor.tabFocusMode',  // Tab focus
	'status.editor.inputMode',     // Input mode
	'status.editor.columnSelectionMode', // Column selection
];

/**
 * Applies Writing Buddy product shell configuration.
 * Most UI hiding is done via package.json configurationDefaults,
 * this handles additional runtime configuration for status bar items.
 */
export async function applyWriterShell(context: vscode.ExtensionContext): Promise<void> {
	// Store hidden status bar items for potential future use
	await context.globalState.update('writingBuddy.hiddenStatusBarItems', DEVELOPMENT_STATUS_BAR_ITEMS);

	// Note: Most UI hiding (menu bar, activity bar, status bar, breadcrumbs, etc.)
	// is configured via package.json configurationDefaults which are applied
	// automatically when the extension is installed/enabled.
	//
	// The configurationDefaults in package.json include:
	// - window.menuBarVisibility: hidden
	// - workbench.activityBar.location: hidden
	// - workbench.statusBar.visible: false
	// - breadcrumbs.enabled: false
	// - window.title: ${appName}
	// - And more...

	// Enable centered layout for paper-like writing experience
	try {
		await vscode.commands.executeCommand('workbench.action.toggleCenteredLayout');
	} catch (error) {
		console.error('Failed to enable centered layout:', error);
	}

	console.log('[Writing Buddy] Product shell applied');
}

/**
 * Restores VS Code default configuration (for debugging/development)
 */
export async function restoreDefaultShell(): Promise<void> {
	const config = vscode.workspace.getConfiguration();

	const defaultConfig: Record<string, unknown> = {
		'window.menuBarVisibility': 'classic',
		'workbench.activityBar.location': 'default',
		'workbench.statusBar.visible': true,
		'breadcrumbs.enabled': true,
		'workbench.editor.showTabs': 'multiple',
		'workbench.editor.editorActionsLocation': 'default',
		'window.commandCenter': true,
		'workbench.layoutControl.enabled': true,
		'workbench.navigationControl.enabled': true,
		'workbench.tips.enabled': true,
		'editor.lineNumbers': 'on',
		'editor.minimap.enabled': true,
		'window.title': undefined, // Reset to default
		'workbench.editor.showTitle': true,
	};

	for (const [key, value] of Object.entries(defaultConfig)) {
		try {
			await config.update(key, value, vscode.ConfigurationTarget.Global);
		} catch (error) {
			console.error(`Failed to restore ${key}:`, error);
		}
	}
}
