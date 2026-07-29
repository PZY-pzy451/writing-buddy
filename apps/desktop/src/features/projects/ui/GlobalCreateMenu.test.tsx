import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { GlobalCreateMenu } from './GlobalCreateMenu';

afterEach(() => {
	useAppStore.setState({ snapshot: undefined });
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

		window.dispatchEvent(new CustomEvent('writing-buddy:open-create-menu', {
			detail: { focus: 'chapter' }
		}));
		const chapter = await screen.findByRole('menuitem', { name: /新建章节/ });
		expect(chapter).toBeEnabled();
		expect(chapter).toHaveFocus();
		await userEvent.click(chapter);

		expect(openChapterCreator).toHaveBeenCalledOnce();
	});
});
