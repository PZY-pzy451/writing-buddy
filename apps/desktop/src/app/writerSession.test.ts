import { describe, expect, it } from 'vitest';
import {
	parseWriterSessionMap,
	reconcileWriterSession,
	type WriterSessionState
} from './writerSession';
import {
	createDefaultWriterWorkspaceLayouts,
	updateWriterWorkspaceLayout
} from './writerWorkspace';

const panelState = {
	projectSidebarWidth: 336,
	assistantWidth: 388,
	assistantVisible: false,
	inspectorVisible: false,
	sidebarVisible: true,
	dockHeight: 222,
	dockVisible: false
} as const;

function session(overrides: Partial<WriterSessionState> = {}): WriterSessionState {
	return {
		schemaVersion: 2,
		projectId: 'project-one',
		activeWorkspace: 'writing',
		activeChapterId: 'chapter-two',
		activeSceneId: 'scene-two',
		activeResourceId: 'chapter-two',
		openTabs: [
			{ resourceId: 'chapter-one' },
			{ resourceId: 'chapter-two' }
		],
		cursor: {
			chapterId: 'chapter-two',
			anchorId: 'anchor-two',
			line: 18,
			column: 7
		},
		scroll: {
			chapterId: 'chapter-two',
			scrollTop: 720
		},
		expandedTreeNodes: ['volume-one', 'references'],
		panelState,
		workspaceLayouts: updateWriterWorkspaceLayout(
			createDefaultWriterWorkspaceLayouts(),
			'writing',
			panelState
		),
		focusMode: false,
		updatedAt: '2026-07-28T14:41:00.000Z',
		...overrides
	};
}

describe('writer session contract', () => {
	it('keeps independent valid project sessions and drops corrupt entries', () => {
		const parsed = parseWriterSessionMap({
			'project-one': session(),
			'project-two': session({
				projectId: 'project-two',
				activeChapterId: 'chapter-nine',
				activeResourceId: 'chapter-nine'
			}),
			'project-corrupt': {
				projectId: 'project-corrupt',
				openTabs: 'not-an-array'
			}
		});

		expect(Object.keys(parsed)).toEqual(['project-one', 'project-two']);
		expect(parsed['project-one']?.activeChapterId).toBe('chapter-two');
		expect(parsed['project-two']?.activeChapterId).toBe('chapter-nine');
		expect(parseWriterSessionMap('{broken json')).toEqual({});
	});

	it('migrates the Gate B session into independent workspace presets', () => {
		const legacy = {
			...session(),
			schemaVersion: 1,
			workspaceLayouts: undefined
		};
		const parsed = parseWriterSessionMap({ 'project-one': legacy });

		expect(parsed['project-one']).toMatchObject({
			schemaVersion: 2,
			panelState
		});
		expect(parsed['project-one']?.workspaceLayouts.writing).toEqual(panelState);
		expect(parsed['project-one']?.workspaceLayouts.planning.assistantVisible).toBe(false);
	});

	it('restores stable chapter, scene, cursor, scroll, tree and pane state', () => {
		const result = reconcileWriterSession(session(), {
			projectId: 'project-one',
			chapterIds: ['chapter-one', 'chapter-two'],
			resourceIds: ['chapter-one', 'chapter-two', 'note-one'],
			sceneIdsByChapter: {
				'chapter-one': ['scene-one'],
				'chapter-two': ['scene-two']
			},
			expandedTreeNodeIds: ['volume-one', 'volume-two', 'references'],
			defaultPanelState: panelState,
			now: '2026-07-29T00:00:00.000Z'
		});

		expect(result.notice).toBeUndefined();
		expect(result.session).toMatchObject({
			activeChapterId: 'chapter-two',
			activeSceneId: 'scene-two',
			activeResourceId: 'chapter-two',
			cursor: { chapterId: 'chapter-two', line: 18, column: 7 },
			scroll: { chapterId: 'chapter-two', scrollTop: 720 },
			expandedTreeNodes: ['volume-one', 'references'],
			panelState
		});
	});

	it('falls back without blocking project open when chapter, scene or anchor is stale', () => {
		const result = reconcileWriterSession(session({
			activeChapterId: 'deleted-chapter',
			activeSceneId: 'deleted-scene',
			activeResourceId: 'deleted-chapter',
			openTabs: [{ resourceId: 'deleted-chapter' }],
			cursor: {
				chapterId: 'deleted-chapter',
				anchorId: 'deleted-anchor',
				line: 900,
				column: 200
			},
			scroll: { chapterId: 'deleted-chapter', scrollTop: 9999 },
			expandedTreeNodes: ['deleted-volume']
		}), {
			projectId: 'project-one',
			chapterIds: ['chapter-one'],
			resourceIds: ['chapter-one'],
			sceneIdsByChapter: { 'chapter-one': ['scene-one'] },
			expandedTreeNodeIds: ['volume-one', 'references'],
			defaultPanelState: panelState,
			now: '2026-07-29T00:00:00.000Z'
		});

		expect(result.session).toMatchObject({
			activeChapterId: 'chapter-one',
			activeResourceId: 'chapter-one',
			openTabs: [{ resourceId: 'chapter-one' }],
			cursor: {
				chapterId: 'chapter-one',
				line: 1,
				column: 1
			},
			scroll: {
				chapterId: 'chapter-one',
				scrollTop: 0
			},
			expandedTreeNodes: ['volume-one', 'references']
		});
		expect(result.session).not.toHaveProperty('activeSceneId');
		expect(result.notice).toContain('上次写作位置已变化');
	});

	it('ignores a session belonging to another project', () => {
		const result = reconcileWriterSession(session({ projectId: 'project-other' }), {
			projectId: 'project-one',
			chapterIds: ['chapter-one'],
			resourceIds: ['chapter-one'],
			sceneIdsByChapter: { 'chapter-one': [] },
			expandedTreeNodeIds: ['volume-one', 'references'],
			defaultPanelState: panelState,
			now: '2026-07-29T00:00:00.000Z'
		});

		expect(result.session.projectId).toBe('project-one');
		expect(result.session.activeChapterId).toBe('chapter-one');
		expect(result.notice).toContain('会话已安全重建');
	});
});
