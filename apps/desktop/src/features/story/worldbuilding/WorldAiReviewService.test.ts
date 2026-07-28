import { describe, expect, it, vi } from 'vitest';
import {
	StorySchemaRegistry,
	type Location,
	type StoryRepository,
	type WorldRule
} from '@writing-buddy/story-kernel';
import {
	WorldAiReviewService,
	stageWorldReviewBatch
} from './WorldAiReviewService';

const now = '2026-07-27T12:00:00.000Z';
const sourceContent = '旧车站的机械钟只在雨夜停摆。';

function rule(revision = 2): WorldRule {
	return StorySchemaRegistry.parse('worldRule', {
		id: 'world-rule:rain-clock',
		type: 'worldRule',
		title: '雨夜停钟',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision,
		category: 'magic',
		statement: '雨夜里所有机械钟都会停摆。',
		scope: '旧车站',
		exceptions: [],
		consequences: [],
		evidenceIds: []
	}) as unknown as WorldRule;
}

describe('WorldAiReviewService', () => {
	it('deduplicates entries and surfaces same-scope rule conflicts and bad evidence', () => {
		const batch = stageWorldReviewBatch({
			actionType: 'extract-worldbuilding',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			locations: [],
			factions: [],
			rules: [rule()],
			responses: [{
				kind: 'worldRule',
				title: '雨夜停钟',
				aliases: [],
				category: 'magic',
				statement: '只有站台上的钟会停摆。',
				scope: '旧车站',
				exceptions: ['站长室'],
				consequences: ['旅客失去时间参照'],
				conflicts: [],
				confidence: 0.9,
				rationale: '正文明确。',
				evidence: { start: 0, end: 3, quote: '错误' }
			}, {
				kind: 'worldRule',
				title: '雨夜停钟',
				aliases: ['停钟规则'],
				category: 'magic',
				statement: '只有站台上的钟会停摆。',
				scope: '旧车站',
				exceptions: ['站长室'],
				consequences: ['旅客失去时间参照'],
				conflicts: [],
				confidence: 0.8,
				rationale: '重复候选。',
				evidence: { start: 0, end: 3, quote: '旧车站' }
			}]
		});

		expect(batch.candidates).toHaveLength(1);
		expect(batch.candidates[0]).toMatchObject({
			matchedResourceId: 'world-rule:rain-clock',
			duplicateCount: 1
		});
		expect(batch.candidates[0]?.conflicts[0]).toContain('适用范围相同');
		expect(batch.candidates[0]?.fields.every(field => field.blocking)).toBe(true);
	});

	it('snapshots and creates only selected structured location fields', async () => {
		const batch = stageWorldReviewBatch({
			actionType: 'generate-world-entry',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			locations: [],
			factions: [],
			rules: [],
			responses: [{
				kind: 'location',
				title: '钟楼站台',
				aliases: [],
				summary: '旧站最深处的封闭站台。',
				locationType: '站台',
				parentLocationId: null,
				rules: ['雨夜禁止鸣笛'],
				confidence: 0.9,
				rationale: '补足地点层级。',
				evidence: null
			}]
		});
		let saved: Location | undefined;
		const commit = vi.fn((entries: readonly { readonly resource: unknown }[]) => {
			saved = {
				...(entries[0]?.resource as Location),
				revision: 1
			};
			return Promise.resolve([saved]);
		});
		const repository = {
			list: vi.fn(() => Promise.resolve([])),
			commit
		} as unknown as StoryRepository;
		const snapshot = vi.fn(() => Promise.resolve('snapshot:world'));
		const service = new WorldAiReviewService(repository, snapshot);
		const candidate = batch.candidates[0];
		const selected = candidate.fields
			.filter(field => field.key !== 'parentLocationId')
			.map(field => field.id);

		const result = await service.apply({
			batch,
			candidateId: candidate.id,
			selectedFieldIds: selected,
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent,
			now: '2026-07-27T12:05:00.000Z'
		});

		expect(snapshot).toHaveBeenCalledBefore(commit);
		expect(result.resource).toMatchObject({
			type: 'location',
			title: '钟楼站台',
			locationType: '站台',
			rules: ['雨夜禁止鸣笛'],
			revision: 1
		});
	});

	it('rejects a stale matched world resource revision', async () => {
		const current = rule();
		const batch = stageWorldReviewBatch({
			actionType: 'generate-world-entry',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			locations: [],
			factions: [],
			rules: [current],
			responses: [{
				kind: 'worldRule',
				title: current.title,
				aliases: [],
				category: 'magic',
				statement: '雨夜只有站台钟停摆。',
				scope: '旧车站',
				exceptions: [],
				consequences: [],
				conflicts: [],
				confidence: 0.8,
				rationale: '规则候选。',
				evidence: null
			}]
		});
		const service = new WorldAiReviewService({
			get: vi.fn(() => Promise.resolve(rule(3)))
		} as unknown as StoryRepository, vi.fn());
		await expect(service.apply({
			batch,
			candidateId: batch.candidates[0].id,
			selectedFieldIds: [batch.candidates[0].fields[0].id],
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent
		})).rejects.toThrow('staleWorldCandidate');
	});
});
