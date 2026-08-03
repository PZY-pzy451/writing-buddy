import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { toStoryChapterId } from '@writing-buddy/story-kernel';
import { desktopBridge } from '../platform/bridge';
import { buildStoryTabKey } from '../features/story/application/StoryResourceRegistry';
import { useAppStore } from './store';
import type { WriterSessionState } from './writerSession';
import {
	createDefaultWriterWorkspaceLayouts,
	updateWriterWorkspaceLayout
} from './writerWorkspace';

const panelState: WriterSessionState['panelState'] = {
	projectSidebarWidth: 404,
	assistantWidth: 428,
	assistantVisible: false,
	inspectorVisible: false,
	sidebarVisible: true,
	dockHeight: 286,
	dockVisible: false
};

function sessionFor(
	projectId: string,
	activeChapterId: string,
	openTabs: readonly string[] = [activeChapterId]
): WriterSessionState {
	return {
		schemaVersion: 2,
		projectId,
		activeWorkspace: 'writing',
		activeChapterId,
		activeResourceId: activeChapterId,
		openTabs: openTabs.map(resourceId => ({ resourceId })),
		cursor: {
			chapterId: activeChapterId,
			line: 18,
			column: 4
		},
		scroll: {
			chapterId: activeChapterId,
			scrollTop: 640
		},
		expandedTreeNodes: ['volume-a11ce002', 'references'],
		panelState,
		workspaceLayouts: updateWriterWorkspaceLayout(
			createDefaultWriterWorkspaceLayouts(),
			'writing',
			panelState
		),
		focusMode: false,
		updatedAt: '2026-07-28T14:41:00.000Z'
	};
}

function resetStore(): void {
	useAppStore.setState({
		recentProjectRoot: undefined,
		recentProjectRoots: [],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		writerSessions: {},
		documentViews: {},
		expandedTreeNodes: [],
		sidebarOpen: true,
		sidebarWidth: 320,
		assistantOpen: true,
		assistantWidth: 360,
		dockOpen: true,
		dockHeight: 240,
		focusMode: false,
		sessionRestoreState: 'idle',
		sessionRestoreNotice: undefined,
		projectOpenError: undefined,
		loading: false,
		error: undefined
	});
}

function chapterResource(snapshot: ProjectSnapshot, chapterId: string) {
	const chapter = snapshot.project.volumes
		.flatMap(volume => volume.chapters)
		.find(candidate => candidate.id === chapterId);
	if (!chapter) throw new Error(`missing chapter fixture: ${chapterId}`);
	return {
		id: chapter.id,
		type: 'chapter' as const,
		title: chapter.title,
		path: chapter.file,
		projectId: snapshot.project.projectId
	};
}

