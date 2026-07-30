export const creationStartRoutes = [
	'genre',
	'ideas',
	'synopsis',
	'character-world',
	'outline',
	'manuscript',
	'blank'
] as const;

export const creationJourneyStages = [
	'elements',
	'core',
	'directions',
	'outline',
	'chapters',
	'writing'
] as const;

export type CreationStartRoute = typeof creationStartRoutes[number];
export type CreationJourneyStage = typeof creationJourneyStages[number];

export interface StoryElement {
	readonly id: string;
	readonly category: 'character' | 'place' | 'object' | 'event' | 'mood' | 'theme' | 'question' | 'other';
	readonly text: string;
	readonly locked: boolean;
}

export interface StoryCore {
	readonly oneSentence: string;
	readonly protagonist: string;
	readonly goal: string;
	readonly obstacle: string;
	readonly stakes: string;
	readonly mystery: string;
	readonly readerExperience: string;
	readonly endingDirection: string;
	readonly confirmedAt?: string;
}

export interface StoryDirection {
	readonly id: string;
	readonly title: string;
	readonly premise: string;
	readonly centralConflict: string;
	readonly endingPromise: string;
	readonly tone: string;
}

export type StoryScale = 'short' | 'novella' | 'novel' | 'serial';
export type EndingPreference =
	| 'open'
	| 'hopeful'
	| 'tragic'
	| 'bittersweet'
	| 'surprising'
	| 'unspecified';
export type GenreControlMode = 'quick' | 'deep';

export interface GenreToOutlineInput {
	readonly projectId: string;
	readonly genre: string;
	readonly premise?: string;
	readonly mode: GenreControlMode;
	readonly scale?: StoryScale;
	readonly tones: readonly string[];
	readonly protagonistHints: readonly string[];
	readonly requiredElements: readonly string[];
	readonly excludedElements: readonly string[];
	readonly endingPreference?: EndingPreference;
	readonly audience?: string;
	readonly structureTemplateId?: string;
}

