import type {
	GroundedCandidateEvidence,
	WorldAnalysisActionType,
	WorldAnalysisCandidateResponse
} from '@writing-buddy/ai';
import {
	StorySchemaRegistry,
	createStoryId,
	parseEvidenceRef,
	type EvidenceRef,
	type Faction,
	type Location,
	type StoryRepository,
	type WorldRule
} from '@writing-buddy/story-kernel';

export type WorldReviewResource = Location | Faction | WorldRule;
export type WorldReviewKind = WorldAnalysisCandidateResponse['kind'];
export type WorldReviewFieldKey =
	| 'aliases'
	| 'summary'
	| 'locationType'
	| 'parentLocationId'
	| 'rules'
	| 'ideology'
	| 'goals'
	| 'territoryLocationIds'
	| 'category'
	| 'statement'
	| 'scope'
	| 'exceptions'
	| 'consequences';

export interface WorldReviewField {
	readonly id: string;
	readonly key: WorldReviewFieldKey;
	readonly value: string | readonly string[] | null;
	readonly evidence?: EvidenceRef;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
}

export interface WorldReviewCandidate {
	readonly id: string;
	readonly kind: WorldReviewKind;
	readonly title: string;
	readonly matchedResourceId?: string;
	readonly expectedRevision?: number;
	readonly confidence: number;
	readonly rationale: string;
	readonly fields: readonly WorldReviewField[];
	readonly conflicts: readonly string[];
	readonly duplicateCount: number;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface WorldReviewBatch {
	readonly id: string;
	readonly actionType: WorldAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly candidates: readonly WorldReviewCandidate[];
	readonly createdAt: string;
}

function normalizeName(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function responseNames(response: WorldAnalysisCandidateResponse): ReadonlySet<string> {
	return new Set([response.title, ...response.aliases].map(normalizeName).filter(Boolean));
}

function resourceNames(resource: WorldReviewResource): ReadonlySet<string> {
	return new Set([resource.title, ...resource.aliases].map(normalizeName).filter(Boolean));
}

function resourceKind(resource: WorldReviewResource): WorldReviewKind {
	return resource.type === 'worldRule' ? 'worldRule' : resource.type;
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

function responseFields(
	response: WorldAnalysisCandidateResponse
): readonly {
	readonly key: WorldReviewFieldKey;
	readonly value: string | readonly string[] | null;
}[] {
	const common = [{ key: 'aliases' as const, value: response.aliases }];
	if (response.kind === 'location') {
		return [
			...common,
			{ key: 'summary', value: response.summary },
			{ key: 'locationType', value: response.locationType },
			{ key: 'parentLocationId', value: response.parentLocationId },
			{ key: 'rules', value: response.rules }
		];
	}
	if (response.kind === 'faction') {
		return [
			...common,
			{ key: 'summary', value: response.summary },
			{ key: 'ideology', value: response.ideology },
			{ key: 'goals', value: response.goals },
			{ key: 'territoryLocationIds', value: response.territoryLocationIds }
		];
	}
	return [
		...common,
		{ key: 'category', value: response.category },
		{ key: 'statement', value: response.statement },
		{ key: 'scope', value: response.scope },
		{ key: 'exceptions', value: response.exceptions },
		{ key: 'consequences', value: response.consequences }
	];
}

function existingFieldValue(
	resource: WorldReviewResource | undefined,
	key: WorldReviewFieldKey
): unknown {
	if (!resource || !(key in resource)) return undefined;
	return resource[key as keyof WorldReviewResource];
}

function deduplicateResponses(
	responses: readonly WorldAnalysisCandidateResponse[]
): readonly {
	readonly response: WorldAnalysisCandidateResponse;
	readonly duplicateCount: number;
}[] {
	const groups: {
		response: WorldAnalysisCandidateResponse;
		names: Set<string>;
		duplicateCount: number;
	}[] = [];
	for (const response of responses) {
		const names = new Set(responseNames(response));
		const group = groups.find(candidate => (
			candidate.response.kind === response.kind
			&& [...names].some(name => candidate.names.has(name))
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

function automaticRuleConflicts(
	response: Extract<WorldAnalysisCandidateResponse, { readonly kind: 'worldRule' }>,
	rules: readonly WorldRule[]
): readonly string[] {
	const scope = normalizeName(response.scope);
	return rules
		.filter(rule => (
			rule.category === response.category
			&& rule.scope
			&& normalizeName(rule.scope) === scope
			&& normalizeName(rule.statement) !== normalizeName(response.statement)
		))
		.map(rule => `与“${rule.title}”适用范围相同，但规则陈述不同。`);
}

export function stageWorldReviewBatch(input: {
	readonly actionType: WorldAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly locations: readonly Location[];
	readonly factions: readonly Faction[];
	readonly rules: readonly WorldRule[];
	readonly responses: readonly WorldAnalysisCandidateResponse[];
	readonly now?: string;
}): WorldReviewBatch {
	const resources: readonly WorldReviewResource[] = [
		...input.locations,
		...input.factions,
		...input.rules
	];
	const knownLocationIds = new Set<string>(input.locations.map(location => location.id));
	const knownRuleIds = new Set<string>(input.rules.map(rule => rule.id));
	const candidates = deduplicateResponses(input.responses).map(group => {
		const names = responseNames(group.response);
		const matched = resources.find(resource => (
			resourceKind(resource) === group.response.kind
			&& [...resourceNames(resource)].some(name => names.has(name))
		));
		const evidence = anchorEvidence({
			evidence: group.response.evidence,
			sourceResourceId: input.sourceResourceId,
			sourceRevision: input.sourceRevision,
			sourceContent: input.sourceContent
		});
		const invalidEvidence = group.response.evidence !== null && !evidence;
		const externalConflicts = group.response.kind === 'worldRule'
			? [
				...group.response.conflicts.map(conflict => (
					knownRuleIds.has(conflict.resourceId)
						? conflict.reason
						: `未知冲突规则：${conflict.resourceId}`
				)),
				...automaticRuleConflicts(group.response, input.rules)
			].filter((value, index, values) => values.indexOf(value) === index)
			: [];
		const fields = responseFields(group.response).map(field => {
			const existingValue = existingFieldValue(matched, field.key);
			const conflict = hasExistingValue(existingValue)
				&& !valuesEqual(existingValue, field.value)
				? `已有值：${Array.isArray(existingValue)
					? existingValue.join('、')
					: String(existingValue)}`
				: undefined;
			const unknownReference = (
				field.key === 'parentLocationId'
				&& typeof field.value === 'string'
				&& !knownLocationIds.has(field.value)
			) || (
				field.key === 'territoryLocationIds'
				&& Array.isArray(field.value)
				&& field.value.some((id: unknown) => (
					typeof id !== 'string' || !knownLocationIds.has(id)
				))
			);
			const blocking = invalidEvidence || unknownReference;
			return {
				id: `world-field:${crypto.randomUUID()}`,
				key: field.key,
				value: field.value,
				...(evidence ? { evidence } : {}),
				...(blocking
					? { conflict: invalidEvidence
						? '正文证据与章节内容不一致。'
						: '候选引用了未知地点。' }
					: conflict
						? { conflict }
						: {}),
				blocking,
				selectedByDefault: !blocking && !conflict
			};
		});
		return {
			id: `world-candidate:${crypto.randomUUID()}`,
			kind: group.response.kind,
			title: group.response.title,
			...(matched
				? {
					matchedResourceId: matched.id,
					expectedRevision: matched.revision
				}
				: {}),
			confidence: group.response.confidence,
			rationale: group.response.rationale,
			fields,
			conflicts: externalConflicts,
			duplicateCount: group.duplicateCount,
			status: 'candidate' as const
		};
	});
	return {
		id: `world-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		sourceResourceId: input.sourceResourceId,
		sourceRevision: input.sourceRevision,
		sourceContent: input.sourceContent,
		narrativeOrder: input.narrativeOrder,
		candidates,
		createdAt: input.now ?? new Date().toISOString()
	};
}

function confirmedEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

function requiredCreateFields(kind: WorldReviewKind): ReadonlySet<WorldReviewFieldKey> {
	if (kind === 'location') return new Set(['summary', 'locationType']);
	if (kind === 'faction') return new Set(['summary', 'ideology', 'goals']);
	return new Set(['category', 'statement', 'scope']);
}

function resourceTypeFor(kind: WorldReviewKind): 'location' | 'faction' | 'worldRule' {
	return kind;
}

function defaultPayload(
	candidate: WorldReviewCandidate,
	now: string,
	evidenceIds: readonly string[]
): Record<string, unknown> {
	const base = {
		id: createStoryId(candidate.kind === 'worldRule' ? 'world-rule' : candidate.kind),
		type: candidate.kind,
		title: candidate.title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 0,
		evidenceIds
	};
	if (candidate.kind === 'location') {
		return { ...base, travelLinks: [], factionIds: [], rules: [] };
	}
	if (candidate.kind === 'faction') {
		return {
			...base,
			goals: [],
			allyFactionIds: [],
			enemyFactionIds: [],
			territoryLocationIds: []
		};
	}
	return {
		...base,
		category: 'other',
		statement: candidate.title,
		exceptions: [],
		consequences: []
	};
}

export class WorldAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async apply(input: {
		readonly batch: WorldReviewBatch;
		readonly candidateId: string;
		readonly selectedFieldIds: readonly string[];
		readonly currentSourceRevision: string;
		readonly currentSourceContent: string;
		readonly now?: string;
	}): Promise<{
		readonly resource: WorldReviewResource;
		readonly candidate: WorldReviewCandidate;
	}> {
		const candidate = input.batch.candidates.find(item => item.id === input.candidateId);
		if (
			!candidate
			|| candidate.status !== 'candidate'
			|| input.batch.sourceRevision !== input.currentSourceRevision
			|| input.batch.sourceContent !== input.currentSourceContent
		) {
			throw new Error('staleWorldCandidate');
		}
		const selectedIds = new Set(input.selectedFieldIds);
		const fields = candidate.fields.filter(field => selectedIds.has(field.id));
		if (
			fields.length === 0
			|| fields.length !== selectedIds.size
			|| fields.some(field => field.blocking)
		) {
			throw new Error('invalidWorldFieldSelection');
		}
		const type = resourceTypeFor(candidate.kind);
		const current = candidate.matchedResourceId
			? await this.repository.get(type, candidate.matchedResourceId) as unknown as WorldReviewResource | undefined
			: undefined;
		if (
			candidate.matchedResourceId
			&& (!current || current.revision !== candidate.expectedRevision)
		) {
			throw new Error('staleWorldCandidate');
		}
		if (!current) {
			const selectedKeys = new Set(fields.map(field => field.key));
			if ([...requiredCreateFields(candidate.kind)].some(key => !selectedKeys.has(key))) {
				throw new Error('missingWorldRequiredField');
			}
			const resources = await this.repository.list(type) as unknown as readonly WorldReviewResource[];
			const candidateName = normalizeName(candidate.title);
			if (resources.some(resource => resourceNames(resource).has(candidateName))) {
				throw new Error('worldNameCollision');
			}
		}
		const now = input.now ?? new Date().toISOString();
		const evidence = fields.find(field => field.evidence)?.evidence;
		const confirmed = evidence ? confirmedEvidence(evidence, now) : undefined;
		const evidenceIds = [
			...(current?.evidenceIds ?? []),
			...(confirmed ? [confirmed.id] : [])
		].filter((id, index, values) => values.indexOf(id) === index);
		const payload: Record<string, unknown> = current
			? { ...current, updatedAt: now, evidenceIds }
			: defaultPayload(candidate, now, evidenceIds);
		for (const field of fields) {
			if (field.value === null) delete payload[field.key];
			else payload[field.key] = field.value;
		}
		const resource = StorySchemaRegistry.parse(
			type,
			payload
		) as unknown as WorldReviewResource;
		await this.createSnapshot(`AI 世界观 · ${candidate.title}`);
		const saved = current
			? await this.repository.save(resource, current.revision) as unknown as WorldReviewResource
			: (await this.repository.commit([{
				resource,
				expectedAbsent: true
			}]))[0] as unknown as WorldReviewResource;
		if (!saved) throw new Error('worldCommitFailed');
		return {
			resource: saved,
			candidate: { ...candidate, status: 'accepted' }
		};
	}
}
