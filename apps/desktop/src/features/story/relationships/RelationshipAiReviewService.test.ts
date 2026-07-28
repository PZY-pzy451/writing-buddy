import { describe, expect, it, vi } from 'vitest';
import {
	StorySchemaRegistry,
	type Character,
	type Relationship,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import {
	RelationshipAiReviewService,
	stageRelationshipReviewBatch
} from './RelationshipAiReviewService';

const now = '2026-07-27T12:00:00.000Z';

function character(id: string, title: string): Character {
	return StorySchemaRegistry.parse('character', {
		id,
		type: 'character',
		title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 1,
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: []
	}) as unknown as Character;
}

function relationship(revision = 2): Relationship {
	return StorySchemaRegistry.parse('relationship', {
		id: 'relationship:lin-shen',
		type: 'relationship',
		title: '林越 → 沈青',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision,
		sourceCharacterId: 'character:lin-yue',
		targetCharacterId: 'character:shen-qing',
		relationshipType: '戒备',
		strength: 0.4,
		visibility: 'private',
		effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 1 },
		evidenceIds: [],
		history: []
	}) as unknown as Relationship;
}

describe('RelationshipAiReviewService', () => {
	const characters = [
		character('character:lin-yue', '林越'),
		character('character:shen-qing', '沈青')
	];

	it('keeps opposite directions, deduplicates identical edges, and blocks invalid evidence', () => {
		const sourceContent = '沈青把钥匙交给林越。';
		const batch = stageRelationshipReviewBatch({
			actionType: 'extract-relationship-changes',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			characters,
			relationships: [relationship()],
			responses: [{
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '信任',
				strength: 0.8,
				visibility: 'private',
				confidence: 0.9,
				rationale: '交付钥匙改变认知。',
				evidence: { start: 0, end: 10, quote: sourceContent }
			}, {
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '信任',
				strength: 0.8,
				visibility: 'private',
				confidence: 0.9,
				rationale: '重复。',
				evidence: { start: 0, end: 10, quote: sourceContent }
			}, {
				sourceCharacterId: 'character:shen-qing',
				targetCharacterId: 'character:lin-yue',
				relationshipType: '保护',
				visibility: 'secret',
				confidence: 0.8,
				rationale: '反向认知。',
				evidence: { start: 0, end: 2, quote: '错误' }
			}]
		});

		expect(batch.candidates).toHaveLength(2);
		expect(batch.candidates[0]).toMatchObject({
			matchedRelationshipId: 'relationship:lin-shen',
			conflict: '将更新已有关系“戒备”',
			blocking: false
		});
		expect(batch.candidates[1]).toMatchObject({ blocking: true });
	});

	it('snapshots and explicitly promotes one candidate to a formal edge', async () => {
		const current = relationship();
		const sourceContent = '沈青把钥匙交给林越。';
		const batch = stageRelationshipReviewBatch({
			actionType: 'extract-relationship-changes',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			characters,
			relationships: [current],
			responses: [{
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '信任',
				strength: 0.8,
				visibility: 'private',
				description: '林越决定暂时相信沈青。',
				confidence: 0.9,
				rationale: '交付钥匙改变认知。',
				evidence: { start: 0, end: 10, quote: sourceContent }
			}]
		});
		let saved: Relationship | undefined;
		const saveRelationship = vi.fn((resource: unknown) => {
			saved = { ...(resource as Relationship), revision: 3 };
			return Promise.resolve(saved);
		});
		const repository = {
			get: vi.fn(() => Promise.resolve(current)),
			save: saveRelationship
		} as unknown as StoryRepository;
		const snapshot = vi.fn(() => Promise.resolve('snapshot:relationship'));
		const service = new RelationshipAiReviewService(repository, snapshot);

		const result = await service.apply({
			batch,
			candidateId: batch.candidates[0].id,
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent,
			now: '2026-07-27T12:05:00.000Z'
		});

		expect(snapshot).toHaveBeenCalledBefore(saveRelationship);
		expect(result.relationship).toMatchObject({
			relationshipType: '信任',
			strength: 0.8,
			revision: 3
		});
		expect(result.relationship.history.at(-1)).toMatchObject({
			relationshipType: '信任',
			effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 3 }
		});
		expect(saved?.evidenceIds).toHaveLength(1);
	});

	it('rejects stale formal relationship revisions', async () => {
		const current = relationship();
		const batch = stageRelationshipReviewBatch({
			actionType: 'generate-relationship',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent: '关系设定。',
			narrativeOrder: 3,
			characters,
			relationships: [current],
			responses: [{
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '盟友',
				visibility: 'public',
				confidence: 0.8,
				rationale: '作者设定。',
				evidence: null
			}]
		});
		const repository = {
			get: vi.fn(() => Promise.resolve(relationship(3)))
		} as unknown as StoryRepository;
		const service = new RelationshipAiReviewService(repository, vi.fn());
		await expect(service.apply({
			batch,
			candidateId: batch.candidates[0].id,
			currentSourceRevision: 'hash:7',
			currentSourceContent: '关系设定。'
		})).rejects.toThrow('staleRelationshipCandidate');
	});
});