export interface StoryOutline {
	readonly id: string;
	readonly projectId: string;
	readonly title?: string;
	readonly genre: string;
	readonly premise: string;
	readonly themePromise?: string;
	readonly protagonistGoal?: string;
	readonly centralConflict?: string;
	readonly stakes?: string;
	readonly mysteryQuestion?: string;
	readonly endingDirection?: string;
	readonly structureTemplateId?: string;
	readonly status: 'draft' | 'confirmed' | 'needs_review';
	readonly revision: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export type OutlineNodeType = 'story_beat' | 'volume' | 'chapter' | 'scene';

export interface StoryOutlineNode {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly purpose: string;
	readonly type?: OutlineNodeType;
	readonly parentId?: string;
	readonly order?: number;
	readonly goal?: string;
	readonly conflict?: string;
	readonly outcome?: string;
	readonly hook?: string;
	readonly povHint?: string;
	readonly povCharacterId?: string;
	readonly locationId?: string;
	readonly characterIds?: readonly string[];
	readonly plotThreadIds?: readonly string[];
	readonly foreshadowingIds?: readonly string[];
	readonly status?: 'planned' | 'ready_to_write' | 'drafting' | 'drafted' | 'revising' | 'complete';
	readonly source?: 'manual' | 'ai_generated' | 'ai_revised' | 'extracted_from_draft';
	readonly revision?: number;
}

export interface SuggestedStoryResource {
	readonly title: string;
	readonly summary: string;
	readonly role?: string;
	readonly category?: string;
}

export interface OutlineGenerationWarning {
	readonly code: string;
	readonly message: string;
	readonly nodeIndexes: readonly number[];
}

export interface GenreOutlineGenerationRecord {
	readonly suggestedCharacters: readonly SuggestedStoryResource[];
	readonly suggestedWorldRules: readonly SuggestedStoryResource[];
	readonly warnings: readonly OutlineGenerationWarning[];
	readonly generatedAt: string;
}

export interface GeneratedGenreOutline {
	readonly outline: Omit<
		StoryOutline,
		'id' | 'projectId' | 'status' | 'revision' | 'createdAt' | 'updatedAt'
	>;
	readonly storyBeats: readonly Pick<
		StoryOutlineNode,
		'title' | 'summary' | 'goal' | 'conflict' | 'outcome' | 'hook' | 'povHint'
	>[];
	readonly suggestedCharacters: readonly SuggestedStoryResource[];
	readonly suggestedWorldRules: readonly SuggestedStoryResource[];
	readonly warnings: readonly OutlineGenerationWarning[];
}

export interface JourneyChapterProposal {
	readonly id: string;
	readonly title: string;
	readonly goal: string;
	readonly summary: string;
	readonly sourceNodeIds: readonly string[];
	readonly resourceId?: string;
}

export const storyCoreFields = [
	'oneSentence',
	'protagonist',
	'goal',
	'obstacle',
	'stakes',
	'mystery',
	'readerExperience',
	'endingDirection'
] as const;

export type StoryCoreField = typeof storyCoreFields[number];
export type JourneyImpactTargetKind = 'direction' | 'outline' | 'chapter';
export type JourneyImpactSourceKind = 'element' | 'core' | 'direction-selection' | 'direction' | 'outline';

export interface CreationGuidanceOption {
	readonly id: string;
	readonly label: string;
	readonly description: string;
}

export interface CreationGuidanceQuestion {
	readonly id: string;
	readonly stage: CreationJourneyStage;
	readonly prompt: string;
	readonly rationale: string;
	readonly options: readonly [
		CreationGuidanceOption,
		CreationGuidanceOption,
		CreationGuidanceOption
	];
}

export interface CreationGuidanceAnswer {
	readonly questionId: string;
	readonly stage: CreationJourneyStage;
	readonly source: 'option' | 'custom';
	readonly answerText: string;
	readonly answeredAt: string;
}

export interface CreationJourneyGuidance {
	readonly currentQuestion?: CreationGuidanceQuestion;
	readonly answers: readonly CreationGuidanceAnswer[];
}

export interface CreationJourneyLocks {
	readonly coreFields: readonly StoryCoreField[];
	readonly directionIds: readonly string[];
	readonly outlineNodeIds: readonly string[];
	readonly chapterIds: readonly string[];
}

export interface JourneyImpact {
	readonly id: string;
	readonly sourceKind: JourneyImpactSourceKind;
	readonly sourceId?: string;
	readonly targetKind: JourneyImpactTargetKind;
	readonly targetId: string;
	readonly reason: string;
	readonly status: 'pending' | 'kept' | 'updated';
	readonly createdAt: string;
	readonly resolvedAt?: string;
}

export type JourneyLockTarget =
	| { readonly kind: 'core'; readonly field: StoryCoreField }
	| { readonly kind: 'direction'; readonly id: string }
	| { readonly kind: 'outline'; readonly id: string }
	| { readonly kind: 'chapter'; readonly id: string };

export interface CreationJourneyState {
	readonly schemaVersion: 2;
	readonly revision: number;
	readonly projectId: string;
	readonly startRoute: CreationStartRoute;
	readonly stage: CreationJourneyStage;
	readonly genreInput?: GenreToOutlineInput;
	readonly storyOutline?: StoryOutline;
	readonly genreGeneration?: GenreOutlineGenerationRecord;
	readonly elements: readonly StoryElement[];
	readonly core: StoryCore;
	readonly directions: readonly StoryDirection[];
	readonly selectedDirectionIds: readonly string[];
	readonly outline: readonly StoryOutlineNode[];
	readonly chapters: readonly JourneyChapterProposal[];
	readonly guidance: CreationJourneyGuidance;
	readonly locks: CreationJourneyLocks;
	readonly impacts: readonly JourneyImpact[];
	readonly stale: {
		readonly directions: boolean;
		readonly outline: boolean;
		readonly chapters: boolean;
	};
	readonly createdAt: string;
	readonly updatedAt: string;
}

const utcTimestamp = z.string().refine(value => {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
});

const elementIdSchema = z.string().regex(/^journey-element:[a-z0-9][a-z0-9-]*$/u);
const directionIdSchema = z.string().regex(/^journey-direction:[a-z0-9][a-z0-9-]*$/u);
const outlineIdSchema = z.string().regex(/^journey-outline:[a-z0-9][a-z0-9-]*$/u);
const storyOutlineIdSchema = z.string().regex(/^journey-story-outline:[a-z0-9][a-z0-9-]*$/u);
const chapterProposalIdSchema = z.string().regex(/^journey-chapter:[a-z0-9][a-z0-9-]*$/u);
const guidanceQuestionIdSchema = z.string().regex(/^journey-question:[a-z0-9][a-z0-9-]*$/u);
const guidanceOptionIdSchema = z.string().regex(/^journey-option:[a-z0-9][a-z0-9-]*$/u);
const impactIdSchema = z.string().regex(/^journey-impact:[a-z0-9][a-z0-9-]*$/u);

const storyElementSchema = z.object({
	id: elementIdSchema,
	category: z.enum([
		'character',
		'place',
		'object',
		'event',
		'mood',
		'theme',
		'question',
		'other'
	]),
	text: z.string().max(500),
	locked: z.boolean()
}).strict();

const storyCoreSchema = z.object({
	oneSentence: z.string().max(2_000),
	protagonist: z.string().max(1_000),
	goal: z.string().max(1_000),
	obstacle: z.string().max(1_000),
	stakes: z.string().max(1_000),
	mystery: z.string().max(1_000),
	readerExperience: z.string().max(1_000),
	endingDirection: z.string().max(1_000),
	confirmedAt: utcTimestamp.optional()
}).strict();

const storyDirectionSchema = z.object({
	id: directionIdSchema,
	title: z.string().max(120),
	premise: z.string().max(2_000),
	centralConflict: z.string().max(2_000),
	endingPromise: z.string().max(2_000),
	tone: z.string().max(500)
}).strict();

const boundedStringListSchema = z.array(
	z.string().trim().min(1).max(240)
).max(12).refine(values => new Set(values).size === values.length);

const genreToOutlineInputSchema = z.object({
	projectId: z.string().trim().min(1).max(240),
	genre: z.string().trim().max(240),
	premise: z.string().trim().max(2_000).optional(),
	mode: z.enum(['quick', 'deep']),
	scale: z.enum(['short', 'novella', 'novel', 'serial']).optional(),
	tones: boundedStringListSchema,
	protagonistHints: boundedStringListSchema,
	requiredElements: boundedStringListSchema,
	excludedElements: boundedStringListSchema,
	endingPreference: z.enum([
		'open',
		'hopeful',
		'tragic',
		'bittersweet',
		'surprising',
		'unspecified'
	]).optional(),
	audience: z.string().trim().max(500).optional(),
	structureTemplateId: z.string().trim().min(1).max(120).optional()
}).strict();

const storyOutlineSchema = z.object({
	id: storyOutlineIdSchema,
	projectId: z.string().trim().min(1).max(240),
	title: z.string().trim().min(1).max(160).optional(),
	genre: z.string().trim().min(1).max(240),
	premise: z.string().max(2_000),
	themePromise: z.string().trim().min(1).max(2_000).optional(),
	protagonistGoal: z.string().trim().min(1).max(2_000).optional(),
	centralConflict: z.string().trim().min(1).max(2_000).optional(),
	stakes: z.string().trim().min(1).max(2_000).optional(),
	mysteryQuestion: z.string().trim().min(1).max(2_000).optional(),
	endingDirection: z.string().trim().min(1).max(2_000).optional(),
	structureTemplateId: z.string().trim().min(1).max(120).optional(),
	status: z.enum(['draft', 'confirmed', 'needs_review']),
	revision: z.number().int().min(1),
	createdAt: utcTimestamp,
	updatedAt: utcTimestamp
}).strict();

const storyOutlineNodeSchema = z.object({
	id: outlineIdSchema,
	title: z.string().max(120),
	summary: z.string().max(3_000),
	purpose: z.string().max(1_000),
	type: z.enum(['story_beat', 'volume', 'chapter', 'scene']).optional(),
	parentId: z.string().trim().min(1).max(240).optional(),
	order: z.number().int().min(0).optional(),
	goal: z.string().max(1_000).optional(),
	conflict: z.string().max(2_000).optional(),
	outcome: z.string().max(2_000).optional(),
	hook: z.string().max(2_000).optional(),
	povHint: z.string().max(500).optional(),
	povCharacterId: z.string().trim().min(1).max(240).optional(),
	locationId: z.string().trim().min(1).max(240).optional(),
	characterIds: z.array(z.string().trim().min(1).max(240)).max(100).optional(),
	plotThreadIds: z.array(z.string().trim().min(1).max(240)).max(100).optional(),
	foreshadowingIds: z.array(z.string().trim().min(1).max(240)).max(100).optional(),
	status: z.enum([
		'planned',
		'ready_to_write',
		'drafting',
		'drafted',
		'revising',
		'complete'
	]).optional(),
	source: z.enum([
		'manual',
		'ai_generated',
		'ai_revised',
		'extracted_from_draft'
	]).optional(),
	revision: z.number().int().min(1).optional()
}).strict();

const suggestedStoryResourceSchema = z.object({
	title: z.string().trim().min(1).max(160),
	summary: z.string().trim().min(1).max(2_000),
	role: z.string().trim().min(1).max(160).optional(),
	category: z.string().trim().min(1).max(160).optional()
}).strict();

const outlineGenerationWarningSchema = z.object({
	code: z.string().regex(/^[a-z][a-z0-9-]*$/u),
	message: z.string().trim().min(1).max(1_000),
	nodeIndexes: z.array(z.number().int().min(0).max(7)).max(8)
		.refine(indexes => new Set(indexes).size === indexes.length)
}).strict();

const genreOutlineGenerationRecordSchema = z.object({
	suggestedCharacters: z.array(suggestedStoryResourceSchema).max(12),
	suggestedWorldRules: z.array(suggestedStoryResourceSchema).max(12),
	warnings: z.array(outlineGenerationWarningSchema).max(24),
	generatedAt: utcTimestamp
}).strict();

const generatedGenreOutlineSchema = z.object({
	outline: storyOutlineSchema.omit({
		id: true,
		projectId: true,
		status: true,
		revision: true,
		createdAt: true,
		updatedAt: true
	}),
	storyBeats: z.array(z.object({
		title: z.string().trim().min(1).max(120),
		summary: z.string().trim().min(1).max(3_000),
		goal: z.string().max(1_000).optional(),
		conflict: z.string().max(2_000).optional(),
		outcome: z.string().max(2_000).optional(),
		hook: z.string().max(2_000).optional(),
		povHint: z.string().max(500).optional()
	}).strict()).min(5).max(8),
	suggestedCharacters: z.array(suggestedStoryResourceSchema).max(12),
	suggestedWorldRules: z.array(suggestedStoryResourceSchema).max(12),
	warnings: z.array(outlineGenerationWarningSchema).max(24)
}).strict();

const journeyChapterProposalSchema = z.object({
	id: chapterProposalIdSchema,
	title: z.string().max(120),
	goal: z.string().max(1_000),
	summary: z.string().max(3_000),
	sourceNodeIds: z.array(outlineIdSchema).min(1).max(8)
		.refine(ids => new Set(ids).size === ids.length),
	resourceId: z.string().regex(/^chapter(?::|-)[a-z0-9][a-z0-9-]*$/u).optional()
}).strict();

const creationGuidanceOptionSchema = z.object({
	id: guidanceOptionIdSchema,
	label: z.string().trim().min(1).max(120),
	description: z.string().trim().min(1).max(500)
}).strict();

const creationGuidanceQuestionSchema = z.object({
	id: guidanceQuestionIdSchema,
	stage: z.enum(creationJourneyStages),
	prompt: z.string().trim().min(1).max(500),
	rationale: z.string().trim().min(1).max(500),
	options: z.tuple([
		creationGuidanceOptionSchema,
		creationGuidanceOptionSchema,
		creationGuidanceOptionSchema
	])
}).strict().superRefine((question, context) => {
	if (new Set(question.options.map(option => option.id)).size !== 3) {
		context.addIssue({ code: 'custom', message: 'duplicateCreationGuidanceOption' });
	}
});

const creationGuidanceAnswerSchema = z.object({
	questionId: guidanceQuestionIdSchema,
	stage: z.enum(creationJourneyStages),
	source: z.enum(['option', 'custom']),
	answerText: z.string().trim().min(1).max(1_000),
	answeredAt: utcTimestamp
}).strict();

const creationJourneyGuidanceSchema = z.object({
	currentQuestion: creationGuidanceQuestionSchema.optional(),
	answers: z.array(creationGuidanceAnswerSchema).max(100)
}).strict();

const creationJourneyLocksSchema = z.object({
	coreFields: z.array(z.enum(storyCoreFields))
		.refine(fields => new Set(fields).size === fields.length),
	directionIds: z.array(directionIdSchema)
		.refine(ids => new Set(ids).size === ids.length),
	outlineNodeIds: z.array(outlineIdSchema)
		.refine(ids => new Set(ids).size === ids.length),
	chapterIds: z.array(chapterProposalIdSchema)
		.refine(ids => new Set(ids).size === ids.length)
}).strict();

const journeyImpactSchema = z.object({
	id: impactIdSchema,
	sourceKind: z.enum(['element', 'core', 'direction-selection', 'direction', 'outline']),
	sourceId: z.string().trim().min(1).max(240).optional(),
	targetKind: z.enum(['direction', 'outline', 'chapter']),
	targetId: z.string().trim().min(1).max(240),
	reason: z.string().trim().min(1).max(500),
	status: z.enum(['pending', 'kept', 'updated']),
	createdAt: utcTimestamp,
	resolvedAt: utcTimestamp.optional()
}).strict().superRefine((impact, context) => {
	if (impact.status === 'pending' && impact.resolvedAt) {
		context.addIssue({ code: 'custom', message: 'pendingJourneyImpactResolved' });
	}
	if (impact.status !== 'pending' && !impact.resolvedAt) {
		context.addIssue({ code: 'custom', message: 'resolvedJourneyImpactMissingTime' });
	}
});

const creationJourneyStateSchema = z.object({
	schemaVersion: z.literal(2),
	revision: z.number().int().min(0),
	projectId: z.string().trim().min(1).max(240),
	startRoute: z.enum(creationStartRoutes),
	stage: z.enum(creationJourneyStages),
	genreInput: genreToOutlineInputSchema.optional(),
	storyOutline: storyOutlineSchema.optional(),
	genreGeneration: genreOutlineGenerationRecordSchema.optional(),
	elements: z.array(storyElementSchema).min(3).max(8),
	core: storyCoreSchema,
	directions: z.array(storyDirectionSchema)
		.refine(directions => directions.length === 0 || directions.length === 3),
	selectedDirectionIds: z.array(directionIdSchema).max(2)
		.refine(ids => new Set(ids).size === ids.length),
	outline: z.array(storyOutlineNodeSchema)
		.refine(nodes => nodes.length === 0 || (nodes.length >= 5 && nodes.length <= 8)),
	chapters: z.array(journeyChapterProposalSchema)
		.refine(chapters => chapters.length === 0 || chapters.length === 3),
	guidance: creationJourneyGuidanceSchema,
	locks: creationJourneyLocksSchema,
	impacts: z.array(journeyImpactSchema).max(500),
	stale: z.object({
		directions: z.boolean(),
		outline: z.boolean(),
		chapters: z.boolean()
	}).strict(),
	createdAt: utcTimestamp,
	updatedAt: utcTimestamp
}).strict().superRefine((state, context) => {
	const collections = [
		state.elements.map(item => item.id),
		state.directions.map(item => item.id),
		state.outline.map(item => item.id),
		state.chapters.map(item => item.id)
	];
	if (collections.some(ids => new Set(ids).size !== ids.length)) {
		context.addIssue({ code: 'custom', message: 'duplicateJourneyId' });
	}
	const directionIds = new Set(state.directions.map(direction => direction.id));
	if (
		state.genreInput?.projectId !== undefined
		&& state.genreInput.projectId !== state.projectId
	) {
		context.addIssue({ code: 'custom', message: 'foreignGenreInput' });
	}
	if (
		state.storyOutline?.projectId !== undefined
		&& state.storyOutline.projectId !== state.projectId
	) {
		context.addIssue({ code: 'custom', message: 'foreignStoryOutline' });
	}
	if (state.startRoute === 'genre' && !state.genreInput) {
		context.addIssue({ code: 'custom', message: 'missingGenreInput' });
	}
	if (
		state.storyOutline
		&& state.outline.some((node, index) => (
			node.type === 'story_beat' && node.order !== undefined && node.order !== index
		))
	) {
		context.addIssue({ code: 'custom', message: 'invalidGenreOutlineOrder' });
	}
	if (state.selectedDirectionIds.some(id => !directionIds.has(id))) {
		context.addIssue({ code: 'custom', message: 'unknownJourneyDirection' });
	}
	const outlineIds = new Set(state.outline.map(node => node.id));
	const chapterIds = new Set(state.chapters.map(chapter => chapter.id));
	if (
		state.chapters.some(chapter => chapter.sourceNodeIds.some(id => !outlineIds.has(id)))
	) {
		context.addIssue({ code: 'custom', message: 'unknownJourneyOutlineNode' });
	}
	if (
		state.locks.directionIds.some(id => !directionIds.has(id))
		|| state.locks.outlineNodeIds.some(id => !outlineIds.has(id))
		|| state.locks.chapterIds.some(id => !chapterIds.has(id))
	) {
		context.addIssue({ code: 'custom', message: 'orphanJourneyLock' });
	}
	if (new Set(state.impacts.map(impact => impact.id)).size !== state.impacts.length) {
		context.addIssue({ code: 'custom', message: 'duplicateJourneyImpactId' });
	}
	const pendingTargets = new Set<string>();
	for (const impact of state.impacts) {
		const knownTarget = (
			(impact.targetKind === 'direction' && directionIds.has(impact.targetId))
			|| (impact.targetKind === 'outline' && outlineIds.has(impact.targetId))
			|| (impact.targetKind === 'chapter' && chapterIds.has(impact.targetId))
		);
		if (impact.status === 'pending' && !knownTarget) {
			context.addIssue({ code: 'custom', message: 'orphanJourneyImpact' });
		}
		if (impact.status === 'pending') {
			const key = `${impact.targetKind}:${impact.targetId}`;
			if (pendingTargets.has(key)) {
				context.addIssue({ code: 'custom', message: 'duplicatePendingJourneyImpact' });
			}
			pendingTargets.add(key);
		}
	}
	const expectedStale = {
		directions: [...pendingTargets].some(key => key.startsWith('direction:')),
		outline: [...pendingTargets].some(key => key.startsWith('outline:')),
		chapters: [...pendingTargets].some(key => key.startsWith('chapter:'))
	};
	if (
		state.stale.directions !== expectedStale.directions
		|| state.stale.outline !== expectedStale.outline
		|| state.stale.chapters !== expectedStale.chapters
	) {
		context.addIssue({ code: 'custom', message: 'journeyStaleImpactMismatch' });
	}
	const materializedCount = state.chapters.filter(chapter => chapter.resourceId).length;
	if (materializedCount !== 0 && materializedCount !== 3) {
		context.addIssue({ code: 'custom', message: 'partialJourneyMaterialization' });
	}
	if (state.stage === 'writing' && materializedCount !== 3) {
		context.addIssue({ code: 'custom', message: 'journeyWritingWithoutChapters' });
	}
});

function defaultId(
	prefix:
		| 'journey-element'
		| 'journey-direction'
		| 'journey-story-outline'
		| 'journey-outline'
		| 'journey-chapter'
		| 'journey-impact'
): string {
	return `${prefix}:${globalThis.crypto.randomUUID()}`;
}

function emptyCore(): StoryCore {
	return {
		oneSentence: '',
		protagonist: '',
		goal: '',
		obstacle: '',
		stakes: '',
		mystery: '',
		readerExperience: '',
		endingDirection: ''
	};
}

function timestamp(now?: () => string): string {
	return (now ?? (() => new Date().toISOString()))();
}

function nextState(
	state: CreationJourneyState,
	patch: Partial<CreationJourneyState>,
	now?: () => string
): CreationJourneyState {
	return parseCreationJourneyState(JSON.stringify({
		...state,
		...patch,
		revision: state.revision + 1,
		updatedAt: timestamp(now)
	}));
}

function staleFromImpacts(impacts: readonly JourneyImpact[]): CreationJourneyState['stale'] {
	const pending = impacts.filter(impact => impact.status === 'pending');
	return {
		directions: pending.some(impact => impact.targetKind === 'direction'),
		outline: pending.some(impact => impact.targetKind === 'outline'),
		chapters: pending.some(impact => impact.targetKind === 'chapter')
	};
}

function targetsForKinds(
	state: CreationJourneyState,
	targetKinds: readonly JourneyImpactTargetKind[]
): readonly { readonly kind: JourneyImpactTargetKind; readonly id: string }[] {
	const kinds = new Set(targetKinds);
	return [
		...(kinds.has('direction')
			? state.directions.map(direction => ({ kind: 'direction' as const, id: direction.id }))
			: []),
		...(kinds.has('outline')
			? state.outline.map(node => ({ kind: 'outline' as const, id: node.id }))
			: []),
		...(kinds.has('chapter')
			? state.chapters.map(chapter => ({ kind: 'chapter' as const, id: chapter.id }))
			: [])
	];
}

function addPendingImpacts(
	state: CreationJourneyState,
	sourceKind: JourneyImpactSourceKind,
	sourceId: string | undefined,
	targetKinds: readonly JourneyImpactTargetKind[],
	now?: () => string,
	baseImpacts: readonly JourneyImpact[] = state.impacts
): Pick<CreationJourneyState, 'impacts' | 'stale'> {
	const createdAt = timestamp(now);
	const impacts = [...baseImpacts];
	for (const target of targetsForKinds(state, targetKinds)) {
		const existingIndex = impacts.findIndex(impact => (
			impact.status === 'pending'
			&& impact.targetKind === target.kind
			&& impact.targetId === target.id
		));
		const pending: JourneyImpact = {
			id: existingIndex >= 0
				? impacts[existingIndex].id
				: defaultId('journey-impact'),
			sourceKind,
			...(sourceId ? { sourceId } : {}),
			targetKind: target.kind,
			targetId: target.id,
			reason: `${sourceKind} changed and may affect this ${target.kind}`,
			status: 'pending',
			createdAt
		};
		if (existingIndex >= 0) {
			impacts[existingIndex] = pending;
		} else {
			impacts.push(pending);
		}
	}
	return {
		impacts,
		stale: staleFromImpacts(impacts)
	};
}

function resolveTargetImpacts(
	impacts: readonly JourneyImpact[],
	targetKind: JourneyImpactTargetKind,
	targetIds: readonly string[],
	status: 'kept' | 'updated',
	now?: () => string
): readonly JourneyImpact[] {
	const ids = new Set(targetIds);
	const resolvedAt = timestamp(now);
	return impacts.map(impact => (
		impact.status === 'pending'
		&& impact.targetKind === targetKind
		&& ids.has(impact.targetId)
			? { ...impact, status, resolvedAt }
			: impact
	));
}

function migrateLegacyCreationJourney(raw: unknown): unknown {
	if (
		typeof raw !== 'object'
		|| raw === null
		|| !('schemaVersion' in raw)
		|| raw.schemaVersion !== 1
	) {
		return raw;
	}
	const legacy = raw as Record<string, unknown>;
	const stale = typeof legacy.stale === 'object' && legacy.stale !== null
		? legacy.stale as Record<string, unknown>
		: {};
	const updatedAt = typeof legacy.updatedAt === 'string' ? legacy.updatedAt : '';
	const targetGroups: readonly [
		JourneyImpactTargetKind,
		unknown,
		unknown,
		JourneyImpactSourceKind
	][] = [
		['direction', legacy.directions, stale.directions, 'core'],
		['outline', legacy.outline, stale.outline, 'direction-selection'],
		['chapter', legacy.chapters, stale.chapters, 'outline']
	];
	let index = 0;
	const impacts: JourneyImpact[] = [];
	for (const [targetKind, items, isStale, sourceKind] of targetGroups) {
		if (!isStale || !Array.isArray(items)) {
			continue;
		}
		for (const item of items) {
			if (typeof item !== 'object' || item === null) {
				continue;
			}
			const itemId = (item as Record<string, unknown>).id;
			if (typeof itemId !== 'string') continue;
			index += 1;
			impacts.push({
				id: `journey-impact:migrated-${index}`,
				sourceKind,
				targetKind,
				targetId: itemId,
				reason: `Migrated version-1 ${targetKind} impact`,
				status: 'pending',
				createdAt: updatedAt
			});
		}
	}
	return {
		...legacy,
		schemaVersion: 2,
		guidance: { answers: [] },
		locks: {
			coreFields: [],
			directionIds: [],
			outlineNodeIds: [],
			chapterIds: []
		},
		impacts,
		stale: staleFromImpacts(impacts)
	};
}

function hasCompleteElements(state: CreationJourneyState): boolean {
	return state.elements.every(element => element.text.trim().length > 0);
}

function hasCompleteCore(core: StoryCore): boolean {
	return [
		core.oneSentence,
		core.protagonist,
		core.goal,
		core.obstacle,
		core.stakes,
		core.mystery,
		core.readerExperience,
		core.endingDirection
	].every(value => value.trim().length > 0);
}

function hasCompleteDirection(direction: StoryDirection): boolean {
	return [
		direction.title,
		direction.premise,
		direction.centralConflict,
		direction.endingPromise,
		direction.tone
	].every(value => value.trim().length > 0);
}

function hasCompleteOutlineNode(node: StoryOutlineNode): boolean {
	return [node.title, node.summary, node.purpose]
		.every(value => value.trim().length > 0);
}

function hasCompleteChapter(chapter: JourneyChapterProposal): boolean {
	return [chapter.title, chapter.goal, chapter.summary]
		.every(value => value.trim().length > 0);
}

export function createCreationJourneyState(
	projectId: string,
	dependencies: {
		readonly id?: () => string;
		readonly now?: () => string;
		readonly startRoute?: CreationStartRoute;
	} = {}
): CreationJourneyState {
	const createdAt = timestamp(dependencies.now);
	const createId = dependencies.id ?? (() => defaultId('journey-element'));
	const startRoute = dependencies.startRoute ?? 'ideas';
	return parseCreationJourneyState(JSON.stringify({
		schemaVersion: 2,
		revision: 0,
		projectId,
		startRoute,
		stage: startRoute === 'genre' ? 'outline' : 'elements',
		...(startRoute === 'genre' ? {
			genreInput: {
				projectId,
				genre: '',
				mode: 'quick',
				tones: [],
				protagonistHints: [],
				requiredElements: [],
				excludedElements: []
			}
		} : {}),
		elements: Array.from({ length: 3 }, () => ({
			id: createId(),
			category: 'other',
			text: '',
			locked: false
		})),
		core: emptyCore(),
		directions: [],
		selectedDirectionIds: [],
		outline: [],
		chapters: [],
		guidance: {
			answers: []
		},
		locks: {
			coreFields: [],
			directionIds: [],
			outlineNodeIds: [],
			chapterIds: []
		},
		impacts: [],
		stale: {
			directions: false,
			outline: false,
			chapters: false
		},
		createdAt,
		updatedAt: createdAt
	}));
}

export function updateGenreToOutlineInput(
	state: CreationJourneyState,
	patch: Partial<Omit<GenreToOutlineInput, 'projectId'>>,
	now?: () => string
): CreationJourneyState {
	const current = state.genreInput ?? {
		projectId: state.projectId,
		genre: '',
		mode: 'quick' as const,
		tones: [],
		protagonistHints: [],
		requiredElements: [],
		excludedElements: []
	};
	const parsed = genreToOutlineInputSchema.safeParse({
		...current,
		...patch,
		projectId: state.projectId
	});
	if (!parsed.success) {
		throw new Error('creationJourneyGenreInputInvalid');
	}
	return nextState(state, {
		startRoute: 'genre',
		stage: 'outline',
		genreInput: parsed.data
	}, now);
}

export function setGeneratedGenreOutline(
	state: CreationJourneyState,
	result: GeneratedGenreOutline,
	dependencies: {
		readonly id?: (
			prefix: 'journey-story-outline' | 'journey-outline'
		) => string;
		readonly now?: () => string;
	} = {}
): CreationJourneyState {
	if (!state.genreInput?.genre.trim()) {
		throw new Error('creationJourneyGenreRequired');
	}
	if (state.locks.outlineNodeIds.length > 0) {
		throw new Error('creationJourneyTargetLocked');
	}
	const parsed = generatedGenreOutlineSchema.safeParse(result);
	if (!parsed.success) {
		throw new Error('creationJourneyOutlineInvalid');
	}
	const createId = dependencies.id ?? (
		(prefix: 'journey-story-outline' | 'journey-outline') => defaultId(prefix)
	);
	const generatedAt = timestamp(dependencies.now);
	const createdAt = state.storyOutline?.createdAt ?? generatedAt;
	const storyOutline: StoryOutline = {
		id: state.storyOutline?.id ?? createId('journey-story-outline'),
		projectId: state.projectId,
		...parsed.data.outline,
		status: 'draft',
		revision: (state.storyOutline?.revision ?? 0) + 1,
		createdAt,
		updatedAt: generatedAt
	};
	const outline: StoryOutlineNode[] = parsed.data.storyBeats.map((node, order) => ({
		id: createId('journey-outline'),
		title: node.title,
		summary: node.summary,
		purpose: node.goal?.trim() || '推进故事结构',
		type: 'story_beat',
		order,
		...(node.goal !== undefined ? { goal: node.goal } : {}),
		...(node.conflict !== undefined ? { conflict: node.conflict } : {}),
		...(node.outcome !== undefined ? { outcome: node.outcome } : {}),
		...(node.hook !== undefined ? { hook: node.hook } : {}),
		...(node.povHint !== undefined ? { povHint: node.povHint } : {}),
		characterIds: [],
		plotThreadIds: [],
		foreshadowingIds: [],
		status: 'planned',
		source: 'ai_generated',
		revision: 1
	}));
	return nextState(state, {
		startRoute: 'genre',
		stage: 'outline',
		storyOutline,
		outline,
		chapters: [],
		genreGeneration: {
			suggestedCharacters: parsed.data.suggestedCharacters,
			suggestedWorldRules: parsed.data.suggestedWorldRules,
			warnings: parsed.data.warnings,
			generatedAt
		}
	}, dependencies.now);
}

export function parseCreationJourneyState(content: string): CreationJourneyState {
	try {
		const result = creationJourneyStateSchema.safeParse(
			migrateLegacyCreationJourney(JSON.parse(content))
		);
		if (!result.success) {
			throw new Error('creationJourneyStateInvalid');
		}
		return result.data;
	} catch (error) {
		if (error instanceof Error && error.message === 'creationJourneyStateInvalid') {
			throw error;
		}
		throw new Error('creationJourneyStateInvalid');
	}
}

export function serializeCreationJourneyState(state: CreationJourneyState): string {
	const parsed = parseCreationJourneyState(JSON.stringify(state));
	return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function updateStoryCore(
	state: CreationJourneyState,
	patch: Partial<Omit<StoryCore, 'confirmedAt'>>,
	now?: () => string
): CreationJourneyState {
	const changedFields = (Object.keys(patch) as StoryCoreField[])
		.filter(field => patch[field] !== state.core[field]);
	if (changedFields.some(field => state.locks.coreFields.includes(field))) {
		throw new Error('creationJourneyTargetLocked');
	}
	const core = {
		...state.core,
		...patch
	};
	delete core.confirmedAt;
	const impactPatch = changedFields.length > 0
		? addPendingImpacts(
			state,
			'core',
			changedFields.join(','),
			['direction', 'outline', 'chapter'],
			now
		)
		: { impacts: state.impacts, stale: state.stale };
	return nextState(state, {
		stage: 'core',
		core,
		...impactPatch
	}, now);
}

export function confirmStoryCore(
	state: CreationJourneyState,
	now?: () => string
): CreationJourneyState {
	if (!hasCompleteElements(state)) {
		throw new Error('creationJourneyElementsIncomplete');
	}
	if (!hasCompleteCore(state.core)) {
		throw new Error('creationJourneyCoreIncomplete');
	}
	return nextState(state, {
		core: {
			...state.core,
			confirmedAt: timestamp(now)
		}
	}, now);
}

export function selectStoryDirections(
	state: CreationJourneyState,
	directionIds: readonly string[],
	now?: () => string
): CreationJourneyState {
	const uniqueIds = [...new Set(directionIds)];
	const knownIds = new Set(state.directions.map(direction => direction.id));
	if (
		uniqueIds.length < 1
		|| uniqueIds.length > 2
		|| uniqueIds.length !== directionIds.length
		|| uniqueIds.some(id => !knownIds.has(id))
	) {
		throw new Error('creationJourneyDirectionSelectionInvalid');
	}
	const selectionChanged = (
		uniqueIds.length !== state.selectedDirectionIds.length
		|| uniqueIds.some((id, index) => id !== state.selectedDirectionIds[index])
	);
	const impactPatch = selectionChanged
		? addPendingImpacts(
			state,
			'direction-selection',
			undefined,
			['outline', 'chapter'],
			now
		)
		: { impacts: state.impacts, stale: state.stale };
	return nextState(state, {
		selectedDirectionIds: uniqueIds,
		...impactPatch
	}, now);
}

export function advanceCreationJourney(
	state: CreationJourneyState,
	stage: CreationJourneyStage,
	now?: () => string
): CreationJourneyState {
	if (stage === 'core' && !hasCompleteElements(state)) {
		throw new Error('creationJourneyElementsIncomplete');
	}
	if (stage === 'directions' && !state.core.confirmedAt) {
		throw new Error('creationJourneyCoreConfirmationRequired');
	}
	if (
		stage === 'outline'
		&& (
			state.directions.length !== 3
			|| state.selectedDirectionIds.length < 1
			|| state.stale.directions
		)
	) {
		throw new Error('creationJourneyDirectionDecisionRequired');
	}
	if (
		stage === 'chapters'
		&& (state.outline.length < 5 || state.stale.outline)
	) {
		throw new Error('creationJourneyOutlineRequired');
	}
	if (
		stage === 'writing'
		&& (
			state.chapters.length !== 3
			|| state.stale.chapters
			|| state.chapters.some(chapter => !chapter.resourceId)
		)
	) {
		throw new Error('creationJourneyChapterMaterializationRequired');
	}
	return nextState(state, { stage }, now);
}

export function updateStoryElement(
	state: CreationJourneyState,
	elementId: string,
	patch: Partial<Pick<StoryElement, 'category' | 'text' | 'locked'>>,
	now?: () => string
): CreationJourneyState {
	const current = state.elements.find(element => element.id === elementId);
	if (!current) {
		throw new Error('creationJourneyElementNotFound');
	}
	const contentChanged = (
		(patch.category !== undefined && patch.category !== current.category)
		|| (patch.text !== undefined && patch.text !== current.text)
	);
	if (current.locked && contentChanged) {
		throw new Error('creationJourneyTargetLocked');
	}
	const impactPatch = contentChanged
		? addPendingImpacts(
			state,
			'element',
			elementId,
			['direction', 'outline', 'chapter'],
			now
		)
		: { impacts: state.impacts, stale: state.stale };
	return nextState(state, {
		elements: state.elements.map(element => (
			element.id === elementId ? { ...element, ...patch } : element
		)),
		core: contentChanged
			? { ...state.core, confirmedAt: undefined }
			: state.core,
		...impactPatch
	}, now);
}

export function addStoryElement(
	state: CreationJourneyState,
	now?: () => string,
	id: () => string = () => defaultId('journey-element')
): CreationJourneyState {
	if (state.elements.length >= 8) {
		throw new Error('creationJourneyElementLimit');
	}
	const impactPatch = addPendingImpacts(
		state,
		'element',
		undefined,
		['direction', 'outline', 'chapter'],
		now
	);
	return nextState(state, {
		elements: [
			...state.elements,
			{ id: id(), category: 'other', text: '', locked: false }
		],
		core: { ...state.core, confirmedAt: undefined },
		...impactPatch
	}, now);
}

export function removeStoryElement(
	state: CreationJourneyState,
	elementId: string,
	now?: () => string
): CreationJourneyState {
	if (state.elements.length <= 3) {
		throw new Error('creationJourneyElementMinimum');
	}
	const current = state.elements.find(element => element.id === elementId);
	if (current?.locked) {
		throw new Error('creationJourneyTargetLocked');
	}
	const elements = state.elements.filter(element => element.id !== elementId);
	if (elements.length === state.elements.length) {
		throw new Error('creationJourneyElementNotFound');
	}
	return nextState(state, {
		elements,
		core: { ...state.core, confirmedAt: undefined },
		...addPendingImpacts(
			state,
			'element',
			elementId,
			['direction', 'outline', 'chapter'],
			now
		)
	}, now);
}

function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
	if (
		!Number.isSafeInteger(fromIndex)
		|| !Number.isSafeInteger(toIndex)
		|| fromIndex < 0
		|| toIndex < 0
		|| fromIndex >= items.length
		|| toIndex >= items.length
	) {
		throw new Error('creationJourneyMoveInvalid');
	}
	const next = [...items];
	const [item] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, item);
	return next;
}

