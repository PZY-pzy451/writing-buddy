import { describe, expect, it } from 'vitest';
import { emptySceneMetadata, type WritingProject } from '@writing-buddy/domain';
import type { DragPayload, DropTarget, MoveCommand } from '@writing-buddy/platform-ports';
import {
	applyProjectStructureMove,
	DropRuleRegistry,
	ProjectStructureMoveError
} from './ProjectStructureMove';

const project: WritingProject = {
	schemaVersion: 1,
	projectId: 'project-1',
	title: '测试作品',
	volumes: [
		{
			id: 'volume-1',
			title: '第一卷',
			chapters: [
				{ id: 'chapter-1', title: '第一章', file: 'chapters/1.md', scene: emptySceneMetadata() },
				{ id: 'chapter-2', title: '第二章', file: 'chapters/2.md', scene: emptySceneMetadata() },
				{ id: 'chapter-3', title: '第三章', file: 'chapters/3.md', scene: emptySceneMetadata() }
			]
		},
		{
			id: 'volume-2',
			title: '第二卷',
			chapters: [
				{ id: 'chapter-4', title: '第四章', file: 'chapters/4.md', scene: emptySceneMetadata() }
			]
		}
	]
};

function command(overrides: Partial<MoveCommand> = {}): MoveCommand {
	return {
		commandId: 'move-1',
		entityType: 'chapter',
		entityIds: ['chapter-1'],
		from: { containerId: 'volume-1', index: 0 },
		to: { containerId: 'volume-1', index: 2 },
		expectedProjectRevision: 'revision-1',
		...overrides
	};
}

describe('DropRuleRegistry', () => {
	const registry = new DropRuleRegistry();
	const payload: DragPayload = {
		entityType: 'chapter',
		entityIds: ['chapter-1'],
		sourceContainerId: 'volume-1',
		sourceIndex: 0,
		projectRevision: 'revision-1'
	};

	it.each([
		[{ targetType: 'before', containerId: 'volume-1', targetEntityId: 'chapter-2' }, true],
		[{ targetType: 'inside', containerId: 'volume-2' }, true],
		[{ targetType: 'associate', containerId: 'character-1' }, false]
	] satisfies readonly [DropTarget, boolean][])(
		'evaluates chapter target %o',
		(target, allowed) => {
			expect(registry.evaluate(payload, target).allowed).toBe(allowed);
		}
	);

	it('allows scene movement only at scene or chapter insertion targets', () => {
		const result = registry.evaluate(
			{ ...payload, entityType: 'scene', entityIds: ['scene-1'] },
			{ targetType: 'inside', containerId: 'chapter-2' }
		);
		expect(result).toMatchObject({ allowed: true, action: 'move' });
		expect(registry.evaluate(
			{ ...payload, entityType: 'scene', entityIds: ['scene-1'] },
			{ targetType: 'associate', containerId: 'character-1' }
		).allowed).toBe(false);
	});
});

describe('applyProjectStructureMove', () => {
	it('reorders a chapter in one volume and returns an inverse command', () => {
		const moved = applyProjectStructureMove(project, command());
		expect(moved.project.volumes[0]?.chapters.map(chapter => chapter.id))
			.toEqual(['chapter-2', 'chapter-3', 'chapter-1']);

		const restored = applyProjectStructureMove(moved.project, moved.inverseCommand);
		expect(restored.project).toEqual(project);
	});

	it('moves a chapter across volumes without changing its ID or file', () => {
		const moved = applyProjectStructureMove(project, command({
			entityIds: ['chapter-2'],
			from: { containerId: 'volume-1', index: 1 },
			to: { containerId: 'volume-2', index: 1 }
		}));
		expect(moved.project.volumes[0]?.chapters.map(chapter => chapter.id))
			.toEqual(['chapter-1', 'chapter-3']);
		expect(moved.project.volumes[1]?.chapters.map(chapter => [chapter.id, chapter.file]))
			.toEqual([
				['chapter-4', 'chapters/4.md'],
				['chapter-2', 'chapters/2.md']
			]);
		expect(applyProjectStructureMove(moved.project, moved.inverseCommand).project).toEqual(project);
	});

	it('reorders volumes', () => {
		const moved = applyProjectStructureMove(project, command({
			entityType: 'volume',
			entityIds: ['volume-1'],
			from: { containerId: 'project-1', index: 0 },
			to: { containerId: 'project-1', index: 1 }
		}));
		expect(moved.project.volumes.map(volume => volume.id)).toEqual(['volume-2', 'volume-1']);
	});

	it('rejects stale source coordinates before changing arrays', () => {
		expect(() => applyProjectStructureMove(project, command({
			entityIds: ['chapter-3']
		}))).toThrow(ProjectStructureMoveError);
		expect(project.volumes[0]?.chapters.map(chapter => chapter.id))
			.toEqual(['chapter-1', 'chapter-2', 'chapter-3']);
	});
});
