import { parseStoryId } from '@writing-buddy/story-kernel';
import type {
	StoryKernelGenerationBatch,
	StoryKernelGenerationCandidate
} from '../ai-context/StoryKernelGenerationService';
import {
	buildChapterReconciliationPatch,
	findMaterializedChapterPlan,
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

	it('resolves a canonical materialized chapter plan and adopts only selected actual fields', () => {
		const plan = findMaterializedChapterPlan([{
			id: 'journey-outline:chapter-one',
			title: '取得褪色车票',
			summary: '林越从画师手中取得褪色车票。',
			purpose: '推进调查',
			type: 'chapter',
			goal: '取得车票',
			conflict: '画师拒绝交谈',
			outcome: '林越获得车票',
			hook: '车票背面出现名字',
			source: 'ai_generated',
			status: 'drafting',
			revision: 4,
			resourceId: 'chapter-one'
		}], [], 'chapter:chapter-one');
		expect(plan).toMatchObject({
			nodeId: 'journey-outline:chapter-one',
			revision: 4,
			locked: false
		});

		const patch = buildChapterReconciliationPatch(plan!, {
			planNodeId: 'journey-outline:chapter-one',
			planRevision: 4,
			actual: {
				summary: '画师展示车票，但没有交给林越。',
				goal: '取得车票',
				conflict: '画师拒绝交出车票',
				outcome: '林越只看到了车票',
				hook: '车票仍留在画师手中'
			},
			differences: [{
				field: 'outcome',
				planned: '林越获得车票',
				actual: '林越只看到了车票'
			}],
			status: 'pending'
		}, ['outcome']);
		expect(patch).toEqual({
			outcome: '林越只看到了车票',
			source: 'extracted_from_draft',
			status: 'drafted'
		});
		expect(() => buildChapterReconciliationPatch(
			{ ...plan!, revision: 5 },
			{
				planNodeId: 'journey-outline:chapter-one',
				planRevision: 4,
				actual: {
					summary: '',
					goal: '',
					conflict: '',
					outcome: '旧候选',
					hook: ''
				},
				differences: [{
					field: 'outcome',
					planned: '',
					actual: '旧候选'
				}],
				status: 'pending'
			},
			['outcome']
		)).toThrow('staleChapterReconciliationPlan');
	});

	it('treats a changed plan revision as stale without invalidating unrelated batches', () => {
		const reconciled = {
			...batch('reconciled', 'chapter:one', 'hash-one', [candidate('lin', 'character')]),
			chapterReconciliation: {
				planNodeId: 'journey-outline:chapter-one',
				planRevision: 4,
				actual: { summary: '', goal: '', conflict: '', outcome: '', hook: '' },
				differences: [],
				status: 'pending',
				updatedAt: '2026-07-29T08:00:00.000Z'
			}
		} as StoryKernelGenerationBatch;
		const unrelated = batch(
			'unrelated',
			'chapter:two',
			'hash-two',
			[candidate('ticket', 'item')]
		);
		expect(findStaleExtractionBatchIds(
			[reconciled, unrelated],
			new Map([
				['chapter:one', 'hash-one'],
				['chapter:two', 'hash-two']
			]),
			new Map([['journey-outline:chapter-one', 5]])
		)).toEqual(new Set(['generation:reconciled']));
	});

	it('does not relabel an explicitly resolved plan comparison as stale after its update', () => {
		const reconciled = {
			...batch('resolved', 'chapter:one', 'hash-one', [candidate('lin', 'character')]),
			chapterReconciliation: {
				planNodeId: 'journey-outline:chapter-one',
				planRevision: 4,
				actual: { summary: '', goal: '', conflict: '', outcome: '', hook: '' },
				differences: [],
				status: 'outline-updated',
				updatedAt: '2026-07-29T08:00:00.000Z'
			}
		} as StoryKernelGenerationBatch;
		expect(findStaleExtractionBatchIds(
			[reconciled],
			new Map([['chapter:one', 'hash-one']]),
			new Map([['journey-outline:chapter-one', 5]])
		)).toEqual(new Set());
	});
});
