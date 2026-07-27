import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineEvent } from '@writing-buddy/story-kernel';
import { VirtualTimelineList } from './VirtualTimelineList';

function events(count: number): readonly TimelineEvent[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `timeline-event:${index.toString().padStart(4, '0')}`,
		type: 'timelineEvent',
		title: `事件 ${index}`,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: '2026-07-27T00:00:00.000Z',
		updatedAt: '2026-07-27T00:00:00.000Z',
		revision: 0,
		storyTimeKind: 'unknown',
		narrativePosition: {
			chapterId: 'chapter:one',
			narrativeOrder: index
		},
		eventType: '测试',
		participantIds: [],
		locationIds: [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: [],
		informationIds: [],
		evidenceIds: []
	})) as unknown as readonly TimelineEvent[];
}

describe('VirtualTimelineList', () => {
	it('renders only a bounded window while exposing the full row count', () => {
		const onSelect = vi.fn();
		const { container } = render(
			<VirtualTimelineList events={events(10_000)} labels={{}} onSelect={onSelect} />
		);

		expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '10001');
		expect(container.querySelectorAll('[data-timeline-list-event]').length).toBeLessThan(24);
		expect(screen.queryByText('事件 9999')).not.toBeInTheDocument();
	});

	it('supports arrow navigation through the accessible list fallback', () => {
		const onSelect = vi.fn();
		render(<VirtualTimelineList events={events(100)} labels={{}} onSelect={onSelect} />);
		const first = screen.getByRole('button', { name: '事件 0' });

		fireEvent.keyDown(first, { key: 'ArrowDown' });

		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
			id: 'timeline-event:0001'
		}));
	});
});
