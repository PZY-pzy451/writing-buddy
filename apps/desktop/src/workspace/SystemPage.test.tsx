import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { useAppStore } from '../app/store';

beforeEach(() => {
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
		loading: false,
		error: undefined,
		projectWizardOpen: false,
		activeMode: 'works'
	});
});

afterEach(() => {
	cleanup();
});

describe('SystemPage author workspace', () => {
	it('renders and hides enabled writer-tool/search/version controls and selects each by pointer', async () => {
		const user = userEvent.setup();
		render(<App />);
		const recent = await screen.findByRole('navigation', { name: '最近作品' });
		await user.click(within(recent.parentElement as HTMLElement)
			.getByRole('button', { name: '打开项目' }));
		await screen.findByRole('main', { name: '写作首页' });
		await user.click(screen.getByRole('button', { name: '继续上次位置' }));
		await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
		const writerTools = screen.getAllByTestId('writer-tool-rail-item');
		expect(writerTools).toHaveLength(4);
		const referencesTool = writerTools.find(control => (
			control.getAttribute('data-writer-tool-id') === 'references'
		));
		expect(referencesTool).toBeEnabled();
		await user.click(referencesTool!);
		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: true,
			writerTool: 'references'
		});

		await user.click(screen.getByRole('button', { name: '历史' }));
		expect(screen.queryByTestId('writer-tool-rail-item')).not.toBeInTheDocument();
		expect(document.querySelector('.app-shell')).toHaveClass('is-system-page');
		expect(screen.queryByRole('tablist', { name: '已打开资源' })).not.toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '创建安全快照' }));
		const version = await screen.findByTestId('system-version-select');
		expect(version).toBeEnabled();
		expect(version).toHaveAttribute('data-version-id', expect.any(String));
		await user.click(version);

		fireEvent.keyDown(window, {
			key: 'f',
			code: 'KeyF',
			ctrlKey: true,
			shiftKey: true
		});
		expect(useAppStore.getState().activeMode).toBe('search');
		const chapterResult = (await screen.findAllByTestId('system-search-resource'))[0];
		expect(chapterResult).toHaveAttribute('data-resource-id', expect.any(String));
		await user.click(chapterResult);
		await waitFor(() => expect(useAppStore.getState().activeMode).toBe('works'));

		fireEvent.keyDown(window, {
			key: 'f',
			code: 'KeyF',
			ctrlKey: true,
			shiftKey: true
		});
		const storyResult = (await screen.findAllByTestId('system-search-story-resource'))[0];
		expect(storyResult).toHaveAttribute('data-resource-id', expect.any(String));
		await user.click(storyResult);
		await waitFor(() => expect(useAppStore.getState().activeMode).toBe('references'));
	});
});
