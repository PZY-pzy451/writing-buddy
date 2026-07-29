import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { useAppStore } from '../../app/store';

function resetExperience(): void {
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
		quickCaptures: [],
		quickCaptureHash: '',
		quickCaptureOpen: false,
		quickCaptureBusy: false,
		quickCaptureSeed: undefined
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

describe('Quick Capture experience', () => {
	beforeEach(resetExperience);
	afterEach(() => localStorage.clear());

	it('captures from the global shortcut without leaving the chapter, then opens the inbox', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);
		const resourceId = useAppStore.getState().activeResource?.id;
		act(() => useAppStore.getState().setSelection({
			start: 0,
			end: 2,
			text: '夜雨'
		}));

		fireEvent.keyDown(window, {
			key: ' ',
			code: 'Space',
			ctrlKey: true,
			shiftKey: true
		});
		const dialog = await screen.findByRole('dialog', { name: '快速记录' });
		const textbox = within(dialog).getByRole('textbox', { name: '记录内容' });
		expect(textbox).toHaveValue('夜雨');
		await user.clear(textbox);
		await user.type(textbox, '让玻璃顶在终章再次出现');
		fireEvent.keyDown(dialog, {
			key: 'Enter',
			ctrlKey: true
		});

		await waitFor(() => expect(screen.queryByRole('dialog', { name: '快速记录' }))
			.not.toBeInTheDocument());
		expect(useAppStore.getState().activeResource?.id).toBe(resourceId);
		expect(useAppStore.getState().selection?.text).toBe('夜雨');
		const status = screen.getByRole('contentinfo', { name: '工作区状态' });
		await user.click(within(status).getByRole('button', { name: /待整理 1/ }));

		expect(await screen.findByText('让玻璃顶在终章再次出现')).toBeInTheDocument();
		expect(useAppStore.getState()).toMatchObject({
			dockOpen: true,
			dockTab: 'inbox'
		});
		await user.click(screen.getByRole('button', { name: '忽略' }));
		await waitFor(() => expect(useAppStore.getState().quickCaptures.at(0)?.status)
			.toBe('dismissed'));
	});

	it('opens an exact Story resource Peek from global search without leaving search', async () => {
		const user = userEvent.setup();
		render(<App />);
		await openFixtureAndContinue(user);

		fireEvent.keyDown(window, {
			key: 'f',
			code: 'KeyF',
			ctrlKey: true,
			shiftKey: true
		});
		const peekButton = await screen.findByRole('button', { name: '速览 林墨' });
		await user.click(peekButton);

		expect(await screen.findByRole('dialog', { name: '林墨资料速览' }))
			.toBeInTheDocument();
		expect(useAppStore.getState().activeMode).toBe('search');
		fireEvent.keyDown(screen.getByRole('dialog', { name: '林墨资料速览' }), {
			key: 'Escape'
		});
		await waitFor(() => expect(screen.queryByRole('dialog', { name: '林墨资料速览' }))
			.not.toBeInTheDocument());
		expect(useAppStore.getState().activeMode).toBe('search');
	});
});
