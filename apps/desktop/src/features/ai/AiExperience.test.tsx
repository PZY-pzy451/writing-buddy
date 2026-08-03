import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	type AiGenerateRequest,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { vi } from 'vitest';
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

	it('starts one playground request for 100 same-tick generation calls', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob');
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('同一条件只应生成一次。');
			await Promise.all(Array.from({ length: 100 }, () => (
				useAiStore.getState().startGeneration()
			)));
		});

		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(cancelAiJob).not.toHaveBeenCalled();
		expect(useAiStore.getState().jobState).toBe('completed');
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
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

	it('deduplicates 100 cancellations and ignores a stale cancellation result', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('取消结果不能覆盖下一次生成。');
		});
		const jobs: Array<{
			request: AiGenerateRequest;
			listener: (event: AiStreamEvent) => void;
			resolve: () => void;
		}> = [];
		const cancellations: Array<(cancelled: boolean) => void> = [];
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => new Promise<void>(resolve => {
				jobs.push({ request, listener, resolve });
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
			}));
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockImplementation(() => new Promise<boolean>(resolve => cancellations.push(resolve)));

		const firstGeneration = useAiStore.getState().startGeneration();
		await waitFor(() => expect(useAiStore.getState().jobState).toBe('connecting'));
		const cancelAttempts = Array.from({ length: 100 }, () => (
			useAiStore.getState().cancelGeneration()
		));

		expect(cancelAiJob).toHaveBeenCalledOnce();
		const first = jobs[0];
		if (!first) throw new Error('first AI job missing');
		first.listener({ type: 'completed', jobId: first.request.jobId });
		const secondGeneration = useAiStore.getState().startGeneration();
		await waitFor(() => expect(jobs).toHaveLength(2));
		const second = jobs[1];
		if (!second) throw new Error('second AI job missing');

		cancellations[0]?.(true);
		await Promise.all(cancelAttempts);
		expect(useAiStore.getState()).toMatchObject({
			jobId: second.request.jobId,
			jobState: 'connecting'
		});

		second.listener({ type: 'completed', jobId: second.request.jobId });
		first.resolve();
		second.resolve();
		await Promise.all([firstGeneration, secondGeneration]);
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
	});

	it('localizes a cancellation failure and permits one explicit retry', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
			useAiStore.getState().setPrompt('停止失败后仍应允许重试。');
		});
		let resolveGeneration: (() => void) | undefined;
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockImplementation((request, listener) => new Promise<void>(resolve => {
				resolveGeneration = resolve;
				listener({ type: 'job_started', jobId: request.jobId });
				listener({ type: 'connection_opened', jobId: request.jobId });
			}));
		const cancelAiJob = vi.spyOn(desktopBridge, 'cancelAiJob')
			.mockRejectedValueOnce(new Error('raw native cancellation detail'))
			.mockResolvedValueOnce(true);

		const generation = useAiStore.getState().startGeneration();
		await waitFor(() => expect(useAiStore.getState().jobState).toBe('connecting'));
		await useAiStore.getState().cancelGeneration();
		expect(useAiStore.getState()).toMatchObject({
			jobState: 'connecting',
			error: { message: 'AI 请求失败。' }
		});
		await useAiStore.getState().cancelGeneration();
		expect(cancelAiJob).toHaveBeenCalledTimes(2);
		expect(useAiStore.getState()).toMatchObject({
			jobState: 'cancelled',
			error: undefined
		});

		resolveGeneration?.();
		await generation;
		startAiGeneration.mockRestore();
		cancelAiJob.mockRestore();
	});

	it('persists the provider maximum and explains long-form output cost', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
		});
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		const maximum = await screen.findByRole('combobox', {
			name: '最大输出 Token'
		});
		await user.selectOptions(maximum, '384000');

		await waitFor(() => expect(
			useAiStore.getState().preferences.maxOutputTokens
		).toBe(384_000));
		expect(maximum).toHaveValue('384000');
		expect(screen.getByText(/64K 以上适合长篇任务/)).toBeInTheDocument();
		expect(screen.getByText(/DeepSeek 当前上限 384K/)).toBeInTheDocument();
	});

	it('keeps text but marks a plain-text result that reaches the output limit', async () => {
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
	});
});
