import { act, render, screen, waitFor } from '@testing-library/react';
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
