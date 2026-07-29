export const writerWorkspaceIds = [
	'writing',
	'planning',
	'reference',
	'review',
	'history'
] as const;

export type WriterWorkspaceId = typeof writerWorkspaceIds[number];

export interface WriterSessionTab {
	readonly resourceId: string;
}

export interface WriterSessionPanelState {
	readonly projectSidebarWidth: number;
	readonly assistantWidth: number;
	readonly assistantVisible: boolean;
	readonly inspectorVisible: boolean;
	readonly sidebarVisible: boolean;
	readonly dockHeight: number;
	readonly dockVisible: boolean;
}

export interface WriterSessionState {
	readonly schemaVersion: 1;
	readonly projectId: string;
	readonly activeWorkspace: WriterWorkspaceId;
	readonly activeChapterId?: string;
	readonly activeSceneId?: string;
	readonly activeResourceId?: string;
	readonly openTabs: readonly WriterSessionTab[];
	readonly cursor?: {
		readonly chapterId: string;
		readonly anchorId?: string;
		readonly line: number;
		readonly column: number;
	};
	readonly scroll?: {
		readonly chapterId: string;
		readonly scrollTop: number;
	};
	readonly expandedTreeNodes: readonly string[];
	readonly panelState: WriterSessionPanelState;
	readonly focusMode: boolean;
	readonly updatedAt: string;
}

export type WriterSessionMap = Readonly<Record<string, WriterSessionState>>;

interface ReconcileWriterSessionInput {
	readonly projectId: string;
	readonly chapterIds: readonly string[];
	readonly resourceIds: readonly string[];
	readonly sceneIdsByChapter: Readonly<Record<string, readonly string[]>>;
	readonly anchorIdsByChapter?: Readonly<Record<string, readonly string[]>>;
	readonly expandedTreeNodeIds: readonly string[];
	readonly defaultPanelState: WriterSessionPanelState;
	readonly now: string;
}