export function moveStoryElement(
	state: CreationJourneyState,
	fromIndex: number,
	toIndex: number,
	now?: () => string
): CreationJourneyState {
	if (state.elements[fromIndex]?.locked) {
		throw new Error('creationJourneyTargetLocked');
	}
	return nextState(state, {
		elements: moveItem(state.elements, fromIndex, toIndex),
		core: { ...state.core, confirmedAt: undefined },
		...addPendingImpacts(
			state,
			'element',
			state.elements[fromIndex]?.id,
			['direction', 'outline', 'chapter'],
			now
		)
	}, now);
}

export function setGeneratedStoryCore(
	state: CreationJourneyState,
	core: Omit<StoryCore, 'confirmedAt'>,
	now?: () => string
): CreationJourneyState {
	if (!hasCompleteElements(state)) {
		throw new Error('creationJourneyElementsIncomplete');
	}
	const parsedCore = storyCoreSchema.safeParse(core);
	if (!parsedCore.success || !hasCompleteCore(parsedCore.data)) {
		throw new Error('creationJourneyCoreInvalid');
	}
	const lockedCore = {
		...parsedCore.data,
		...Object.fromEntries(
			state.locks.coreFields.map(field => [field, state.core[field]])
		)
	} as StoryCore;
	if (!hasCompleteCore(lockedCore)) {
		throw new Error('creationJourneyCoreInvalid');
	}
	return nextState(state, {
		stage: 'core',
		core: lockedCore,
		...addPendingImpacts(
			state,
			'core',
			undefined,
			['direction', 'outline', 'chapter'],
			now
		)
	}, now);
}

