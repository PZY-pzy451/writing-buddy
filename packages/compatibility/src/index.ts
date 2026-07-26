import {
	emptySceneMetadata,
	normalizeProjectRelativePath,
	projectSchemaVersion,
	type ChapterDescriptor,
	type SceneMetadata,
	type VolumeDescriptor,
	type WritingProject
} from '@writing-buddy/domain';
import { z } from 'zod';

const stableId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-[0-9a-f]{8}$`, 'i'));
const title = z.string().trim().min(1).max(120);
const sceneSchema = z.object({
	location: z.string().optional().default(''),
	time: z.string().optional().default(''),
	pov: z.string().optional().default(''),
	characters: z.array(z.string()).optional().default([]),
	goal: z.string().optional().default(''),
	note: z.string().optional().default('')
}).optional();

const chapterSchema = z.object({
	id: stableId('chapter'),
	title,
	file: z.string(),
	status: z.enum(['draft', 'revision', 'completed']).optional(),
	targetWords: z.number().int().min(100).max(200_000).optional(),
	scene: sceneSchema
});

const volumeSchema = z.object({
	id: stableId('volume'),
	title,
	chapters: z.array(chapterSchema)
});

const manifestSchema = z.object({
	schemaVersion: z.literal(projectSchemaVersion),
	projectId: stableId('project'),
	title,
	volumes: z.array(volumeSchema)
});

const earlyManifestSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().min(1),
	title,
	author: z.string().optional(),
	language: z.string().optional(),
	currentVolumeId: z.string().optional(),
	currentChapterId: z.string().optional()
});

export type CompatibilityIssueCode =
	| 'invalidManifest'
	| 'unsupportedSchema'
	| 'duplicateId'
	| 'duplicateChapterFile'
	| 'unsafePath'
	| 'earlyDirectorySchema';

export interface CompatibilityIssue {
	readonly severity: 'info' | 'warning' | 'error';
	readonly code: CompatibilityIssueCode;
	readonly message: string;
	readonly path?: string;
}

export interface ParsedProject {
	readonly kind: 'current' | 'early-directory';
	readonly project?: WritingProject;
	readonly earlyManifest?: z.infer<typeof earlyManifestSchema>;
	readonly issues: readonly CompatibilityIssue[];
}

function normalizeScene(scene: z.infer<typeof sceneSchema>): SceneMetadata {
	const source = scene ?? emptySceneMetadata();
	return {
		location: source.location.trim(),
		time: source.time.trim(),
		pov: source.pov.trim(),
		characters: source.characters.map(value => value.trim()).filter(Boolean),
		goal: source.goal.trim(),
		note: source.note.trim()
	};
}

function normalizeChapter(chapter: z.infer<typeof chapterSchema>): ChapterDescriptor {
	return {
		id: chapter.id.toLowerCase(),
		title: chapter.title,
		file: normalizeProjectRelativePath(chapter.file),
		...(chapter.status ? { status: chapter.status } : {}),
		...(chapter.targetWords ? { targetWords: chapter.targetWords } : {}),
		scene: normalizeScene(chapter.scene)
	};
}

function validateUniqueness(volumes: readonly VolumeDescriptor[]): readonly CompatibilityIssue[] {
	const issues: CompatibilityIssue[] = [];
	const ids = new Set<string>();
	const files = new Set<string>();
	for (const volume of volumes) {
		if (ids.has(volume.id)) {
			issues.push({ severity: 'error', code: 'duplicateId', message: `Duplicate resource ID: ${volume.id}` });
		}
		ids.add(volume.id);
		for (const chapter of volume.chapters) {
			if (ids.has(chapter.id)) {
				issues.push({ severity: 'error', code: 'duplicateId', message: `Duplicate resource ID: ${chapter.id}` });
			}
			ids.add(chapter.id);
			const key = chapter.file.toLocaleLowerCase('en-US');
			if (files.has(key)) {
				issues.push({ severity: 'error', code: 'duplicateChapterFile', message: `Duplicate chapter file: ${chapter.file}`, path: chapter.file });
			}
			files.add(key);
		}
	}
	return issues;
}

export function parseProjectManifest(value: unknown): ParsedProject {
	const current = manifestSchema.safeParse(value);
	if (current.success) {
		try {
			const volumes = current.data.volumes.map(volume => ({
				id: volume.id.toLowerCase(),
				title: volume.title,
				chapters: volume.chapters.map(normalizeChapter)
			}));
			const issues = validateUniqueness(volumes);
			return {
				kind: 'current',
				project: {
					schemaVersion: projectSchemaVersion,
					projectId: current.data.projectId.toLowerCase(),
					title: current.data.title,
					volumes
				},
				issues
			};
		} catch {
			return {
				kind: 'current',
				issues: [{ severity: 'error', code: 'unsafePath', message: 'The project contains an unsafe relative path.' }]
			};
		}
	}

	const early = earlyManifestSchema.safeParse(value);
	if (early.success) {
		return {
			kind: 'early-directory',
			earlyManifest: early.data,
			issues: [{
				severity: 'warning',
				code: 'earlyDirectorySchema',
				message: 'This project uses the early directory schema and is opened read-only until its folder inventory is built.'
			}]
		};
	}

	const schemaVersion = typeof value === 'object' && value !== null && 'schemaVersion' in value
		? (value as { schemaVersion?: unknown }).schemaVersion
		: undefined;
	const schemaLabel = typeof schemaVersion === 'string' || typeof schemaVersion === 'number'
		? String(schemaVersion)
		: 'unknown';
	return {
		kind: 'current',
		issues: [{
			severity: 'error',
			code: schemaVersion === undefined || schemaVersion === 1 ? 'invalidManifest' : 'unsupportedSchema',
			message: schemaVersion === undefined || schemaVersion === 1
				? 'The project manifest is invalid.'
				: `Unsupported project schema: ${schemaLabel}`
		}]
	};
}

export function serializeProjectManifest(project: WritingProject): string {
	const parsed = parseProjectManifest(project);
	if (!parsed.project || parsed.issues.some(issue => issue.severity === 'error')) {
		throw new Error('invalidManifest');
	}
	return `${JSON.stringify(parsed.project, undefined, 2)}\n`;
}
