import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
import { useAiStore } from './stores/aiStore';
import {
	createDeferred,
	resetAiSettingsActionState
} from './AiSettingsActionTestHarness.test-utils';

describe('AI settings save-key action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible action, enters loading disabled state, and saves once across 100 rapid pointer actions without retaining the secret', async () => {
		const secret = await desktopBridge.saveDeepSeekKey('fixture-key');
		const connection = await desktopBridge.testDeepSeekConnection();
		await desktopBridge.deleteDeepSeekKey();
		const saveResult = createDeferred<typeof secret>();
		const saveDeepSeekKey = vi.spyOn(desktopBridge, 'saveDeepSeekKey')
			.mockImplementation(() => saveResult.promise);
		const testDeepSeekConnection = vi.spyOn(desktopBridge, 'testDeepSeekConnection')
			.mockResolvedValue(connection);
		render(<AiSettingsSection />);

		const input = await screen.findByTestId('ai-settings-api-key-input');
		fireEvent.change(input, { target: { value: 'fixture-key' } });
		const save = screen.getByTestId('ai-settings-save-key');
		expect(save).toHaveAttribute('data-ai-action', 'save-key');
		expect(save).toHaveAccessibleName('安全保存并验证');
		expect(save).toBeVisible();
		expect(save).toBeEnabled();
		fireEvent.click(save);
		for (let index = 1; index < 100; index += 1) fireEvent.click(save);

		expect(saveDeepSeekKey).toHaveBeenCalledOnce();
		expect(save).toBeDisabled();
		expect(save).toHaveTextContent('正在保存并验证…');
		saveResult.resolve(secret);
		await screen.findByText('API Key 已安全保存，连接验证通过。');
		expect(testDeepSeekConnection).toHaveBeenCalledOnce();
		expect(JSON.stringify(useAiStore.getState())).not.toContain('fixture-key');
		expect(JSON.stringify(localStorage)).not.toContain('fixture-key');
	});

	it('supports focused keyboard save, focus exit, visual identity and configured restart persistence', async () => {
		const user = userEvent.setup();
		const view = render(<AiSettingsSection />);
		await user.type(await screen.findByTestId('ai-settings-api-key-input'), 'fixture-key');
		const save = screen.getByTestId('ai-settings-save-key');
		expect(save).toHaveClass('primary-button');
		save.focus();
		expect(document.activeElement).toBe(save);
		await user.keyboard('{Enter}');
		await screen.findByText('API Key 已安全保存，连接验证通过。');
		await user.tab();
		expect(document.activeElement).not.toBe(save);

		view.unmount();
		render(<AiSettingsSection />);
		expect(await screen.findByText('凭据已配置')).toBeInTheDocument();
	});

	it('shows a redacted failure and succeeds on explicit save retry', async () => {
		const secret = await desktopBridge.saveDeepSeekKey('fixture-key');
		const connection = await desktopBridge.testDeepSeekConnection();
		await desktopBridge.deleteDeepSeekKey();
		vi.spyOn(desktopBridge, 'saveDeepSeekKey')
			.mockRejectedValueOnce(new Error('raw credential persistence failure'))
			.mockResolvedValueOnce(secret);
		vi.spyOn(desktopBridge, 'testDeepSeekConnection').mockResolvedValue(connection);
		const user = userEvent.setup();
		render(<AiSettingsSection />);

		const input = await screen.findByTestId('ai-settings-api-key-input');
		await user.type(input, 'first-key');
		await user.click(screen.getByTestId('ai-settings-save-key'));
		await screen.findByText('API Key 已交给 Windows 凭据管理器；请根据错误检查连接或密钥。');
		expect(screen.queryByText(/raw credential persistence failure/)).not.toBeInTheDocument();

		await user.type(input, 'retry-key');
		await user.click(screen.getByTestId('ai-settings-save-key'));
		await screen.findByText('API Key 已安全保存，连接验证通过。');
	});
});
