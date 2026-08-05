import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { ChapterCreationDialog } from './ChapterCreationDialog';

const originalCreateChapter = useAppStore.getState().createChapter;
const originalCloseChapterCreator = useAppStore.getState().closeChapterCreator;

function writableSnapshot() {
	return {
		root: 'D:/Novel',
		project: {
			schemaVersion: 1 as const,
			projectId: 'novel-001',
			title: 'Novel',
			volumes: [{
				id: 'volume-001',
				title: 'Volume One',
				chapters: [{
					id: 'chapter-001',
					title: 'Chapter One',
					file: 'chapters/chapter-001.md',
					status: 'draft' as const,
					scene: {
						location: '',
						time: '',
						pov: '',
						characters: [],
						goal: '',
						note: ''
					}
				}]
			}]
		},
		projectRevision: 'revision-001',
		resources: [],
		wordCounts: {},
		integrityIssues: [],
		readOnly: false
	};
}

afterEach(() => {
	act(() => {
		useAppStore.setState({
			snapshot: undefined,
			chapterCreatorOpen: false,
			chapterCreateBusy: false,
			createChapter: originalCreateChapter,
			closeChapterCreator: originalCloseChapterCreator
		});
	});
	vi.restoreAllMocks();
});

describe('ChapterCreationDialog', () => {
	it('creates once across one hundred repeated same-frame submissions and permits one retry', async () => {
		const createChapter = vi.fn().mockResolvedValue(false);
		useAppStore.setState({
			snapshot: writableSnapshot(),
			chapterCreatorOpen: true,
			chapterCreateBusy: false,
			createChapter
		});
		render(<ChapterCreationDialog />);
		expect(screen.getByTestId('chapter-creation-dialog')).toHaveAttribute('role', 'dialog');
		expect(screen.getByTestId('chapter-creation-title')).toHaveFocus();
		expect(screen.getByTestId('chapter-creation-volume')).toHaveValue('volume-001');
		expect(screen.getByTestId('chapter-creation-close')).toBeEnabled();
		const submit = screen.getByTestId('chapter-creation-submit');

		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(createChapter).toHaveBeenCalledTimes(1);
		await userEvent.click(submit);
		expect(createChapter).toHaveBeenCalledTimes(2);
	});

	it('dismisses once under pressure and restores the exact opening focus', async () => {
		const closeChapterCreator = vi.fn(() => {
			useAppStore.setState({ chapterCreatorOpen: false });
		});
		useAppStore.setState({
			snapshot: writableSnapshot(),
			chapterCreatorOpen: true,
			chapterCreateBusy: false,
			closeChapterCreator
		});
		render(
			<>
				<button type="button">Opening focus</button>
				<ChapterCreationDialog />
			</>
		);
		const origin = screen.getByRole('button', { name: 'Opening focus' });
		origin.focus();
		const cancel = screen.getByTestId('chapter-creation-cancel');

		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				cancel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
		});

		expect(closeChapterCreator).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(origin).toHaveFocus());
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});
