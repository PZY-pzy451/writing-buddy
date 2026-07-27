import { parseStoryId, type StoryId } from '../ids/StoryId';

export const storyResourceTypes = [
	'chapter',
	'scene',
	'character',
	'location',
	'faction',
	'item',
	'worldRule',
	'timelineEvent',
	'relationship',
	'plotThread',
	'foreshadowing',
	'information'
] as const;

export type StoryResourceType = typeof storyResourceTypes[number];

export interface StoryResourceBase {
	readonly id: StoryId;
	readonly type: StoryResourceType;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly summary?: string;
	readonly tags: readonly string[];
	readonly schemaVersion: 1;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly revision: number;
}

function isCanonicalUtcTimestamp(value: string): boolean {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

export function parseStoryResourceBase(value: {
	readonly id: string;
	readonly type: StoryResourceType;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly summary?: string;
	readonly tags: readonly string[];
	readonly schemaVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly revision: number;
}): StoryResourceBase {
	if (!storyResourceTypes.includes(value.type)) {
		throw new Error('invalidStoryResourceType');
	}
	if (value.title.trim().length === 0) {
		throw new Error('invalidStoryResourceTitle');
	}
	if (value.schemaVersion !== 1) {
		throw new Error('unsupportedStorySchema');
	}
	if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
		throw new Error('invalidRevision');
	}
	if (!isCanonicalUtcTimestamp(value.createdAt) || !isCanonicalUtcTimestamp(value.updatedAt)) {
		throw new Error('invalidUtcTimestamp');
	}
	return {
		id: parseStoryId(value.id),
		type: value.type,
		title: value.title.trim(),
		aliases: [...value.aliases],
		...(value.summary ? { summary: value.summary } : {}),
		tags: [...value.tags],
		schemaVersion: 1,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		revision: value.revision
	};
}
