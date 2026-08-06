import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	createDeepSeekProviderDefinition
} from '@writing-buddy/ai';
import { createAiPreviewTransaction } from '@writing-buddy/ai-actions';
import { AiGenerationDrawer } from './AiGenerationDrawer';
import {
	createAiGenerationStore,
	type AiGenerationRuntime
} from './aiGenerationStore';

const runtime: AiGenerationRuntime = {
	getAiProviderStatus: () => Promise.resolve({
		provider: createDeepSeekProviderDefinition(),
		secret: { configured: true, providerId: 'deepseek' },
		preferences: DEFAULT_AI_PREFERENCES
	}),
	getAiPreferences: () => Promise.resolve(DEFAULT_AI_PREFERENCES),
	startAiGeneration: () => Promise.resolve(),
	cancelAiJob: () => Promise.resolve(true)
};

function createPreviewStore() {
	const store = createAiGenerationStore(runtime);
	const transaction = createAiPreviewTransaction({
		actionId: 'review.consistency',
		resourceId: 'chapter-1',
		baseRevision: 4,
		applyPolicy: { type: 'review_issues', maximumSeverity: 'warning' },
		candidate: { issues: [] }
	});
	store.setState({
		open: true,
		state: 'preview',
		rawOutput: JSON.stringify({ issues: [] }),
		parsedOutput: { issues: [] },
		transaction
	});
	return store;
}

describe('AI generation drawer reject-preview control', () => {
	it('renders an enabled accessible preview action and hides it after pointer rejection without apply', () => {
		const store = createPreviewStore();
		render(<AiGenerationDrawer store={store} />);

		const reject = screen.getByTestId('ai-drawer-reject-preview');
		expect(reject).toHaveAttribute('data-ai-action', 'reject-preview');
		expect(reject).toHaveAccessibleName('拒绝候选');
		expect(reject).toBeEnabled();
		reject.focus();
		expect(reject).toHaveFocus();
		fireEvent.click(reject);

		expect(store.getState()).toMatchObject({
			state: 'completed',
			transaction: { status: 'rejected', resourceId: 'chapter-1' }
		});
		expect(screen.queryByTestId('ai-drawer-reject-preview')).not.toBeInTheDocument();
	});

	it('commits one rejection across 100 repeated pointer actions without a write', () => {
		const store = createPreviewStore();
		render(<AiGenerationDrawer store={store} />);

		const reject = screen.getByTestId('ai-drawer-reject-preview');
		for (let index = 0; index < 100; index += 1) fireEvent.click(reject);

		expect(store.getState()).toMatchObject({
			state: 'completed',
			transaction: { status: 'rejected', resourceId: 'chapter-1' }
		});
	});

	it('rejects from focused keyboard Enter activation', async () => {
		const user = userEvent.setup();
		const store = createPreviewStore();
		render(<AiGenerationDrawer store={store} />);

		const reject = screen.getByTestId('ai-drawer-reject-preview');
		await waitFor(() => expect(
			screen.getByRole('button', { name: '切换 AI 抽屉宽度' })
		).toHaveFocus());
		reject.focus();
		expect(reject).toHaveFocus();
		await user.keyboard('{Enter}');

		expect(store.getState()).toMatchObject({
			state: 'completed',
			transaction: { status: 'rejected' }
		});
	});

	it('keeps the reject action hidden while an apply transaction is active', () => {
		const store = createPreviewStore();
		store.setState({ state: 'applying' });
		render(<AiGenerationDrawer store={store} />);

		expect(screen.queryByTestId('ai-drawer-reject-preview')).not.toBeInTheDocument();
		expect(store.getState().transaction?.status).toBe('preview');
	});
});
