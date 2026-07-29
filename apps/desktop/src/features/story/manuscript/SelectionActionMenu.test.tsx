import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoryRepository } from '@writing-buddy/story-kernel';
import type { MentionService } from './MentionService';
import { SelectionActionMenu } from './SelectionActionMenu';

describe('SelectionActionMenu', () => {
	it('routes contextual dialogue AI and resource creation into existing workflows', async () => {
		const user = userEvent.setup();
		const onRewrite = vi.fn();
		const onAiMenuClosed = vi.fn();
		const onGenerateResource = vi.fn();
		const onQuickCapture = vi.fn();

		render(
			<SelectionActionMenu
				repository={{} as StoryRepository}
				mentionService={{} as MentionService}
				chapterId="chapter:one"
				manuscript="“别回头。”林越说。\n“为什么？”沈青问。"
				selection={{
					start: 0,
					end: 22,
					text: '“别回头。”林越说。\n“为什么？”沈青问。'
				}}
				readOnly={false}
				onLinked={() => undefined}
				onRewrite={onRewrite}
				onAiMenuClosed={onAiMenuClosed}
				onQuickCapture={onQuickCapture}
				onGenerateResource={onGenerateResource}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'AI 选区操作' }));
		expect(screen.getAllByRole('menuitem').filter(item => (
			item.getAttribute('data-contextual-ai') === 'primary'
		))).toHaveLength(4);
		await user.click(screen.getByRole('menuitem', { name: '优化对话' }));
		await user.click(screen.getByRole('button', { name: '创建人物' }));
		await user.click(screen.getByRole('button', { name: '记录想法' }));

		expect(onRewrite).toHaveBeenCalledWith('dialogue');
		await waitFor(() => expect(onAiMenuClosed).toHaveBeenCalledOnce());
		expect(onGenerateResource).toHaveBeenCalledWith('character');
		expect(onQuickCapture).toHaveBeenCalledOnce();
	});
});
