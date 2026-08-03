import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MentionLink, StoryRepository, StoryResourceType } from '@writing-buddy/story-kernel';
import { afterEach } from 'vitest';
import type { MentionService } from './MentionService';
import { SelectionActionMenu } from './SelectionActionMenu';

describe('SelectionActionMenu', () => {
	afterEach(() => vi.restoreAllMocks());

	it('routes contextual dialogue AI and resource creation into existing workflows', async () => {
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

		await user.click(screen.getByRole('button', { name: 'AI 选区操作' }));
		expect(screen.getAllByRole('menuitem').filter(item => (
			item.getAttribute('data-contextual-ai') === 'primary'
		))).toHaveLength(4);
		await user.click(screen.getByRole('menuitem', { name: '优化对话' }));
		for (const label of ['创建人物', '创建地点', '创建物品', '标记为信息揭示', '创建伏笔']) {
			await user.click(screen.getByRole('button', { name: label }));
		}
		await user.click(screen.getByRole('button', { name: '记录想法' }));
		await user.click(screen.getByRole('button', { name: '链接已有资源' }));

		expect(onRewrite).toHaveBeenCalledWith('dialogue');
		await waitFor(() => expect(onAiMenuClosed).toHaveBeenCalledOnce());
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

	it('shows actionable link failures without exposing internal identifiers', async () => {
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

		await user.click(screen.getByRole('button', { name: '链接已有资源' }));
		expect(await screen.findByRole('status')).toHaveTextContent('没有找到该 Story 资源');
		expect(screen.queryByText(/storyResourceNotFound/u)).not.toBeInTheDocument();
	});
});
