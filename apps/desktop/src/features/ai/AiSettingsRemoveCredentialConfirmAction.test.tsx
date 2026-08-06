import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import { useAiStore } from './stores/aiStore';
import {
	configureAiSettingsKey,
	createDeferred,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings confirm credential-removal action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible visual confirmation, enters loading disabled state, cancels one active job, deletes one key and hides confirmation across 100 rapid pointer actions', async () => {
		await configureAiSettingsKey();
		useAiStore.setState({
			jobId: 'qa-active-job',
			jobState: 'streaming',
			output: 'partial output'
		});
		const cancellationResult = createDeferred<boolean>();
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => cancellationResult.promise);
		const deleteDeepSeekKey = vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockResolvedValue({ configured: false, providerId: 'deepseek' });
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		await user.click(screen.getByRole('button', { name: '移除凭据' }));
		const confirm = screen.getByTestId('ai-settings-remove-credential-confirm');
		expect(confirm).toHaveAttribute('data-ai-action', 'confirm-remove-credential');
		expect(confirm).toHaveAccessibleName('确定');
		expect(confirm).toBeVisible();
		expect(confirm).toBeEnabled();
		expect(confirm).toHaveClass('danger-button');
		fireEvent.click(confirm);
		for (let index = 1; index < 100; index += 1) fireEvent.click(confirm);

		expect(cancelAiJob).toHaveBeenCalledOnce();
		expect(confirm).toBeDisabled();
		cancellationResult.resolve(true);
		await waitFor(() => expect(deleteDeepSeekKey).toHaveBeenCalledOnce());
		await screen.findByText('DeepSeek 凭据和模型缓存已移除。');
		expect(screen.queryByRole('group', { name: '确认移除凭据' })).not.toBeInTheDocument();
		expect(useAiStore.getState()).toMatchObject({
			jobState: 'cancelled',
			partial: true,
			models: []
		});
	});

	it('preserves the cancelled job and enables retry after focused keyboard credential deletion fails', async () => {
		await configureAiSettingsKey();
		useAiStore.setState({
			jobId: 'qa-cancelled-before-delete-failure',
			jobState: 'streaming',
			output: 'partial output',
			startedAt: Date.now() - 100
		});
		vi.spyOn(desktopBridge, 'cancelAiJob').mockResolvedValue(true);
		vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockRejectedValue(new Error('raw credential deletion failure'));
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		await user.click(screen.getByRole('button', { name: '移除凭据' }));
		const confirm = screen.getByTestId('ai-settings-remove-credential-confirm');
		confirm.focus();
		expect(document.activeElement).toBe(confirm);
		await user.keyboard('{Enter}');

		await screen.findByText('移除失败，请检查错误提示后重试。');
		expect(confirm).toBeEnabled();
		expect(useAiStore.getState()).toMatchObject({
			jobState: 'cancelled',
			partial: true,
			loading: false,
			status: { secret: { configured: true } }
		});
		expect(useAiStore.getState().error?.message)
			.not.toContain('raw credential deletion failure');
	});
});
