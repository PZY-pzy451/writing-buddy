import type {
	GroundedCandidateEvidence,
	ItemAnalysisActionType,
	ItemAnalysisCandidateResponse,
	ItemAnalysisStateCandidateResponse
} from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';
import {
	StorySchemaRegistry,
	createStoryId,
	parseEvidenceRef,
	parseItemState,
	parseStoryItem,
	runItemRules,
	type EvidenceRef,
	type ItemState,
	type StoryItem,
	type StoryRepository
} from '@writing-buddy/story-kernel';

export const ITEM_STATES_PATH = 'story/states/item-states.json';

export interface ItemStateStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

export class ItemStateFileStore {
	private hash: string | undefined;
	private records: readonly ItemState[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: ItemStateStoragePort
	) {}

	async load(): Promise<readonly ItemState[]> {
		try {
			const file = await this.storage.readText(this.projectRoot, ITEM_STATES_PATH);
			const decoded = JSON.parse(file.content) as unknown;
			if (!Array.isArray(decoded)) throw new Error('invalidItemStatesFile');
			this.hash = file.hash;
			this.records = decoded.map(value => parseItemState(
				value as Parameters<typeof parseItemState>[0]
			));
		} catch (reason) {
			if (
				reason instanceof SyntaxError
				|| (reason instanceof Error && reason.message === 'invalidItemStatesFile')
			) {
				throw reason;
			}
			this.hash = '';
			this.records = [];
		}
		return this.records;
	}

	async save(records: readonly ItemState[]): Promise<readonly ItemState[]> {
		if (this.hash === undefined) await this.load();
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: ITEM_STATES_PATH,
			content: `${JSON.stringify(records, null, 2)}\n`,
			expectedHash: this.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
		this.hash = result.hash;
		this.records = records;
		return records;
	}
}

export type ItemReviewFieldKey =
	| 'aliases'
	| 'itemType'
	| 'unique'
	| 'quantityUnit'
	| 'description'
	| 'restrictions'
	| 'plotFunction';

export interface ItemReviewField {
	readonly id: string;
	readonly key: ItemReviewFieldKey;
	readonly value: string | readonly string[] | boolean | null;
	readonly evidence?: EvidenceRef;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
}

export interface ItemReviewState {
	readonly id: string;
	readonly action: ItemState['action'];
	readonly quantity: number;
	readonly holderCharacterId?: string;
	readonly holderTitle?: string;
	readonly locationId?: string;
	readonly locationTitle?: string;
	readonly condition?: string;
	readonly evidence?: EvidenceRef;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
}

