import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MentionLink, StoryRepository, StoryResourceType } from '@writing-buddy/story-kernel';
import { afterEach } from 'vitest';
import type { MentionService } from './MentionService';
import { SelectionActionMenu } from './SelectionActionMenu';

describe('SelectionActionMenu', () => {
	afterEach(() => vi.restoreAllMocks());

	it('routes stable contextual actions and supports Arrow keyboard menu navigation', async () => {
		const user = userEvent.setup();
		const onRewrite = vi.fn();
		const onAiMenuClosed = vi.fn();
		const onGenerateResource = vi.fn<(type: StoryResourceType) => void>();
		const onQuickCapture = vi.fn();
		const onLinked = vi.fn();
		const linkSelection = vi.fn(() => Promise.resolve({ id: 'mention:test' } as MentionLink));
		vi.spyOn(window, 'prompt').mockReturnValue('character:lin-yue');

		render(
			<SelectionActionMenu
				repository={{} as StoryRepository}
				mentionService={{ linkSelection } as unknown as MentionService}
				chapterId="chapter:one"
				manuscript="“别回头。”林越说。\n“为什么？”沈青问。"
				selection={{
					start: 0,
					end: 22,
					text: '“别回头。”林越说。\n“为什么？”沈青问。'
				}}
				readOnly={false}
				onLinked={onLinked}
				onRewrite={onRewrite}
				onAiMenuClosed={onAiMenuClosed}
				onQuickCapture={onQuickCapture}
				onGenerateResource={onGenerateResource}
			/>
		);

		const disclosure = screen.getByTestId('selection-action-ai-disclosure');
		await user.click(screen.getByRole('button', { name: 'AI 选区操作' }));
		const menuItems = screen.getAllByRole('menuitem');
		expect(screen.getAllByTestId('selection-action-rewrite')).toHaveLength(menuItems.length);
		expect(menuItems.filter(item => (
			item.getAttribute('data-contextual-ai') === 'primary'
		))).toHaveLength(4);
		await waitFor(() => expect(menuItems[0]).toHaveFocus());
		fireEvent.keyDown(menuItems[0], { key: 'ArrowDown' });
		expect(menuItems[1]).toHaveFocus();
		fireEvent.keyDown(menuItems[1], { key: 'End' });
		expect(menuItems.at(-1)).toHaveFocus();
		fireEvent.keyDown(menuItems.at(-1)!, { key: 'Home' });
		expect(menuItems[0]).toHaveFocus();
		fireEvent.keyDown(menuItems[0], { key: 'ArrowUp' });
		expect(menuItems.at(-1)).toHaveFocus();
		fireEvent.keyDown(menuItems.at(-1)!, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
		expect(disclosure.querySelector('summary')).toHaveFocus();

		await user.click(screen.getByRole('button', { name: 'AI 选区操作' }));
		await user.click(screen.getByRole('menuitem', { name: '优化对话' }));
		expect(screen.getAllByTestId('selection-action-create-resource')).toHaveLength(5);
		for (const label of ['创建人物', '创建地点', '创建物品', '标记为信息揭示', '创建伏笔']) {
			await user.click(screen.getByRole('button', { name: label }));
		}
		await user.click(screen.getByRole('button', { name: '记录想法' }));
		await user.click(screen.getByTestId('selection-action-link-existing'));

		expect(onRewrite).toHaveBeenCalledWith('dialogue');
		await waitFor(() => expect(onAiMenuClosed).toHaveBeenCalledTimes(2));
		expect(onGenerateResource.mock.calls.map(([type]) => type)).toEqual([
			'character',
			'location',
			'item',
			'information',
			'foreshadowing'
		]);
		expect(onQuickCapture).toHaveBeenCalledOnce();
		await waitFor(() => expect(linkSelection).toHaveBeenCalledOnce());
		expect(onLinked).toHaveBeenCalledWith(expect.objectContaining({ id: 'mention:test' }));
	});

	it('shows actionable stable link failures without exposing internal identifiers', async () => {
		const user = userEvent.setup();
		vi.spyOn(window, 'prompt').mockReturnValue('character:missing');
		render(
			<SelectionActionMenu
				repository={{} as StoryRepository}
				mentionService={{
					linkSelection: () => Promise.reject(new Error('storyResourceNotFound'))
				} as unknown as MentionService}
				chapterId="chapter:one"
				manuscript="顾言打开信封。"
				selection={{ start: 0, end: 2, text: '顾言' }}
				readOnly={false}
				onLinked={() => undefined}
				onRewrite={() => undefined}
			/>
		);

		await user.click(screen.getByTestId('selection-action-link-existing'));
		expect(await screen.findByRole('status')).toHaveTextContent('没有找到该 Story 资源');
		expect(screen.queryByText(/storyResourceNotFound/u)).not.toBeInTheDocument();
	});
});
