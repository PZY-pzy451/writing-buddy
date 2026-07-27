import { describe, expect, it } from 'vitest';
import { parseTimelineEvent, type TimelineEvent } from '../model/TimelineEvent';
import { queryEvents } from './TimelineQuery';

const timestamp = '2026-07-27T00:00:00.000Z';

function event(
	id: string,
	title: string,
	narrativeOrder: number,
	storyStart?: string,
	participantIds: readonly string[] = []
): TimelineEvent {
	return parseTimelineEvent({
		id,
		type: 'timelineEvent',
		title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0,
		...(storyStart ? { storyStart } : {}),
		narrativePosition: {
			chapterId: 'chapter:chapter-001',
			narrativeOrder
		},
		eventType: 'plot',
		participantIds,
		locationIds: [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: [],
		informationIds: [],
		evidenceIds: []
	});
}

const events = [
	event('timeline-event:memory', '童年回忆', 6, '2012-04-03T08:00:00.000Z', ['character:lin']),
	event('timeline-event:station', '车站相遇', 1, '2026-07-27T23:17:00.000Z', ['character:lin', 'character:shen']),
	event('timeline-event:letter', '收到来信', 3, '2026-07-26T10:00:00.000Z', ['character:shen']),
	event('timeline-event:unknown', '未知时刻的电话', 4)
];

describe('queryEvents', () => {
	it('keeps story-time order separate from narrative order', () => {
		expect(queryEvents(events, {}, {}, 'story-time').map(item => item.title)).toEqual([
			'童年回忆',
			'收到来信',
			'车站相遇',
			'未知时刻的电话'
		]);
		expect(queryEvents(events, {}, {}, 'narrative-order').map(item => item.title)).toEqual([
			'车站相遇',
			'收到来信',
			'未知时刻的电话',
			'童年回忆'
		]);
	});

	it('applies participant filters and an inclusive story-time window', () => {
		const result = queryEvents(
			events,
			{
				start: '2026-07-26T00:00:00.000Z',
				end: '2026-07-27T23:17:00.000Z'
			},
			{ participantIds: ['character:shen'] },
			'story-time'
		);

		expect(result.map(item => item.title)).toEqual(['收到来信', '车站相遇']);
	});
});
