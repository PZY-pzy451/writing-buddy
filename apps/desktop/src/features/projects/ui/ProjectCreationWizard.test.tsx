import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';

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
		projectWizardStartRoute: undefined,
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

		await user.click(within(welcome).getByRole('button', { name: '根据题材生成大纲' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		expect(within(dialog).getByRole('navigation', { name: '创建步骤' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		expect(await within(dialog).findByText('作品名称需要为 1–80 个字符。')).toBeInTheDocument();
		expect(within(dialog).getByText('请选择作品保存位置。')).toBeInTheDocument();
		expect(within(dialog).getByRole('textbox', { name: /^作品名称/ })).toHaveAttribute('aria-invalid', 'true');
	});

	it('offers four truthful starting paths with genre as the only primary action', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });

		expect(within(welcome).getByRole('button', { name: '根据题材生成大纲' }))
			.toHaveClass('primary-button');
		expect(document.querySelectorAll('.app-shell .primary-button')).toHaveLength(1);
		for (const label of ['导入已有大纲', '导入已有正文', '创建空白作品']) {
			expect(within(welcome).getByRole('button', { name: new RegExp(label, 'u') }))
				.not.toHaveClass('primary-button');
		}

		await user.click(within(welcome).getByRole('button', { name: /导入已有大纲/u }));
		expect(useAppStore.getState()).toMatchObject({
			projectWizardOpen: true,
			projectWizardStartRoute: 'outline'
		});
		expect(await screen.findByRole('dialog', { name: '新建项目' })).toBeInTheDocument();
	});

	it('defaults to the genre-to-outline start while preserving the other truthful starts', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '根据题材生成大纲' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '无日期的人');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		const genreStart = within(dialog).getByRole('button', {
			name: /根据题材生成小说大纲/
		});
		expect(genreStart).toHaveAttribute('aria-pressed', 'true');
		expect(within(dialog).getByRole('button', { name: /我只有几个想法/ }))
			.toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /空白项目/ }))
			.toBeInTheDocument();
	});

	it('creates through five steps, preserves the manuscript start, and opens the first chapter', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '根据题材生成大纲' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });

		await user.type(within(dialog).getByLabelText('作品名称'), '雾港来信');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '你现在从哪里开始？' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /我已经写了一部分正文/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '初始结构' })).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '外观与写作方式' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /深夜/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '确认创建' })).toBeInTheDocument();
		expect(within(dialog).getByText(/3 个文件/)).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /创建项目/ }));
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
		const newProject = within(menu).getByRole('menuitem', { name: /新建项目/ });
		const openProject = within(menu).getByRole('menuitem', { name: /打开项目/ });
		expect(newProject).toBeEnabled();
		expect(openProject).toBeEnabled();
		expect(within(menu).getByRole('menuitem', { name: /新建章节/ })).toBeDisabled();
		expect(within(menu).getAllByText('请先打开作品')).toHaveLength(5);
		expect(newProject).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(openProject).toHaveFocus();
		await user.keyboard('{Escape}');
		expect(trigger).toHaveFocus();
	});

	it('offers New project from the open-project menu and supports keyboard navigation', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '打开已有 Writing Buddy 作品' }));
		await screen.findByRole('heading', { name: '作品大纲' });

		const trigger = screen.getByRole('button', { name: '项目菜单' });
		await user.click(trigger);
		const menu = screen.getByRole('menu', { name: '项目操作' });
		const newProject = within(menu).getByRole('menuitem', { name: /新建项目/ });
		const openProject = within(menu).getByRole('menuitem', { name: /打开项目/ });
		expect(newProject).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(openProject).toHaveFocus();
		await user.keyboard('{Escape}');
		expect(trigger).toHaveFocus();

		await user.click(trigger);
		await user.click(within(screen.getByRole('menu', { name: '项目操作' })).getByRole('menuitem', { name: /新建项目/ }));
		expect(await screen.findByRole('dialog', { name: '新建项目' })).toBeInTheDocument();
	});

	it('does not write a new project when the current manuscript is dirty and switching is cancelled', async () => {
		const user = userEvent.setup();
		const createSpy = vi.spyOn(desktopBridge, 'createProject');
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		render(<App />);
		await act(async () => {
			await useAppStore.getState().chooseProject();
			const snapshot = useAppStore.getState().snapshot;
			const chapter = snapshot?.project.volumes[0]?.chapters[0];
			if (!snapshot || !chapter) throw new Error('Browser project fixture is incomplete.');
			await useAppStore.getState().openResource({
				id: chapter.id,
				type: 'chapter',
				title: chapter.title,
				path: chapter.file,
				projectId: snapshot.project.projectId
			});
			useAppStore.getState().setContent(`${useAppStore.getState().session?.content ?? ''}未保存修改`);
		});

		await user.click(screen.getByRole('button', { name: '项目菜单' }));
		await user.click(within(screen.getByRole('menu', { name: '项目操作' })).getByRole('menuitem', { name: /新建项目/ }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '未写入的新项目');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		expect(within(dialog).getByText('当前项目有未保存正文')).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /创建项目/ }));

		expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('有尚未保存的正文'));
		expect(createSpy).not.toHaveBeenCalled();
		expect(within(dialog).getByText('已取消创建；当前项目和未保存正文保持不变。')).toBeInTheDocument();
	});
});
