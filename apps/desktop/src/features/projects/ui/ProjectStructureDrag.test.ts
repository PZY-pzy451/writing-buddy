import { describe, expect, it } from 'vitest';
import type { WritingProject } from '@writing-buddy/domain';
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
});
