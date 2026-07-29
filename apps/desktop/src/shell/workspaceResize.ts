export const workspaceResizeBounds = {
	sidebar: { min: 220, defaultValue: 320, max: 440 },
	assistant: { min: 280, defaultValue: 360, max: 480 },
	dock: { min: 144, defaultValue: 240, max: 420 }
} as const;

export type WorkspaceResizePane = keyof typeof workspaceResizeBounds;

export function clampWorkspaceSize(pane: WorkspaceResizePane, value: number): number {
	const bounds = workspaceResizeBounds[pane];
	return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}
