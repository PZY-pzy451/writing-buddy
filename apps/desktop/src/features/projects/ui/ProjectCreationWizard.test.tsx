import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import { ProjectWelcome } from './ProjectWelcome';

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

	it('exposes stable automation metadata across all five creation steps', async () => {
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '根据题材生成大纲' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });

		expect(dialog).toHaveAttribute('data-testid', 'project-creation-wizard');
		expect(within(dialog).getByRole('navigation', { name: '创建步骤' })
			.querySelector('button'))
			.toHaveAttribute('data-testid', 'project-wizard-step');
		expect(within(dialog).getByLabelText('作品名称'))
			.toHaveAttribute('data-testid', 'project-wizard-name');
		expect(within(dialog).getByLabelText('作品说明'))
			.toHaveAttribute('data-testid', 'project-wizard-description');
		expect(within(dialog).getByLabelText('保存位置'))
			.toHaveAttribute('data-testid', 'project-wizard-root');
		expect(within(dialog).getByLabelText('项目类型'))
			.toHaveAttribute('data-testid', 'project-wizard-project-type');
		expect(within(dialog).getByLabelText('语言'))
			.toHaveAttribute('data-testid', 'project-wizard-language');

		await user.type(within(dialog).getByLabelText('作品名称'), '稳定控件项目');
		const browse = within(dialog).getByRole('button', { name: /浏览/ });
		expect(browse).toHaveAttribute('data-testid', 'project-wizard-browse');
		await user.click(browse);
		expect(within(dialog).getAllByTestId('project-wizard-template-option').length)
			.toBeGreaterThan(0);

		const next = within(dialog).getByRole('button', { name: /下一步/ });
		expect(next).toHaveAttribute('data-testid', 'project-wizard-submit');
		await user.click(next);
		expect(await within(dialog).findByRole('heading', { name: '你现在从哪里开始？' }))
			.toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: /根据题材生成小说大纲/ }))
			.toHaveAttribute('data-testid', 'project-wizard-start-route');

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '初始结构' }))
			.toBeInTheDocument();
		expect(within(dialog).getAllByTestId('project-wizard-resource-option').length)
			.toBeGreaterThan(0);

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '外观与写作方式' }))
			.toBeInTheDocument();
		expect(within(dialog).getAllByTestId('project-wizard-theme-option').length)
			.toBeGreaterThan(0);
		expect(within(dialog).getAllByTestId('project-wizard-accent-option').length)
			.toBeGreaterThan(0);
		expect(within(dialog).getAllByTestId('project-wizard-writing-mode-option').length)
			.toBeGreaterThan(0);

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '确认创建' }))
			.toBeInTheDocument();
		expect(within(dialog).getByRole('button', { name: '创建项目' }))
			.toHaveAttribute('data-testid', 'project-wizard-submit');
	});

	it('shows a focused welcome experience and clear creation validation', async () => {
		const user = userEvent.setup();
		useAppStore.setState({ recentProjectRoots: ['D:/Writing Buddy/Recent Story'] });
		const recentPreview = render(<ProjectWelcome />);
		expect(screen.getAllByTestId('project-welcome-recent-project')).toHaveLength(1);
		expect(screen.getByTestId('project-welcome-recent-project'))
			.toHaveAttribute('data-project-root', 'D:/Writing Buddy/Recent Story');
		recentPreview.unmount();
		resetWorkspace();
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

	it('offers four accessible truthful starting paths with genre as the only primary action', async () => {
		const user = userEvent.setup();
		render(<App />);
		const startRoutes = await screen.findAllByTestId('project-welcome-start-route');
		expect(startRoutes).toHaveLength(4);
		expect(startRoutes.map(route => route.getAttribute('data-start-route')).sort())
			.toEqual(['blank', 'genre', 'manuscript', 'outline']);
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

	it('defaults to the genre-to-outline start while keeping the other truthful starts enabled', async () => {
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
			.toBeEnabled();
		expect(within(dialog).getByRole('button', { name: /空白项目/ }))
			.toBeEnabled();
	});

	it('persists the manuscript start through five steps and opens the first chapter', async () => {
		const user = userEvent.setup();
		const importSpy = vi.spyOn(desktopBridge, 'chooseImportedText');
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: '根据题材生成大纲' }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });

		await user.type(within(dialog).getByLabelText('作品名称'), '雾港来信');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '你现在从哪里开始？' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /我已经写了一部分正文/ }));
		expect(within(dialog).getByText('添加已有正文文件')).toBeInTheDocument();
		const chooseImportButton = within(dialog).getByRole('button', { name: /选择文件/ });
		act(() => {
			for (let index = 0; index < 100; index += 1) {
				chooseImportButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			}
		});
		expect(await within(dialog).findByText('已有正文.txt')).toBeInTheDocument();
		expect(importSpy).toHaveBeenCalledTimes(1);
		expect(within(dialog).getByText(/正文将原样写入第一章/)).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '初始结构' })).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '外观与写作方式' })).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /深夜/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '确认创建' })).toBeInTheDocument();
		expect(within(dialog).getByText(/3 个文件/)).toBeInTheDocument();

		expect(within(dialog).getByText('已有正文.txt')).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /创建并导入/ }));
		await waitFor(() => {
			expect(screen.getByRole('heading', { level: 1, name: '第一章' })).toBeInTheDocument();
		});
		expect(document.querySelector('.app-shell')).toHaveClass('theme-midnight');
		expect(useAppStore.getState().recentProjectRoots[0]).toContain('雾港来信');
		expect(useAppStore.getState().snapshot?.appearance?.themeId).toBe('midnight');
		expect(useAppStore.getState().session?.content).toContain('雨落在旧站台的玻璃顶上。');
	});

	it('imports an outline offline, creates its chapter structure, and opens the dashboard', async () => {
		const user = userEvent.setup();
		const paidGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: /导入已有大纲/u }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '零点回声导入版');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /选择文件/ }));

		expect(await within(dialog).findByText('零点回声大纲.md')).toBeInTheDocument();
		expect(within(dialog).getByText('2 章')).toBeInTheDocument();
		expect(within(dialog).getByText('第一章 · 迟到四十七秒')).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));

		expect(within(dialog).getByText('2 个章节 + 原始大纲')).toBeInTheDocument();
		expect(within(dialog).getByText(/5 个文件/)).toBeInTheDocument();
		await user.click(within(dialog).getByRole('button', { name: /创建并导入/ }));

		await screen.findByRole('heading', { name: '作品大纲' });
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters.map(chapter => chapter.title))
			.toEqual(['第一章 · 迟到四十七秒', '第二章 · 城市回声协议']);
		expect(useAppStore.getState().activeResource).toBeUndefined();
		expect(paidGeneration).not.toHaveBeenCalled();
	});

	it('visually discloses truthful Word outline format limitations before import', async () => {
		const content = '第一章 雨夜\n顾言收到信。\n\n第二章 回声\n信号重现。';
		vi.spyOn(desktopBridge, 'chooseImportedText').mockResolvedValue({
			fileName: '零点回声大纲.docx',
			format: 'word-document',
			content,
			byteLength: 18_240
		});
		const user = userEvent.setup();
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: /导入已有大纲/u }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), 'Word 大纲导入');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /选择文件/ }));

		expect(await within(dialog).findByText('零点回声大纲.docx')).toBeInTheDocument();
		expect(within(dialog).getByText(/Word 文档/u)).toBeInTheDocument();
		expect(within(dialog).getByText(/图片、批注、脚注、修订记录与版式不会导入/u))
			.toBeInTheDocument();
		expect(within(dialog).getByText('2 章')).toBeInTheDocument();

		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /创建并导入/ }));

		await screen.findByRole('heading', { name: '作品大纲' });
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters.map(chapter => chapter.title))
			.toEqual(['第一章 雨夜', '第二章 回声']);
	});

	it('keeps global create useful while project-scoped actions stay disabled without an open project', async () => {
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
		expect(within(menu).getAllByText('打开作品后可用')).toHaveLength(2);
		expect(within(menu).queryByRole('menuitem', { name: /创建人物/ })).not.toBeInTheDocument();
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
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		expect(dialog).toBeInTheDocument();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog', { name: '新建项目' })).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
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
		act(() => {
			for (let index = 0; index < 100; index += 1) {
				dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			}
		});

		expect(confirmSpy).toHaveBeenCalledTimes(1);
		expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('有尚未保存的正文'));
		expect(createSpy).not.toHaveBeenCalled();
		expect(within(dialog).getByText('已取消创建；当前项目和未保存正文保持不变。')).toBeInTheDocument();
	});

	it('deduplicates one hundred repeated same-tick final submissions and hides the completed wizard', async () => {
		const user = userEvent.setup();
		const createSpy = vi.spyOn(desktopBridge, 'createProject');
		const chooseDirectorySpy = vi.spyOn(desktopBridge, 'chooseProjectParentDirectory');
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: /创建空白作品/u }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '单次创建压力测试');
		const browseButton = within(dialog).getByRole('button', { name: /浏览/ });
		act(() => {
			for (let index = 0; index < 100; index += 1) {
				browseButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			}
		});
		await waitFor(() => expect(within(dialog).getByLabelText('保存位置')).not.toHaveValue(''));
		expect(chooseDirectorySpy).toHaveBeenCalledTimes(1);
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		expect(await within(dialog).findByRole('heading', { name: '确认创建' })).toBeInTheDocument();
		expect(within(dialog).getByTestId('project-wizard-submit')).toBeEnabled();

		act(() => {
			for (let index = 0; index < 100; index += 1) {
				dialog.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
			}
		});

		await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
		await screen.findByRole('heading', { name: '作品大纲' });
		expect(screen.queryByRole('dialog', { name: '新建项目' })).not.toBeInTheDocument();
		expect(useAppStore.getState().snapshot?.project.title).toBe('单次创建压力测试');
	});

	it('keeps the final step retryable after an atomic creation failure', async () => {
		const user = userEvent.setup();
		const createSpy = vi.spyOn(desktopBridge, 'createProject')
			.mockRejectedValueOnce(new Error('projectAtomicRenameFailed'));
		render(<App />);
		const welcome = await screen.findByRole('main', { name: '开始使用 Writing Buddy' });
		await user.click(within(welcome).getByRole('button', { name: /创建空白作品/u }));
		const dialog = await screen.findByRole('dialog', { name: '新建项目' });
		await user.type(within(dialog).getByLabelText('作品名称'), '创建失败重试测试');
		await user.click(within(dialog).getByRole('button', { name: /浏览/ }));
		for (let index = 0; index < 4; index += 1) {
			await user.click(within(dialog).getByRole('button', { name: /下一步/ }));
		}

		const createButton = within(dialog).getByRole('button', { name: /创建项目/ });
		await user.click(createButton);
		expect(await within(dialog).findByText('最终保存项目时失败，未覆盖任何现有目录。')).toBeInTheDocument();
		expect(createButton).toBeEnabled();

		await user.click(createButton);
		await screen.findByRole('heading', { name: '作品大纲' });
		expect(createSpy).toHaveBeenCalledTimes(2);
		expect(useAppStore.getState().snapshot?.project.title).toBe('创建失败重试测试');
	});
});
