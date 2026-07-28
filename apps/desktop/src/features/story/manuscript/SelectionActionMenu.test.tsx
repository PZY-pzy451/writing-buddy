import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoryRepository } from '@writing-buddy/story-kernel';
import type { MentionService } from './MentionService';
import { SelectionActionMenu } from './SelectionActionMenu';

describe('SelectionActionMenu', () => {
	it('routes AI polish and resource creation into visible assistant workflows', async () => {
		const user = userEvent.setup();
		const onRewrite = vi.fn();
		const onGenerateResource = vi.fn();

		render(
			<SelectionActionMenu
				repository={{} as StoryRepository}
				mentionService={{} as MentionService}
				chapterId="chapter:one"
				manuscript="林越走进车站。"
				selection={{ start: 0, end: 2, text: '林越' }}
				readOnly={false}
				onLinked={() => undefined}
				onRewrite={onRewrite}
				onGenerateResource={onGenerateResource}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'AI 润色' }));
		await user.click(screen.getByRole('button', { name: '创建人物' }));

		expect(onRewrite).toHaveBeenCalledOnce();
		expect(onGenerateResource).toHaveBeenCalledWith('character');
	});
});
