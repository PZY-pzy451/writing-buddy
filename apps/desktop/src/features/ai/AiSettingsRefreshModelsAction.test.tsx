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

describe('AI settings refresh-models action', () => {
	beforeEach(resetAiSettingsActionState);
	afterEach(() => vi.restoreAllMocks());

	it('renders a visible enabled accessible action, enters loading disabled state, and refreshes models once across 100 rapid pointer actions with success', async () => {
		await configureAiSettingsKey();
		const models = await desktopBridge.listDeepSeekModels(true);
		const modelsResult = createDeferred<typeof models>();
		const listDeepSeekModels = vi.spyOn(desktopBridge, 'listDeepSeekModels')
			.mockImplementation(() => modelsResult.promise);
		render(<AiSettingsSection />);

		const refresh = screen.getByTestId('ai-settings-refresh-models');
		expect(refresh).toHaveAttribute('data-ai-action', 'refresh-models');
		expect(refresh).toHaveAccessibleName('刷新模型列表');
		expect(refresh).toBeVisible();
		expect(refresh).toBeEnabled();
		fireEvent.click(refresh);
		for (let index = 1; index < 100; index += 1) fireEvent.click(refresh);

		expect(listDeepSeekModels).toHaveBeenCalledOnce();
		expect(refresh).toBeDisabled();
		modelsResult.resolve(models);
		await screen.findByText(`模型列表已刷新，共 ${models.length} 个可用模型。`);
		expect(useAiStore.getState().models).toEqual(models);
	});

	it('supports focused keyboard refresh, focus exit, visual identity and model persistence after restart', async () => {
		await configureAiSettingsKey();
		const user = userEvent.setup();
		const view = render(<AiSettingsSection />);
		const refresh = screen.getByTestId('ai-settings-refresh-models');
		expect(refresh).toHaveClass('secondary-button');
		refresh.focus();
		expect(document.activeElement).toBe(refresh);
		await user.keyboard('{Enter}');
		await screen.findByText('模型列表已刷新，共 2 个可用模型。');
		await user.tab();
		expect(document.activeElement).not.toBe(refresh);
		const models = useAiStore.getState().models;

		view.unmount();
		render(<AiSettingsSection />);
		expect(useAiStore.getState().models).toEqual(models);
	});

	it('shows a redacted model refresh failure and succeeds on explicit retry', async () => {
		await configureAiSettingsKey();
		const models = await desktopBridge.listDeepSeekModels(true);
		vi.spyOn(desktopBridge, 'listDeepSeekModels')
			.mockRejectedValueOnce(new Error('raw model refresh failure'))
			.mockResolvedValueOnce(models);
		const user = userEvent.setup();
		render(<AiSettingsSection />);
		const refresh = screen.getByTestId('ai-settings-refresh-models');

		await user.click(refresh);
		await screen.findByText('模型列表刷新失败，请检查错误提示后重试。');
		expect(screen.queryByText(/raw model refresh failure/)).not.toBeInTheDocument();
		expect(refresh).toBeEnabled();
		await user.click(refresh);
		await screen.findByText(`模型列表已刷新，共 ${models.length} 个可用模型。`);
	});
});
