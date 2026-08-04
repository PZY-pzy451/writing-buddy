import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../app/store';
import { QuickCaptureDialog } from './QuickCaptureDialog';

afterEach(() => {
	act(() => {
		useAppStore.setState({
			quickCaptureOpen: false,
			quickCaptureBusy: false,
			quickCaptureSeed: undefined
		});
	});
});

describe('QuickCaptureDialog', () => {
	it('starts from editor context and saves with Ctrl+Enter', async () => {
		const saveQuickCapture = vi.fn(() => Promise.resolve(true));
		useAppStore.setState({
			quickCaptureOpen: true,
			quickCaptureBusy: false,
			quickCaptureSeed: {
				type: 'idea',
				text: '玻璃顶在终章再次出现',
				chapterId: 'chapter:chapter-a11ce001',
				anchor: {
					start: 0,
					end: 3,
					before: '',
					target: '玻璃顶',
					after: '在终章',
					sourceHash: '1234abcd'
				}
			},
			saveQuickCapture
		});
		render(<QuickCaptureDialog />);

		expect(screen.getByRole('textbox', { name: '记录内容' })).toHaveValue('玻璃顶在终章再次出现');
		expect(screen.getByText(/已关联/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('radio', { name: '伏笔' }));
		fireEvent.keyDown(screen.getByRole('dialog'), {
			key: 'Enter',
			ctrlKey: true
		});

		await waitFor(() => expect(saveQuickCapture).toHaveBeenCalledWith(
			'foreshadowing',
			'玻璃顶在终章再次出现'
		));
	});

	it('closes once on Escape and restores the exact opening focus', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = '打开快速记录';
		document.body.append(trigger);
		trigger.focus();
		const closeQuickCapture = vi.fn(() => {
			useAppStore.setState({ quickCaptureOpen: false });
		});
		useAppStore.setState({
			quickCaptureOpen: true,
			quickCaptureBusy: false,
			quickCaptureSeed: { type: 'revision', text: '' },
			closeQuickCapture
		});
		render(<QuickCaptureDialog />);

		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

		expect(closeQuickCapture).toHaveBeenCalledOnce();
		await waitFor(() => expect(trigger).toHaveFocus());
		trigger.remove();
	});
});
