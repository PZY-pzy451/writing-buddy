import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopBridge } from '../../../platform/bridge';
import { AiJobCancelButton } from './AiJobCancelButton';

describe('AiJobCancelButton', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('keeps an accepted cancellation locked until the active job leaves the UI', async () => {
		let resolveCancellation: (accepted: boolean) => void = () => undefined;
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => {
				resolveCancellation = resolve;
			}));
		render(<AiJobCancelButton jobId="job-1" showIcon />);

		const button = screen.getByRole('button', { name: '取消' });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
		resolveCancellation(true);
		await act(async () => Promise.resolve());
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
	});

	it('releases after a structured command failure and permits a retry', async () => {
		const onErrorChange = vi.fn();
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockRejectedValueOnce({
				code: 'connection_timeout',
				message: '取消命令连接超时。',
				retryable: true
			})
			.mockResolvedValue(true);
		render(
			<AiJobCancelButton
				jobId="job-2"
				onErrorChange={onErrorChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '取消' }));
		await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toBeEnabled());
		expect(onErrorChange).toHaveBeenLastCalledWith('取消命令连接超时。');
		fireEvent.click(screen.getByRole('button', { name: '取消' }));

		expect(cancelAiJob).toHaveBeenCalledTimes(2);
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
	});

	it('localizes an unknown command failure and a missing native job', async () => {
		const onErrorChange = vi.fn();
		vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockRejectedValueOnce(new Error('internal_transport_stack_9281'))
			.mockResolvedValueOnce(false);
		render(
			<AiJobCancelButton
				jobId="job-3"
				onErrorChange={onErrorChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: '取消' }));
		await waitFor(() => expect(onErrorChange).toHaveBeenLastCalledWith(
			'取消请求未完成，请检查 AI 连接状态后重试。'
		));
		expect(onErrorChange).not.toHaveBeenCalledWith(expect.stringContaining('internal_transport'));
		fireEvent.click(screen.getByRole('button', { name: '取消' }));
		await waitFor(() => expect(onErrorChange).toHaveBeenLastCalledWith(
			'没有找到正在生成的任务，请稍候后重试取消。'
		));
		expect(screen.getByRole('button', { name: '取消' })).toBeEnabled();
	});

	it('ignores a stale cancellation result after the active job changes', async () => {
		const resolvers: Array<(accepted: boolean) => void> = [];
		const onErrorChange = vi.fn();
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => {
				resolvers.push(resolve);
			}));
		const { rerender } = render(
			<AiJobCancelButton jobId="job-old" onErrorChange={onErrorChange} />
		);
		fireEvent.click(screen.getByRole('button', { name: '取消' }));

		rerender(<AiJobCancelButton jobId="job-new" onErrorChange={onErrorChange} />);
		fireEvent.click(screen.getByRole('button', { name: '取消' }));
		expect(cancelAiJob).toHaveBeenCalledTimes(2);
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();

		resolvers[0]?.(false);
		await act(async () => Promise.resolve());
		expect(onErrorChange).not.toHaveBeenCalledWith(
			'没有找到正在生成的任务，请稍候后重试取消。'
		);
		expect(screen.getByRole('button', { name: '正在取消' })).toBeDisabled();
		resolvers[1]?.(true);
		await act(async () => Promise.resolve());
	});
});
