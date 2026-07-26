import { parseBackupMetadata } from './index';

describe('backup metadata', () => {
	it('accepts format v1 and rejects traversal', () => {
		const metadata = {
			schemaVersion: 1,
			projectId: 'project-a11ce001',
			createdAt: '2026-07-26T10:00:00.000Z',
			reason: 'manual',
			appVersion: '0.1.0',
			entries: [{ relativePath: 'chapters/one.md', byteLength: 3, contentHash: 'a'.repeat(64) }]
		};
		expect(parseBackupMetadata(metadata)).toMatchObject({ schemaVersion: 1, projectId: 'project-a11ce001' });
		expect(() => parseBackupMetadata({
			...metadata,
			entries: [{ ...metadata.entries[0], relativePath: '../outside' }]
		})).toThrow();
	});
});
