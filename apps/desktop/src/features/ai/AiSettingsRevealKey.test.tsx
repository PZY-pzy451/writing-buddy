import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { desktopBridge } from '../../platform/bridge';
import { AiSettingsSection } from './AiSettingsSection';
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
		jobState: 'created',
		partial: false,
		error: undefined
	});
}

describe('AI settings secret reveal control', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetAiState();
	});

	it('renders a visible enabled accessible action and reveals only during pointer hold', async () => {
		render(<AiSettingsSection />);

		const input = await screen.findByLabelText('DeepSeek API Key');
		const reveal = screen.getByTestId('ai-settings-key-reveal');
		expect(reveal).toHaveAttribute('data-ai-action', 'reveal-api-key');
		expect(reveal).toHaveAccessibleName('按住显示 API Key');
		expect(reveal).toBeEnabled();
		expect(input).toHaveAttribute('type', 'password');

		fireEvent.change(input, { target: { value: 'fixture-secret' } });
		fireEvent.pointerDown(reveal, { pointerId: 1 });
		expect(input).toHaveAttribute('type', 'text');
		fireEvent.pointerUp(reveal, { pointerId: 1 });
		expect(input).toHaveAttribute('type', 'password');

		fireEvent.pointerDown(reveal, { pointerId: 2 });
		fireEvent.pointerLeave(reveal, { pointerId: 2 });
		expect(input).toHaveAttribute('type', 'password');

		fireEvent.pointerDown(reveal, { pointerId: 3 });
		fireEvent.pointerCancel(reveal, { pointerId: 3 });
		expect(input).toHaveAttribute('type', 'password');

		reveal.focus();
		fireEvent.pointerDown(reveal, { pointerId: 4 });
		fireEvent.blur(reveal);
		expect(input).toHaveAttribute('type', 'password');
	});

	it('reveals by keyboard Enter and Space only until keyup', async () => {
		render(<AiSettingsSection />);

		const input = await screen.findByLabelText('DeepSeek API Key');
		const reveal = screen.getByTestId('ai-settings-key-reveal');
		reveal.focus();

		fireEvent.keyDown(reveal, { key: 'Enter', code: 'Enter' });
		expect(input).toHaveAttribute('type', 'text');
		fireEvent.keyUp(reveal, { key: 'Enter', code: 'Enter' });
		expect(input).toHaveAttribute('type', 'password');

		fireEvent.keyDown(reveal, { key: ' ', code: 'Space' });
		expect(input).toHaveAttribute('type', 'text');
		fireEvent.keyUp(reveal, { key: ' ', code: 'Space' });
		expect(input).toHaveAttribute('type', 'password');
	});

	it('restores a hidden visual state after 100 repeated presses without persisting the secret', async () => {
		const view = render(<AiSettingsSection />);

		const input = await screen.findByLabelText('DeepSeek API Key');
		const reveal = screen.getByTestId('ai-settings-key-reveal');
		fireEvent.change(input, { target: { value: 'never-persist-this' } });
		for (let index = 0; index < 100; index += 1) {
			fireEvent.pointerDown(reveal, { pointerId: index + 1 });
			fireEvent.pointerUp(reveal, { pointerId: index + 1 });
		}

		expect(input).toHaveAttribute('type', 'password');
		expect(JSON.stringify(useAiStore.getState())).not.toContain('never-persist-this');
		expect(JSON.stringify(localStorage)).not.toContain('never-persist-this');

		view.rerender(<AiSettingsSection />);
		expect(screen.getByLabelText('DeepSeek API Key')).toHaveAttribute('type', 'password');
	});
});
