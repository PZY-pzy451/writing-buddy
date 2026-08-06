import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { flattenChapters } from '@writing-buddy/domain';
import { useAppStore } from '../app/store';
import { resetWriterWorkspaceFixture } from '../app/WriterWorkspaceTestHarness.test-utils';
import { ResourceTabs } from './ResourceTabs';

describe('ResourceTabs', () => {
	beforeEach(resetWriterWorkspaceFixture);

	afterEach(() => {
		localStorage.clear();
	});

	it('selects exact resource tabs by pointer and keyboard without repeated drift', async () => {
		await act(async () => {
			await useAppStore.getState().openProject('browser-fixture');
		});
		const snapshot = useAppStore.getState().snapshot;
		const chapters = snapshot ? flattenChapters(snapshot.project).slice(0, 2) : [];
		if (!snapshot || chapters.length < 2) throw new Error('resource tab fixture missing');
		for (const chapter of chapters) {
			await act(async () => {
				await useAppStore.getState().openResource({
					id: chapter.id,
					type: 'chapter',
					title: chapter.title,
					path: chapter.file,
					projectId: snapshot.project.projectId
				});
			});
		}
		render(<ResourceTabs />);

		const tabs = screen.getAllByTestId('resource-tab-select');
		expect(tabs.map(tab => tab.getAttribute('data-resource-id')))
			.toEqual(chapters.map(chapter => chapter.id));
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				tabs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});
		await waitFor(() => expect(useAppStore.getState().activeResource?.id)
			.toBe(chapters[0].id));

		tabs[0].focus();
		fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
		await waitFor(() => expect(useAppStore.getState().activeResource?.id)
			.toBe(chapters[1].id));
		expect(tabs[1]).toHaveFocus();
	});
});
