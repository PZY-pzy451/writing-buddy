import { describe, expect, it, vi } from 'vitest';
import {
	parseForeshadowing,
	parsePlotThread,
	type Foreshadowing,
	type PlotThread,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import {
	PlotAiReviewService,
	stagePlotReviewBatch
} from './PlotAiReviewService';
import type { TimelineReviewSource } from '../timeline/TimelineAiReviewService';

const timestamp = '2026-07-27T12:00:00.000Z';
const source: TimelineReviewSource = {
	resourceId: 'chapter:one',
	revision: 'hash:7',
	content: '墙上的钟停在二十三点十七分，林墨第一次意识到失踪并非偶然。',
	narrativeOrder: 3
};
const base = {
	aliases: [],
	tags: [],
	schemaVersion: 1 as const,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 1,
	evidenceIds: []
};

describe('PlotAiReviewService', () => {
	it('deduplicates same-name clues and separates early-payoff local checks', () => {
		const clue = parseForeshadowing({
			...base,
			id: 'foreshadowing:clock',
			type: 'foreshadowing',
			title: '停摆时钟',
			status: 'planted',
			surfaceMeaning: '旧钟故障',
			readerVisibility: 0.3
		});
		const response = {
			kind: 'foreshadowing' as const,
			sourceResourceId: 'chapter:one',
			title: '停摆时钟',
			aliases: [],
			summary: '同一时刻反复出现。',
			status: 'resolved' as const,
			plantedAt: { chapterId: 'chapter:one', narrativeOrder: 1 },
			surfaceMeaning: '旧钟故障',
			trueMeaning: '事故发生时间',
			reminderPositions: [],
			plannedPayoffAt: { chapterId: 'chapter:one', narrativeOrder: 8 },
			actualPayoffAt: { chapterId: 'chapter:one', narrativeOrder: 3 },
			readerVisibility: 0.8,
			plotThreadIds: ['plot-thread:notebook'],
			confidence: 0.92,
			rationale: '候选回收。',
			evidence: { start: 0, end: 14, quote: '墙上的钟停在二十三点十七分' }
		};
		const batch = stagePlotReviewBatch({
			actionType: 'extract-foreshadowing',
			includeAuthorSecrets: false,
			sources: [source],
			threads: [],
			foreshadowing: [clue],
			responses: [
				response,
				{ ...response, aliases: ['雨夜停钟'] }
			],
			currentNarrativeOrder: 3
		});
		expect(batch.candidates).toHaveLength(1);
		expect(batch.candidates[0]).toMatchObject({
			matchedResourceId: clue.id,
			duplicateCount: 1,
			selectedByDefault: false
		});
		expect(batch.candidates[0]?.localIssues.map(issue => issue.ruleId)).toContain(
			'plot.foreshadowing-early-payoff'
		);
	});

	it('snapshots and atomically creates selected plot candidates only', async () => {
		const batch = stagePlotReviewBatch({
			actionType: 'generate-plot-thread',
			includeAuthorSecrets: false,
			sources: [source],
			threads: [],
			foreshadowing: [],
			responses: [{
				kind: 'plotThread',
				sourceResourceId: 'chapter:one',
				title: '零号月台调查',
				aliases: [],
				summary: '调查被从站图删除的月台。',
				status: 'active',
				premise: '林墨得到一张不存在的站牌照片。',
				stakes: '错过雨夜窗口将失去唯一证据。',
				dramaticQuestion: '零号月台为何被删除？',
				startPosition: { chapterId: 'chapter:one', narrativeOrder: 3 },
				targetResolution: { chapterId: 'chapter:one', narrativeOrder: 9 },
				actualResolution: null,
				participantIds: ['character:lin-mo'],
				sceneIds: ['scene:station'],
				confidence: 0.91,
				rationale: '形成可追踪主线。',
				evidence: null
			}],
			currentNarrativeOrder: 3
		});
		const commit = vi.fn((entries: readonly { readonly resource: unknown }[]) => (
			Promise.resolve(entries.map(entry => ({
				...(entry.resource as PlotThread),
				revision: 1
			})))
		));
		const repository = {
			list: vi.fn((type: string) => Promise.resolve(
				type === 'plotThread' ? [] : []
			)),
			commit
		} as unknown as StoryRepository;
		const snapshot = vi.fn(() => Promise.resolve('snapshot:plot'));
		const result = await new PlotAiReviewService(repository, snapshot).applyBatch({
			batch,
			selectedCandidateIds: [batch.candidates[0].id],
			currentSources: [source],
			now: '2026-07-27T12:05:00.000Z'
		});
		expect(snapshot).toHaveBeenCalledBefore(commit);
		expect(result.resources).toHaveLength(1);
		expect(result.resources[0]).toMatchObject({
			type: 'plotThread',
			title: '零号月台调查',
			status: 'active'
		});
	});

	it('rejects a stale matched resource revision', async () => {
		const thread = parsePlotThread({
			...base,
			id: 'plot-thread:notebook',
			type: 'plotThread',
			title: '遗失笔记',
			status: 'active'
		});
		const batch = stagePlotReviewBatch({
			actionType: 'generate-plot-consequences',
			includeAuthorSecrets: false,
			sources: [source],
			threads: [thread],
			foreshadowing: [],
			responses: [{
				kind: 'plotThread',
				sourceResourceId: 'chapter:one',
				title: thread.title,
				aliases: [],
				summary: '调查受阻。',
				status: 'at-risk',
				premise: '笔记被人替换。',
				stakes: '误导会令调查对象逃离。',
				dramaticQuestion: '谁替换了笔记？',
				startPosition: null,
				targetResolution: null,
				actualResolution: null,
				participantIds: [],
				sceneIds: [],
				confidence: 0.8,
				rationale: '生成阻碍。',
				evidence: null
			}],
			currentNarrativeOrder: 3
		});
		const staleThread: PlotThread = { ...thread, revision: 2 };
		const service = new PlotAiReviewService({
			list: vi.fn((type: string) => Promise.resolve(
				type === 'plotThread' ? [staleThread] : [] as readonly Foreshadowing[]
			))
		} as unknown as StoryRepository, vi.fn());
		await expect(service.applyBatch({
			batch,
			selectedCandidateIds: [batch.candidates[0].id],
			currentSources: [source]
		})).rejects.toThrow('stalePlotResource');
	});
});
