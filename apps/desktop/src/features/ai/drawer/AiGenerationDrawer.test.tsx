import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	createDeepSeekProviderDefinition
} from '@writing-buddy/ai';
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

describe('AiGenerationDrawer', () => {
	it('opens any registered test action and keeps unavailable guidance in the drawer', async () => {
		const user = userEvent.setup();
		const store = createAiGenerationStore(runtime);
		store.getState().openAiAction('review.consistency', {}, { context: {} });
		render(<AiGenerationDrawer store={store} />);

		expect(screen.getByRole('dialog', { name: 'AI 快速生成' })).toBeInTheDocument();
		expect(screen.getByText('一致性审查')).toBeInTheDocument();
		expect(screen.getByText('请先打开作品')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始生成' })).toBeDisabled();

		await user.click(screen.getByRole('button', { name: '关闭 AI 快速生成' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});
