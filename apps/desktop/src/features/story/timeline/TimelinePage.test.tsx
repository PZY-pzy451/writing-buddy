import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
	parseTimelineEvent,
	type TimelineEvent
} from '@writing-buddy/story-kernel';
import {
	CausalityConfirmDialog,
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
	it('shows virtualized tracks, selects events and confirms a causal conflict by pointer with a list fallback', async () => {
		render(
			<TimelinePage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		expect(await screen.findByRole('region', { name: '多轨时间线画布' })).toBeInTheDocument();
		expect(screen.getByText('人物 · 林越')).toBeInTheDocument();
		const canvasEvents = screen.getAllByTestId('timeline-event-select');
		expect(canvasEvents.map(event => event.dataset.eventId).sort()).toEqual([
			'timeline-event:memory',
			'timeline-event:station'
		]);
		fireEvent.click(canvasEvents.find(event => event.dataset.eventId === 'timeline-event:station')!);

		fireEvent.click(screen.getByRole('tab', { name: '叙事顺序' }));
		fireEvent.click(screen.getByRole('button', { name: '列表替代视图' }));

		const rows = screen.getAllByRole('row');
		expect(rows[1]).toHaveTextContent('车站相遇');
		expect(rows[2]).toHaveTextContent('童年回忆');

		const confirmCausality = vi.fn();
		render(
			<CausalityConfirmDialog
				conflicts={[{
					eventId: 'timeline-event:memory',
					eventTitle: '童年回忆',
					predecessorId: 'timeline-event:station',
					predecessorTitle: '车站相遇'
				}]}
				saving={false}
				onCancel={vi.fn()}
				onConfirm={confirmCausality}
			/>
		);
		const confirm = screen.getByTestId('timeline-causality-confirm');
		expect(confirm).toBeEnabled();
		fireEvent.click(confirm);
		expect(confirmCausality).toHaveBeenCalledOnce();
	});

	it('supports keyboard event selection and saves edits through the injected action', async () => {
		const user = userEvent.setup();
		const saveEvent = vi.fn((event: TimelineEvent) => Promise.resolve(event));
		render(
			<TimelinePage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
				saveEvent={saveEvent}
			/>
		);

		const first = (await screen.findAllByTestId('timeline-event-select'))
			.find(event => event.dataset.eventId === 'timeline-event:memory')!;
		first.focus();
		expect(screen.getByText('确认旧站时钟失去时间参照')).toBeInTheDocument();
		expect(screen.getByText('调查转向二十三点十七分')).toBeInTheDocument();
		await user.keyboard('{ArrowRight}');
		expect(screen.getByRole('heading', { name: '车站相遇' })).toBeInTheDocument();

		const title = screen.getByRole('textbox', { name: '事件标题' });
		await user.clear(title);
		await user.type(title, '雨夜车站相遇');
		await user.click(screen.getByRole('button', { name: '保存事件' }));

		await waitFor(() => {
			expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ title: '雨夜车站相遇' }));
		});
	});

	it('opens AI story progress, edits scope and instruction, deduplicates generation and toggles event and causal candidates', async () => {
		const user = userEvent.setup();
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
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

		const aiEntry = await screen.findByTestId('timeline-ai-open');
		expect(aiEntry).toHaveAttribute('data-entry', 'toolbar');
		await user.click(aiEntry);
		expect(screen.getByRole('complementary', { name: 'AI 故事进程助手' })).toBeInTheDocument();
		expect(screen.getAllByTestId('timeline-ai-action').map(action => action.dataset.action)).toEqual([
			'extract-events',
			'generate-events',
			'generate-directions',
			'suggest-causality'
		]);
		const scope = screen.getByTestId('timeline-ai-scope');
		await user.selectOptions(scope, 'selected-chapters');
		const chapterToggle = screen.getByTestId('timeline-ai-chapter-toggle');
		expect(chapterToggle).toHaveAttribute('data-chapter-id', 'chapter:chapter-000000a1');
		expect(chapterToggle).toBeChecked();
		await user.click(chapterToggle);
		expect(chapterToggle).not.toBeChecked();
		await user.click(chapterToggle);
		expect(chapterToggle).toBeChecked();
		await user.selectOptions(scope, 'current-chapter');
		const instruction = screen.getByTestId('timeline-ai-instruction');
		await user.clear(instruction);
		await user.type(instruction, '提取事件，并保留可核对的直接结果与因果边。');
		const generate = screen.getByTestId('timeline-ai-generate');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByRole('heading', { name: '雨夜时钟停摆' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(screen.getByRole('heading', { name: '褪色票据揭示时间' })).toBeInTheDocument();
		expect(screen.getByText('虚线因果候选')).toBeInTheDocument();
		expect(screen.getAllByText(/AI 建议/).length).toBeGreaterThan(0);
		expect(screen.getAllByRole('button', { name: '查看原文证据' })).toHaveLength(2);
		const candidateToggle = screen.getAllByTestId('timeline-ai-candidate-toggle')[0];
		expect(candidateToggle).toHaveAttribute('data-candidate-id');
		expect(candidateToggle).toBeChecked();
		await user.click(candidateToggle);
		expect(candidateToggle).not.toBeChecked();
		await user.click(candidateToggle);
		const edgeToggle = screen.getAllByTestId('timeline-ai-edge-toggle')[0];
		expect(edgeToggle).toHaveAttribute('data-edge-id');
		expect(edgeToggle).toBeChecked();
		await user.click(edgeToggle);
		expect(edgeToggle).not.toBeChecked();
		await user.click(edgeToggle);
		expect(screen.getByTestId('timeline-ai-apply')).toBeEnabled();
		await desktopBridge.deleteDeepSeekKey();
	});
});
