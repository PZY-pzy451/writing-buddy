import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
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

describe('AI playground clear-result control', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetAiState();
	});

	it('renders an enabled action for output-limit success and clears by pointer while preserving the prompt', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('[QA_OUTPUT_LIMIT] 写一段长篇测试。');
			await useAiStore.getState().startGeneration();
		});

		render(<AiPlaygroundPage />);
		await screen.findByText('已完成 · 达到输出上限');
		expect(useAiStore.getState().partial).toBe(true);
		expect(screen.getByRole('log')).not.toBeEmptyDOMElement();

		const clear = screen.getByTestId('ai-playground-clear-result');
		expect(clear).toHaveAttribute('data-ai-action', 'clear-result');
		expect(clear).toHaveAccessibleName('清空');
		expect(clear).toBeEnabled();
		fireEvent.click(clear);

		expect(useAiStore.getState()).toMatchObject({
			prompt: '[QA_OUTPUT_LIMIT] 写一段长篇测试。',
			output: '',
			jobState: 'created',
			partial: false
		});
		expect(clear).toBeDisabled();
	});

	it('supports focused keyboard Enter and remains empty after 100 repeated clear actions', async () => {
		const user = userEvent.setup();
		useAiStore.setState({
			initialized: true,
			prompt: 'retain author prompt',
			output: 'completed candidate',
			jobState: 'completed'
		});
		render(<AiPlaygroundPage />);

		const clear = screen.getByTestId('ai-playground-clear-result');
		clear.focus();
		expect(clear).toHaveFocus();
		await user.keyboard('{Enter}');
		for (let index = 0; index < 100; index += 1) fireEvent.click(clear);

		expect(useAiStore.getState()).toMatchObject({
			prompt: 'retain author prompt',
			output: '',
			jobState: 'created'
		});
	});

	it('keeps clear disabled while output is missing or streaming', () => {
		useAiStore.setState({ initialized: true, output: '', jobState: 'created' });
		const view = render(<AiPlaygroundPage />);
		expect(screen.getByTestId('ai-playground-clear-result')).toBeDisabled();

		act(() => {
			useAiStore.setState({ output: 'partial candidate', jobState: 'streaming' });
			view.rerender(<AiPlaygroundPage />);
		});
		expect(screen.getByTestId('ai-playground-clear-result')).toBeDisabled();
	});
});
