import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { SettingsPage } from '../../settings/SettingsPage';
import { desktopBridge } from '../../platform/bridge';
import { AiPlaygroundPage } from './AiPlaygroundPage';
import { useAiStore } from './stores/aiStore';

function resetAiStore(): void {
	useAiStore.setState({
		initialized: false,
		loading: false,
		status: undefined,
		preferences: DEFAULT_AI_PREFERENCES,
		models: [],
		balance: undefined,
		usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 },
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

describe('Phase 1.0A AI experience', () => {
	beforeEach(async () => {
		await desktopBridge.deleteDeepSeekKey();
		resetAiStore();
	});

	it('saves and validates a key without retaining it in React or local storage', async () => {
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		const input = await screen.findByLabelText('DeepSeek API Key');
		await user.type(input, 'fixture-key');
		await user.click(screen.getByRole('button', { name: /安全保存并验证/ }));

		await screen.findByText('API Key 已安全保存，连接验证通过。');
		expect(screen.getByText('凭据已配置')).toBeInTheDocument();
		expect(JSON.stringify(useAiStore.getState())).not.toContain('fixture-key');
		const localValues = Array.from({ length: localStorage.length }, (_, index) => {
			const storageKey = localStorage.key(index);
			return storageKey ? localStorage.getItem(storageKey) : '';
		});
		expect(JSON.stringify(localValues)).not.toContain('fixture-key');
	});

	it('streams only the explicit StoryForge prompt and exposes usage', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
		});
		const user = userEvent.setup();
		render(<AiPlaygroundPage />);
		const prompt = screen.getByLabelText('仅发送此输入框的内容');
		await user.type(prompt, '写一段雨夜车站的悬疑场景。');
		await user.click(screen.getByRole('button', { name: /开始流式生成/ }));

		await waitFor(() => expect(screen.getByText('已完成')).toBeInTheDocument());
		expect(screen.getByRole('log')).toHaveTextContent('雨水沿着锈蚀的站牌缓慢滑落');
		expect(screen.getByText('输入 38')).toBeInTheDocument();
		expect(useAiStore.getState().prompt).toBe('写一段雨夜车站的悬疑场景。');
	});

	it('cancels an active stream and preserves partial output when present', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('测试停止');
		});
		const generation = useAiStore.getState().startGeneration();
		await waitFor(() => expect(useAiStore.getState().jobState).toBe('connecting'));
		await act(async () => {
			await useAiStore.getState().cancelGeneration();
			await generation;
		});
		expect(useAiStore.getState().jobState).toBe('cancelled');
	});
});
