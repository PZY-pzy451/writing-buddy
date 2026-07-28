import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App';
import { useAppStore } from '../../../app/store';

function resetWorkspace(): void {
	localStorage.clear();
	useAppStore.setState({
		recentProjectRoot: undefined,
		recentProjectRoots: [],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		projectWizardOpen: false,
		loading: false,
		error: undefined,
		activeMode: 'works',
		theme: 'paper',
		accent: 'gold'
	});
}

describe('guided project creation', () => {
	beforeEach(resetWorkspace);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('shows a focused welcome experience and clear creation validation', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		expect(within(welcome).getByRole('heading', { name: '开始你的故事' })).toBeInTheDocument();

		await user.click(within(welcome).getByRole('button', { name: '新建作品' }));
		const dialog = await screen.findByRole('dialog', { name: '新建作品' });
		expect(within(dialog).getByRole('navigation', { name: '创建步骤' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		expect(await within(dialog).findByText('作品名称需要为 1–80 个字符。')).toBeInTheDocument();
		expect(within(dialog).getByText('请选择作品保存位置。')).toBeInTheDocument();
		expect(within(dialog).getByRole('textbox', { name: /^作品名称/ })).toHaveAttribute('aria-invalid', 'true');
	});

	it('creates through the four steps, restores project appearance, and opens the first chapter', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '新建作品' }));
		const dialog = await screen.findByRole('dialog', { name: '新建作品' });

		await user.type(within(dialog).getByLabelText('作品名称'), '雾港来信');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '初始结构' })).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '外观与写作方式' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /深夜/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '确认创建' })).toBeInTheDocument();
		expect(within(dialog).getByText(/3 个文件/)).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /创建作品/ }));
		await waitFor(() => {
			expect(screen.getByRole('heading', { level: 1, name: '第一章' })).toBeInTheDocument();
		});
		expect(document.querySelector('.app-shell')).toHaveClass('theme-midnight');
		expect(useAppStore.getState().recentProjectRoots[0]).toContain('雾港来信');
		expect(useAppStore.getState().snapshot?.appearance?.themeId).toBe('midnight');
	});

	it('keeps the global create menu useful without an open project', async () => {
		const user = userEvent.setup();
		render(<App />);
		const trigger = await screen.findByRole('button', { name: '新建' });
		await user.click(trigger);
		const menu = screen.getByRole('menu', { name: '新建内容' });
		expect(within(menu).getByRole('menuitem', { name: /新建作品/ })).toBeEnabled();
		expect(within(menu).getByRole('menuitem', { name: /导入旧项目/ })).toBeEnabled();
		expect(within(menu).getByRole('menuitem', { name: /新建章节/ })).toBeDisabled();
		expect(within(menu).getAllByText('请先打开作品')).toHaveLength(6);
	});
});