export function setStoryDirections(
	state: CreationJourneyState,
	directions: readonly StoryDirection[],
	now?: () => string
): CreationJourneyState {
	if (!state.core.confirmedAt) {
		throw new Error('creationJourneyCoreConfirmationRequired');
	}
	if (state.locks.directionIds.length > 0) {
		throw new Error('creationJourneyTargetLocked');
	}
	const parsed = z.array(storyDirectionSchema).length(3).safeParse(directions);
	if (
		!parsed.success
		|| new Set(parsed.data.map(direction => direction.id)).size !== 3
		|| !parsed.data.every(hasCompleteDirection)
	) {
		throw new Error('creationJourneyDirectionsInvalid');
	}
	const resolvedImpacts = resolveTargetImpacts(
		state.impacts,
		'direction',
		state.directions.map(direction => direction.id),
		'updated',
		now
	);
	const staged = {
		...state,
		directions: parsed.data,
		selectedDirectionIds: []
	};
	return nextState(state, {
		stage: 'directions',
		directions: parsed.data,
		selectedDirectionIds: [],
		...addPendingImpacts(
			staged,
			'core',
			undefined,
			['outline', 'chapter'],
			now,
			resolvedImpacts
		)
	}, now);
}

export function updateStoryDirection(
	state: CreationJourneyState,
	directionId: string,
	patch: Partial<Omit<StoryDirection, 'id'>>,
	now?: () => string
): CreationJourneyState {
	const directions = state.directions.map(direction => (
		direction.id === directionId ? { ...direction, ...patch } : direction
	));
	if (!state.directions.some(direction => direction.id === directionId)) {
		throw new Error('creationJourneyDirectionNotFound');
	}
	if (state.locks.directionIds.includes(directionId)) {
		throw new Error('creationJourneyTargetLocked');
	}
	const parsed = z.array(storyDirectionSchema).length(3).safeParse(directions);
	if (!parsed.success) {
		throw new Error('creationJourneyDirectionsInvalid');
	}
	const resolvedImpacts = resolveTargetImpacts(
		state.impacts,
		'direction',
		[directionId],
		'updated',
		now
	);
	const staged = { ...state, directions: parsed.data };
	return nextState(state, {
		stage: 'directions',
		directions: parsed.data,
		...addPendingImpacts(
			staged,
			'direction',
			directionId,
			['outline', 'chapter'],
			now,
			resolvedImpacts
		)
	}, now);
}

