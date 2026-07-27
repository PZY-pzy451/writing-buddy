import { parseStoryId, type StoryId } from '../ids/StoryId';

export type MentionStatus = 'active' | 'stale';

export interface MentionTextAnchor {
	readonly start: number;
	readonly end: number;
	readonly revision: number;
	readonly quote: string;
	readonly before: string;
	readonly after: string;
}

export interface MentionLink {
	readonly id: StoryId;
	readonly resourceId: StoryId;
	readonly chapterId: StoryId;
	readonly sceneId?: StoryId;
	readonly anchor: MentionTextAnchor;
	readonly displayText: string;
	readonly status: MentionStatus;
	readonly revision: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface MentionSaveEntry {
	readonly mention: unknown;
	readonly expectedRevision?: number;
}

export interface MentionStorageGateway {
	listMentionLinks(projectRoot: string): Promise<readonly unknown[]>;
	saveMentionLinks(
		projectRoot: string,
		entries: readonly MentionSaveEntry[]
	): Promise<readonly unknown[]>;
}

const mentionableResourcePrefixes = new Set([
	'chapter',
	'scene',
	'character',
	'location',
	'faction',
	'item',
	'world-rule',
	'timeline-event',
	'relationship',
	'plot-thread',
	'foreshadowing',
	'information'
]);

function isCanonicalUtcTimestamp(value: string): boolean {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

export function parseMentionLink(value: unknown): MentionLink {
	if (!value || typeof value !== 'object') {
		throw new Error('invalidMention');
	}
	const mention = value as {
		readonly id?: unknown;
		readonly resourceId?: unknown;
		readonly chapterId?: unknown;
		readonly sceneId?: unknown;
		readonly anchor?: {
			readonly start?: unknown;
			readonly end?: unknown;
			readonly revision?: unknown;
			readonly quote?: unknown;
			readonly before?: unknown;
			readonly after?: unknown;
		};
		readonly displayText?: unknown;
		readonly status?: unknown;
		readonly revision?: unknown;
		readonly createdAt?: unknown;
		readonly updatedAt?: unknown;
	};
	if (typeof mention.id !== 'string' || !mention.id.startsWith('mention:')) {
		throw new Error('invalidMentionId');
	}
	if (typeof mention.resourceId !== 'string'
		|| !mentionableResourcePrefixes.has(mention.resourceId.split(':')[0] ?? '')
		|| typeof mention.chapterId !== 'string'
		|| !mention.chapterId.startsWith('chapter:')
		|| (mention.sceneId !== undefined && (
			typeof mention.sceneId !== 'string' || !mention.sceneId.startsWith('scene:')
		))) {
		throw new Error('invalidMentionResource');
	}
	const anchor = mention.anchor;
	if (!anchor
		|| typeof anchor.start !== 'number'
		|| typeof anchor.end !== 'number'
		|| typeof anchor.revision !== 'number'
		|| typeof anchor.quote !== 'string'
		|| typeof anchor.before !== 'string'
		|| typeof anchor.after !== 'string'
		|| !Number.isSafeInteger(anchor.start)
		|| !Number.isSafeInteger(anchor.end)
		|| !Number.isSafeInteger(anchor.revision)
		|| anchor.start < 0
		|| anchor.end <= anchor.start
		|| anchor.revision < 0
		|| anchor.quote.length === 0
		|| anchor.quote.length > 500
		|| anchor.before.length > 64
		|| anchor.after.length > 64) {
		throw new Error('invalidMentionAnchor');
	}
	if (typeof mention.displayText !== 'string'
		|| mention.displayText.length === 0
		|| mention.displayText.length > 500
		|| (mention.status !== 'active' && mention.status !== 'stale')
		|| typeof mention.revision !== 'number'
		|| !Number.isSafeInteger(mention.revision)
		|| mention.revision < 0
		|| typeof mention.createdAt !== 'string'
		|| typeof mention.updatedAt !== 'string'
		|| !isCanonicalUtcTimestamp(mention.createdAt)
		|| !isCanonicalUtcTimestamp(mention.updatedAt)) {
		throw new Error('invalidMention');
	}
	return {
		id: parseStoryId(mention.id),
		resourceId: parseStoryId(mention.resourceId),
		chapterId: parseStoryId(mention.chapterId),
		...(typeof mention.sceneId === 'string' ? { sceneId: parseStoryId(mention.sceneId) } : {}),
		anchor: {
			start: anchor.start,
			end: anchor.end,
			revision: anchor.revision,
			quote: anchor.quote,
			before: anchor.before,
			after: anchor.after
		},
		displayText: mention.displayText,
		status: mention.status,
		revision: mention.revision,
		createdAt: mention.createdAt,
		updatedAt: mention.updatedAt
	};
}
