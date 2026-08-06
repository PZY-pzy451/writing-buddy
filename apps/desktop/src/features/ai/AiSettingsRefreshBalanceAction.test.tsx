import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import { useAiStore } from './stores/aiStore';
import {
	configureAiSettingsKey,
	createDeferred,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings refresh-balance action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible action, enters loading disabled state, and refreshes balance once across 100 rapid pointer actions with success', async () => {
		await configureAiSettingsKey();
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		await user.click(screen.getByRole('button', { name: '刷新模型列表' }));
		await screen.findByText('模型列表已刷新，共 2 个可用模型。');

		const balance = await desktopBridge.getDeepSeekBalance();
		const balanceResult = createDeferred<typeof balance>();
		const getDeepSeekBalance = vi.spyOn(desktopBridge, 'getDeepSeekBalance')
			.mockImplementation(() => balanceResult.promise);
		const refresh = screen.getByTestId('ai-settings-refresh-balance');
		expect(refresh).toHaveAttribute('data-ai-action', 'refresh-balance');
		expect(refresh).toHaveAccessibleName('刷新余额');
		expect(refresh).toBeVisible();
		expect(refresh).toBeEnabled();
		fireEvent.click(refresh);
		for (let index = 1; index < 100; index += 1) fireEvent.click(refresh);

		expect(getDeepSeekBalance).toHaveBeenCalledOnce();
		expect(refresh).toBeDisabled();
		balanceResult.resolve(balance);
		await screen.findByText('余额已刷新：88.00 CNY。');
		expect(screen.queryByText('模型列表已刷新，共 2 个可用模型。')).not.toBeInTheDocument();
		expect(useAiStore.getState().balance).toEqual(balance);
	});

	it('supports focused keyboard refresh, focus exit, visual identity and balance persistence after restart', async () => {
		await configureAiSettingsKey();
		const user = userEvent.setup();
		const view = render(<AiSettingsSection />);
		const refresh = screen.getByTestId('ai-settings-refresh-balance');
		expect(refresh).toHaveClass('secondary-button');
		refresh.focus();
		expect(document.activeElement).toBe(refresh);
		await user.keyboard('{Enter}');
		await screen.findByText('余额已刷新：88.00 CNY。');
		await user.tab();
		expect(document.activeElement).not.toBe(refresh);
		const balance = useAiStore.getState().balance;

		view.unmount();
		render(<AiSettingsSection />);
		expect(useAiStore.getState().balance).toEqual(balance);
	});

	it('shows a redacted balance refresh failure and succeeds on explicit retry', async () => {
		await configureAiSettingsKey();
		const balance = await desktopBridge.getDeepSeekBalance();
		vi.spyOn(desktopBridge, 'getDeepSeekBalance')
			.mockRejectedValueOnce(new Error('raw balance refresh failure'))
			.mockResolvedValueOnce(balance);
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		const refresh = screen.getByTestId('ai-settings-refresh-balance');

		await user.click(refresh);
		await screen.findByText('余额刷新失败，请检查错误提示后重试。');
		expect(screen.queryByText(/raw balance refresh failure/)).not.toBeInTheDocument();
		expect(refresh).toBeEnabled();
		await user.click(refresh);
		await screen.findByText('余额已刷新：88.00 CNY。');
	});
});
