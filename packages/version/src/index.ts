export type SnapshotReason =
	| 'manual'
	| 'periodic'
	| 'beforeRestore'
	| 'beforeMigration'
	| 'beforeDestructiveOperation'
	| 'milestone';

export type SnapshotResourceKind =
	| 'projectManifest'
	| 'chapter'
	| 'note'
	| 'character'
	| 'worldbuilding'
	| 'timeline'
	| 'item'
	| 'reviewState'
	| 'aiState'
	| 'trashMetadata';

export interface SnapshotResourceEntry {
	readonly resourceId: string;
	readonly kind: SnapshotResourceKind;
	readonly relativePath: string;
	readonly blobHash: string;
	readonly byteLength: number;
	readonly contentHash: string;
}

export interface VersionSnapshot {
	readonly schemaVersion: 1;
	readonly id: string;
	readonly projectId: string;
	readonly createdAt: string;
	readonly reason: SnapshotReason;
	readonly label?: string;
	readonly appVersion: string;
	readonly projectSchemaVersion: number;
	readonly parentSnapshotId?: string;
	readonly manifestHash: string;
	readonly resources: readonly SnapshotResourceEntry[];
	readonly summary: {
		readonly added: number;
		readonly modified: number;
		readonly deleted: number;
		readonly unchanged: number;
		readonly totalBytes: number;
		readonly newBlobBytes: number;
	};
}

export function validateSnapshotPath(path: string): boolean {
	return path.length > 0
		&& !path.includes('\\')
		&& !path.startsWith('/')
		&& !path.split('/').some(segment => !segment || segment === '.' || segment === '..');
}
