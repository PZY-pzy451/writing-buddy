import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import {
	ProjectOpenService,
	type ProjectOpenGateway,
	type PublicProjectOpenError
} from './ProjectOpenService';

const snapshot: ProjectSnapshot = {
	root: 'D:\\projects\\story',
	projectRevision: 'revision-test-1',
	project: {
		schemaVersion: 1,
		projectId: 'project-00000001',
		title: '测试作品',
		volumes: []
	},
	resources: [],
	wordCounts: {},
	integrityIssues: [],
	readOnly: false
};

function structuredError(overrides: Partial<PublicProjectOpenError> = {}): PublicProjectOpenError {
	return {
		code: 'manifestNotFound',
		stage: 'read-manifest',
		safePath: 'C:\\Users\\***\\Novel',
		canOpenReadOnly: false,
		canRepair: false,
		diagnosticId: 'project-open-test-001',
		...overrides
	};
}

function gateway(openImpl: ProjectOpenGateway['openProject']): ProjectOpenGateway {
	return {
		openProject: openImpl,
		repairProject: vi.fn(() => Promise.resolve({ repaired: true, diagnosticId: 'repair-test-001' })),
		revealProjectDirectory: vi.fn(() => Promise.resolve())
	};
}

function asException(error: PublicProjectOpenError): Error & PublicProjectOpenError {
	return Object.assign(new Error(error.code), error);
}

describe('ProjectOpenService', () => {
	it('returns a successful read-write snapshot', async () => {
		const openProject = vi.fn(() => Promise.resolve(snapshot));
		const service = new ProjectOpenService(gateway(openProject));

		await expect(service.openProjectReadWrite(snapshot.root)).resolves.toEqual({
			ok: true,
			snapshot
		});
		expect(openProject).toHaveBeenCalledWith(snapshot.root, 'read-write');
	});

	it.each([
		['missing project.json', structuredError()],
		['unsupported schema', structuredError({
			code: 'unsupportedSchema',
			stage: 'validate-schema',
			canOpenReadOnly: true
		})],
		['active lock conflict', structuredError({
			code: 'projectLocked',
			stage: 'acquire-lock',
			canOpenReadOnly: true
		})]
	])('preserves structured diagnostics for %s', async (_label, expected) => {
		const service = new ProjectOpenService(gateway(() => Promise.reject(asException(expected))));

		await expect(service.openProjectReadWrite('C:\\Users\\Alice\\Novel')).resolves.toEqual({
			ok: false,
			error: expected
		});
	});

	it('opens the same selected root in read-only mode after a lock conflict', async () => {
		const openProject = vi
			.fn<ProjectOpenGateway['openProject']>()
			.mockRejectedValueOnce(structuredError({
				code: 'projectLocked',
				stage: 'acquire-lock',
				canOpenReadOnly: true
			}))
			.mockResolvedValueOnce({ ...snapshot, readOnly: true });
		const service = new ProjectOpenService(gateway(openProject));

		const first = await service.openProjectReadWrite(snapshot.root);
		expect(first.ok).toBe(false);
		await expect(service.openProjectReadOnly(snapshot.root)).resolves.toEqual({
			ok: true,
			snapshot: { ...snapshot, readOnly: true }
		});
		expect(openProject).toHaveBeenNthCalledWith(2, snapshot.root, 'read-only');
	});

	it('redacts usernames and raw exception text from unstructured failures', async () => {
		const service = new ProjectOpenService(gateway(() => Promise.reject(
			new Error('C:\\Users\\Alice\\Novel\\secret.md: access denied')
		)));

		const result = await service.openProjectReadWrite('C:\\Users\\Alice\\Novel');
		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error('Expected failure.');
		}
		expect(result.error).toMatchObject({
			code: 'projectOpenFailed',
			safePath: 'C:\\Users\\***\\Novel'
		});
		expect(JSON.stringify(result.error)).not.toContain('Alice');
		expect(JSON.stringify(result.error)).not.toContain('secret.md');
	});
});
