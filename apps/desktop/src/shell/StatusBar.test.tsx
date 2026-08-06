import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runLocalReview } from '@writing-buddy/review';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { useAppStore } from '../app/store';
import { StatusBar } from './StatusBar';

function resetStatusBarExperience(): void {
	localStorage.clear();
	useAppStore.setState({
		recentProjectRoot: undefined,
		recentProjectRoots: [],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		openResourceIds: [],
		tabs: [],
		writerSessions: {},
		documentViews: {},
		expandedTreeNodes: [],
		loading: false,
		error: undefined,
		activeMode: 'works',
		focusMode: false,
		sidebarOpen: true,
		assistantOpen: false,
		dockOpen: false,
		dockTab: 'issues',
		issues: [],
		quickCaptures: [],
		quickCaptureHash: '',
		quickCaptureOpen: false,
		quickCaptureBusy: false,
		quickCaptureSeed: undefined
	});
}

async function openStatusBarFixture(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	render(<App />);
	const recent = await screen.findByRole('navigation', { name: '最近作品' });
	await user.click(within(recent.parentElement as HTMLElement).getByRole(
		'button',
		{ name: '打开项目' }
	));
	await screen.findByRole('main', { name: '写作首页' });
	await user.click(screen.getByRole('button', { name: '继续上次位置' }));
	await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
}

