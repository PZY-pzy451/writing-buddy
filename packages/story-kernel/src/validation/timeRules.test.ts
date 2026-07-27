import { describe, expect, it } from 'vitest';
import { parseTimelineEvent, type TimelineEvent } from '../model/TimelineEvent';
import { runTimelineRules } from './timeRules';

const timestamp = '2026-07-27T00:00:00.000Z';

function event(input: {
	readonly id: string;
	readonly title: string;
	readonly start: string;
	readonly end?: string;
	readonly participant: string;
	readonly location: string;
	readonly order: number;
	readonly predecessorIds?: readonly string[];
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
		revision: 0,
		storyStart: input.start,
		...(input.end ? { storyEnd: input.end } : {}),
		narrativePosition: {
			chapterId: `chapter:chapter-00${input.order}`,
			sceneId: `scene:scene-00${input.order}`,
			narrativeOrder: input.order
		},
		eventType: 'plot',
		participantIds: [input.participant],
		locationIds: [input.location],
		itemIds: [],
		predecessorIds: input.predecessorIds ?? [],
		consequenceIds: [],
		plotThreadIds: [],
		informationIds: [],
		evidenceIds: [`evidence:event-00${input.order}`]
	});
}

describe('runTimelineRules', () => {
	it('finds impossible cross-location overlaps and locates both evidence positions', () => {
		const first = event({
			id: 'timeline-event:station',
			title: '林越在车站',
			start: '2026-07-27T10:00:00.000Z',
			end: '2026-07-27T11:00:00.000Z',
			participant: 'character:lin',
			location: 'location:station',
			order: 1
		});
		const second = event({
			id: 'timeline-event:hotel',
			title: '林越在旅社',
			start: '2026-07-27T10:30:00.000Z',
			end: '2026-07-27T11:30:00.000Z',
			participant: 'character:lin',
			location: 'location:hotel',
			order: 2
		});

		const issues = runTimelineRules({ events: [first, second], travelLinks: [] });
		const overlap = issues.find(issue => issue.ruleId === 'timeline.impossible-overlap');

		expect(overlap?.evidence.map(item => item.eventId)).toEqual([first.id, second.id]);
		expect(overlap?.evidence.map(item => item.sceneId)).toEqual([
			'scene:scene-001',
			'scene:scene-002'
		]);
	});

	it('finds predecessor inversion without flagging correctly ordered events', () => {
		const consequence = event({
			id: 'timeline-event:consequence',
			title: '后果先出现',
			start: '2026-07-27T08:00:00.000Z',
			participant: 'character:shen',
			location: 'location:station',
			order: 1,
			predecessorIds: ['timeline-event:cause']
		});
		const cause = event({
			id: 'timeline-event:cause',
			title: '原因后发生',
			start: '2026-07-27T09:00:00.000Z',
			participant: 'character:other',
			location: 'location:station',
			order: 2
		});

		const issues = runTimelineRules({ events: [consequence, cause], travelLinks: [] });

		expect(issues.filter(issue => issue.ruleId === 'timeline.predecessor-inversion'))
			.toHaveLength(1);
		expect(issues[0]?.evidence).toHaveLength(2);
	});

	it('finds travel gaps shorter than the configured minimum duration', () => {
		const departure = event({
			id: 'timeline-event:departure',
			title: '离开车站',
			start: '2026-07-27T10:00:00.000Z',
			end: '2026-07-27T10:10:00.000Z',
			participant: 'character:lin',
			location: 'location:station',
			order: 1
		});
		const arrival = event({
			id: 'timeline-event:arrival',
			title: '抵达山庄',
			start: '2026-07-27T10:30:00.000Z',
			participant: 'character:lin',
			location: 'location:manor',
			order: 2
		});

		const issues = runTimelineRules({
			events: [departure, arrival],
			travelLinks: [{
				fromLocationId: 'location:station',
				toLocationId: 'location:manor',
				minimumMinutes: 90,
				bidirectional: true
			}]
		});

		const travel = issues.find(issue => issue.ruleId === 'location.insufficient-travel-time');
		expect(travel?.message).toContain('仅有 20 分钟');
		expect(travel?.evidence.map(item => item.eventId)).toEqual([departure.id, arrival.id]);
	});
});