export function setStoryOutline(
	state: CreationJourneyState,
	outline: readonly StoryOutlineNode[],
	now?: () => string
): CreationJourneyState {
	if (
		state.selectedDirectionIds.length < 1
		|| state.selectedDirectionIds.length > 2
		|| state.stale.directions
	) {
		throw new Error('creationJourneyDirectionDecisionRequired');
	}
	if (state.locks.outlineNodeIds.length > 0) {
		throw new Error('creationJourneyTargetLocked');
	}
	const parsed = z.array(storyOutlineNodeSchema).min(5).max(8).safeParse(outline);
	if (
		!parsed.success
		|| new Set(parsed.data.map(node => node.id)).size !== parsed.data.length
		|| !parsed.data.every(hasCompleteOutlineNode)
	) {
		throw new Error('creationJourneyOutlineInvalid');
	}
	const resolvedImpacts = resolveTargetImpacts(
		state.impacts,
		'outline',
		state.outline.map(node => node.id),
		'updated',
		now
	);
	const staged = { ...state, outline: parsed.data };
	return nextState(state, {
		stage: 'outline',
		outline: parsed.data,
		...addPendingImpacts(
			staged,
			'direction-selection',
			undefined,
			['chapter'],
			now,
			resolvedImpacts
		)
	}, now);
}

