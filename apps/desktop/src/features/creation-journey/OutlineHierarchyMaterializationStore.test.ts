import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';

const emptyScene = {
	location: '',
	time: '',
	pov: '',
	characters: [],
	goal: '',
	note: ''
} as const;

describe('outline hierarchy materialization store', () => {
	beforeEach(() => {
		useAppStore.setState({
			snapshot: {
				root: 'D:\\browser-fixture',
				project: {
					schemaVersion: 1,
					projectId: 'project-a11ce001',
					title: '雨夜旧站',
					volumes: []
				},
				projectRevision: 'before-revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			},
			activeResource: undefined,
			activeResourceId: undefined,
			session: undefined,
			resourceContent: undefined,
			resourceHash: undefined,
			structureUndo: undefined,
			structureMoveAnnouncement: undefined,
			error: undefined
		});
	});

	it('creates the snapshot before the native atomic command and updates the canonical tree', async () => {
		const snapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockResolvedValue('snapshot:outline-hierarchy');
		const materialize = vi.spyOn(desktopBridge, 'materializeOutlineHierarchy')
			.mockResolvedValue({
				project: {
					schemaVersion: 1,
					projectId: 'project-a11ce001',
					title: '雨夜旧站',
					volumes: [{
						id: 'volume-a11ce001',
						title: '第一卷',
						chapters: [{
							id: 'chapter-a11ce001',
							title: '第一章 夜雨名单',
							file: 'chapters/chapter-001.md',
							status: 'draft',
							scene: emptyScene
						}]
					}]
				},
				projectRevision: 'after-revision',
				chapters: [{
					id: 'chapter-a11ce001',
					title: '第一章 夜雨名单',
					file: 'chapters/chapter-001.md',
					status: 'draft',
					scene: emptyScene
				}],
				sceneIds: ['scene:a11ce001'],
				journeyContent: '{}',
				journeyHash: 'after-hash',
				description: '已创建 1 卷、1 章和 1 个场景。'
			});
		vi.spyOn(desktopBridge, 'readText').mockResolvedValue({
			content: '# 第一章 夜雨名单\n\n## 场景\n',
			hash: 'chapter-hash',
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});

		await expect(useAppStore.getState().materializeOutlineHierarchy('{}', 'before-hash'))
			.resolves.toBe(true);
		expect(snapshot).toHaveBeenCalledBefore(materialize);
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters[0]?.id)
			.toBe('chapter-a11ce001');
		expect(useAppStore.getState().activeResourceId).toBe('chapter-a11ce001');
		expect(useAppStore.getState().structureUndo).toMatchObject({
			kind: 'snapshot',
			snapshotId: 'snapshot:outline-hierarchy'
		});
	});
});
