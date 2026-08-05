import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@writing-buddy/story-kernel';
import { TimelineReorderRail } from './TimelineReorderRail';
import { timelineDropPreview } from './TimelineReorderFeedback';

const events = [
	{ id: 'event:first', title: '第一件事', narrativePosition: { narrativeOrder: 1 } },
	{ id: 'event:second', title: '第二件事', narrativePosition: { narrativeOrder: 2 } },
	{ id: 'event:third', title: '第三件事', narrativePosition: { narrativeOrder: 3 } }
] as unknown as readonly TimelineEvent[];

describe('timelineDropPreview', () => {
	it('shows the exact destination and selects an event without changing actual time', () => {
		const onSelect = vi.fn();
		render(createElement(TimelineReorderRail, {
			events,
			mode: 'narrative-order',
			disabled: false,
			onSelect,
			onReorder: vi.fn()
		}));
		const handles = screen.getAllByTestId('timeline-reorder-handle');
		expect(handles).toHaveLength(3);
		expect(handles[1]).toHaveAttribute('data-event-id', 'event:second');
		expect(handles[1]).toHaveAttribute('data-narrative-order', '2');
		const eventButtons = screen.getAllByTestId('timeline-reorder-event');
		expect(eventButtons).toHaveLength(3);
		expect(eventButtons[1]).toHaveAttribute('data-event-id', 'event:second');
		expect(eventButtons[1]).toHaveAttribute('data-narrative-order', '2');
		fireEvent.click(eventButtons[1]);
		expect(onSelect).toHaveBeenCalledWith(events[1]);
		expect(timelineDropPreview(events, 'event:second')).toBe(
			'移动到叙事顺序第 2 位；只改变顺序，不改变实际时间'
		);
	});

	it('disables every reorder handle and does not invent a preview for a missing target', () => {
		render(createElement(TimelineReorderRail, {
			events,
			mode: 'narrative-order',
			disabled: true,
			onSelect: vi.fn(),
			onReorder: vi.fn()
		}));
		expect(screen.getAllByTestId('timeline-reorder-handle')).toHaveLength(3);
		for (const handle of screen.getAllByTestId('timeline-reorder-handle')) {
			expect(handle).toBeDisabled();
		}
		expect(timelineDropPreview(events, 'event:missing')).toBeUndefined();
	});
});
