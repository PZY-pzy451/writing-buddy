import { validateSnapshotPath } from '@writing-buddy/version';
import { z } from 'zod';

export const wbBackupFormatVersion = 1 as const;

export interface WbBackupEntry {
	readonly relativePath: string;
	readonly byteLength: number;
	readonly contentHash: string;
}

export interface WbBackupMetadata {
	readonly schemaVersion: typeof wbBackupFormatVersion;
	readonly projectId: string;
	readonly createdAt: string;
	readonly reason: string;
	readonly label?: string;
	readonly appVersion: string;
	readonly entries: readonly WbBackupEntry[];
}

const metadataSchema = z.object({
	schemaVersion: z.literal(wbBackupFormatVersion),
	projectId: z.string().min(1),
	createdAt: z.iso.datetime(),
	reason: z.string().min(1),
	label: z.string().optional(),
	appVersion: z.string().min(1),
	entries: z.array(z.object({
		relativePath: z.string().refine(validateSnapshotPath),
		byteLength: z.number().int().nonnegative(),
		contentHash: z.string().regex(/^[0-9a-f]{64}$/i)
	}))
});

export function parseBackupMetadata(value: unknown): WbBackupMetadata {
	return metadataSchema.parse(value);
}
