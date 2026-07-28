import { describe, expect, it, vi } from 'vitest';
import {
	parseTimelineEvent,
	type StoryRepository,
	type TimelineEvent
} from '@writing-buddy/story-kernel';
import {
	TimelineAiReviewService,
	stageTimelineReviewBatch,
	type TimelineReviewSource
} from './TimelineAiReviewService';

const timestamp = '2026-07-27T12:00:00.000Z';
const source: TimelineReviewSource = {
	resourceId: 'chapter:one',
	revision: 'hash:7',
	content: '徐青把褪色车票交给林墨。墙上的钟停在二十三点十七分。',
	narrativeOrder: 3
};

function event(input: {
	readonly id: string;
	readonly title: string;
	readonly locationId?: string;
	readonly revision?: number;
}): TimelineEvent {
	return parseTimelineEvent({
		id: input.id,
		type: 'timelineEvent',
		title: input.title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: input.revision ?? 1,
		storyTimeKind: 'exact',
		storyStart: '2026-07-27T23:17:00.000Z',
		narrativePosition: {
			chapterId: 'chapter:one',
			narrativeOrder: 2
		},
		eventType: '行动',
		participantIds: ['character:lin-mo'],
		locationIds: input.locationId ? [input.locationId] : [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: [],
		informationIds: [],
		evidenceIds: []
	});
}

function response(overrides: Record<string, unknown> = {}) {
	return {
		clientCandidateId: 'candidate:ticket-transfer',
		sourceResourceId: 'chapter:one',
		title: '车票转交',
		aliases: [],
		summary: '徐青把褪色车票交给林墨。',
		eventType: '线索交接',
		storyTimeKind: 'unknown' as const,
		storyStart: null,
		storyEnd: null,
		narrativeOrder: 3,
		participantIds: ['character:lin-mo'],
		locationIds: ['location:old-station'],
		itemIds: ['item:faded-ticket'],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: ['plot-thread:notebook'],
		foreshadowingIds: ['foreshadowing:clock'],
		directResults: ['林墨取得车票'],
		impacts: ['调查转向票面时间'],
		confidence: 0.95,
		rationale: '正文行动明确。',
		evidence: { start: 0, end: 12, quote: '徐青把褪色车票交给林墨' },
		...overrides
	};
}

describe('TimelineAiReviewService', () => {
	it('deduplicates candidates and blocks invalid evidence or deterministic overlap', () => {
		const existing = event({
			id: 'timeline-event:other-place',
			title: '另一地点行动',
			locationId: 'location:far-platform'
		});
		const batch = stageTimelineReviewBatch({
			actionType: 'extract-events',
			sources: [source],
			events: [existing],
			responses: [
				response({
					storyTimeKind: 'exact',
					storyStart: '2026-07-27T23:17:00.000Z',
					evidence: { start: 0, end: 2, quote: '错误' }
				}),
				response({
					clientCandidateId: 'candidate:ticket-transfer-copy',
					aliases: ['交接车票']
				})
			],
			causalEdges: []
		});
		expect(batch.candidates).toHaveLength(1);
		expect(batch.candidates[0]).toMatchObject({
			duplicateCount: 1,
			blocking: true,
			selectedByDefault: false
		});
		expect(batch.candidates[0]?.localIssues.map(issue => issue.ruleId)).toContain(
			'timeline.impossible-overlap'
		);
	});

	it('creates one snapshot and atomically writes selected events and causality', async () => {
		const arrival = event({
			id: 'timeline-event:arrival',
			title: '抵达旧站'
		});
		const batch = stageTimelineReviewBatch({
			actionType: 'suggest-causality',
			sources: [source],
			events: [arrival],
			responses: [response({ evidence: null })],
			causalEdges: [{
				clientEdgeId: 'edge:arrival-transfer',
				from: { kind: 'existing', id: arrival.id },
				to: { kind: 'candidate', id: 'candidate:ticket-transfer' },
				relation: 'enables',
				confidence: 0.9,
				rationale: '到站后才发生交接。'
			}]
		});
		const commit = vi.fn((entries: readonly { readonly resource: unknown }[]) => (
			Promise.resolve(entries.map(entry => ({
				...(entry.resource as TimelineEvent),
				revision: (entry.resource as TimelineEvent).revision + 1
			})))
		));
		const repository = {
			list: vi.fn(() => Promise.resolve([arrival])),
			commit
		} as unknown as StoryRepository;
		const snapshot = vi.fn(() => Promise.resolve('snapshot:timeline'));
		const service = new TimelineAiReviewService(repository, snapshot);
		const result = await service.applyBatch({
			batch,
			selectedCandidateIds: [batch.candidates[0].id],
			selectedEdgeIds: [batch.edges[0].id],
			currentSources: [source],
			now: '2026-07-27T12:05:00.000Z'
		});
		expect(snapshot).toHaveBeenCalledBefore(commit);
		expect(commit).toHaveBeenCalledTimes(1);
		const savedArrival = result.events.find(candidate => candidate.id === arrival.id);
		const savedTransfer = result.events.find(candidate => candidate.title === '车票转交');
		expect(savedArrival?.consequenceIds).toContain(savedTransfer?.id);
		expect(savedTransfer?.predecessorIds).toContain(arrival.id);
	});

	it('rejects a stale source before any repository write', async () => {
		const batch = stageTimelineReviewBatch({
			actionType: 'generate-events',
			sources: [source],
			events: [],
			responses: [response({ evidence: null })],
			causalEdges: []
		});
		const list = vi.fn();
		const repository = {
			list,
			commit: vi.fn()
		} as unknown as StoryRepository;
		const service = new TimelineAiReviewService(repository, vi.fn());
		await expect(service.applyBatch({
			batch,
			selectedCandidateIds: [batch.candidates[0].id],
			selectedEdgeIds: [],
			currentSources: [{ ...source, revision: 'hash:8' }]
		})).rejects.toThrow('staleTimelineSource');
		expect(list).not.toHaveBeenCalled();
	});
});