export function moveStoryOutlineNode(
	state: CreationJourneyState,
	fromIndex: number,
	toIndex: number,
	now?: () => string
): CreationJourneyState {
	const moved = state.outline[fromIndex];
	if (moved && state.locks.outlineNodeIds.includes(moved.id)) {
		throw new Error('creationJourneyTargetLocked');
	}
	const outline = moveItem(state.outline, fromIndex, toIndex);
	const resolvedImpacts = moved
		? resolveTargetImpacts(state.impacts, 'outline', [moved.id], 'updated', now)
		: state.impacts;
	const staged = { ...state, outline };
	return nextState(state, {
		outline,
		...addPendingImpacts(
			staged,
			'outline',
			moved?.id,
			['chapter'],
			now,
			resolvedImpacts
		)
	}, now);
}

export function updateStoryOutlineNode(
	state: CreationJourneyState,
	nodeId: string,
	patch: Partial<Omit<StoryOutlineNode, 'id'>>,
	now?: () => string
): CreationJourneyState {
	if (!state.outline.some(node => node.id === nodeId)) {
		throw new Error('creationJourneyOutlineNodeNotFound');
	}
	if (state.locks.outlineNodeIds.includes(nodeId)) {
		throw new Error('creationJourneyTargetLocked');
	}
	const outline = state.outline.map(node => (
		node.id === nodeId ? { ...node, ...patch } : node
	));
	const resolvedImpacts = resolveTargetImpacts(
		state.impacts,
		'outline',
		[nodeId],
		'updated',
		now
	);
	const staged = { ...state, outline };
	return nextState(state, {
		outline,
		...addPendingImpacts(
			staged,
			'outline',
			nodeId,
			['chapter'],
			now,
			resolvedImpacts
		)
	}, now);
}

