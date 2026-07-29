import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../app/store';
import { CloseProtectionDialog } from './CloseProtectionDialog';

describe('CloseProtectionDialog', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		useAppStore.setState({ closeProtectionOpen: false });
	});

	it('explains durable auxiliary state, cancels safely and requires explicit discard', async () => {
		const user = userEvent.setup();
		const onExit = vi.fn();
		useAppStore.setState({
			closeProtectionOpen: true,
			saveState: { type: 'dirty' },
			activeResource: {
				id: 'chapter-one',
				type: 'chapter',
				title: '第四章 桥下的画师',
				path: 'chapters/four.md',
				projectId: 'project-one'
			}
		});
		const { rerender } = render(<CloseProtectionDialog onExit={onExit} />);

		expect(screen.getByRole('dialog', { name: '退出前确认正文安全' })).toBeInTheDocument();
		expect(screen.getByText(/快速记录已经单独落盘/u)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '继续写作' }));
		expect(onExit).not.toHaveBeenCalled();

		useAppStore.setState({ closeProtectionOpen: true });
		rerender(<CloseProtectionDialog onExit={onExit} />);
		await user.click(screen.getByRole('button', { name: '不保存并退出' }));
		expect(onExit).toHaveBeenCalledTimes(1);
	});

	it('waits for an in-flight save and exits only after it becomes clean', async () => {
		const onExit = vi.fn();
		useAppStore.setState({
			closeProtectionOpen: true,
			saveState: { type: 'saving', startedAt: '2026-07-29T11:05:00.000Z' }
		});
		render(<CloseProtectionDialog onExit={onExit} />);

		expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
		expect(onExit).not.toHaveBeenCalled();
		act(() => {
			useAppStore.setState({
				saveState: {
					type: 'clean',
					savedAt: '2026-07-29T11:05:01.000Z'
				}
			});
		});

		await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
	});
});
