/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Application/window-scoped settings that the Writing Buddy product shell requires.
 * Extension `configurationDefaults` cannot cover application-scoped keys,
 * so they are written to the global (user) configuration on activation.
 * A fresh install also receives these via the deployed default settings.json.
 */
const SHELL_SETTINGS: Readonly<Record<string, unknown>> = {
	'window.menuBarVisibility': 'hidden',
	'workbench.activityBar.location': 'hidden',
	'breadcrumbs.enabled': false,
	'window.commandCenter': false,
	'workbench.layoutControl.enabled': false,
	'workbench.navigationControl.enabled': false,
	'workbench.tips.enabled': false,
	'window.title': '${appName}',
	'security.workspace.trust.enabled': false,
	'security.workspace.trust.startupPrompt': 'never',
	'security.workspace.trust.banner': 'never',
	'security.workspace.trust.untrustedFiles': 'open',
	'workbench.editor.centeredLayoutAutoResize': true,
	'workbench.editor.centeredLayoutFixedWidth': true,
	'chat.titleBarSignInEnabled': false,
	'update.mode': 'none',
	'update.showReleaseNotes': false
};

const APPLIED_KEY = 'writingBuddy.shellSettingsApplied';

/**
 * Applies the Writing Buddy product shell. Idempotent: writes global settings
 * once per installation, relying on deployed defaults afterwards.
 */
export async function applyWriterShell(context: vscode.ExtensionContext): Promise<void> {
	const alreadyApplied = context.globalState.get<boolean>(APPLIED_KEY, false);
	if (!alreadyApplied) {
		const config = vscode.workspace.getConfiguration();
		for (const [key, value] of Object.entries(SHELL_SETTINGS)) {
			try {
				await config.update(key, value, vscode.ConfigurationTarget.Global);
			} catch (error) {
				console.error(`[Writing Buddy] Failed to apply shell setting ${key}:`, error);
			}
		}
		await context.globalState.update(APPLIED_KEY, true);
	}

	// Enable centered layout for the paper-like writing canvas.
	try {
		await vscode.commands.executeCommand('workbench.action.toggleCenteredLayout');
	} catch (error) {
		console.error('[Writing Buddy] Failed to enable centered layout:', error);
	}

	console.log('[Writing Buddy] Product shell applied');
}
