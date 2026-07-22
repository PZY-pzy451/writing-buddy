/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Phase 0.3 feature gate. Every optional capability consults this single source so that
 * scope-creep features can be disabled without deleting code or scattering `if (x)` checks.
 *
 * Not exposed to users; treated as a compile-time constant of the current phase.
 */
export const phase03Features = {
	/** AI-driven polish suggestions. */
	aiSuggestions: false,
	/** Inline annotations for character / location / foreshadow. */
	aiDecorations: false,
	/** Quick actions like 润色 / 精简 / 语病. */
	aiQuickActions: false,
	/** Microsoft / GitHub account entry. */
	accountUi: false,
	/** Daily word count and target word count tracking. */
	dailyWriting: false,
	/** Backup status indicators and backup records. */
	backupStatus: false,
	/** Floating product header webview (chapter tabs, action buttons). */
	productHeader: false,
	/** Second and third volume placeholders. */
	extraVolumes: false,
	/** Placeholder deep links for 人物 / 世界观 / 时间线 / 笔记. */
	placeholderLinks: false,
	/** Stub commands for pending / diff / tasks / backup-records. */
	stubCommands: false
} as const;

export type Phase03Feature = keyof typeof phase03Features;

export function isFeatureEnabled(name: Phase03Feature): boolean {
	return phase03Features[name];
}
