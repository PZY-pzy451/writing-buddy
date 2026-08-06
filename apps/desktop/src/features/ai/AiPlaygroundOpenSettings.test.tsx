import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { AiPlaygroundPage } from './AiPlaygroundPage';
import { useAiStore } from './stores/aiStore';

function resetAiState(): void {
	useAiStore.setState({
		initialized: false,
		loading: false,
		status: undefined,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		balance: undefined,
		prompt: '',
		output: '',
		jobId: undefined,
		jobState: 'created',
		jobUsage: undefined,
		startedAt: undefined,
		durationMs: undefined,
		partial: false,
		error: undefined
	});
}

describe('AI playground open-settings control', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetAiState();
		useAppStore.setState({ activeMode: 'ai' });
	});

	afterEach(() => {
		useAppStore.setState({ activeMode: 'works' });
	});

	it('renders a visible enabled accessible action and opens settings by pointer', async () => {
		const user = userEvent.setup();
		render(<AiPlaygroundPage />);

		const openSettings = await screen.findByTestId('ai-playground-open-settings');
		expect(openSettings).toHaveAttribute('data-ai-action', 'open-settings');
		expect(openSettings).toHaveAccessibleName('打开 AI 设置');
		expect(openSettings).toBeEnabled();

		openSettings.focus();
		expect(openSettings).toHaveFocus();
		await user.click(openSettings);
		expect(useAppStore.getState().activeMode).toBe('settings');
	});

	it('opens settings from focused keyboard Enter activation', async () => {
		const user = userEvent.setup();
		render(<AiPlaygroundPage />);

		const openSettings = await screen.findByTestId('ai-playground-open-settings');
		openSettings.focus();
		await user.keyboard('{Enter}');

		expect(useAppStore.getState().activeMode).toBe('settings');
	});

	it('hides the action after saved credentials survive a playground rerender', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
		});

		const view = render(<AiPlaygroundPage />);
		expect(screen.queryByTestId('ai-playground-open-settings')).not.toBeInTheDocument();

		view.rerender(<AiPlaygroundPage />);
		expect(screen.queryByTestId('ai-playground-open-settings')).not.toBeInTheDocument();
	});
});
