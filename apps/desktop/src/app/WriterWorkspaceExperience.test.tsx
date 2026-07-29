import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { useAppStore } from './store';

function resetWorkspaceExperience(): void {
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
		writerSessions: {},
		documentViews: {},
		expandedTreeNodes: [],
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		error: undefined,
		projectWizardOpen: false,
		activeMode: 'works',
		focusMode: false,
		sidebarOpen: true,
		sidebarWidth: 320,
		assistantOpen: true,
		assistantWidth: 360,
		dockOpen: true,
		dockHeight: 240
	});
}

async function openFixtureAndContinue(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	const recent = await screen.findByRole('navigation', { name: '最近作品' });
	await user.click(within(recent.parentElement as HTMLElement).getByRole(
		'button',
		{ name: '打开项目' }
	));
	await screen.findByRole('main', { name: '作品仪表盘' });
	await user.click(screen.getByRole('button', { name: '继续上次位置' }));
	await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
}

describe('quiet writer workspaces', () => {
	beforeEach(resetWorkspaceExperience);

	afterEach(() => {
		localStorage.clear();
	});

	it('presents the five author tasks while keeping search and settings global', async () => {
		render(<App />);
		const navigation = await screen.findByRole('navigation', { name: '全局导航' });

		for (const label of ['写作', '规划', '资料', '检查', '历史']) {
			expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument();
		}
		expect(within(navigation).queryByRole('button', { name: '作品' })).not.toBeInTheDocument();
		expect(within(navigation).queryByRole('button', { name: '审校' })).not.toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: '搜索当前作品' })).toBeInTheDocument();
		expect(within(navigation).getByRole('button', { name: '设置' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '收起作品侧栏' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '展开写作助手' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '恢复当前工作区默认布局' })).not.toBeInTheDocument();
	});

	it('restores independent writing and planning layouts without changing the resource', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const chapterId = useAppStore.getState().activeResource?.id;

		act(() => {
			useAppStore.getState().setSidebarWidth(408);
			if (useAppStore.getState().assistantOpen) {
				useAppStore.getState().toggleAssistant();
			}
		});
		await user.click(screen.getByRole('button', { name: '规划' }));
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'planning',
			activeResourceId: chapterId,
			assistantOpen: false
		});
		expect(useAppStore.getState().sidebarWidth).not.toBe(408);

		act(() => {
			useAppStore.getState().setSidebarWidth(372);
			useAppStore.getState().toggleAssistant();
		});
		await user.click(screen.getByRole('button', { name: '写作' }));
		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'works',
			activeResourceId: chapterId,
			sidebarWidth: 408,
			assistantOpen: false
		});

		await user.click(screen.getByRole('button', { name: '规划' }));
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 372,
			assistantOpen: true
		});
		act(() => useAppStore.getState().resetWorkspaceLayout());
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 320,
			assistantOpen: false
		});
	});

	it('rehydrates manual writing layout changes before reopening the project', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		await user.click(screen.getByRole('button', { name: '规划' }));
		await user.click(screen.getByRole('button', { name: '写作' }));
		await user.click(screen.getByRole('button', { name: '更多写作操作' }));
		await user.click(screen.getByRole('menuitem', { name: '收起章节树' }));

		expect(useAppStore.getState().writerSessions['project-a11ce001']
			?.workspaceLayouts.writing.sidebarVisible).toBe(false);
		const persisted = localStorage.getItem('writing-buddy-next-workspace');
		expect(persisted).toContain('"sidebarVisible":false');

		act(() => {
			useAppStore.setState({
				writerSessions: {},
				sidebarOpen: true
			});
		});
		if (persisted) {
			localStorage.setItem('writing-buddy-next-workspace', persisted);
		}
		await act(async () => {
			await useAppStore.persist.rehydrate();
		});
		await act(async () => {
			await useAppStore.getState().openProject('browser-fixture');
		});

		expect(useAppStore.getState()).toMatchObject({
			sidebarOpen: false
		});
		expect(useAppStore.getState().writerSessions['project-a11ce001']
			?.workspaceLayouts.writing.sidebarVisible).toBe(false);
	});

	it('keeps the writing chrome quiet until the author asks for more tools', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: false,
			dockOpen: false
		});
		const topBar = document.querySelector('.top-bar') as HTMLElement;
		expect(within(topBar).queryByRole('button', { name: '新建' })).not.toBeInTheDocument();
		expect(within(topBar).queryByRole('button', { name: 'AI 快速生成' })).not.toBeInTheDocument();
		expect(within(topBar).getByRole('button', { name: '专注模式' })).toBeInTheDocument();
		expect(within(topBar).getByRole('button', { name: '更多写作操作' })).toBeInTheDocument();

		await user.click(within(topBar).getByRole('button', { name: '更多写作操作' }));
		expect(screen.getByRole('menuitem', { name: 'AI 快速动作' })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: '恢复写作布局' })).toBeInTheDocument();

		const status = screen.getByRole('contentinfo', { name: '工作区状态' });
		expect(within(status).getByText(/本章 \d+ 字/)).toBeInTheDocument();
		expect(within(status).getByText('已保存')).toBeInTheDocument();
		expect(within(status).queryByText('我的小说')).not.toBeInTheDocument();
	});

	it('opens the existing extraction center for the current chapter without starting AI', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		await user.click(screen.getByRole('button', { name: '更多章节操作' }));
		await user.click(screen.getByRole('menuitem', { name: '整理本章' }));

		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'references',
			storyView: 'extraction'
		});
		expect(await screen.findByRole('main', { name: 'AI 从正文整理中心' }))
			.toBeInTheDocument();
		expect(screen.getByRole('radio', { name: '当前章' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		expect(screen.getByText(/创建计划不会调用 AI/u)).toBeInTheDocument();
	});

	it('uses F11 and Escape for a temporary focus overlay without changing the normal layout', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		act(() => {
			useAppStore.getState().setSidebarWidth(396);
			if (!useAppStore.getState().assistantOpen) {
				useAppStore.getState().toggleAssistant();
			}
		});

		fireEvent.keyDown(window, { key: 'F11', code: 'F11' });
		await waitFor(() => expect(document.querySelector('.app-shell')).toHaveClass('is-focus-mode'));
		expect(screen.queryByRole('navigation', { name: '全局导航' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '退出专注' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1, name: '第一章 停摆的时钟' })).toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 396,
			assistantOpen: true
		});

		fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
		await screen.findByRole('navigation', { name: '全局导航' });
		expect(document.querySelector('.app-shell')).not.toHaveClass('is-focus-mode');
		expect(useAppStore.getState()).toMatchObject({
			sidebarWidth: 396,
			assistantOpen: true
		});
		const persisted = localStorage.getItem('writing-buddy-next-workspace') ?? '';
		expect(persisted).not.toContain('"focusMode":true');
	});
});
