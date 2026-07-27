import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	parseTimelineEvent,
	type TimelineEvent
} from '@writing-buddy/story-kernel';
import {
	TimelinePage,
	type TimelinePageData
} from './TimelinePage';

const timestamp = '2026-07-27T00:00:00.000Z';

function timelineEvent(
	id: string,
	title: string,
	narrativeOrder: number,
	storyStart: string
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
		storyStart,
		narrativePosition: {
			chapterId: 'chapter:chapter-001',
			narrativeOrder
		},
		eventType: '主线',
		participantIds: ['character:lin-yue'],
		locationIds: ['location:old-station'],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: ['plot-thread:notebook'],
		informationIds: [],
		evidenceIds: ['evidence:chapter-one']
	});
}

const data: TimelinePageData = {
	events: [
		timelineEvent('timeline-event:memory', '童年回忆', 5, '2012-04-03T08:00:00.000Z'),
		timelineEvent('timeline-event:station', '车站相遇', 1, '2026-07-27T23:17:00.000Z')
	],
	labels: {
		'character:lin-yue': '林越',
		'location:old-station': '旧车站',
		'plot-thread:notebook': '遗失笔记'
	}
};

describe('TimelinePage', () => {
	it('shows virtualized tracks, switches order mode and provides a list fallback', async () => {
		render(
			<TimelinePage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		expect(await screen.findByRole('region', { name: '多轨时间线画布' })).toBeInTheDocument();
		expect(screen.getByText('人物 · 林越')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('tab', { name: '叙事顺序' }));
		fireEvent.click(screen.getByRole('button', { name: '列表替代视图' }));

		const rows = screen.getAllByRole('row');
		expect(rows[1]).toHaveTextContent('车站相遇');
		expect(rows[2]).toHaveTextContent('童年回忆');
	});

	it('supports keyboard event selection and saves edits through the injected action', async () => {
		const saveEvent = vi.fn((event: TimelineEvent) => Promise.resolve(event));
		render(
			<TimelinePage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
				saveEvent={saveEvent}
			/>
		);

		const first = await screen.findByRole('button', { name: /童年回忆/ });
		first.focus();
		fireEvent.keyDown(first, { key: 'ArrowRight' });
		expect(screen.getByRole('heading', { name: '车站相遇' })).toBeInTheDocument();

		fireEvent.change(screen.getByRole('textbox', { name: '事件标题' }), {
			target: { value: '雨夜车站相遇' }
		});
		fireEvent.click(screen.getByRole('button', { name: '保存事件' }));

		expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ title: '雨夜车站相遇' }));
	});
});
