import { z } from 'zod';
import type { StoryResourceType } from '../model/StoryResourceBase';

const storyIdPattern = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;

export const storyIdSchema = z.string().regex(storyIdPattern, 'invalidStoryId');

export const utcTimestampSchema = z.string().refine(value => {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}, 'invalidUtcTimestamp');

const resourcePrefixes: Record<StoryResourceType, string> = {
	chapter: 'chapter',
	scene: 'scene',
	character: 'character',
	location: 'location',
	faction: 'faction',
	item: 'item',
	worldRule: 'world-rule',
	timelineEvent: 'timeline-event',
	relationship: 'relationship',
	plotThread: 'plot-thread',
	foreshadowing: 'foreshadowing',
	information: 'information'
};

function idFor(type: StoryResourceType) {
	return z.string().regex(
		new RegExp(`^${resourcePrefixes[type]}:[a-z0-9][a-z0-9-]*$`),
		`invalid${type}Id`
	);
}

const baseShape = {
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)),
	summary: z.string().max(10_000).optional(),
	tags: z.array(z.string().trim().min(1).max(80)),
	schemaVersion: z.literal(1),
	createdAt: utcTimestampSchema,
	updatedAt: utcTimestampSchema,
	revision: z.number().int().min(0)
};

export const storyPositionSchema = z.object({
	chapterId: idFor('chapter'),
	sceneId: idFor('scene').optional(),
	narrativeOrder: z.number().int().min(0),
	storyTime: z.string().trim().min(1).optional()
}).strict();

export const textAnchorSchema = z.object({
	start: z.number().int().min(0),
	end: z.number().int().positive(),
	revision: z.number().int().min(0),
	quote: z.string().max(500)
}).strict().refine(anchor => anchor.end > anchor.start, {
	message: 'invalidTextAnchorRange'
});

const evidenceIds = z.array(z.string().regex(/^evidence:[a-z0-9][a-z0-9-]*$/));

const simpleResourceSchema = <T extends StoryResourceType>(type: T) => z.object({
	id: idFor(type),
	type: z.literal(type),
	...baseShape,
	evidenceIds: evidenceIds.optional().default([])
}).strict();

export const characterSchema = z.object({
	id: idFor('character'),
	type: z.literal('character'),
	...baseShape,
	role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
	pronouns: z.string().max(120).optional(),
	birth: z.string().max(120).optional(),
	appearance: z.string().max(10_000).optional(),
	occupation: z.string().max(500).optional(),
	factionIds: z.array(idFor('faction')).optional().default([]),
	goals: z.array(z.string().trim().min(1).max(1000)).optional().default([]),
	desires: z.array(z.string().trim().min(1).max(1000)).optional().default([]),
	fears: z.array(z.string().trim().min(1).max(1000)).optional().default([]),
	values: z.array(z.string().trim().min(1).max(1000)).optional().default([]),
	secrets: z.array(z.string().trim().min(1).max(5000)).optional().default([]),
	speechStyle: z.string().max(5000).optional(),
	evidenceIds
}).strict();

export const sceneSchema = z.object({
	id: idFor('scene'),
	type: z.literal('scene'),
	...baseShape,
	chapterId: idFor('chapter'),
	manuscriptRange: textAnchorSchema,
	narrativeOrder: z.number().int().min(0),
	storyStart: z.string().trim().min(1).optional(),
	storyEnd: z.string().trim().min(1).optional(),
	povCharacterId: idFor('character').optional(),
	locationIds: z.array(idFor('location')),
	participantIds: z.array(idFor('character')),
	goal: z.string().max(5000).optional(),
	conflict: z.string().max(5000).optional(),
	turn: z.string().max(5000).optional(),
	outcome: z.string().max(5000).optional(),
	plotThreadIds: z.array(idFor('plotThread')),
	revealInformationIds: z.array(idFor('information')),
	foreshadowingIds: z.array(idFor('foreshadowing')),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

export const relationshipSchema = z.object({
	id: idFor('relationship'),
	type: z.literal('relationship'),
	...baseShape,
	sourceCharacterId: idFor('character'),
	targetCharacterId: idFor('character'),
	relationshipType: z.string().trim().min(1).max(160),
	strength: z.number().min(0).max(1).optional(),
	visibility: z.enum(['public', 'private', 'secret']),
	description: z.string().max(10_000).optional(),
	effectiveFrom: storyPositionSchema,
	effectiveUntil: storyPositionSchema.optional(),
	evidenceIds
}).strict().refine(
	relationship => relationship.sourceCharacterId !== relationship.targetCharacterId,
	{ message: 'relationshipEndpointsMustDiffer' }
);

export const timelineEventSchema = z.object({
	id: idFor('timelineEvent'),
	type: z.literal('timelineEvent'),
	...baseShape,
	storyStart: z.string().trim().min(1).optional(),
	storyEnd: z.string().trim().min(1).optional(),
	narrativePosition: storyPositionSchema,
	eventType: z.string().trim().min(1).max(160),
	participantIds: z.array(idFor('character')),
	locationIds: z.array(idFor('location')),
	itemIds: z.array(idFor('item')),
	predecessorIds: z.array(idFor('timelineEvent')),
	consequenceIds: z.array(idFor('timelineEvent')),
	evidenceIds
}).strict();

export const itemSchema = z.object({
	id: idFor('item'),
	type: z.literal('item'),
	...baseShape,
	itemType: z.string().max(160).optional(),
	unique: z.boolean(),
	quantityUnit: z.string().max(160).optional(),
	description: z.string().max(10_000).optional(),
	restrictions: z.array(z.string().max(1000)),
	plotFunction: z.string().max(5000).optional(),
	evidenceIds
}).strict();

export const resourceSchemas = {
	chapter: simpleResourceSchema('chapter'),
	scene: sceneSchema,
	character: characterSchema,
	location: simpleResourceSchema('location'),
	faction: simpleResourceSchema('faction'),
	item: itemSchema,
	worldRule: simpleResourceSchema('worldRule'),
	timelineEvent: timelineEventSchema,
	relationship: relationshipSchema,
	plotThread: simpleResourceSchema('plotThread'),
	foreshadowing: simpleResourceSchema('foreshadowing'),
	information: simpleResourceSchema('information')
} as const;

export type StoryResource =
	| z.infer<typeof resourceSchemas.chapter>
	| z.infer<typeof resourceSchemas.scene>
	| z.infer<typeof resourceSchemas.character>
	| z.infer<typeof resourceSchemas.location>
	| z.infer<typeof resourceSchemas.faction>
	| z.infer<typeof resourceSchemas.item>
	| z.infer<typeof resourceSchemas.worldRule>
	| z.infer<typeof resourceSchemas.timelineEvent>
	| z.infer<typeof resourceSchemas.relationship>
	| z.infer<typeof resourceSchemas.plotThread>
	| z.infer<typeof resourceSchemas.foreshadowing>
	| z.infer<typeof resourceSchemas.information>;