export interface ItemReviewCandidate {
	readonly id: string;
	readonly title: string;
	readonly matchedItemId?: string;
	readonly expectedRevision?: number;
	readonly confidence: number;
	readonly rationale: string;
	readonly fields: readonly ItemReviewField[];
	readonly states: readonly ItemReviewState[];
	readonly duplicateCount: number;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface ItemReviewBatch {
	readonly id: string;
	readonly actionType: ItemAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly candidates: readonly ItemReviewCandidate[];
	readonly createdAt: string;
}

function normalizeName(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function responseNames(response: ItemAnalysisCandidateResponse): ReadonlySet<string> {
	return new Set([response.title, ...response.aliases].map(normalizeName).filter(Boolean));
}

function itemNames(item: StoryItem): ReadonlySet<string> {
	return new Set([item.title, ...item.aliases].map(normalizeName).filter(Boolean));
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function hasExistingValue(value: unknown): boolean {
	return value !== undefined
		&& value !== null
		&& value !== ''
		&& (!Array.isArray(value) || value.length > 0);
}

function anchorEvidence(input: {
	readonly evidence: GroundedCandidateEvidence | null;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
}): EvidenceRef | undefined {
	if (!input.evidence) return undefined;
	if (
		input.evidence.end <= input.evidence.start
		|| input.evidence.end > input.sourceContent.length
		|| input.sourceContent.slice(input.evidence.start, input.evidence.end)
			!== input.evidence.quote
	) {
		return undefined;
	}
	return parseEvidenceRef({
		id: createStoryId('evidence'),
		origin: 'ai-extracted',
		resourceId: input.sourceResourceId,
		range: { start: input.evidence.start, end: input.evidence.end },
		revisionId: input.sourceRevision,
		quotePreview: input.evidence.quote,
		confirmedByAuthor: false
	});
}

function deduplicateResponses(
	responses: readonly ItemAnalysisCandidateResponse[]
): readonly {
	readonly response: ItemAnalysisCandidateResponse;
	readonly duplicateCount: number;
}[] {
	const groups: {
		response: ItemAnalysisCandidateResponse;
		names: Set<string>;
		duplicateCount: number;
	}[] = [];
	for (const response of responses) {
		const names = new Set(responseNames(response));
		const group = groups.find(candidate => (
			[...names].some(name => candidate.names.has(name))
		));
		if (!group) {
			groups.push({ response, names, duplicateCount: 0 });
			continue;
		}
		if (response.confidence > group.response.confidence) group.response = response;
		for (const name of names) group.names.add(name);
		group.duplicateCount += 1;
	}
	return groups;
}

function responseFields(
	response: ItemAnalysisCandidateResponse
): readonly {
	readonly key: ItemReviewFieldKey;
	readonly value: string | readonly string[] | boolean | null;
}[] {
	return [
		{ key: 'aliases', value: response.aliases },
		{ key: 'itemType', value: response.itemType },
		{ key: 'unique', value: response.unique },
		{ key: 'quantityUnit', value: response.quantityUnit },
		{ key: 'description', value: response.description },
		{ key: 'restrictions', value: response.restrictions },
		{ key: 'plotFunction', value: response.plotFunction }
	];
}

function provisionalState(
	itemId: string,
	state: ItemAnalysisStateCandidateResponse,
	sourceResourceId: string,
	narrativeOrder: number
): ItemState {
	return parseItemState({
		id: createStoryId('item-state'),
		itemId,
		action: state.action,
		quantity: state.quantity,
		...(state.holderCharacterId ? { holderCharacterId: state.holderCharacterId } : {}),
		...(state.locationId ? { locationId: state.locationId } : {}),
		...(state.condition ? { condition: state.condition } : {}),
		effectiveFrom: { chapterId: sourceResourceId, narrativeOrder },
		evidenceIds: [],
		confirmation: 'pending',
		revision: 0
	});
}

function closePriorItemState(
	states: readonly ItemState[],
	itemId: string,
	nextNarrativeOrder: number
): readonly ItemState[] {
	const prior = states
		.filter(state => (
			state.itemId === itemId
			&& !state.effectiveUntil
			&& state.effectiveFrom.narrativeOrder < nextNarrativeOrder
		))
		.sort((left, right) => (
			right.effectiveFrom.narrativeOrder - left.effectiveFrom.narrativeOrder
		))[0];
	if (!prior) return states;
	return states.map(state => state.id === prior.id
		? parseItemState({
			...state,
			effectiveUntil: {
				chapterId: state.effectiveFrom.chapterId,
				narrativeOrder: nextNarrativeOrder
			},
			revision: state.revision + 1
		})
		: state);
}

function itemForRules(
	response: ItemAnalysisCandidateResponse,
	matched: StoryItem | undefined,
	now: string
): StoryItem {
	return parseStoryItem({
		...(matched ?? {
			id: 'item:ai-candidate',
			type: 'item',
			title: response.title,
			aliases: response.aliases,
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			evidenceIds: []
		}),
		itemType: response.itemType,
		unique: response.unique,
		...(response.quantityUnit ? { quantityUnit: response.quantityUnit } : {}),
		description: response.description,
		restrictions: response.restrictions,
		plotFunction: response.plotFunction
	});
}

export function stageItemReviewBatch(input: {
	readonly actionType: ItemAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly items: readonly StoryItem[];
	readonly states: readonly ItemState[];
	readonly characters: readonly { readonly id: string; readonly title: string }[];
	readonly locations: readonly { readonly id: string; readonly title: string }[];
	readonly responses: readonly ItemAnalysisCandidateResponse[];
	readonly now?: string;
}): ItemReviewBatch {
	const now = input.now ?? new Date().toISOString();
	const characterTitles = new Map(input.characters.map(character => [character.id, character.title]));
	const locationTitles = new Map(input.locations.map(location => [location.id, location.title]));
	const candidates = deduplicateResponses(input.responses).map(group => {
		const names = responseNames(group.response);
		const matched = input.items.find(item => (
			[...itemNames(item)].some(name => names.has(name))
		));
		const cardEvidence = anchorEvidence({
			evidence: group.response.evidence,
			sourceResourceId: input.sourceResourceId,
			sourceRevision: input.sourceRevision,
			sourceContent: input.sourceContent
		});
		const invalidCardEvidence = group.response.evidence !== null && !cardEvidence;
		const fields = responseFields(group.response).map(field => {
			const existingValue = matched?.[field.key as keyof StoryItem];
			const conflict = hasExistingValue(existingValue)
				&& !valuesEqual(existingValue, field.value)
				? `已有值：${Array.isArray(existingValue)
					? existingValue.join('、')
					: String(existingValue)}`
				: undefined;
			return {
				id: `item-field:${crypto.randomUUID()}`,
				key: field.key,
				value: field.value,
				...(cardEvidence ? { evidence: cardEvidence } : {}),
				...(invalidCardEvidence
					? { conflict: '正文证据与章节内容不一致。' }
					: conflict
						? { conflict }
						: {}),
				blocking: invalidCardEvidence,
				selectedByDefault: !invalidCardEvidence && !conflict
			};
		});
		const rulesItem = itemForRules(group.response, matched, now);
		const existingStates = input.states.filter(state => state.itemId === rulesItem.id);
		const states = group.response.states.map(response => {
			const evidence = anchorEvidence({
				evidence: response.evidence,
				sourceResourceId: input.sourceResourceId,
				sourceRevision: input.sourceRevision,
				sourceContent: input.sourceContent
			});
			const invalidEvidence = response.evidence !== null && !evidence;
			const unknownHolder = response.holderCharacterId !== null
				&& !characterTitles.has(response.holderCharacterId);
			const unknownLocation = response.locationId !== null
				&& !locationTitles.has(response.locationId);
			const proposed = provisionalState(
				rulesItem.id,
				response,
				input.sourceResourceId,
				input.narrativeOrder
			);
			const simulatedExistingStates = closePriorItemState(
				existingStates,
				rulesItem.id,
				input.narrativeOrder
			);
			const ruleIssue = runItemRules(
				[rulesItem],
				[...simulatedExistingStates, proposed]
			).find(issue => issue.evidence.some(position => position.eventId === proposed.id));
			const conflict = invalidEvidence
				? '正文证据与章节内容不一致。'
				: unknownHolder
					? '候选引用了未知持有人。'
					: unknownLocation
						? '候选引用了未知地点。'
						: ruleIssue?.message;
			return {
				id: `item-state-candidate:${crypto.randomUUID()}`,
				action: response.action,
				quantity: response.quantity,
				...(response.holderCharacterId
					? {
						holderCharacterId: response.holderCharacterId,
						...(characterTitles.get(response.holderCharacterId)
							? { holderTitle: characterTitles.get(response.holderCharacterId)! }
							: {})
					}
					: {}),
				...(response.locationId
					? {
						locationId: response.locationId,
						...(locationTitles.get(response.locationId)
							? { locationTitle: locationTitles.get(response.locationId)! }
							: {})
					}
					: {}),
				...(response.condition ? { condition: response.condition } : {}),
				...(evidence ? { evidence } : {}),
				...(conflict ? { conflict } : {}),
				blocking: Boolean(conflict),
				selectedByDefault: !conflict
			};
		});
		return {
			id: `item-candidate:${crypto.randomUUID()}`,
			title: group.response.title,
			...(matched
				? {
					matchedItemId: matched.id,
					expectedRevision: matched.revision
				}
				: {}),
			confidence: group.response.confidence,
			rationale: group.response.rationale,
			fields,
			states,
			duplicateCount: group.duplicateCount,
			status: 'candidate' as const
		};
	});
	return {
		id: `item-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		sourceResourceId: input.sourceResourceId,
		sourceRevision: input.sourceRevision,
		sourceContent: input.sourceContent,
		narrativeOrder: input.narrativeOrder,
		candidates,
		createdAt: now
	};
}

function confirmedEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

const requiredCreateFields = new Set<ItemReviewFieldKey>([
	'itemType',
	'unique',
	'description',
	'restrictions',
	'plotFunction'
]);

export class ItemAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly stateStore: ItemStateFileStore,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async apply(input: {
		readonly batch: ItemReviewBatch;
		readonly candidateId: string;
		readonly selectedFieldIds: readonly string[];
		readonly selectedStateIds: readonly string[];
		readonly currentSourceRevision: string;
		readonly currentSourceContent: string;
		readonly now?: string;
	}): Promise<{
		readonly item: StoryItem;
		readonly states: readonly ItemState[];
		readonly candidate: ItemReviewCandidate;
	}> {
		const candidate = input.batch.candidates.find(item => item.id === input.candidateId);
		if (
			!candidate
			|| candidate.status !== 'candidate'
			|| input.batch.sourceRevision !== input.currentSourceRevision
			|| input.batch.sourceContent !== input.currentSourceContent
		) {
			throw new Error('staleItemCandidate');
		}
		const selectedFieldIds = new Set(input.selectedFieldIds);
		const selectedStateIds = new Set(input.selectedStateIds);
		const fields = candidate.fields.filter(field => selectedFieldIds.has(field.id));
		const stateCandidates = candidate.states.filter(state => selectedStateIds.has(state.id));
		if (
			fields.length !== selectedFieldIds.size
			|| stateCandidates.length !== selectedStateIds.size
			|| fields.some(field => field.blocking)
			|| stateCandidates.some(state => state.blocking)
			|| (fields.length === 0 && stateCandidates.length === 0)
		) {
			throw new Error('invalidItemSelection');
		}
		const current = candidate.matchedItemId
			? await this.repository.get('item', candidate.matchedItemId) as unknown as StoryItem | undefined
			: undefined;
		if (
			candidate.matchedItemId
			&& (!current || current.revision !== candidate.expectedRevision)
		) {
			throw new Error('staleItemCandidate');
		}
		if (!current) {
			const selectedKeys = new Set(fields.map(field => field.key));
			if ([...requiredCreateFields].some(key => !selectedKeys.has(key))) {
				throw new Error('missingItemRequiredField');
			}
			const items = await this.repository.list('item') as unknown as readonly StoryItem[];
			const candidateName = normalizeName(candidate.title);
			if (items.some(item => itemNames(item).has(candidateName))) {
				throw new Error('itemNameCollision');
			}
		}
		const now = input.now ?? new Date().toISOString();
		const cardEvidence = fields.find(field => field.evidence)?.evidence;
		const confirmedCardEvidence = cardEvidence
			? confirmedEvidence(cardEvidence, now)
			: undefined;
		const evidenceIds = [
			...(current?.evidenceIds ?? []),
			...(confirmedCardEvidence ? [confirmedCardEvidence.id] : [])
		].filter((id, index, values) => values.indexOf(id) === index);
		const payload: Record<string, unknown> = current
			? { ...current, updatedAt: now, evidenceIds }
			: {
				id: createStoryId('item'),
				type: 'item',
				title: candidate.title,
				aliases: [],
				tags: [],
				schemaVersion: 1,
				createdAt: now,
				updatedAt: now,
				revision: 0,
				unique: false,
				restrictions: [],
				evidenceIds
			};
		for (const field of fields) {
			if (field.value === null) delete payload[field.key];
			else payload[field.key] = field.value;
		}
		const item = StorySchemaRegistry.parse('item', payload) as unknown as StoryItem;
		const currentStates = await this.stateStore.load();
		const newStates = stateCandidates.map(state => {
			const evidence = state.evidence ? confirmedEvidence(state.evidence, now) : undefined;
			return parseItemState({
				id: createStoryId('item-state'),
				itemId: item.id,
				action: state.action,
				quantity: state.quantity,
				...(state.holderCharacterId ? { holderCharacterId: state.holderCharacterId } : {}),
				...(state.locationId ? { locationId: state.locationId } : {}),
				...(state.condition ? { condition: state.condition } : {}),
				effectiveFrom: {
					chapterId: input.batch.sourceResourceId,
					narrativeOrder: input.batch.narrativeOrder
				},
				evidenceIds: evidence ? [evidence.id] : [],
				confirmation: 'confirmed',
				revision: 0
			});
		});
		let nextStates = [...currentStates];
		for (const newState of newStates) {
			nextStates = [...closePriorItemState(
				nextStates,
				item.id,
				newState.effectiveFrom.narrativeOrder
			), newState];
			const blockingIssues = runItemRules(
				[item],
				nextStates.filter(state => state.itemId === item.id)
			).filter(issue => issue.severity === 'error');
			if (blockingIssues.length > 0) throw new Error('itemStateConflict');
		}
		await this.createSnapshot(`AI 物品 · ${candidate.title}`);
		const saved = current
			? await this.repository.save(item, current.revision) as unknown as StoryItem
			: (await this.repository.commit([{
				resource: item,
				expectedAbsent: true
			}]))[0] as unknown as StoryItem;
		if (!saved) throw new Error('itemCommitFailed');
		const states = newStates.length
			? await this.stateStore.save(nextStates)
			: currentStates;
		return {
			item: saved,
			states,
			candidate: { ...candidate, status: 'accepted' }
		};
	}
}
