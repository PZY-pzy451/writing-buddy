export const writerWorkspaceIds = [
	'writing',
	'planning',
	'reference',
	'review',
	'history'
] as const;

export type WriterWorkspaceId = typeof writerWorkspaceIds[number];

export const writerToolIds = [
	'outline',
	'characters',
	'references',
	'ai',
	'review'
] as const;

export type WriterToolId = typeof writerToolIds[number];

export const manuscriptDensityIds = [
	'compact',
	'comfortable',
	'spacious'
] as const;

export type ManuscriptDensity = typeof manuscriptDensityIds[number];

export interface WriterWorkspaceLayout {
	readonly projectSidebarWidth: number;
	readonly assistantWidth: number;
	readonly assistantVisible: boolean;
	readonly assistantTool?: WriterToolId;
	readonly assistantPinned?: boolean;
	readonly sceneBarExpanded?: boolean;
	readonly manuscriptDensity?: ManuscriptDensity;
	readonly inspectorVisible: boolean;
	readonly sidebarVisible: boolean;
	readonly dockHeight: number;
	readonly dockVisible: boolean;
}

export type WriterWorkspaceLayoutMap = Readonly<
	Record<WriterWorkspaceId, WriterWorkspaceLayout>
>;

const defaults: WriterWorkspaceLayoutMap = {
	writing: {
		projectSidebarWidth: 272,
		assistantWidth: 360,
		assistantVisible: false,
		assistantTool: 'outline',
		assistantPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		inspectorVisible: false,
		sidebarVisible: true,
		dockHeight: 240,
		dockVisible: false
	},
	planning: {
		projectSidebarWidth: 320,
		assistantWidth: 360,
		assistantVisible: false,
		assistantTool: 'outline',
		assistantPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		inspectorVisible: true,
		sidebarVisible: true,
		dockHeight: 240,
		dockVisible: false
	},
	reference: {
		projectSidebarWidth: 300,
		assistantWidth: 360,
		assistantVisible: false,
		assistantTool: 'references',
		assistantPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		inspectorVisible: true,
		sidebarVisible: true,
		dockHeight: 240,
		dockVisible: false
	},
	review: {
		projectSidebarWidth: 300,
		assistantWidth: 360,
		assistantVisible: false,
		assistantTool: 'review',
		assistantPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		inspectorVisible: true,
		sidebarVisible: false,
		dockHeight: 260,
		dockVisible: true
	},
	history: {
		projectSidebarWidth: 272,
		assistantWidth: 360,
		assistantVisible: false,
		assistantTool: 'outline',
		assistantPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		inspectorVisible: false,
		sidebarVisible: false,
		dockHeight: 240,
		dockVisible: false
	}
};

function cloneLayout(layout: WriterWorkspaceLayout): WriterWorkspaceLayout {
	return { ...layout };
}

export function createDefaultWriterWorkspaceLayouts(): WriterWorkspaceLayoutMap {
	return {
		writing: cloneLayout(defaults.writing),
		planning: cloneLayout(defaults.planning),
		reference: cloneLayout(defaults.reference),
		review: cloneLayout(defaults.review),
		history: cloneLayout(defaults.history)
	};
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLayout(
	value: unknown,
	fallback: WriterWorkspaceLayout
): WriterWorkspaceLayout | undefined {
	if (!isRecord(value)) return undefined;
	if (
		typeof value.projectSidebarWidth !== 'number'
		|| !Number.isFinite(value.projectSidebarWidth)
		|| value.projectSidebarWidth < 1
		|| typeof value.assistantWidth !== 'number'
		|| !Number.isFinite(value.assistantWidth)
		|| value.assistantWidth < 1
		|| typeof value.assistantVisible !== 'boolean'
		|| typeof value.inspectorVisible !== 'boolean'
		|| typeof value.sidebarVisible !== 'boolean'
		|| typeof value.dockHeight !== 'number'
		|| !Number.isFinite(value.dockHeight)
		|| value.dockHeight < 1
		|| typeof value.dockVisible !== 'boolean'
	) {
		return undefined;
	}
	return {
		projectSidebarWidth: value.projectSidebarWidth,
		assistantWidth: value.assistantWidth,
		assistantVisible: value.assistantVisible,
		assistantTool: writerToolIds.includes(value.assistantTool as WriterToolId)
			? value.assistantTool as WriterToolId
			: fallback.assistantTool ?? 'outline',
		assistantPinned: typeof value.assistantPinned === 'boolean'
			? value.assistantPinned
			: fallback.assistantPinned ?? false,
		sceneBarExpanded: typeof value.sceneBarExpanded === 'boolean'
			? value.sceneBarExpanded
			: fallback.sceneBarExpanded ?? true,
		manuscriptDensity: manuscriptDensityIds.includes(
			value.manuscriptDensity as ManuscriptDensity
		)
			? value.manuscriptDensity as ManuscriptDensity
			: fallback.manuscriptDensity ?? 'comfortable',
		inspectorVisible: value.inspectorVisible,
		sidebarVisible: value.sidebarVisible,
		dockHeight: value.dockHeight,
		dockVisible: value.dockVisible
	};
}

export function parseWriterWorkspaceLayouts(value: unknown): WriterWorkspaceLayoutMap {
	const fallback = createDefaultWriterWorkspaceLayouts();
	if (!isRecord(value)) return fallback;
	return Object.fromEntries(writerWorkspaceIds.map(workspace => [
		workspace,
		parseLayout(value[workspace], fallback[workspace]) ?? fallback[workspace]
	])) as WriterWorkspaceLayoutMap;
}

export function updateWriterWorkspaceLayout(
	layouts: WriterWorkspaceLayoutMap,
	workspace: WriterWorkspaceId,
	patch: Partial<WriterWorkspaceLayout>
): WriterWorkspaceLayoutMap {
	return {
		...layouts,
		[workspace]: {
			...layouts[workspace],
			...patch
		}
	};
}

export function workspaceForRailMode(mode: string): WriterWorkspaceId {
	if (mode === 'planning') return 'planning';
	if (mode === 'references') return 'reference';
	if (mode === 'review') return 'review';
	if (mode === 'versions') return 'history';
	return 'writing';
}

export function railModeForWorkspace(workspace: WriterWorkspaceId): string {
	if (workspace === 'planning') return 'planning';
	if (workspace === 'reference') return 'references';
	if (workspace === 'review') return 'review';
	if (workspace === 'history') return 'versions';
	return 'works';
}
