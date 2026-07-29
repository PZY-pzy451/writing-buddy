import type { TimelineEvent } from '@writing-buddy/story-kernel';
import { timelineDropPreview } from './TimelineReorderFeedback';

const events = [
	{ id: 'event:first', title: '第一件事' },
	{ id: 'event:second', title: '第二件事' },
	{ id: 'event:third', title: '第三件事' }
] as unknown as readonly TimelineEvent[];

describe('timelineDropPreview', () => {
	it('states the exact destination and the fields that remain unchanged', () => {
		expect(timelineDropPreview(events, 'event:second')).toBe(
			'移动到叙事顺序第 2 位；只改变顺序，不改变实际时间'
		);
	});

	it('does not invent a preview for a missing target', () => {
		expect(timelineDropPreview(events, 'event:missing')).toBeUndefined();
	});
});
