import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { vi } from 'vitest';
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

describe('AI playground start-generation control', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetAiState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders an enabled accessible action and starts one successful stream across 100 rapid pointer clicks', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('只生成一次。');
		});
		render(<AiPlaygroundPage />);

		const start = screen.getByTestId('ai-playground-start-generation');
		expect(start).toHaveAttribute('data-ai-action', 'start-generation');
		expect(start).toHaveAccessibleName('开始流式生成');
		expect(start).toBeEnabled();
		for (let index = 0; index < 100; index += 1) fireEvent.click(start);

		await waitFor(() => expect(useAiStore.getState().jobState).toBe('completed'));
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(useAiStore.getState().output).not.toBe('');
	});

	it('starts from focused keyboard Enter activation', async () => {
		const user = userEvent.setup();
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('键盘生成。');
		});
		render(<AiPlaygroundPage />);

		const start = screen.getByTestId('ai-playground-start-generation');
		start.focus();
		await user.keyboard('{Enter}');

		await waitFor(() => expect(useAiStore.getState().jobState).toBe('completed'));
	});

	it('keeps generation disabled without configured credentials or an author prompt', async () => {
		render(<AiPlaygroundPage />);
		const start = await screen.findByTestId('ai-playground-start-generation');
		expect(start).toBeDisabled();

		await act(async () => {
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
		});
		expect(start).toBeDisabled();
	});
});
