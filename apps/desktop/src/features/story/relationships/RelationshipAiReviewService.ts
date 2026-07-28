import type {
	RelationshipAnalysisActionType,
	RelationshipAnalysisCandidateResponse
} from '@writing-buddy/ai';
import {
	StorySchemaRegistry,
	createStoryId,
	parseEvidenceRef,
	type Character,
	type EvidenceRef,
	type Relationship,
	type StoryRepository
} from '@writing-buddy/story-kernel';

export interface RelationshipReviewCandidate {
	readonly id: string;
	readonly sourceCharacterId: string;
	readonly sourceTitle: string;
	readonly targetCharacterId: string;
	readonly targetTitle: string;
	readonly relationshipType: string;
	readonly strength: number;
	readonly visibility: Relationship['visibility'];
	readonly description?: string;
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence?: EvidenceRef;
	readonly matchedRelationshipId?: string;
	readonly expectedRevision?: number;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface RelationshipReviewBatch {
	readonly id: string;
	readonly actionType: RelationshipAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly candidates: readonly RelationshipReviewCandidate[];
	readonly createdAt: string;
}

function anchorEvidence(input: {
	readonly response: RelationshipAnalysisCandidateResponse;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
}): EvidenceRef | undefined {
	const evidence = input.response.evidence;
	if (!evidence) return undefined;
	if (
		evidence.end <= evidence.start
		|| evidence.end > input.sourceContent.length
		|| input.sourceContent.slice(evidence.start, evidence.end) !== evidence.quote
	) {
		return undefined;
	}
	return parseEvidenceRef({
		id: createStoryId('evidence'),
		origin: 'ai-extracted',
		resourceId: input.sourceResourceId,
		range: { start: evidence.start, end: evidence.end },
		revisionId: input.sourceRevision,
		quotePreview: evidence.quote,
		confirmedByAuthor: false
	});
}

function relationshipSignature(response: RelationshipAnalysisCandidateResponse): string {
	return [
		response.sourceCharacterId,
		response.targetCharacterId,
		response.relationshipType.trim().toLocaleLowerCase(),
		response.evidence?.start ?? -1,
		response.evidence?.end ?? -1
	].join('|');
}

export function stageRelationshipReviewBatch(input: {
	readonly actionType: RelationshipAnalysisActionType;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly sourceContent: string;
	readonly narrativeOrder: number;
	readonly characters: readonly Character[];
	readonly relationships: readonly Relationship[];
	readonly responses: readonly RelationshipAnalysisCandidateResponse[];
	readonly now?: string;
}): RelationshipReviewBatch {
	const byCharacterId = new Map<string, Character>(
		input.characters.map(character => [character.id, character])
	);
	const seen = new Set<string>();
	const candidates = input.responses.flatMap(response => {
		const signature = relationshipSignature(response);
		if (seen.has(signature)) return [];
		seen.add(signature);
		const source = byCharacterId.get(response.sourceCharacterId);
		const target = byCharacterId.get(response.targetCharacterId);
		const matched = input.relationships
			.filter(relationship => (
				relationship.sourceCharacterId === response.sourceCharacterId
				&& relationship.targetCharacterId === response.targetCharacterId
			))
			.sort((left, right) => right.revision - left.revision)[0];
		const evidence = anchorEvidence({
			response,
			sourceResourceId: input.sourceResourceId,
			sourceRevision: input.sourceRevision,
			sourceContent: input.sourceContent
		});
		const invalidEvidence = response.evidence !== null && !evidence;
		const conflict = matched && (
			matched.relationshipType !== response.relationshipType
			|| matched.strength !== response.strength
			|| matched.visibility !== response.visibility
			|| (matched.description ?? '') !== (response.description ?? '')
		)
			? `将更新已有关系“${matched.relationshipType}”`
			: undefined;
		return [{
			id: `relationship-candidate:${crypto.randomUUID()}`,
			sourceCharacterId: response.sourceCharacterId,
			sourceTitle: source?.title ?? response.sourceCharacterId,
			targetCharacterId: response.targetCharacterId,
			targetTitle: target?.title ?? response.targetCharacterId,
			relationshipType: response.relationshipType,
			strength: response.strength ?? 0.5,
			visibility: response.visibility,
			...(response.description ? { description: response.description } : {}),
			confidence: response.confidence,
			rationale: response.rationale,
			...(evidence ? { evidence } : {}),
			...(matched
				? {
					matchedRelationshipId: matched.id,
					expectedRevision: matched.revision
				}
				: {}),
			...(invalidEvidence
				? { conflict: '正文证据与章节内容不一致。' }
				: conflict
					? { conflict }
					: {}),
			blocking: !source || !target || invalidEvidence,
			status: 'candidate' as const
		}];
	});
	return {
		id: `relationship-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		sourceResourceId: input.sourceResourceId,
		sourceRevision: input.sourceRevision,
		sourceContent: input.sourceContent,
		narrativeOrder: input.narrativeOrder,
		candidates,
		createdAt: input.now ?? new Date().toISOString()
	};
}

function confirmEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

export class RelationshipAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async apply(input: {
		readonly batch: RelationshipReviewBatch;
		readonly candidateId: string;
		readonly currentSourceRevision: string;
		readonly currentSourceContent: string;
		readonly now?: string;
	}): Promise<{
		readonly relationship: Relationship;
		readonly candidate: RelationshipReviewCandidate;
	}> {
		const candidate = input.batch.candidates.find(item => item.id === input.candidateId);
		if (
			!candidate
			|| candidate.status !== 'candidate'
			|| candidate.blocking
			|| input.batch.sourceRevision !== input.currentSourceRevision
			|| input.batch.sourceContent !== input.currentSourceContent
		) {
			throw new Error('staleRelationshipCandidate');
		}
		const current = candidate.matchedRelationshipId
			? await this.repository.get('relationship', candidate.matchedRelationshipId) as unknown as Relationship | undefined
			: undefined;
		if (
			candidate.matchedRelationshipId
			&& (!current || current.revision !== candidate.expectedRevision)
		) {
			throw new Error('staleRelationshipCandidate');
		}
		const now = input.now ?? new Date().toISOString();
		const evidence = candidate.evidence ? confirmEvidence(candidate.evidence, now) : undefined;
		const effectiveFrom = {
			chapterId: input.batch.sourceResourceId,
			narrativeOrder: input.batch.narrativeOrder
		};
		const payload = {
			...(current ?? {
				id: createStoryId('relationship'),
				type: 'relationship' as const,
				title: `${candidate.sourceTitle} → ${candidate.targetTitle} · ${candidate.relationshipType}`,
				aliases: [],
				tags: [],
				schemaVersion: 1 as const,
				createdAt: now,
				revision: 0,
				history: []
			}),
			updatedAt: now,
			sourceCharacterId: candidate.sourceCharacterId,
			targetCharacterId: candidate.targetCharacterId,
			relationshipType: candidate.relationshipType,
			strength: candidate.strength,
			visibility: candidate.visibility,
			...(candidate.description ? { description: candidate.description } : {}),
			effectiveFrom,
			evidenceIds: [
				...(current?.evidenceIds ?? []),
				...(evidence ? [evidence.id] : [])
			].filter((id, index, values) => values.indexOf(id) === index),
			history: current
				? [
					...current.history,
					{
						effectiveFrom,
						relationshipType: candidate.relationshipType,
						strength: candidate.strength,
						visibility: candidate.visibility,
						evidenceIds: evidence ? [evidence.id] : []
					}
				]
				: []
		};
		const relationship = StorySchemaRegistry.parse(
			'relationship',
			payload
		) as unknown as Relationship;
		await this.createSnapshot(
			`AI 关系 · ${candidate.sourceTitle} → ${candidate.targetTitle}`
		);
		const saved = current
			? await this.repository.save(
				relationship,
				current.revision
			) as unknown as Relationship
			: (await this.repository.commit([{
				resource: relationship,
				expectedAbsent: true
			}]))[0] as unknown as Relationship;
		if (!saved) throw new Error('relationshipCommitFailed');
		return {
			relationship: saved,
			candidate: { ...candidate, status: 'accepted' }
		};
	}
}