export function setJourneyChapterProposals(
	state: CreationJourneyState,
	chapters: readonly JourneyChapterProposal[],
	now?: () => string
): CreationJourneyState {
	if (state.outline.length < 5 || state.stale.outline) {
		throw new Error('creationJourneyOutlineRequired');
	}
	if (state.chapters.some(chapter => chapter.resourceId)) {
		throw new Error('creationJourneyMaterializedChapterLocked');
	}
	if (state.locks.chapterIds.length > 0) {
		throw new Error('creationJourneyTargetLocked');
	}
	const parsed = z.array(journeyChapterProposalSchema).length(3).safeParse(chapters);
	if (
		!parsed.success
		|| new Set(parsed.data.map(chapter => chapter.id)).size !== 3
		|| !parsed.data.every(hasCompleteChapter)
	) {
		throw new Error('creationJourneyChaptersInvalid');
	}
	const resolvedImpacts = resolveTargetImpacts(
		state.impacts,
		'chapter',
		state.chapters.map(chapter => chapter.id),
		'updated',
		now
	);
	return nextState(state, {
		stage: 'chapters',
		chapters: parsed.data,
		impacts: resolvedImpacts,
		stale: staleFromImpacts(resolvedImpacts)
	}, now);
}

export function updateJourneyChapterProposal(
	state: CreationJourneyState,
	chapterId: string,
	patch: Partial<Pick<
		JourneyChapterProposal,
		'title' | 'goal' | 'summary' | 'sourceNodeIds'
	>>,
	now?: () => string
): CreationJourneyState {
	if (!state.chapters.some(chapter => chapter.id === chapterId)) {
		throw new Error('creationJourneyChapterNotFound');
	}
	const current = state.chapters.find(chapter => chapter.id === chapterId);
	if (current?.resourceId) {
		throw new Error('creationJourneyMaterializedChapterLocked');
	}
	if (state.locks.chapterIds.includes(chapterId)) {
		throw new Error('creationJourneyTargetLocked');
	}
	const impacts = resolveTargetImpacts(
		state.impacts,
		'chapter',
		[chapterId],
		'updated',
		now
	);
	return nextState(state, {
		chapters: state.chapters.map(chapter => (
			chapter.id === chapterId ? { ...chapter, ...patch } : chapter
		)),
		impacts,
		stale: staleFromImpacts(impacts)
	}, now);
}

