import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseStoryId, type MentionLink } from '@writing-buddy/story-kernel';
import type { MentionService } from '../manuscript/MentionService';
import { BacklinksPanel } from './BacklinksPanel';

const backlink: MentionLink = {
	id: parseStoryId('mention:lin-mo-station'),
	resourceId: parseStoryId('character:lin-mo'),
	chapterId: parseStoryId('chapter:chapter-a11ce001'),
	anchor: {
		start: 12,
		end: 14,
		revision: 1,
		quote: '林墨',
		before: '雨夜里，',
		after: '推开门。'
	},
	displayText: '林墨',
	status: 'active',
	revision: 1,
	createdAt: '2026-08-06T00:00:00.000Z',
	updatedAt: '2026-08-06T00:00:00.000Z'
};

describe('BacklinksPanel', () => {
	it('opens the exact backlink by pointer and keyboard', async () => {
		const user = userEvent.setup();
		const onOpenBacklink = vi.fn();
		const service = {
			listBacklinks: vi.fn().mockResolvedValue([backlink])
		} as unknown as MentionService;
		render(
			<BacklinksPanel
				service={service}
				resourceId="character:lin-mo"
				onOpenBacklink={onOpenBacklink}
			/>
		);

		const open = await screen.findByTestId('backlinks-open');
		expect(open).toHaveAttribute('data-mention-id', 'mention:lin-mo-station');
		await user.click(open);
		expect(onOpenBacklink).toHaveBeenLastCalledWith(backlink);
		open.focus();
		await user.keyboard('{Enter}');
		expect(onOpenBacklink).toHaveBeenCalledTimes(2);
	});
});
