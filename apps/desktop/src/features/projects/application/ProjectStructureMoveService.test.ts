import { describe, expect, it, vi } from 'vitest';
import type {
	MoveCommand,
	ProjectStructureMoveResult
} from '@writing-buddy/platform-ports';
import {
	ProjectStructureMoveGatewayError,
	ProjectStructureMoveService
} from './ProjectStructureMoveService';

const command: MoveCommand = {
	commandId: 'move-1',
	entityType: 'chapter',
	entityIds: ['chapter-1'],
	from: { containerId: 'volume-1', index: 0 },
	to: { containerId: 'volume-2', index: 1 },
	expectedProjectRevision: 'revision-1'
};

const result: ProjectStructureMoveResult = {
	project: {
		schemaVersion: 1,
		projectId: 'project-1',
		title: '测试作品',
		volumes: []
	},
	projectRevision: 'revision-2',
	inverseCommand: {
		...command,
		commandId: 'undo:move-1',
		from: command.to,
		to: command.from,
		expectedProjectRevision: 'revision-2'
	},
	description: '已移动章节。'
};

describe('ProjectStructureMoveService', () => {
	it('passes a typed move through the existing desktop boundary', async () => {
		const moveProjectStructure = vi.fn(() => Promise.resolve(result));
		const service = new ProjectStructureMoveService({ moveProjectStructure });

		await expect(service.execute('D:\\Project', command)).resolves.toEqual(result);
		expect(moveProjectStructure).toHaveBeenCalledWith({
			projectRoot: 'D:\\Project',
			command
		});
	});

	it('normalizes native revision conflicts without leaking details', async () => {
		const service = new ProjectStructureMoveService({
			moveProjectStructure: vi.fn(() => Promise.reject(
				new Error('projectRevisionConflict:private-hash')
			))
		});

		await expect(service.execute('D:\\Project', command)).rejects.toEqual(
			new ProjectStructureMoveGatewayError('projectRevisionConflict')
		);
	});
});

