import { parseStoryId } from '@writing-buddy/story-kernel';
import type {
	StoryKernelGenerationBatch,
	StoryKernelGenerationCandidate
} from '../ai-context/StoryKernelGenerationService';
import {
	findStaleExtractionBatchIds,
	groupChapterOrganizationCandidates
} from './ChapterOrganizationModel';

function candidate(
	id: string,
	resourceType: StoryKernelGenerationCandidate['resourceType'],
	options: Partial<StoryKernelGenerationCandidate> = {}
): StoryKernelGenerationCandidate {
	return {
		id: parseStoryId(`candidate:${id}`),
		operation: 'create',
		resourceType,
		resourceId: parseStoryId(`${resourceType}:${id}`),
		title: id,
		rawResource: {},
		confidence: 0.9,
		rationale: '正文依据',
		conflicts: [],
		status: 'pending',
		createdAt: '2026-07-29T08:00:00.000Z',
		updatedAt: '2026-07-29T08:00:00.000Z',
		...options
	};
}

function batch(
	id: string,
	sourceResourceId: string,
	sourceRevision: string,
	candidates: readonly StoryKernelGenerationCandidate[]
): StoryKernelGenerationBatch {
	return {
		id: parseStoryId(`generation:${id}`),
		schemaVersion: 1,
		sourceResourceId: parseStoryId(sourceResourceId),
		sourceRevision,
		baseOffset: 0,
		instruction: '只提取有正文依据的资料。',
		targetTypes: [...new Set(candidates.map(item => item.resourceType))],
		candidates,
		createdAt: '2026-07-29T08:00:00.000Z',
		updatedAt: '2026-07-29T08:00:00.000Z'
	};
}

describe('ChapterOrganizationModel', () => {
	it('groups candidates by type with pending, conflict, resolved, and low-confidence counts', () => {
		const batches = [batch('one', 'chapter:one', 'hash-one', [
			candidate('lin', 'character'),
			candidate('shen', 'character', { confidence: 0.45 }),
			candidate('station', 'location', {
				conflicts: [{
					code: 'create-collision',
					message: '地点已存在',
					blocking: true
				}]
			}),
			candidate('ticket', 'item', { status: 'accepted' })
		])];

		const groups = groupChapterOrganizationCandidates(batches);
		expect(groups.map(group => group.type)).toEqual(['character', 'location', 'item']);
		expect(groups[0]).toMatchObject({
			pendingCount: 2,
			conflictCount: 0,
			resolvedCount: 0,
			lowConfidenceCount: 1
		});
		expect(groups[1]).toMatchObject({ pendingCount: 1, conflictCount: 1 });
		expect(groups[2]).toMatchObject({ resolvedCount: 1 });
		expect(groups.flatMap(group => group.entries)
			.filter(entry => entry.defaultSelected)).toEqual([]);
	});

	it('marks only batches whose authoritative chapter hash changed as stale', () => {
		const batches = [
			batch('one', 'chapter:one', 'hash-one', [candidate('lin', 'character')]),
			batch('two', 'chapter:two', 'hash-two', [candidate('ticket', 'item')])
		];
		expect(findStaleExtractionBatchIds(batches, new Map([
			['chapter:one', 'hash-new'],
			['chapter:two', 'hash-two']
		]))).toEqual(new Set(['generation:one']));
	});
});
