export const creationStartRoutes = [
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

export interface StoryOutlineNode {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly purpose: string;
}

export interface JourneyChapterProposal {
	readonly id: string;
	readonly title: string;
	readonly goal: string;
	readonly summary: string;
	readonly sourceNodeIds: readonly string[];
	readonly resourceId?: string;
}

export interface CreationJourneyState {
	readonly schemaVersion: 1;
	readonly revision: number;
	readonly projectId: string;
	readonly startRoute: CreationStartRoute;
	readonly stage: CreationJourneyStage;
	readonly elements: readonly StoryElement[];
	readonly core: StoryCore;
	readonly directions: readonly StoryDirection[];
	readonly selectedDirectionIds: readonly string[];
	readonly outline: readonly StoryOutlineNode[];
	readonly chapters: readonly JourneyChapterProposal[];
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
const chapterProposalIdSchema = z.string().regex(/^journey-chapter:[a-z0-9][a-z0-9-]*$/u);

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

const storyOutlineNodeSchema = z.object({
	id: outlineIdSchema,
	title: z.string().max(120),
	summary: z.string().max(3_000),
	purpose: z.string().max(1_000)
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

const creationJourneyStateSchema = z.object({
	schemaVersion: z.literal(1),
	revision: z.number().int().min(0),
	projectId: z.string().trim().min(1).max(240),
	startRoute: z.enum(creationStartRoutes),
	stage: z.enum(creationJourneyStages),
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
	if (state.selectedDirectionIds.some(id => !directionIds.has(id))) {
		context.addIssue({ code: 'custom', message: 'unknownJourneyDirection' });
	}
	const outlineIds = new Set(state.outline.map(node => node.id));
	if (
		state.chapters.some(chapter => chapter.sourceNodeIds.some(id => !outlineIds.has(id)))
	) {
		context.addIssue({ code: 'custom', message: 'unknownJourneyOutlineNode' });
	}
	const materializedCount = state.chapters.filter(chapter => chapter.resourceId).length;
	if (materializedCount !== 0 && materializedCount !== 3) {
		context.addIssue({ code: 'custom', message: 'partialJourneyMaterialization' });
	}
	if (state.stage === 'writing' && materializedCount !== 3) {
		context.addIssue({ code: 'custom', message: 'journeyWritingWithoutChapters' });
	}
});

function defaultId(prefix: 'journey-element' | 'journey-direction' | 'journey-outline' | 'journey-chapter'): string {
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
	} = {}
): CreationJourneyState {
	const createdAt = timestamp(dependencies.now);
	const createId = dependencies.id ?? (() => defaultId('journey-element'));
	return parseCreationJourneyState(JSON.stringify({
		schemaVersion: 1,
		revision: 0,
		projectId,
		startRoute: 'ideas',
		stage: 'elements',
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
		stale: {
			directions: false,
			outline: false,
			chapters: false
		},
		createdAt,
		updatedAt: createdAt
	}));
}

export function parseCreationJourneyState(content: string): CreationJourneyState {
	try {
		const result = creationJourneyStateSchema.safeParse(JSON.parse(content));
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
	const core = {
		...state.core,
		...patch
	};
	delete core.confirmedAt;
	return nextState(state, {
		stage: 'core',
		core,
		stale: {
			directions: state.directions.length > 0,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		}
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
	return nextState(state, {
		selectedDirectionIds: uniqueIds,
		stale: selectionChanged ? {
			...state.stale,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		} : state.stale
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
	if (!state.elements.some(element => element.id === elementId)) {
		throw new Error('creationJourneyElementNotFound');
	}
	return nextState(state, {
		elements: state.elements.map(element => (
			element.id === elementId ? { ...element, ...patch } : element
		)),
		core: {
			...state.core,
			confirmedAt: undefined
		},
		stale: {
			directions: state.directions.length > 0,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		}
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
	return nextState(state, {
		elements: [
			...state.elements,
			{ id: id(), category: 'other', text: '', locked: false }
		]
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
	const elements = state.elements.filter(element => element.id !== elementId);
	if (elements.length === state.elements.length) {
		throw new Error('creationJourneyElementNotFound');
	}
	return nextState(state, { elements }, now);
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
	return nextState(state, {
		elements: moveItem(state.elements, fromIndex, toIndex)
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
	return nextState(state, {
		stage: 'core',
		core: parsedCore.data,
		stale: {
			directions: state.directions.length > 0,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		}
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
	const parsed = z.array(storyDirectionSchema).length(3).safeParse(directions);
	if (
		!parsed.success
		|| new Set(parsed.data.map(direction => direction.id)).size !== 3
		|| !parsed.data.every(hasCompleteDirection)
	) {
		throw new Error('creationJourneyDirectionsInvalid');
	}
	return nextState(state, {
		stage: 'directions',
		directions: parsed.data,
		selectedDirectionIds: [],
		stale: {
			directions: false,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		}
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
	const parsed = z.array(storyDirectionSchema).length(3).safeParse(directions);
	if (!parsed.success) {
		throw new Error('creationJourneyDirectionsInvalid');
	}
	return nextState(state, {
		stage: 'directions',
		directions: parsed.data,
		stale: {
			directions: false,
			outline: state.outline.length > 0,
			chapters: state.chapters.length > 0
		}
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
	const parsed = z.array(storyOutlineNodeSchema).min(5).max(8).safeParse(outline);
	if (
		!parsed.success
		|| new Set(parsed.data.map(node => node.id)).size !== parsed.data.length
		|| !parsed.data.every(hasCompleteOutlineNode)
	) {
		throw new Error('creationJourneyOutlineInvalid');
	}
	return nextState(state, {
		stage: 'outline',
		outline: parsed.data,
		stale: {
			...state.stale,
			outline: false,
			chapters: state.chapters.length > 0
		}
	}, now);
}

export function moveStoryOutlineNode(
	state: CreationJourneyState,
	fromIndex: number,
	toIndex: number,
	now?: () => string
): CreationJourneyState {
	return nextState(state, {
		outline: moveItem(state.outline, fromIndex, toIndex),
		stale: {
			...state.stale,
			chapters: state.chapters.length > 0
		}
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
	return nextState(state, {
		outline: state.outline.map(node => (
			node.id === nodeId ? { ...node, ...patch } : node
		)),
		stale: {
			...state.stale,
			chapters: state.chapters.length > 0
		}
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
	const parsed = z.array(journeyChapterProposalSchema).length(3).safeParse(chapters);
	if (
		!parsed.success
		|| new Set(parsed.data.map(chapter => chapter.id)).size !== 3
		|| !parsed.data.every(hasCompleteChapter)
	) {
		throw new Error('creationJourneyChaptersInvalid');
	}
	return nextState(state, {
		stage: 'chapters',
		chapters: parsed.data,
		stale: {
			...state.stale,
			chapters: false
		}
	}, now);
}

export function updateJourneyChapterProposal(
	state: CreationJourneyState,
	chapterId: string,
	patch: Partial<Pick<JourneyChapterProposal, 'title' | 'goal' | 'summary'>>,
	now?: () => string
): CreationJourneyState {
	if (!state.chapters.some(chapter => chapter.id === chapterId)) {
		throw new Error('creationJourneyChapterNotFound');
	}
	return nextState(state, {
		chapters: state.chapters.map(chapter => (
			chapter.id === chapterId ? { ...chapter, ...patch } : chapter
		))
	}, now);
}
import { z } from 'zod';
