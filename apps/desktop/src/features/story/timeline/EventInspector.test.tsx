import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseTimelineEvent, type TimelineEvent } from '@writing-buddy/story-kernel';
import { EventInspector } from './EventInspector';

const timestamp = '2026-08-04T00:00:00.000Z';

function eventFixture(): TimelineEvent {
	return parseTimelineEvent({
		id: 'timeline-event:station',
		type: 'timelineEvent',
		title: 'Station encounter',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0,
		storyStart: '2026-08-04T23:17:00.000Z',
		narrativePosition: {
			chapterId: 'chapter:chapter-001',
			narrativeOrder: 1
		},
		eventType: 'main',
		participantIds: [],
		locationIds: [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		directResults: [],
		impacts: [],
		plotThreadIds: [],
		foreshadowingIds: [],
		informationIds: [],
		evidenceIds: []
	});
}

function renderInspector(overrides: {
	onSave?: (event: TimelineEvent) => Promise<void>;
	onClose?: () => void;
	saving?: boolean;
} = {}) {
	return render(
		<EventInspector
			event={eventFixture()}
			saving={overrides.saving ?? false}
			labels={{}}
			ruleIssues={[]}
			onSave={overrides.onSave ?? (() => Promise.resolve())}
			onClose={overrides.onClose ?? vi.fn()}
		/>
	);
}

describe('EventInspector', () => {
	it('renders seven accessible stable controls and disables invalid save', () => {
		renderInspector();

		for (const selector of [
			'event-inspector-close',
			'event-inspector-title',
			'event-inspector-event-type',
			'event-inspector-story-start',
			'event-inspector-story-end',
			'event-inspector-narrative-order',
			'event-inspector-save'
		]) {
			expect(screen.getByTestId(selector)).toBeInTheDocument();
		}

		fireEvent.change(screen.getByTestId('event-inspector-title'), {
			target: { value: '   ' }
		});
		expect(screen.getByTestId('event-inspector-save')).toBeDisabled();
	});

	it('deduplicates 100 repeated pointer save attempts while loading and allows success', async () => {
		let finishSave: (() => void) | undefined;
		const onSave = vi.fn(() => new Promise<void>(resolve => {
			finishSave = resolve;
		}));
		renderInspector({ onSave });
		const save = screen.getByTestId('event-inspector-save');

		for (let attempt = 0; attempt < 100; attempt += 1) {
			fireEvent.click(save);
		}

		expect(onSave).toHaveBeenCalledOnce();
		await act(async () => {
			finishSave?.();
			await Promise.resolve();
		});
	});

	it('releases the save guard after failure so a retry can succeed', async () => {
		const onSave = vi.fn()
			.mockRejectedValueOnce(new Error('disk unavailable'))
			.mockResolvedValueOnce(undefined);
		renderInspector({ onSave });
		const save = screen.getByTestId('event-inspector-save');

		fireEvent.click(save);
		expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请重试。');
		fireEvent.click(save);
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

		expect(onSave).toHaveBeenCalledTimes(2);
	});

	it('deduplicates 100 repeated close pointer attempts', () => {
		const onClose = vi.fn();
		renderInspector({ onClose });
		const close = screen.getByTestId('event-inspector-close');

		for (let attempt = 0; attempt < 100; attempt += 1) {
			fireEvent.click(close);
		}

		expect(onClose).toHaveBeenCalledOnce();
	});
});