describe('writer session store integration', () => {
	beforeEach(() => {
		localStorage.clear();
		resetStore();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('opens on the project dashboard and continues with the restored cursor, scroll and panes', async () => {
		const fixture = await desktopBridge.openProject('browser-fixture');
		const chapterId = 'chapter-a11ce002';
		useAppStore.setState({
			writerSessions: {
				[fixture.project.projectId]: sessionFor(
					fixture.project.projectId,
					chapterId,
					[chapterId, 'draft-note']
				)
			}
		});

		await useAppStore.getState().openProject(fixture.root);

		const restored = useAppStore.getState();
		expect(restored.sessionRestoreState).toBe('ready');
		expect(restored.activeResource).toBeUndefined();
		expect(restored.tabs.map(tab => tab.id)).toEqual([chapterId, 'draft-note']);
		expect(restored.documentViews[`${fixture.project.projectId}:${chapterId}`]).toEqual({
			lineNumber: 18,
			column: 4,
			scrollTop: 640
		});
		expect({
			sidebarWidth: restored.sidebarWidth,
			assistantWidth: restored.assistantWidth,
			assistantOpen: restored.assistantOpen,
			dockHeight: restored.dockHeight,
			dockOpen: restored.dockOpen,
			expandedTreeNodes: restored.expandedTreeNodes
		}).toEqual({
			sidebarWidth: 404,
			assistantWidth: 428,
			assistantOpen: false,
			dockHeight: 286,
			dockOpen: false,
			expandedTreeNodes: ['volume-a11ce002', 'references']
		});

		await restored.openResource(chapterResource(fixture, chapterId));
		expect(useAppStore.getState().session?.state.cursor).toEqual({
			lineNumber: 18,
			column: 4,
			scrollTop: 640
		});
	});

	it('keeps mutable editor, panel and tree state isolated per project', async () => {
		const fixtureA = await desktopBridge.openProject('browser-fixture');
		const projectA = fixtureA.project.projectId;
		const chapterA = 'chapter-a11ce001';
		useAppStore.setState({
			writerSessions: {
				[projectA]: sessionFor(projectA, chapterA)
			}
		});
		await useAppStore.getState().openProject(fixtureA.root);
		await useAppStore.getState().openResource(chapterResource(fixtureA, chapterA));
		useAppStore.getState().updateCursor({
			lineNumber: 22,
			column: 7,
			scrollTop: 880
		});
		useAppStore.getState().setSidebarWidth(452);
		useAppStore.getState().toggleAssistant();
		useAppStore.getState().setTreeNodeExpanded('volume-a11ce001', true);
		useAppStore.setState({
			structureScenes: [{
				id: 'scene-restored',
				chapterId: toStoryChapterId(chapterA),
				manuscriptRange: { start: 12, end: 42 },
				narrativeOrder: 1
			}] as never
		});
		useAppStore.getState().requestEditorReveal(chapterA, 12);

		const fixtureB: ProjectSnapshot = {
			...fixtureA,
			root: 'browser-fixture-b',
			project: {
				...fixtureA.project,
				projectId: 'project-b11ce002',
				title: '另一个作品'
			}
		};
		vi.spyOn(desktopBridge, 'openProject').mockResolvedValueOnce(fixtureB);
		await useAppStore.getState().openProject(fixtureB.root);

		const switched = useAppStore.getState();
		expect(switched.writerSessions[projectA]?.cursor).toMatchObject({
			line: 22,
			column: 7
		});
		expect(switched.writerSessions[projectA]?.panelState.projectSidebarWidth).toBe(440);
		expect(switched.writerSessions[projectA]?.expandedTreeNodes).toContain('volume-a11ce001');
		expect(switched.writerSessions[projectA]?.activeSceneId).toBe('scene-restored');
		expect(switched.writerSessions[fixtureB.project.projectId]?.projectId)
			.toBe(fixtureB.project.projectId);
		expect(switched.writerSessions[fixtureB.project.projectId]?.cursor?.line).toBe(1);
	});

	it('safely rebuilds a corrupt persisted session and synchronously flushes it', async () => {
		const fixture = await desktopBridge.openProject('browser-fixture');
		vi.spyOn(desktopBridge, 'openProject').mockResolvedValue(fixture);
		useAppStore.setState({
			writerSessions: {
				[fixture.project.projectId]: {
					schemaVersion: 99,
					projectId: fixture.project.projectId
				}
			} as never
		});

		await useAppStore.getState().openProject(fixture.root);

		const state = useAppStore.getState();
		expect(state.sessionRestoreState).toBe('fallback');
		expect(state.sessionRestoreNotice).toContain('安全重建');
		expect(state.writerSessions[fixture.project.projectId]?.activeChapterId)
			.toBe('chapter-a11ce001');
		expect(() => state.flushWriterSession()).not.toThrow();
		const persisted = JSON.parse(
			localStorage.getItem('writing-buddy-next-workspace') ?? '{}'
		) as { readonly state?: { readonly writerSessions?: Record<string, unknown> } };
		expect(persisted.state?.writerSessions?.[fixture.project.projectId]).toBeDefined();
	});

	it('reopens a project when one persisted Story tab is temporarily unreadable and keeps it retryable', async () => {
		const fixture = await desktopBridge.openProject('browser-fixture');
		const chapterId = 'chapter-a11ce002';
		const storyTabId = buildStoryTabKey('character', 'character:lin-mo');
		useAppStore.setState({
			writerSessions: {
				[fixture.project.projectId]: {
					...sessionFor(
						fixture.project.projectId,
						chapterId,
						[chapterId, storyTabId]
					),
					activeResourceId: storyTabId
				}
			}
		});
		const getStoryResource = vi.spyOn(desktopBridge, 'getStoryResource')
			.mockRejectedValueOnce(new Error('readFailed:C:\\private\\story\\character.json'));

		await useAppStore.getState().openProject(fixture.root);

		const restored = useAppStore.getState();
		expect(restored.projectOpenError).toBeUndefined();
		expect(restored.snapshot?.project.projectId).toBe(fixture.project.projectId);
		expect(restored.tabs.map(tab => tab.id)).toEqual([chapterId, storyTabId]);
		expect(restored.storyOpenResult).toMatchObject({
			status: 'unavailable',
			errorCode: 'storyResourceReadFailed'
		});
		expect(restored.tabs.find(tab => tab.id === storyTabId)?.title).toBe('资料暂不可用');

		const storyTab = restored.tabs.find(tab => tab.id === storyTabId);
		if (!storyTab) throw new Error('missing restored Story tab');
		await restored.openResource(storyTab);

		expect(getStoryResource).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().storyOpenResult?.status).toBe('ready');
		expect(useAppStore.getState().activeResource?.title).toBe('林墨');
	});
});