describe('Status Bar author controls', () => {
	beforeEach(resetStatusBarExperience);
	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it('TC-STATUS-BAR-001 renders visible accessible visual controls, disables session actions and toggles the dock by keyboard focus', async () => {
		const user = userEvent.setup();
		const view = render(<StatusBar />);
		const quickCapture = screen.getByTestId('status-bar-quick-capture');
		const inbox = screen.getByTestId('status-bar-inbox');
		const dock = screen.getByTestId('status-bar-dock');

		for (const control of [quickCapture, inbox, dock]) {
			expect(control).toBeVisible();
			expect(control).toHaveAccessibleName();
		}
		expect(quickCapture).toBeDisabled();
		expect(inbox).toBeDisabled();
		expect(dock).toBeEnabled();
		dock.focus();
		expect(dock).toHaveFocus();
		await user.keyboard('{Enter}');
		expect(useAppStore.getState().dockOpen).toBe(true);
		view.unmount();
		expect(dock).not.toHaveFocus();
	});

	it('TC-STATUS-BAR-002 updates live counts and routes enabled pointer actions to quick capture, inbox and Task Dock', async () => {
		const user = userEvent.setup();
		await openStatusBarFixture(user);
		const state = useAppStore.getState();
		if (!state.snapshot || !state.activeResource || !state.session) {
			throw new Error('status bar fixture missing');
		}
		const issue = runLocalReview(
			state.snapshot.project.projectId,
			state.activeResource.id,
			'夜雨落下。。'
		).issues[0];
		if (!issue) throw new Error('status bar issue fixture missing');
		const projectId = state.snapshot.project.projectId;
		void act(() => useAppStore.setState({
			issues: [issue],
			quickCaptures: [{
				id: 'capture:status-bar',
				projectId,
				type: 'idea',
				text: '让玻璃顶在终章再次出现',
				status: 'inbox',
				createdAt: '2026-08-06T08:00:00.000Z',
				updatedAt: '2026-08-06T08:00:00.000Z'
			}]
		}));

		const status = screen.getByRole('contentinfo', { name: '工作区状态' });
		const quickCapture = within(status).getByTestId('status-bar-quick-capture');
		const inbox = within(status).getByTestId('status-bar-inbox');
		const dock = within(status).getByTestId('status-bar-dock');
		expect(quickCapture).toBeEnabled();
		expect(inbox).toBeEnabled();
		expect(dock).toBeEnabled();
		expect(inbox).toHaveTextContent('待整理 1');
		expect(dock).toHaveTextContent('待处理 1');

		await user.click(inbox);
		expect(useAppStore.getState()).toMatchObject({ dockOpen: true, dockTab: 'inbox' });
		await user.click(dock);
		expect(useAppStore.getState().dockOpen).toBe(false);
		await user.click(quickCapture);
		expect(await screen.findByRole('dialog', { name: '快速记录' })).toBeInTheDocument();
	});

	it('TC-STATUS-BAR-003 enforces read-only permission before activation while preserving inbox and dock navigation', async () => {
		const user = userEvent.setup();
		await openStatusBarFixture(user);
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('status bar read-only snapshot missing');
		void act(() => useAppStore.setState({
			snapshot: { ...snapshot, readOnly: true },
			quickCaptureOpen: false
		}));

		const quickCapture = screen.getByTestId('status-bar-quick-capture');
		const inbox = screen.getByTestId('status-bar-inbox');
		const dock = screen.getByTestId('status-bar-dock');
		expect(quickCapture).toBeDisabled();
		expect(inbox).toBeEnabled();
		expect(dock).toBeEnabled();
		await user.click(inbox);
		expect(useAppStore.getState()).toMatchObject({
			dockOpen: true,
			dockTab: 'inbox',
			quickCaptureOpen: false
		});
	});

	it('TC-STATUS-BAR-004 opens quick capture offline, cancels by keyboard, restores focus and hides in focus mode', async () => {
		const user = userEvent.setup();
		await openStatusBarFixture(user);
		const quickCapture = screen.getByTestId('status-bar-quick-capture');
		await user.click(quickCapture);
		const dialog = await screen.findByRole('dialog', { name: '快速记录' });
		expect(within(dialog).getByRole('textbox', { name: '记录内容' })).toHaveFocus();
		fireEvent.keyDown(dialog, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole('dialog', { name: '快速记录' }))
			.not.toBeInTheDocument());
		expect(quickCapture).toHaveFocus();

		void act(() => useAppStore.setState({ focusMode: true }));
		expect(screen.queryByRole('contentinfo', { name: '工作区状态' }))
			.not.toBeInTheDocument();
		void act(() => useAppStore.setState({ focusMode: false }));
		expect(screen.getByRole('contentinfo', { name: '工作区状态' })).toBeVisible();
	});

	it('TC-STATUS-BAR-005 deduplicates one hundred repeated quick-capture requests into one dialog and one active seed', async () => {
		const user = userEvent.setup();
		await openStatusBarFixture(user);
		const quickCapture = screen.getByTestId('status-bar-quick-capture');
		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				quickCapture.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
		});

		expect(screen.getAllByRole('dialog', { name: '快速记录' })).toHaveLength(1);
		expect(useAppStore.getState().quickCaptureOpen).toBe(true);
		expect(useAppStore.getState().quickCaptureSeed).toMatchObject({ type: 'idea' });
	});

	it('TC-STATUS-BAR-006 persists a quick capture, reloads the project and restores the inbox count after restart', async () => {
		const user = userEvent.setup();
		await openStatusBarFixture(user);
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('status bar persistence snapshot missing');
		await user.click(screen.getByTestId('status-bar-quick-capture'));
		const dialog = await screen.findByRole('dialog', { name: '快速记录' });
		await user.type(
			within(dialog).getByRole('textbox', { name: '记录内容' }),
			'状态栏持久化验证'
		);
		await user.click(within(dialog).getByTestId('quick-capture-save'));
		await waitFor(() => expect(useAppStore.getState().quickCaptures).toHaveLength(1));
		expect(useAppStore.getState().quickCaptureHash).not.toBe('');

		void act(() => useAppStore.setState({ quickCaptures: [], quickCaptureHash: '' }));
		await act(async () => {
			await useAppStore.getState().openProject(snapshot.root);
		});
		expect(useAppStore.getState().quickCaptures).toHaveLength(1);
		expect(screen.getByTestId('status-bar-inbox')).toHaveTextContent('待整理 1');
	});
});
