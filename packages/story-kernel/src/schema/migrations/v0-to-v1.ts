import { storyResourceTypes, type StoryResourceType } from '../../model/StoryResourceBase';
import { StorySchemaRegistry } from '../schemaRegistry';
import type { StoryResource } from '../resourceSchemas';

type JsonRecord = Record<string, unknown>;

export interface StoryResourceV0ToV1Plan {
	readonly schemaVersion: 1;
	readonly sourceSchemaVersion: 0;
	readonly targetSchemaVersion: 1;
	readonly resourceType: StoryResourceType;
	readonly original: Readonly<JsonRecord>;
	readonly staged: StoryResource;
	readonly changes: readonly string[];
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireTimestamp(value: string): string {
	let normalized: string;
	try {
		normalized = new Date(value).toISOString();
	} catch {
		throw new Error('invalidMigrationTimestamp');
	}
	if (!value.endsWith('Z') || normalized !== value) {
		throw new Error('invalidMigrationTimestamp');
	}
	return value;
}

function requireResourceType(value: unknown): StoryResourceType {
	if (typeof value !== 'string' || !storyResourceTypes.includes(value as StoryResourceType)) {
		throw new Error('unsupportedStoryResourceType');
	}
	return value as StoryResourceType;
}

/**
 * Builds a pure, author-reviewable migration plan. This function never writes
 * files and never mutates the supplied v0 object.
 */
export function stageStoryResourceV0ToV1(
	input: unknown,
	migrationTimestamp: string
): StoryResourceV0ToV1Plan {
	if (!isRecord(input)) throw new Error('invalidStoryResourceV0');
	if (input.schemaVersion !== undefined && input.schemaVersion !== 0) {
		throw new Error('unsupportedStoryResourceSchema');
	}
	const timestamp = requireTimestamp(migrationTimestamp);
	const type = requireResourceType(input.type);
	const original = cloneJson(input);
	const staged: JsonRecord = cloneJson(input);
	const changes: string[] = ['schemaVersion:0→1'];

	staged.schemaVersion = 1;
	if (typeof staged.title !== 'string' && typeof staged.name === 'string') {
		staged.title = staged.name;
		changes.push('name→title');
	}
	if ('name' in staged) delete staged.name;
	for (const field of ['aliases', 'tags', 'evidenceIds'] as const) {
		if (!Array.isArray(staged[field])) {
			staged[field] = [];
			changes.push(`${field}:default`);
		}
	}
	if (typeof staged.createdAt !== 'string') {
		staged.createdAt = timestamp;
		changes.push('createdAt:default');
	}
	if (typeof staged.updatedAt !== 'string') {
		staged.updatedAt = staged.createdAt;
		changes.push('updatedAt:default');
	}
	if (!Number.isInteger(staged.revision) || Number(staged.revision) < 0) {
		staged.revision = 0;
		changes.push('revision:default');
	}

	return {
		schemaVersion: 1,
		sourceSchemaVersion: 0,
		targetSchemaVersion: 1,
		resourceType: type,
		original,
		staged: StorySchemaRegistry.parse(type, staged),
		changes
	};
}

export function commitStoryResourceV0ToV1(
	plan: StoryResourceV0ToV1Plan
): StoryResource {
	if (plan.sourceSchemaVersion !== 0 || plan.targetSchemaVersion !== 1) {
		throw new Error('invalidStoryMigrationPlan');
	}
	return StorySchemaRegistry.parse(plan.resourceType, cloneJson(plan.staged));
}

export function rollbackStoryResourceV0ToV1(
	plan: StoryResourceV0ToV1Plan
): Readonly<JsonRecord> {
	if (plan.sourceSchemaVersion !== 0 || plan.targetSchemaVersion !== 1) {
		throw new Error('invalidStoryMigrationPlan');
	}
	return cloneJson(plan.original);
}
