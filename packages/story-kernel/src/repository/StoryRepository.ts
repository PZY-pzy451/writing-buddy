import type { StoryId } from '../ids/StoryId';
import type { StoryResourceType } from '../model/StoryResourceBase';
import { storyResourceTypes } from '../model/StoryResourceBase';
import { StorySchemaRegistry } from '../schema/schemaRegistry';
import type { StoryResource } from '../schema/resourceSchemas';

export interface StorySaveEntry {
	readonly resource: unknown;
	readonly expectedRevision?: number;
}

export interface StoryStorageGateway {
	getStoryResource(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown | undefined>;
	listStoryResources(projectRoot: string, type: StoryResourceType): Promise<readonly unknown[]>;
	saveStoryResources(
		projectRoot: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]>;
	moveStoryResourceToTrash(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<void>;
	restoreStoryResourceFromTrash(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown>;
}

export interface StoryRepository {
	get<T extends StoryResource = StoryResource>(
		type: StoryResourceType,
		id: StoryId | string
	): Promise<T | undefined>;
	list<T extends StoryResource = StoryResource>(type: StoryResourceType): Promise<readonly T[]>;
	save(resource: unknown, expectedRevision?: number): Promise<StoryResource>;
	commit(entries: readonly StorySaveEntry[]): Promise<readonly StoryResource[]>;
	moveToTrash(type: StoryResourceType, id: StoryId | string): Promise<void>;
	restoreFromTrash(type: StoryResourceType, id: StoryId | string): Promise<StoryResource>;
}

export class StoryRevisionConflictError extends Error {
	constructor(readonly actualRevision?: number) {
		super('Story resource changed on disk.');
		this.name = 'StoryRevisionConflictError';
	}
}

export class StoryStorageError extends Error {
	constructor(readonly code: string) {
		super('Story resource operation failed.');
		this.name = 'StoryStorageError';
	}
}

function resourceType(value: unknown): StoryResourceType {
	if (!value || typeof value !== 'object' || !('type' in value)) {
		throw new Error('missingStoryResourceType');
	}
	const type = (value as { readonly type?: unknown }).type;
	if (typeof type !== 'string' || !storyResourceTypes.includes(type as StoryResourceType)) {
		throw new Error('invalidStoryResourceType');
	}
	return type as StoryResourceType;
}

function toStorageError(error: unknown): Error {
	const code = typeof error === 'string'
		? error
		: error instanceof Error
			? error.message
			: 'storyStorageFailed';
	if (code.startsWith('storyRevisionConflict')) {
		const actual = Number(code.split(':')[1]);
		return new StoryRevisionConflictError(Number.isSafeInteger(actual) ? actual : undefined);
	}
	const publicCode = code.split(':')[0];
	const knownCodes = new Set([
		'storyResourceNotFound',
		'storyTrashNotFound',
		'storyReadFailed',
		'storyWriteFailed',
		'storyStorageFailed',
		'storyReadOnly'
	]);
	return new StoryStorageError(knownCodes.has(publicCode) ? publicCode : 'storyStorageFailed');
}

export class DesktopStoryRepository implements StoryRepository {
	constructor(
		private readonly projectRoot: string,
		private readonly gateway: StoryStorageGateway
	) {}

	async get<T extends StoryResource = StoryResource>(
		type: StoryResourceType,
		id: StoryId | string
	): Promise<T | undefined> {
		try {
			const value = await this.gateway.getStoryResource(this.projectRoot, type, id);
			return value === undefined ? undefined : StorySchemaRegistry.parse(type, value) as T;
		} catch (error) {
			throw toStorageError(error);
		}
	}

	async list<T extends StoryResource = StoryResource>(
		type: StoryResourceType
	): Promise<readonly T[]> {
		try {
			const values = await this.gateway.listStoryResources(this.projectRoot, type);
			return values.map(value => StorySchemaRegistry.parse(type, value) as T);
		} catch (error) {
			throw toStorageError(error);
		}
	}

	async save(resource: unknown, expectedRevision?: number): Promise<StoryResource> {
		const [saved] = await this.commit([{ resource, ...(expectedRevision === undefined ? {} : { expectedRevision }) }]);
		if (!saved) {
			throw new StoryStorageError('storyStorageFailed');
		}
		return saved;
	}

	async commit(entries: readonly StorySaveEntry[]): Promise<readonly StoryResource[]> {
		const validated = entries.map(entry => {
			const type = resourceType(entry.resource);
			return {
				resource: StorySchemaRegistry.parse(type, entry.resource),
				...(entry.expectedRevision === undefined ? {} : { expectedRevision: entry.expectedRevision })
			};
		});
		try {
			const saved = await this.gateway.saveStoryResources(this.projectRoot, validated);
			if (saved.length !== validated.length) {
				throw new Error('storyCommitCountMismatch');
			}
			return saved.map(value => StorySchemaRegistry.parse(resourceType(value), value));
		} catch (error) {
			throw toStorageError(error);
		}
	}

	async moveToTrash(type: StoryResourceType, id: StoryId | string): Promise<void> {
		try {
			await this.gateway.moveStoryResourceToTrash(this.projectRoot, type, id);
		} catch (error) {
			throw toStorageError(error);
		}
	}

	async restoreFromTrash(type: StoryResourceType, id: StoryId | string): Promise<StoryResource> {
		try {
			const value = await this.gateway.restoreStoryResourceFromTrash(this.projectRoot, type, id);
			return StorySchemaRegistry.parse(type, value);
		} catch (error) {
			throw toStorageError(error);
		}
	}
}
