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
	it('TC-QUICK-CAPTURE-DIALOG-001 exposes stable controls, deduplicates repeated Ctrl+Enter and button actions, and releases explicit retry', async () => {
		let resolveFirst: (saved: boolean) => void = () => undefined;
		const firstSave = new Promise<boolean>(resolve => {
			resolveFirst = resolve;
		});
		const saveQuickCapture = vi.fn()
			.mockImplementationOnce(() => firstSave)
			.mockResolvedValue(true);
		const closeQuickCapture = vi.fn();
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
			saveQuickCapture,
			closeQuickCapture
		});
		render(<QuickCaptureDialog />);

		const dialog = screen.getByRole('dialog', { name: '快速记录' });
		expect(dialog).toHaveAttribute('data-testid', 'quick-capture-dialog');
		expect(screen.getByRole('textbox', { name: '记录内容' }))
			.toHaveAttribute('data-testid', 'quick-capture-text');
		expect(screen.getByRole('textbox', { name: '记录内容' })).toHaveValue('玻璃顶在终章再次出现');
		expect(screen.getByText(/已关联/)).toBeInTheDocument();
		const type = screen.getByRole('radio', { name: '伏笔' });
		expect(type).toHaveAttribute('data-testid', 'quick-capture-type');
		await userEvent.click(type);
		const saveButton = screen.getByRole('button', { name: '保存到待整理箱' });
		expect(saveButton).toHaveAttribute('data-testid', 'quick-capture-save');
		for (let attempt = 0; attempt < 100; attempt += 1) {
			fireEvent.keyDown(dialog, { key: 'Enter', ctrlKey: true });
			saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		expect(saveQuickCapture).toHaveBeenCalledTimes(1);
		expect(saveQuickCapture).toHaveBeenCalledWith(
			'foreshadowing',
			'玻璃顶在终章再次出现'
		);
		fireEvent.click(screen.getByRole('button', { name: '关闭快速记录' }));
		expect(closeQuickCapture).not.toHaveBeenCalled();
		await act(async () => {
			resolveFirst(false);
			await firstSave;
		});
		fireEvent.click(saveButton);
		await waitFor(() => expect(saveQuickCapture).toHaveBeenCalledTimes(2));
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
		expect(screen.getByRole('button', { name: '关闭快速记录' }))
			.toHaveAttribute('data-testid', 'quick-capture-close');

		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

		expect(closeQuickCapture).toHaveBeenCalledOnce();
		await waitFor(() => expect(trigger).toHaveFocus());
		trigger.remove();
	});
});
