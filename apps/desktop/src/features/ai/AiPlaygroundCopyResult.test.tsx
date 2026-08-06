import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { vi } from 'vitest';
import { AiPlaygroundPage } from './AiPlaygroundPage';
import { useAiStore } from './stores/aiStore';

function resetAiState(): void {
	useAiStore.setState({
		initialized: true,
		loading: false,
		status: undefined,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		balance: undefined,
		prompt: 'author prompt',
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

describe('AI playground copy-result control', () => {
	beforeEach(() => {
		resetAiState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders a visible enabled accessible action and copies the exact result by pointer', async () => {
		const user = userEvent.setup();
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		useAiStore.setState({ output: 'exact completed candidate', jobState: 'completed' });
		render(<AiPlaygroundPage />);

		const copy = screen.getByTestId('ai-playground-copy-result');
		expect(copy).toHaveAttribute('data-ai-action', 'copy-result');
		expect(copy).toHaveAccessibleName('复制');
		expect(copy).toBeEnabled();
		await user.click(copy);

		expect(writeText).toHaveBeenCalledOnce();
		expect(writeText).toHaveBeenCalledWith('exact completed candidate');
		expect(copy).toHaveAccessibleName('已复制');
		expect(useAiStore.getState().output).toBe('exact completed candidate');
	});

	it('supports focused keyboard Enter and preserves the output after copy success', async () => {
		const user = userEvent.setup();
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		useAiStore.setState({ output: 'keyboard candidate', jobState: 'completed' });
		render(<AiPlaygroundPage />);

		const copy = screen.getByTestId('ai-playground-copy-result');
		copy.focus();
		await user.keyboard('{Enter}');

		expect(writeText).toHaveBeenCalledOnce();
		expect(useAiStore.getState().output).toBe('keyboard candidate');
	});

	it('keeps copy disabled while output is empty', () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		render(<AiPlaygroundPage />);

		expect(screen.getByTestId('ai-playground-copy-result')).toBeDisabled();
		expect(writeText).not.toHaveBeenCalled();
	});
});
