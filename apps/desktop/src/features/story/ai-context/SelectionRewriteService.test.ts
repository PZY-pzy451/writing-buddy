import { describe, expect, it } from 'vitest';
import { EditTransactionService } from '@writing-buddy/project';
import {
	buildContextPack,
	parseStateRecord,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import {
	createRewriteCandidate,
	isRewriteCandidateStale,
	loadGroundedContextCandidates,
	SelectionRewriteService
} from './SelectionRewriteService';

function candidate() {
	const pack = buildContextPack({
		actionType: 'polish',
		instruction: '润色',
		selection: { text: '非常非常安静', resourceId: 'chapter:one', revision: 4, start: 2, end: 8 },
		candidates: [],
		budgetTokens: 512
	});
	return createRewriteCandidate({
		pack,
		response: {
			suggestion: '格外安静',
			rationale: '删除重复表达。',
			potentialImpact: '不改变情节。'
		}
	});
}

describe('SelectionRewriteService', () => {
	it('accepts an author-confirmed candidate and supports undo', () => {
		const service = new SelectionRewriteService(new EditTransactionService());
		const current = '夜里非常非常安静。';
		const applied = service.accept(candidate(), 4, current);
		expect(applied.content).toBe('夜里格外安静。');
		expect(service.undo(applied.content).content).toBe(current);
	});

	it('accepts an edited partial candidate', () => {
		const current = '夜里非常非常安静。';
		const applied = new SelectionRewriteService(new EditTransactionService())
			.accept(candidate(), 4, current, '很安静');
		expect(applied.content).toBe('夜里很安静。');
	});

	it('marks candidates stale after revision or source text changes', () => {
		const value = candidate();
		expect(isRewriteCandidateStale(value, 5, '夜里非常非常安静。')).toBe(true);
		expect(() => new SelectionRewriteService(new EditTransactionService())
			.accept(value, 4, '夜里并不安静。')).toThrow('staleRewriteCandidate');
	});

	it('grounds scene characters in their dynamic state at the current narrative position', async () => {
		const timestamp = '2026-07-27T00:00:00.000Z';
		const resources = {
			scene: [{
				id: 'scene:rain-station',
				type: 'scene',
				title: '雨夜车站',
				aliases: [],
				tags: [],
				schemaVersion: 1,
				createdAt: timestamp,
				updatedAt: timestamp,
				revision: 0,
				chapterId: 'chapter:one',
				manuscriptRange: { start: 0, end: 24, revision: 0, quote: '雨落在站台上。' },
				narrativeOrder: 5,
				locationIds: [],
				participantIds: ['character:lin'],
				plotThreadIds: [],
				revealInformationIds: [],
				foreshadowingIds: [],
				evidenceIds: []
			}],
			character: [{
				id: 'character:lin',
				type: 'character',
				title: '林越',
				aliases: [],
				tags: [],
				schemaVersion: 1,
				createdAt: timestamp,
				updatedAt: timestamp,
				revision: 0,
				factionIds: [],
				goals: ['找到失踪者'],
				desires: [],
				fears: [],
				values: [],
				secrets: [],
				evidenceIds: []
			}]
		} as const;
		const repository = {
			list: (type: string) => Promise.resolve(resources[type as keyof typeof resources] ?? [])
		} as unknown as StoryRepository;
		const stateRecords = [
			parseStateRecord({
				id: 'state:lin-location',
				characterId: 'character:lin',
				kind: 'location',
				value: '旧车站',
				effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 3 },
				evidenceIds: ['evidence:arrival'],
				confirmation: 'confirmed',
				revision: 0
			}),
			parseStateRecord({
				id: 'state:lin-emotion',
				characterId: 'character:lin',
				kind: 'emotion',
				value: '警惕',
				effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 5 },
				evidenceIds: ['evidence:reaction'],
				confirmation: 'pending',
				revision: 0
			})
		];

		const candidates = await loadGroundedContextCandidates({
			repository,
			chapterId: 'chapter:one',
			selectionStart: 8,
			stateRecords
		});
		const character = candidates.find(candidate => candidate.kind === 'character');
		expect(character?.priority).toBe('P3');
		expect(character?.content).toContain('当前位置：旧车站（作者已确认）');
		expect(character?.content).toContain('当前情绪：警惕（待作者确认）');
	});
});
