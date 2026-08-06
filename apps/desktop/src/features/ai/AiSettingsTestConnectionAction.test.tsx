import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import {
	configureAiSettingsKey,
	createDeferred,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings test-connection action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible action, enters loading disabled state, and tests the connection once across 100 rapid pointer actions', async () => {
		await configureAiSettingsKey();
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		fireEvent.change(screen.getByTestId('ai-settings-api-key-input'), {
			target: { value: 'replacement-fixture-key' }
		});
		await user.click(screen.getByRole('button', { name: '安全保存并验证' }));
		await screen.findByText('API Key 已安全保存，连接验证通过。');

		const connection = await desktopBridge.testDeepSeekConnection();
		const connectionResult = createDeferred<typeof connection>();
		const testDeepSeekConnection = vi.spyOn(desktopBridge, 'testDeepSeekConnection')
			.mockImplementation(() => connectionResult.promise);

		const test = screen.getByTestId('ai-settings-test-connection');
		expect(test).toHaveAttribute('data-ai-action', 'test-connection');
		expect(test).toHaveAccessibleName('测试连接');
		expect(test).toBeVisible();
		expect(test).toBeEnabled();
		fireEvent.click(test);
		for (let index = 1; index < 100; index += 1) fireEvent.click(test);

		expect(testDeepSeekConnection).toHaveBeenCalledOnce();
		expect(test).toBeDisabled();
		connectionResult.resolve(connection);
		await screen.findByText('连接测试成功，当前凭据可用。');
		expect(screen.queryByText('API Key 已安全保存，连接验证通过。'))
			.not.toBeInTheDocument();
	});

	it('supports focused keyboard connection testing, focus exit, visual identity and configured restart state', async () => {
		await configureAiSettingsKey();
		const user = userEvent.setup();
		const view = render(<AiSettingsSection />);
		const test = screen.getByTestId('ai-settings-test-connection');
		expect(test).toHaveClass('secondary-button');
		test.focus();
		expect(document.activeElement).toBe(test);
		await user.keyboard('{Enter}');
		await screen.findByText('连接测试成功，当前凭据可用。');
		await user.tab();
		expect(document.activeElement).not.toBe(test);

		view.unmount();
		render(<AiSettingsSection />);
		expect(await screen.findByText('凭据已配置')).toBeInTheDocument();
	});
});