export function setCreationGuidanceQuestion(
	state: CreationJourneyState,
	question: CreationGuidanceQuestion,
	now?: () => string
): CreationJourneyState {
	const parsed = creationGuidanceQuestionSchema.safeParse(question);
	if (!parsed.success) {
		throw new Error('creationJourneyGuidanceQuestionInvalid');
	}
	return nextState(state, {
		guidance: {
			...state.guidance,
			currentQuestion: parsed.data
		}
	}, now);
}

export function answerCreationGuidanceQuestion(
	state: CreationJourneyState,
	answer:
		| { readonly source: 'option'; readonly optionId: string }
		| { readonly source: 'custom'; readonly answerText: string },
	now?: () => string
): CreationJourneyState {
	const question = state.guidance.currentQuestion;
	if (!question) {
		throw new Error('creationJourneyGuidanceQuestionMissing');
	}
	let answerText: string;
	if (answer.source === 'option') {
		const option = question.options.find(candidate => candidate.id === answer.optionId);
		if (!option) {
			throw new Error('creationJourneyGuidanceAnswerInvalid');
		}
		answerText = `${option.label}：${option.description}`;
	} else {
		answerText = answer.answerText.trim();
		if (!answerText || answerText.length > 1_000) {
			throw new Error('creationJourneyGuidanceAnswerInvalid');
		}
	}
	return nextState(state, {
		guidance: {
			answers: [
				...state.guidance.answers,
				{
					questionId: question.id,
					stage: question.stage,
					source: answer.source,
					answerText,
					answeredAt: timestamp(now)
				}
			]
		}
	}, now);
}

export function toggleJourneyLock(
	state: CreationJourneyState,
	target: JourneyLockTarget,
	locked?: boolean,
	now?: () => string
): CreationJourneyState {
	let key: keyof CreationJourneyLocks;
	let value: string;
	if (target.kind === 'core') {
		key = 'coreFields';
		value = target.field;
	} else if (target.kind === 'direction') {
		if (!state.directions.some(direction => direction.id === target.id)) {
			throw new Error('creationJourneyDirectionNotFound');
		}
		key = 'directionIds';
		value = target.id;
	} else if (target.kind === 'outline') {
		if (!state.outline.some(node => node.id === target.id)) {
			throw new Error('creationJourneyOutlineNodeNotFound');
		}
		key = 'outlineNodeIds';
		value = target.id;
	} else {
		if (!state.chapters.some(chapter => chapter.id === target.id)) {
			throw new Error('creationJourneyChapterNotFound');
		}
		key = 'chapterIds';
		value = target.id;
	}
	const values = state.locks[key] as readonly string[];
	const shouldLock = locked ?? !values.includes(value);
	const nextValues = shouldLock
		? [...new Set([...values, value])]
		: values.filter(item => item !== value);
	return nextState(state, {
		locks: {
			...state.locks,
			[key]: nextValues
		}
	}, now);
}

export function resolveJourneyImpact(
	state: CreationJourneyState,
	impactId: string,
	resolution: 'kept' | 'updated',
	now?: () => string
): CreationJourneyState {
	const impact = state.impacts.find(candidate => candidate.id === impactId);
	if (!impact || impact.status !== 'pending') {
		throw new Error('creationJourneyImpactNotPending');
	}
	if (impact.targetKind === 'chapter' && resolution === 'updated') {
		const chapter = state.chapters.find(candidate => candidate.id === impact.targetId);
		if (chapter?.resourceId) {
			throw new Error('creationJourneyMaterializedChapterLocked');
		}
	}
	const impacts = state.impacts.map(candidate => (
		candidate.id === impactId
			? {
				...candidate,
				status: resolution,
				resolvedAt: timestamp(now)
			}
			: candidate
	));
	return nextState(state, {
		impacts,
		stale: staleFromImpacts(impacts)
	}, now);
}

import { z } from 'zod';
