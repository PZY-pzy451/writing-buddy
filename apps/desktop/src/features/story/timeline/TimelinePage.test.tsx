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
import { desktopBridge } from '../../../platform/bridge';

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
		directResults: ['确认旧站时钟失去时间参照'],
		impacts: ['调查转向二十三点十七分'],
		plotThreadIds: ['plot-thread:notebook'],
		foreshadowingIds: [],
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
		expect(screen.getByText('确认旧站时钟失去时间参照')).toBeInTheDocument();
		expect(screen.getByText('调查转向二十三点十七分')).toBeInTheDocument();
		fireEvent.keyDown(first, { key: 'ArrowRight' });
		expect(screen.getByRole('heading', { name: '车站相遇' })).toBeInTheDocument();

		fireEvent.change(screen.getByRole('textbox', { name: '事件标题' }), {
			target: { value: '雨夜车站相遇' }
		});
		fireEvent.click(screen.getByRole('button', { name: '保存事件' }));

		expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ title: '雨夜车站相遇' }));
	});

	it('opens the AI story-progress workflow with evidence and separate causal-edge review', async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		const openEvidence = vi.fn();
		render(
			<TimelinePage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve(data)}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 0,
					volumeId: 'volume:volume-00000001',
					volumeTitle: '第一卷'
				}]}
				onOpenEvidence={openEvidence}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 从正文提取' }));
		expect(screen.getByRole('complementary', { name: 'AI 故事进程助手' })).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '生成事件与因果候选' }));

		expect(await screen.findByRole('heading', { name: '雨夜时钟停摆' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: '褪色票据揭示时间' })).toBeInTheDocument();
		expect(screen.getByText('虚线因果候选')).toBeInTheDocument();
		expect(screen.getAllByText(/AI 建议/).length).toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '查看原文证据' })).toHaveLength(2);
		await desktopBridge.deleteDeepSeekKey();
	});
});
