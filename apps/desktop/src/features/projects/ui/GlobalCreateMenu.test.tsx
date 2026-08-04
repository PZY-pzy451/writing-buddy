import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { GlobalCreateMenu } from './GlobalCreateMenu';

afterEach(() => {
	act(() => {
		useAppStore.setState({
			snapshot: undefined,
			activeMode: 'works',
			storyView: 'characters',
			contextualCreateIntent: undefined
		});
	});
});

describe('GlobalCreateMenu', () => {
	it('dispatches one project chooser for one hundred same-frame menu actions', async () => {
		const chooseProject = vi.fn(() => new Promise<void>(() => undefined));
		useAppStore.setState({ chooseProject });
		render(<GlobalCreateMenu />);
		const trigger = screen.getByRole('button', { name: '新建' });
		await userEvent.click(trigger);
		const openProject = screen.getByRole('menuitem', { name: /打开项目/ });

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				openProject.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(chooseProject).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		await userEvent.click(trigger);
		await userEvent.click(screen.getByRole('menuitem', { name: /打开项目/ }));
		expect(chooseProject).toHaveBeenCalledTimes(2);
	});

	it('preserves the original shortcut focus through one hundred reopen events', async () => {
		render(
			<>
				<button type="button">原始焦点</button>
				<GlobalCreateMenu shortcutOnly />
			</>
		);
		const origin = screen.getByRole('button', { name: '原始焦点' });
		origin.focus();
		act(() => {
			window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu'));
		});
		await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());

		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu'));
			}
		});
		fireEvent.keyDown(window, { key: 'Escape' });

		await waitFor(() => expect(origin).toHaveFocus());
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('wraps keyboard navigation across enabled actions and skips project-only actions', async () => {
		render(<GlobalCreateMenu />);
		await userEvent.click(screen.getByTestId('global-create-trigger'));
		const menu = screen.getByRole('menu');
		const newProject = screen.getByTestId('global-create-new-project');
		const openProject = screen.getByTestId('global-create-open-project');
		const newChapter = screen.getByTestId('global-create-new-chapter');

		await waitFor(() => expect(newProject).toHaveFocus());
		expect(newChapter).toBeDisabled();
		fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(openProject).toHaveFocus();
		fireEvent.keyDown(menu, { key: 'ArrowDown' });
		expect(newProject).toHaveFocus();
		fireEvent.keyDown(menu, { key: 'End' });
		expect(openProject).toHaveFocus();
	});

	it('moves an already open shortcut menu to the requested chapter action', async () => {
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			}
		});
		render(
			<>
				<button type="button">原始焦点</button>
				<GlobalCreateMenu shortcutOnly />
			</>
		);
		const origin = screen.getByRole('button', { name: '原始焦点' });
		origin.focus();
		act(() => {
			window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu'));
		});
		await waitFor(() => expect(screen.getAllByRole('menuitem')[0]).toHaveFocus());

		act(() => {
			window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu', {
				detail: { focus: 'chapter' }
			}));
		});

		await waitFor(() => expect(
			screen.getByRole('menuitem', { name: /新建章节/ })
		).toHaveFocus());
		fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(origin).toHaveFocus());
	});

	it('opens Quick Capture as a real project action', async () => {
		const openQuickCapture = vi.fn();
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			},
			openQuickCapture
		});
		render(<GlobalCreateMenu />);

		await userEvent.click(screen.getByRole('button', { name: '新建' }));
		await userEvent.click(screen.getByRole('menuitem', { name: /快速记录/ }));

		expect(openQuickCapture).toHaveBeenCalledOnce();
	});

	it('opens the real chapter creator from the menu and from quick-create focus', async () => {
		const openChapterCreator = vi.fn();
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			},
			openChapterCreator
		});
		render(<GlobalCreateMenu />);

		act(() => {
			window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu', {
				detail: { focus: 'chapter' }
			}));
		});
		const chapter = await screen.findByRole('menuitem', { name: /新建章节/ });
		expect(chapter).toBeEnabled();
		await waitFor(() => expect(chapter).toHaveFocus());
		await userEvent.click(chapter);

		expect(openChapterCreator).toHaveBeenCalledOnce();
	});

	it('routes contextual creation into the existing author assistant', async () => {
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			},
			activeMode: 'references'
		});
		render(<GlobalCreateMenu />);

		await userEvent.click(screen.getByRole('button', { name: '新建' }));
		await userEvent.click(screen.getByRole('menuitem', { name: /创建人物/ }));

		expect(useAppStore.getState()).toMatchObject({
			activeMode: 'references',
			storyView: 'characters',
			contextualCreateIntent: 'character'
		});
	});

	it('prioritizes story structure and plot actions while planning', async () => {
		useAppStore.setState({
			snapshot: {
				root: 'D:/Novel',
				project: {
					schemaVersion: 1,
					projectId: 'novel-001',
					title: 'Novel',
					volumes: []
				},
				projectRevision: 'revision',
				resources: [],
				wordCounts: {},
				integrityIssues: [],
				readOnly: false
			},
			activeMode: 'planning'
		});
		render(<GlobalCreateMenu />);

		await userEvent.click(screen.getByRole('button', { name: '新建' }));
		const contextualItems = screen.getAllByRole('menuitem').slice(4);

		expect(contextualItems[0]).toHaveAccessibleName(/规划卷、章与场景/);
		expect(contextualItems[1]).toHaveAccessibleName(/创建剧情线或伏笔/);
	});
});
