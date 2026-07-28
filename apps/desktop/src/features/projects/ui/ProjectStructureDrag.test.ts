import { describe, expect, it } from 'vitest';
import type { WritingProject } from '@writing-buddy/domain';
import type { StoryScene } from '@writing-buddy/story-kernel';
import {
	resolveProjectStructureDrop,
	type ProjectStructureDragItem
} from './ProjectStructureDrag';

const project: WritingProject = {
	schemaVersion: 1,
	projectId: 'project-a11ce001',
	title: '测试作品',
	volumes: [
		{
			id: 'volume-a11ce001',
			title: '第一卷',
			chapters: [
				{ id: 'chapter-a11ce001', title: '第一章', file: 'chapters/1.md', scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' } },
				{ id: 'chapter-a11ce002', title: '第二章', file: 'chapters/2.md', scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' } },
				{ id: 'chapter-a11ce003', title: '第三章', file: 'chapters/3.md', scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' } }
			]
		},
		{
			id: 'volume-a11ce002',
			title: '第二卷',
			chapters: [
				{ id: 'chapter-a11ce004', title: '第四章', file: 'chapters/4.md', scene: { location: '', time: '', pov: '', characters: [], goal: '', note: '' } }
			]
		}
	]
};

function item(value: Partial<ProjectStructureDragItem> = {}): ProjectStructureDragItem {
	return {
		entityType: 'chapter',
		entityId: 'chapter-a11ce001',
		title: '第一章',
		containerId: 'volume-a11ce001',
		index: 0,
		projectRevision: 'revision-1',
		...value
	};
}

describe('resolveProjectStructureDrop', () => {
	const scenes = [
		{
			id: 'scene:first',
			type: 'scene',
			title: '第一场',
			chapterId: 'chapter:chapter-a11ce001',
			narrativeOrder: 0,
			manuscriptRange: { start: 0, end: 3 }
		},
		{
			id: 'scene:second',
			type: 'scene',
			title: '第二场',
			chapterId: 'chapter:chapter-a11ce001',
			narrativeOrder: 1,
			manuscriptRange: { start: 5, end: 8 }
		},
		{
			id: 'scene:target',
			type: 'scene',
			title: '目标场',
			chapterId: 'chapter:chapter-a11ce002',
			narrativeOrder: 0,
			manuscriptRange: { start: 0, end: 3 }
		}
	] as unknown as readonly StoryScene[];

	it('calculates a downward same-volume insertion after source removal', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item(),
			item({ entityId: 'chapter-a11ce003', title: '第三章', index: 2 }),
			'before'
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'volume-a11ce001',
			index: 1
		});
	});

	it('calculates an upward insertion after the hovered chapter', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({ entityId: 'chapter-a11ce003', title: '第三章', index: 2 }),
			item(),
			'after'
		);
		expect(intent.allowed && intent.command.to.index).toBe(1);
	});

	it('moves a chapter into another volume at the requested edge', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item(),
			item({
				entityId: 'chapter-a11ce004',
				title: '第四章',
				containerId: 'volume-a11ce002',
				index: 0
			}),
			'after'
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'volume-a11ce002',
			index: 1
		});
	});

	it('drops a chapter on a volume by appending it', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item(),
			item({
				entityType: 'volume',
				entityId: 'volume-a11ce002',
				title: '第二卷',
				containerId: project.projectId,
				index: 1
			}),
			'before'
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'volume-a11ce002',
			index: 1
		});
	});

	it('treats dropping the last chapter on its current volume as no change', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({ entityId: 'chapter-a11ce003', title: '第三章', index: 2 }),
			item({
				entityType: 'volume',
				entityId: 'volume-a11ce001',
				title: '第一卷',
				containerId: project.projectId,
				index: 0
			}),
			'after'
		);
		expect(intent).toEqual({
			allowed: false,
			reason: '项目已经在这个位置。'
		});
	});

	it('rejects dropping a volume on a chapter', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({
				entityType: 'volume',
				entityId: 'volume-a11ce001',
				title: '第一卷',
				containerId: project.projectId
			}),
			item(),
			'before'
		);
		expect(intent).toEqual({
			allowed: false,
			reason: '卷只能放在其他卷之前或之后。'
		});
	});

	it('calculates same-chapter scene insertion after source removal', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({
				entityType: 'scene',
				entityId: 'scene:first',
				title: '第一场',
				containerId: 'chapter:chapter-a11ce001',
				index: 0
			}),
			item({
				entityType: 'scene',
				entityId: 'scene:second',
				title: '第二场',
				containerId: 'chapter:chapter-a11ce001',
				index: 1
			}),
			'after',
			scenes
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'chapter:chapter-a11ce001',
			index: 1
		});
	});

	it('moves a scene into another chapter after its target scene', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({
				entityType: 'scene',
				entityId: 'scene:first',
				title: '第一场',
				containerId: 'chapter:chapter-a11ce001',
				index: 0
			}),
			item({
				entityType: 'scene',
				entityId: 'scene:target',
				title: '目标场',
				containerId: 'chapter:chapter-a11ce002',
				index: 0
			}),
			'after',
			scenes
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'chapter:chapter-a11ce002',
			index: 1
		});
	});

	it('drops a scene on an empty chapter at its manuscript end', () => {
		const intent = resolveProjectStructureDrop(
			project,
			item({
				entityType: 'scene',
				entityId: 'scene:first',
				title: '第一场',
				containerId: 'chapter:chapter-a11ce001',
				index: 0
			}),
			item({
				entityType: 'chapter',
				entityId: 'chapter-a11ce003',
				title: '第三章',
				containerId: 'volume-a11ce001',
				index: 2
			}),
			'after',
			scenes
		);
		expect(intent.allowed && intent.command.to).toEqual({
			containerId: 'chapter:chapter-a11ce003',
			index: 0
		});
	});
});