export interface ReconciledWriterSession {
	readonly session: WriterSessionState;
	readonly notice?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFinitePositive(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 1;
}

function isIsoTimestamp(value: unknown): value is string {
	return typeof value === 'string'
		&& Number.isFinite(Date.parse(value));
}

function parsePanelState(value: unknown): WriterSessionPanelState | undefined {
	if (!isRecord(value)) return undefined;
	if (
		!isFinitePositive(value.projectSidebarWidth)
		|| !isFinitePositive(value.assistantWidth)
		|| typeof value.assistantVisible !== 'boolean'
		|| typeof value.inspectorVisible !== 'boolean'
		|| typeof value.sidebarVisible !== 'boolean'
		|| !isFinitePositive(value.dockHeight)
		|| typeof value.dockVisible !== 'boolean'
	) {
		return undefined;
	}
	return {
		projectSidebarWidth: value.projectSidebarWidth,
		assistantWidth: value.assistantWidth,
		assistantVisible: value.assistantVisible,
		inspectorVisible: value.inspectorVisible,
		sidebarVisible: value.sidebarVisible,
		dockHeight: value.dockHeight,
		dockVisible: value.dockVisible
	};
}

function parseCursor(value: unknown): WriterSessionState['cursor'] {
	if (value === undefined) return undefined;
	if (
		!isRecord(value)
		|| typeof value.chapterId !== 'string'
		|| !isFinitePositive(value.line)
		|| !isFinitePositive(value.column)
		|| (value.anchorId !== undefined && typeof value.anchorId !== 'string')
	) {
		return undefined;
	}
	return {
		chapterId: value.chapterId,
		...(typeof value.anchorId === 'string' ? { anchorId: value.anchorId } : {}),
		line: Math.floor(value.line),
		column: Math.floor(value.column)
	};
}

function parseScroll(value: unknown): WriterSessionState['scroll'] {
	if (value === undefined) return undefined;
	if (
		!isRecord(value)
		|| typeof value.chapterId !== 'string'
		|| !isFiniteNonNegative(value.scrollTop)
	) {
		return undefined;
	}
	return {
		chapterId: value.chapterId,
		scrollTop: value.scrollTop
	};
}

export function parseWriterSession(value: unknown): WriterSessionState | undefined {
	if (!isRecord(value)) return undefined;
	const panelState = parsePanelState(value.panelState);
	const cursor = parseCursor(value.cursor);
	const scroll = parseScroll(value.scroll);
	if (
		value.schemaVersion !== 1
		|| typeof value.projectId !== 'string'
		|| !writerWorkspaceIds.includes(value.activeWorkspace as WriterWorkspaceId)
		|| (value.activeChapterId !== undefined && typeof value.activeChapterId !== 'string')
		|| (value.activeSceneId !== undefined && typeof value.activeSceneId !== 'string')
		|| (value.activeResourceId !== undefined && typeof value.activeResourceId !== 'string')
		|| !Array.isArray(value.openTabs)
		|| !value.openTabs.every(tab => isRecord(tab) && typeof tab.resourceId === 'string')
		|| !Array.isArray(value.expandedTreeNodes)
		|| !value.expandedTreeNodes.every(nodeId => typeof nodeId === 'string')
		|| !panelState
		|| typeof value.focusMode !== 'boolean'
		|| !isIsoTimestamp(value.updatedAt)
		|| (value.cursor !== undefined && !cursor)
		|| (value.scroll !== undefined && !scroll)
	) {
		return undefined;
	}
	return {
		schemaVersion: 1,
		projectId: value.projectId,
		activeWorkspace: value.activeWorkspace as WriterWorkspaceId,
		...(typeof value.activeChapterId === 'string'
			? { activeChapterId: value.activeChapterId }
			: {}),
		...(typeof value.activeSceneId === 'string'
			? { activeSceneId: value.activeSceneId }
			: {}),
		...(typeof value.activeResourceId === 'string'
			? { activeResourceId: value.activeResourceId }
			: {}),
		openTabs: value.openTabs.map(tab => ({
			resourceId: (tab as Readonly<Record<string, unknown>>).resourceId as string
		})),
		...(cursor ? { cursor } : {}),
		...(scroll ? { scroll } : {}),
		expandedTreeNodes: [...value.expandedTreeNodes] as string[],
		panelState,
		focusMode: value.focusMode,
		updatedAt: value.updatedAt
	};
}

export function parseWriterSessionMap(value: unknown): WriterSessionMap {
	let candidate = value;
	if (typeof candidate === 'string') {
		try {
			candidate = JSON.parse(candidate) as unknown;
		} catch {
			return {};
		}
	}
	if (!isRecord(candidate)) return {};
	return Object.fromEntries(Object.entries(candidate).flatMap(([projectId, entry]) => {
		const parsed = parseWriterSession(entry);
		return parsed && parsed.projectId === projectId ? [[projectId, parsed]] : [];
	}));
}

function defaultSession(input: ReconcileWriterSessionInput): WriterSessionState {
	const activeChapterId = input.chapterIds[0];
	return {
		schemaVersion: 1,
		projectId: input.projectId,
		activeWorkspace: 'writing',
		...(activeChapterId ? {
			activeChapterId,
			activeResourceId: activeChapterId,
			openTabs: [{ resourceId: activeChapterId }],
			cursor: {
				chapterId: activeChapterId,
				line: 1,
				column: 1
			},
			scroll: {
				chapterId: activeChapterId,
				scrollTop: 0
			}
		} : {
			openTabs: []
		}),
		expandedTreeNodes: [...input.expandedTreeNodeIds],
		panelState: input.defaultPanelState,
		focusMode: false,
		updatedAt: input.now
	};
}

export function reconcileWriterSession(
	value: unknown,
	input: ReconcileWriterSessionInput
): ReconciledWriterSession {
	const parsed = parseWriterSession(value);
	if (!parsed) {
		return {
			session: defaultSession(input),
			...(value === undefined ? {} : { notice: '上次会话已损坏，会话已安全重建。' })
		};
	}
	if (parsed.projectId !== input.projectId) {
		return {
			session: defaultSession(input),
			notice: '上次会话属于其他作品，会话已安全重建。'
		};
	}

	const resourceIds = new Set(input.resourceIds);
	const chapterIds = new Set(input.chapterIds);
	let fallback = false;
	const activeChapterId = parsed.activeChapterId && chapterIds.has(parsed.activeChapterId)
		? parsed.activeChapterId
		: input.chapterIds[0];
	if (parsed.activeChapterId && parsed.activeChapterId !== activeChapterId) fallback = true;

	let activeResourceId = parsed.activeResourceId && resourceIds.has(parsed.activeResourceId)
		? parsed.activeResourceId
		: activeChapterId;
	if (parsed.activeResourceId && parsed.activeResourceId !== activeResourceId) fallback = true;

	const openTabs = parsed.openTabs
		.filter((tab, index, all) => (
			resourceIds.has(tab.resourceId)
			&& all.findIndex(candidate => candidate.resourceId === tab.resourceId) === index
		));
	if (openTabs.length !== parsed.openTabs.length) fallback = true;
	if (activeResourceId && !openTabs.some(tab => tab.resourceId === activeResourceId)) {
		openTabs.push({ resourceId: activeResourceId });
	}
	if (!activeResourceId && openTabs[0]) {
		activeResourceId = openTabs[0].resourceId;
	}

	const activeSceneId = activeChapterId
		&& parsed.activeSceneId
		&& input.sceneIdsByChapter[activeChapterId]?.includes(parsed.activeSceneId)
		? parsed.activeSceneId
		: undefined;
	if (parsed.activeSceneId && parsed.activeSceneId !== activeSceneId) fallback = true;

	let cursor = parsed.cursor && parsed.cursor.chapterId === activeChapterId
		? parsed.cursor
		: activeChapterId ? { chapterId: activeChapterId, line: 1, column: 1 } : undefined;
	if (parsed.cursor && parsed.cursor.chapterId !== activeChapterId) fallback = true;
	if (
		cursor?.anchorId
		&& input.anchorIdsByChapter
		&& !input.anchorIdsByChapter[cursor.chapterId]?.includes(cursor.anchorId)
	) {
		cursor = {
			chapterId: cursor.chapterId,
			line: Math.max(1, cursor.line),
			column: Math.max(1, cursor.column)
		};
		fallback = true;
	}

	const scroll = parsed.scroll && parsed.scroll.chapterId === activeChapterId
		? parsed.scroll
		: activeChapterId ? { chapterId: activeChapterId, scrollTop: 0 } : undefined;
	if (parsed.scroll && parsed.scroll.chapterId !== activeChapterId) fallback = true;

	const validExpandedNodes = parsed.expandedTreeNodes.filter(nodeId => (
		input.expandedTreeNodeIds.includes(nodeId)
	));
	const expandedTreeNodes = validExpandedNodes.length
		? validExpandedNodes
		: [...input.expandedTreeNodeIds];
	if (validExpandedNodes.length !== parsed.expandedTreeNodes.length) fallback = true;
	const stableSession = { ...parsed };
	delete stableSession.activeChapterId;
	delete stableSession.activeSceneId;
	delete stableSession.activeResourceId;
	delete stableSession.cursor;
	delete stableSession.scroll;

	return {
		session: {
			...stableSession,
			...(activeChapterId ? { activeChapterId } : {}),
			...(activeSceneId ? { activeSceneId } : {}),
			...(activeResourceId ? { activeResourceId } : {}),
			openTabs,
			...(cursor ? { cursor } : {}),
			...(scroll ? { scroll } : {}),
			expandedTreeNodes,
			focusMode: false
		},
		...(fallback ? {
			notice: '上次写作位置已变化，已回退到可用的章节位置。'
		} : {})
	};
}

export function workspaceForRailMode(mode: string): WriterWorkspaceId {
	if (mode === 'references') return 'reference';
	if (mode === 'review') return 'review';
	if (mode === 'versions') return 'history';
	return 'writing';
}
