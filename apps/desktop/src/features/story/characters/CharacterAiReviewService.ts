import type {
	CharacterAnalysisActionType,
	CharacterAnalysisCandidateResponse,
	CharacterAnalysisFieldKey,
	CharacterAnalysisFieldValue,
	GroundedCandidateEvidence
} from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	StorySchemaRegistry,
	createStoryId,
	parseEvidenceRef,
	parseStateRecord,
	type Character,
	type EvidenceRef,
	type StateRecord,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type { TextFile } from '@writing-buddy/domain';

export const CHARACTER_STATES_PATH = 'story/states/character-states.json';

export interface CharacterStateStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

export class CharacterStateFileStore {
	private hash: string | undefined;
	private records: readonly StateRecord[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: CharacterStateStoragePort
	) {}

	async load(): Promise<readonly StateRecord[]> {
		try {
			const file = await this.storage.readText(this.projectRoot, CHARACTER_STATES_PATH);
			const decoded = JSON.parse(file.content) as unknown;
			if (!Array.isArray(decoded)) throw new Error('invalidCharacterStatesFile');
			this.hash = file.hash;
			this.records = decoded.map(value => parseStateRecord(
				value as Parameters<typeof parseStateRecord>[0]
			));
		} catch (reason) {
			if (
				reason instanceof SyntaxError
				|| (reason instanceof Error && reason.message === 'invalidCharacterStatesFile')
			) {
				throw reason;
			}
			this.hash = '';
			this.records = [];
		}
		return this.records;
	}

