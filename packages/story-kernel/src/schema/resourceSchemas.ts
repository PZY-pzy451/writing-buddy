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
	emotionBeats: z.array(z.object({
		label: z.string().trim().min(1).max(160),
		emotion: z.string().trim().min(1).max(160),
		intensity: z.number().min(0).max(1)
	}).strict()).max(24).optional(),
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
	evidenceIds,
	history: z.array(z.object({
		effectiveFrom: storyPositionSchema,
		relationshipType: z.string().trim().min(1).max(160),
		strength: z.number().min(0).max(1).optional(),
		visibility: z.enum(['public', 'private', 'secret']),
		evidenceIds
	}).strict()).optional().default([])
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
	storyTimeKind: z.enum(['exact', 'date', 'relative', 'range', 'unknown']).optional(),
	relativeTime: z.object({
		anchorEventId: idFor('timelineEvent'),
		offsetMinutes: z.number().finite()
	}).strict().optional(),
	uncertainRange: z.object({
		earliest: z.string().trim().min(1).optional(),
		latest: z.string().trim().min(1).optional()
	}).strict().optional(),
	narrativePosition: storyPositionSchema,
	eventType: z.string().trim().min(1).max(160),
	participantIds: z.array(idFor('character')),
	locationIds: z.array(idFor('location')),
	itemIds: z.array(idFor('item')),
	predecessorIds: z.array(idFor('timelineEvent')),
	consequenceIds: z.array(idFor('timelineEvent')),
	directResults: z.array(z.string().trim().min(1).max(2_000)).optional().default([]),
	impacts: z.array(z.string().trim().min(1).max(2_000)).optional().default([]),
	plotThreadIds: z.array(idFor('plotThread')).optional().default([]),
	foreshadowingIds: z.array(idFor('foreshadowing')).optional().default([]),
	informationIds: z.array(idFor('information')).optional().default([]),
	evidenceIds
}).strict();

const locationSchema = z.object({
	id: idFor('location'),
	type: z.literal('location'),
	...baseShape,
	parentLocationId: idFor('location').optional(),
	locationType: z.string().trim().min(1).max(160).optional(),
	mapPoint: z.object({
		x: z.number().min(0).max(100),
		y: z.number().min(0).max(100)
	}).strict().optional(),
	travelLinks: z.array(z.object({
		targetLocationId: idFor('location'),
		minimumMinutes: z.number().positive(),
		mode: z.string().trim().min(1).max(160).optional()
	}).strict()).optional().default([]),
	factionIds: z.array(idFor('faction')).optional().default([]),
	rules: z.array(z.string().trim().min(1).max(2000)).optional().default([]),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

const factionSchema = z.object({
	id: idFor('faction'),
	type: z.literal('faction'),
	...baseShape,
	ideology: z.string().max(5000).optional(),
	goals: z.array(z.string().trim().min(1).max(1000)).optional().default([]),
	allyFactionIds: z.array(idFor('faction')).optional().default([]),
	enemyFactionIds: z.array(idFor('faction')).optional().default([]),
	territoryLocationIds: z.array(idFor('location')).optional().default([]),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

const worldRuleSchema = z.object({
	id: idFor('worldRule'),
	type: z.literal('worldRule'),
	...baseShape,
	category: z.enum(['culture', 'religion', 'technology', 'magic', 'law', 'other']).optional().default('other'),
	statement: z.string().trim().min(1).max(10_000).optional(),
	scope: z.string().trim().min(1).max(2_000).optional(),
	exceptions: z.array(z.string().trim().min(1).max(2000)).optional().default([]),
	consequences: z.array(z.string().trim().min(1).max(2000)).optional().default([]),
	effectiveFrom: storyPositionSchema.optional(),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

const plotThreadSchema = z.object({
	id: idFor('plotThread'),
	type: z.literal('plotThread'),
	...baseShape,
	status: z.enum(['planned', 'active', 'at-risk', 'resolved', 'abandoned']).optional().default('planned'),
	premise: z.string().max(10_000).optional(),
	stakes: z.string().max(5000).optional(),
	dramaticQuestion: z.string().max(5000).optional(),
	startPosition: storyPositionSchema.optional(),
	targetResolution: storyPositionSchema.optional(),
	actualResolution: storyPositionSchema.optional(),
	participantIds: z.array(idFor('character')).optional().default([]),
	sceneIds: z.array(idFor('scene')).optional().default([]),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

const foreshadowingSchema = z.object({
	id: idFor('foreshadowing'),
	type: z.literal('foreshadowing'),
	...baseShape,
	status: z.enum(['planted', 'reminded', 'resolved', 'overdue', 'abandoned']).optional().default('planted'),
	plantedAt: storyPositionSchema.optional(),
	surfaceMeaning: z.string().max(5000).optional(),
	trueMeaning: z.string().max(5000).optional(),
	reminderPositions: z.array(storyPositionSchema).optional().default([]),
	plannedPayoffAt: storyPositionSchema.optional(),
	actualPayoffAt: storyPositionSchema.optional(),
	readerVisibility: z.number().min(0).max(1).optional().default(0),
	plotThreadIds: z.array(idFor('plotThread')).optional().default([]),
	evidenceIds: evidenceIds.optional().default([])
}).strict();

const informationSchema = z.object({
	id: idFor('information'),
	type: z.literal('information'),
	...baseShape,
	truthStatement: z.string().trim().min(1).max(10_000),
	truthStatus: z.enum(['confirmed', 'disputed', 'unknown']).optional().default('unknown'),
	authorSecret: z.boolean().optional().default(false),
	excludeFromAiByDefault: z.boolean().optional(),
	truthEffectiveFrom: storyPositionSchema.optional(),
	readerRevealAt: storyPositionSchema.optional(),
	evidenceIds: evidenceIds.optional().default([])
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
	location: locationSchema,
	faction: factionSchema,
	item: itemSchema,
	worldRule: worldRuleSchema,
	timelineEvent: timelineEventSchema,
	relationship: relationshipSchema,
	plotThread: plotThreadSchema,
	foreshadowing: foreshadowingSchema,
	information: informationSchema
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
