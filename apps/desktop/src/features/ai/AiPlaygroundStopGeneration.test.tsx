import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { vi } from 'vitest';
import { desktopBridge } from '../../platform/bridge';
import { AiPlaygroundPage } from './AiPlaygroundPage';
import { useAiStore } from './stores/aiStore';

function createDeferred<T>(): {
	readonly promise: Promise<T>;
	readonly resolve: (value: T) => void;
} {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function resetAiState(): void {
	useAiStore.setState({
		initialized: true,
		loading: false,
		status: undefined,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		balance: undefined,
		prompt: 'active author prompt',
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

describe('AI playground stop-generation control', () => {
	beforeEach(() => {
		resetAiState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders an enabled accessible action and cancels once across 100 rapid pointer clicks', async () => {
		const cancellation = createDeferred<boolean>();
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => cancellation.promise);
		useAiStore.setState({
			jobId: 'active-playground-job',
			jobState: 'streaming',
			output: 'partial candidate'
		});
		render(<AiPlaygroundPage />);

		const stop = screen.getByTestId('ai-playground-stop-generation');
		expect(stop).toHaveAttribute('data-ai-action', 'stop-generation');
		expect(stop).toHaveAccessibleName('停止');
		expect(stop).toBeEnabled();
		for (let index = 0; index < 100; index += 1) fireEvent.click(stop);

		expect(cancelAiJob).toHaveBeenCalledOnce();
		cancellation.resolve(true);
		await waitFor(() => expect(useAiStore.getState()).toMatchObject({
			jobState: 'cancelled',
			partial: true,
			output: 'partial candidate'
		}));
	});

	it('stops from focused keyboard Enter activation', async () => {
		const user = userEvent.setup();
		vi.spyOn(desktopBridge, 'cancelAiJob').mockResolvedValue(true);
		useAiStore.setState({ jobId: 'keyboard-job', jobState: 'connecting' });
		render(<AiPlaygroundPage />);

		const stop = screen.getByTestId('ai-playground-stop-generation');
		stop.focus();
		await user.keyboard('{Enter}');

		await waitFor(() => expect(useAiStore.getState().jobState).toBe('cancelled'));
	});

	it('keeps stop disabled while no generation is active', () => {
		render(<AiPlaygroundPage />);
		expect(screen.getByTestId('ai-playground-stop-generation')).toBeDisabled();
	});
});