	async save(records: readonly StateRecord[]): Promise<readonly StateRecord[]> {
		if (this.hash === undefined) await this.load();
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: CHARACTER_STATES_PATH,
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

export type CharacterReviewFieldKey = CharacterAnalysisFieldKey | 'role';

export interface CharacterReviewField {
	readonly id: string;
	readonly key: CharacterReviewFieldKey;
	readonly value: CharacterAnalysisFieldValue;
	readonly evidence?: EvidenceRef;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
}

export interface CharacterReviewCandidate {
	readonly id: string;
	readonly title: string;
	readonly matchedCharacterId?: string;
	readonly expectedRevision?: number;
	readonly confidence: number;
	readonly rationale: string;
	readonly fields: readonly CharacterReviewField[];
	readonly duplicateCount: number;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface CharacterReviewBatch {
	readonly id: string;
	readonly actionType: CharacterAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly candidates: readonly CharacterReviewCandidate[];
	readonly createdAt: string;
}

const dossierFields = new Set<CharacterReviewFieldKey>([
	'role',
	'aliases',
	'summary',
	'pronouns',
	'birth',
	'appearance',
	'occupation',
	'goals',
	'desires',
	'fears',
	'values',
	'speechStyle'
]);

function normalizeName(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function candidateNames(candidate: CharacterAnalysisCandidateResponse): readonly string[] {
	const aliases = candidate.fields.find(field => field.key === 'aliases')?.value;
	const names = [candidate.title];
	if (Array.isArray(aliases)) {
		for (const alias of aliases) {
			if (typeof alias === 'string') names.push(alias);
		}
	}
	return names
		.map(normalizeName)
		.filter(Boolean);
}

function characterNames(character: Character): ReadonlySet<string> {
	return new Set([character.title, ...character.aliases].map(normalizeName).filter(Boolean));
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
	readonly content: string;
}): EvidenceRef | undefined {
	if (!input.evidence) return undefined;
	if (
		input.evidence.end <= input.evidence.start
		|| input.evidence.end > input.content.length
		|| input.content.slice(input.evidence.start, input.evidence.end) !== input.evidence.quote
	) {
		return undefined;
	}
	return parseEvidenceRef({
		id: createStoryId('evidence'),
		origin: 'ai-extracted',
		resourceId: input.sourceResourceId,
		range: {
			start: input.evidence.start,
			end: input.evidence.end
		},
		revisionId: input.sourceRevision,
		quotePreview: input.evidence.quote,
		confirmedByAuthor: false
	});
}

function existingFieldValue(
	character: Character | undefined,
	states: readonly StateRecord[],
	key: CharacterReviewFieldKey,
	narrativeOrder: number
): unknown {
	if (!character) return undefined;
	if (dossierFields.has(key)) {
		return character[key as keyof Character];
	}
	const kind = key.slice('state.'.length);
	return states.find(state => (
		state.characterId === character.id
		&& state.kind === kind
		&& state.effectiveFrom.narrativeOrder === narrativeOrder
	))?.value;
}

function mergeDuplicateCandidates(
	responses: readonly CharacterAnalysisCandidateResponse[],
	existingCharacters: readonly Character[]
): readonly {
	readonly response: CharacterAnalysisCandidateResponse;
	readonly duplicateCount: number;
}[] {
	const groups: {
		response: CharacterAnalysisCandidateResponse;
		names: Set<string>;
		duplicateCount: number;
	}[] = [];
	for (const response of responses) {
		const names = new Set(candidateNames(response));
		const matched = existingCharacters.find(character => (
			[...characterNames(character)].some(name => names.has(name))
		));
		if (matched) {
			for (const name of characterNames(matched)) names.add(name);
		}
		const existing = groups.find(group => [...names].some(name => group.names.has(name)));
		if (!existing) {
			groups.push({ response, names, duplicateCount: 0 });
			continue;
		}
		const byKey = new Map(existing.response.fields.map(field => [field.key, field]));
		for (const field of response.fields) {
			if (!byKey.has(field.key)) byKey.set(field.key, field);
		}
		existing.response = {
			...(response.confidence > existing.response.confidence
				? response
				: existing.response),
			fields: [...byKey.values()]
		};
		for (const name of names) existing.names.add(name);
		existing.duplicateCount += 1;
	}
	return groups.map(group => ({
		response: group.response,
		duplicateCount: group.duplicateCount
	}));
}

export function stageCharacterReviewBatch(input: {
	readonly actionType: CharacterAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly existingCharacters: readonly Character[];
	readonly states: readonly StateRecord[];
	readonly responses: readonly CharacterAnalysisCandidateResponse[];
	readonly now?: string;
}): CharacterReviewBatch {
	const createdAt = input.now ?? new Date().toISOString();
	const candidates = mergeDuplicateCandidates(
		input.responses,
		input.existingCharacters
	).map((group): CharacterReviewCandidate => {
		const names = new Set(candidateNames(group.response));
		const matched = input.existingCharacters.find(character => (
			[...characterNames(character)].some(name => names.has(name))
		));
		const responseFields = [
			...(group.response.role && input.actionType !== 'extract-from-chapter'
				? [{
					key: 'role' as const,
					value: group.response.role,
					evidence: null
				}]
				: []),
			...group.response.fields
		];
		const fields = responseFields.map(field => {
			const evidence = anchorEvidence({
				evidence: field.evidence,
				sourceResourceId: input.sourceResourceId,
				sourceRevision: input.sourceRevision,
				content: input.sourceContent
			});
			const invalidEvidence = field.evidence !== null && !evidence;
			const existingValue = existingFieldValue(
				matched,
				input.states,
				field.key,
				input.narrativeOrder
			);
			const conflict = hasExistingValue(existingValue)
				&& !valuesEqual(existingValue, field.value)
				? `已有值：${Array.isArray(existingValue)
					? existingValue.join('、')
					: String(existingValue)}`
				: undefined;
			return {
				id: `character-field:${crypto.randomUUID()}`,
				key: field.key,
				value: field.value,
				...(evidence ? { evidence } : {}),
				...(invalidEvidence
					? { conflict: '正文证据与章节内容不一致。' }
					: conflict
						? { conflict }
						: {}),
				blocking: invalidEvidence,
				selectedByDefault: !invalidEvidence && !conflict
			};
		});
		return {
			id: `character-candidate:${crypto.randomUUID()}`,
			title: group.response.title,
			...(matched
				? {
					matchedCharacterId: matched.id,
					expectedRevision: matched.revision
				}
				: {}),
			confidence: group.response.confidence,
			rationale: group.response.rationale,
			fields,
			duplicateCount: group.duplicateCount,
			status: 'candidate'
		};
	});
	return {
		id: `character-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		sourceResourceId: input.sourceResourceId,
		sourceRevision: input.sourceRevision,
		sourceContent: input.sourceContent,
		narrativeOrder: input.narrativeOrder,
		candidates,
		createdAt
	};
}

function confirmedEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

export class CharacterAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly stateStore: CharacterStateFileStore,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async apply(input: {
		readonly batch: CharacterReviewBatch;
		readonly candidateId: string;
		readonly selectedFieldIds: readonly string[];
		readonly currentSourceRevision: string;
		readonly currentSourceContent: string;
		readonly now?: string;
	}): Promise<{
		readonly character: Character;
		readonly states: readonly StateRecord[];
		readonly candidate: CharacterReviewCandidate;
	}> {
		const candidate = input.batch.candidates.find(item => item.id === input.candidateId);
		if (
			!candidate
			|| candidate.status !== 'candidate'
			|| input.batch.sourceRevision !== input.currentSourceRevision
			|| input.batch.sourceContent !== input.currentSourceContent
		) {
			throw new Error('staleCharacterCandidate');
		}
		const selectedIds = new Set(input.selectedFieldIds);
		const fields = candidate.fields.filter(field => selectedIds.has(field.id));
		if (
			fields.length === 0
			|| fields.length !== selectedIds.size
			|| fields.some(field => field.blocking)
		) {
			throw new Error('invalidCharacterFieldSelection');
		}
		const allCharacters = await this.repository.list('character') as unknown as readonly Character[];
		const current = candidate.matchedCharacterId
			? await this.repository.get('character', candidate.matchedCharacterId) as unknown as Character | undefined
			: undefined;
		if (
			candidate.matchedCharacterId
			&& (!current || current.revision !== candidate.expectedRevision)
		) {
			throw new Error('staleCharacterCandidate');
		}
		if (!current) {
			const candidateName = normalizeName(candidate.title);
			if (allCharacters.some(character => characterNames(character).has(candidateName))) {
				throw new Error('characterNameCollision');
			}
		}
		const now = input.now ?? new Date().toISOString();
		const evidenceIds = [
			...(current?.evidenceIds ?? []),
			...fields.flatMap(field => field.evidence ? [field.evidence.id] : [])
		].filter((id, index, values) => values.indexOf(id) === index);
		const payload: Record<string, unknown> = current
			? { ...current, updatedAt: now, evidenceIds }
			: {
				id: createStoryId('character'),
				type: 'character',
				title: candidate.title,
				aliases: [],
				tags: [],
				schemaVersion: 1,
				createdAt: now,
				updatedAt: now,
				revision: 0,
				factionIds: [],
				goals: [],
				desires: [],
				fears: [],
				values: [],
				secrets: [],
				evidenceIds
			};
		for (const field of fields) {
			if (dossierFields.has(field.key)) payload[field.key] = field.value;
		}
		const character = StorySchemaRegistry.parse('character', payload) as unknown as Character;
		const currentStates = await this.stateStore.load();
		const newStates = fields.flatMap(field => {
			if (!field.key.startsWith('state.')) return [];
			const evidence = field.evidence ? confirmedEvidence(field.evidence, now) : undefined;
			return [parseStateRecord({
				id: createStoryId('state'),
				characterId: character.id,
				kind: field.key.slice('state.'.length),
				value: field.value,
				effectiveFrom: {
					chapterId: input.batch.sourceResourceId,
					narrativeOrder: input.batch.narrativeOrder
				},
				evidenceIds: evidence ? [evidence.id] : [],
				confirmation: 'confirmed',
				revision: 0
			})];
		});
		await this.createSnapshot(`AI 人物 · ${candidate.title}`);
		const saved = current
			? await this.repository.save(character, current.revision) as unknown as Character
			: (await this.repository.commit([{
				resource: character,
				expectedAbsent: true
			}]))[0] as unknown as Character;
		if (!saved) throw new Error('characterCommitFailed');
		const states = newStates.length
			? await this.stateStore.save([...currentStates, ...newStates])
			: currentStates;
		return {
			character: saved,
			states,
			candidate: { ...candidate, status: 'accepted' }
		};
	}
}
