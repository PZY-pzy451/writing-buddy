import { act, render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '../app/store';
import { resetWriterWorkspaceFixture } from '../app/WriterWorkspaceTestHarness.test-utils';
import { desktopBridge } from '../platform/bridge';
import { ProjectSidebar } from './ProjectSidebar';

describe('ProjectSidebar recent projects', () => {
	beforeEach(() => {
		resetWriterWorkspaceFixture();
		useAppStore.setState({ recentProjectRoots: ['browser-fixture'] });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('opens one exact recent project after repeated pointer selection', async () => {
		const openProject = vi.spyOn(desktopBridge, 'openProject');
		render(<ProjectSidebar />);
		const recent = screen.getByTestId('project-sidebar-recent');
		expect(recent).toHaveAttribute('data-project-root', 'browser-fixture');

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				recent.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		await waitFor(() => expect(useAppStore.getState().snapshot?.root)
			.toBe('browser-fixture'));
		expect(openProject).toHaveBeenCalledOnce();
	});
});
