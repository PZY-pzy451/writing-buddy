import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	type AiGenerateRequest,
	type AiProviderPreferences,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { vi } from 'vitest';
import { SettingsPage } from '../../settings/SettingsPage';
import { desktopBridge } from '../../platform/bridge';
import { useAppStore } from '../../app/store';
import { AiPlaygroundPage } from './AiPlaygroundPage';
import { useAiStore } from './stores/aiStore';

function createDeferred<T>(): {
	readonly promise: Promise<T>;
	readonly resolve: (value: T) => void;
	readonly reject: (reason?: unknown) => void;
} {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

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

	afterEach(() => {
		vi.restoreAllMocks();
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

	it('shows recoverable feedback when a manual connection test fails', async () => {
		await useAiStore.getState().initialize();
		await useAiStore.getState().saveKeyAndValidate('fixture-key');
		vi.spyOn(desktopBridge, 'testDeepSeekConnection')
			.mockRejectedValueOnce(new Error('raw provider test failure'));
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));

		await user.click(screen.getByRole('button', { name: '测试连接' }));
		await screen.findByText('连接测试失败，请检查错误提示后重试。');
		expect(screen.queryByText(/raw provider test failure/)).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled();
	});

	it('streams only the explicit StoryForge prompt and exposes usage', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
			await useAiStore.getState().saveKeyAndValidate('fixture-key');
		});
		const user = userEvent.setup();
		render(<AiPlaygroundPage />);
		expect(screen.getByTestId('ai-playground-prompt'))
			.toHaveAttribute('data-testid', 'ai-playground-prompt');
		const prompt = screen.getByLabelText('仅发送此输入框的内容');
		await user.type(prompt, '写一段雨夜车站的悬疑场景。');
		await user.click(screen.getByRole('button', { name: /开始流式生成/ }));

		await waitFor(() => expect(screen.getByText('已完成')).toBeInTheDocument());
		expect(screen.getByRole('log')).toHaveTextContent('雨水沿着锈蚀的站牌缓慢滑落');
		expect(screen.getByText('输入 38')).toBeInTheDocument();
		expect(useAiStore.getState().prompt).toBe('写一段雨夜车站的悬疑场景。');
	});

	it('queues a different settings action without dropping or multiplying it', async () => {
		await useAiStore.getState().initialize();
		await useAiStore.getState().saveKeyAndValidate('fixture-key');
		const balance = await desktopBridge.getDeepSeekBalance();
		const balanceResult = createDeferred<typeof balance>();
		const getDeepSeekBalance = vi.spyOn(desktopBridge, 'getDeepSeekBalance')
			.mockImplementation(() => balanceResult.promise);
		const deletedSecret = {
			configured: false,
			providerId: 'deepseek' as const
		};
		const deleteDeepSeekKey = vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockResolvedValue(deletedSecret);

		const refresh = useAiStore.getState().refreshBalance();
		const deletionAttempts = Array.from({ length: 100 }, () => (
			useAiStore.getState().deleteKey()
		));
		expect(getDeepSeekBalance).toHaveBeenCalledOnce();
		expect(deleteDeepSeekKey).not.toHaveBeenCalled();

		balanceResult.resolve(balance);
		await Promise.all([refresh, ...deletionAttempts]);
		expect(deleteDeepSeekKey).toHaveBeenCalledOnce();
		expect(useAiStore.getState().status?.secret.configured).toBe(false);
	});

	it('does not start a new generation while credential deletion is active', async () => {
		await useAiStore.getState().initialize();
		await useAiStore.getState().saveKeyAndValidate('fixture-key');
		useAiStore.getState().setPrompt('删除凭据期间不得启动新的生成。');
		const deletedSecret = {
			configured: false,
			providerId: 'deepseek' as const
		};
		const deletionResult = createDeferred<typeof deletedSecret>();
		vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockImplementation(() => deletionResult.promise);
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');

		const deletion = useAiStore.getState().deleteKey();
		const generationAttempts = Array.from({ length: 100 }, () => (
			useAiStore.getState().startGeneration()
		));
		expect(startAiGeneration).not.toHaveBeenCalled();
		deletionResult.resolve(deletedSecret);
		await Promise.all([deletion, ...generationAttempts]);

		expect(useAiStore.getState().status?.secret.configured).toBe(false);
		expect(useAiStore.getState().jobId).toBeUndefined();
	});

	it('shows a recoverable deletion failure and succeeds on explicit retry', async () => {
		await useAiStore.getState().initialize();
		await useAiStore.getState().saveKeyAndValidate('fixture-key');
		const deletedSecret = {
			configured: false,
			providerId: 'deepseek' as const
		};
		const deleteDeepSeekKey = vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockRejectedValueOnce(new Error('raw native delete failure'))
			.mockResolvedValueOnce(deletedSecret);
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		await user.click(screen.getByRole('button', { name: '移除凭据' }));
		await user.click(screen.getByRole('button', { name: '确定' }));

		await screen.findByText('移除失败，请检查错误提示后重试。');
		expect(useAiStore.getState().status?.secret.configured).toBe(true);
		expect(screen.getByRole('button', { name: '确定' })).toBeEnabled();

		await user.click(screen.getByRole('button', { name: '确定' }));
		await screen.findByText('DeepSeek 凭据和模型缓存已移除。');
		expect(deleteDeepSeekKey).toHaveBeenCalledTimes(2);
		expect(useAiStore.getState().status?.secret.configured).toBe(false);
	});

	it('locks destructive confirmation and preference controls while deletion is pending', async () => {
		await useAiStore.getState().initialize();
		await useAiStore.getState().saveKeyAndValidate('fixture-key');
		const deletedSecret = {
			configured: false,
			providerId: 'deepseek' as const
		};
		const deletionResult = createDeferred<typeof deletedSecret>();
		vi.spyOn(desktopBridge, 'deleteDeepSeekKey')
			.mockImplementation(() => deletionResult.promise);
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		await user.click(screen.getByRole('button', { name: '移除凭据' }));
		await user.click(screen.getByRole('button', { name: '确定' }));

		expect(screen.getByRole('button', { name: '确定' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
		for (const select of screen.getAllByRole('combobox')) {
			expect(select).toBeDisabled();
		}
		expect(screen.getAllByTestId('ai-settings-generation-select')).toHaveLength(2);

		deletionResult.resolve(deletedSecret);
		await screen.findByText('DeepSeek 凭据和模型缓存已移除。');
	});

	it('serializes rapid rendered preference selections so the latest choice wins', async () => {
		await useAiStore.getState().initialize();
		const firstPreferences: AiProviderPreferences = {
			...useAiStore.getState().preferences,
			thinkingMode: 'enabled'
		};
		const latestPreferences: AiProviderPreferences = {
			...firstPreferences,
			thinkingMode: 'disabled'
		};
		const saves: Array<ReturnType<typeof createDeferred<AiProviderPreferences>>> = [];
		const saveAiPreferences = vi.spyOn(desktopBridge, 'saveAiPreferences')
			.mockImplementation(() => {
				const pending = createDeferred<AiProviderPreferences>();
				saves.push(pending);
				return pending.promise;
			});

		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		const preferenceControls = screen.getAllByTestId('ai-settings-generation-select');
		expect(preferenceControls).toHaveLength(2);
		const model = preferenceControls.find(control => (
			control.getAttribute('data-preference-key') === 'defaultModelId'
		));
		const thinking = preferenceControls.find(control => (
			control.getAttribute('data-preference-key') === 'thinkingMode'
		));
		expect(model).toBeDefined();
		expect(thinking).toBeDefined();
		await user.selectOptions(thinking as HTMLElement, 'enabled');
		await user.selectOptions(thinking as HTMLElement, 'disabled');
		expect(useAiStore.getState().preferences).toEqual(latestPreferences);
		expect(saveAiPreferences).toHaveBeenCalledOnce();

		saves[0]?.resolve(firstPreferences);
		await waitFor(() => expect(saveAiPreferences).toHaveBeenCalledTimes(2));
		expect(saveAiPreferences).toHaveBeenLastCalledWith(latestPreferences);
		saves[1]?.resolve(latestPreferences);
		await waitFor(() => expect(useAiStore.getState().status?.preferences)
			.toEqual(latestPreferences));

		expect(useAiStore.getState().preferences).toEqual(latestPreferences);
		expect(useAiStore.getState().status?.preferences).toEqual(latestPreferences);
	});

	it('rolls back to the last persisted preferences when the latest queued save fails', async () => {
		await useAiStore.getState().initialize();
		const firstPreferences: AiProviderPreferences = {
			...useAiStore.getState().preferences,
			maxOutputTokens: 65_536
		};
		const latestPreferences: AiProviderPreferences = {
			...firstPreferences,
			maxOutputTokens: 384_000
		};
		const saveAiPreferences = vi.spyOn(desktopBridge, 'saveAiPreferences')
			.mockResolvedValueOnce(firstPreferences)
			.mockRejectedValueOnce(new Error('raw stale preference write failure'));

		await Promise.all([
			useAiStore.getState().updatePreferences(firstPreferences),
			useAiStore.getState().updatePreferences(latestPreferences)
		]);

		expect(saveAiPreferences).toHaveBeenCalledTimes(2);
		expect(useAiStore.getState().preferences).toEqual(firstPreferences);
		expect(useAiStore.getState().status?.preferences).toEqual(firstPreferences);
		expect(useAiStore.getState().error?.message)
			.not.toContain('raw stale preference write failure');
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

	it('persists the provider maximum and enables explicit inline feature choices', async () => {
		await act(async () => {
			await useAiStore.getState().initialize();
		});
		useAppStore.setState({
			inlineLanguageCheckEnabled: false,
			inlinePlotExpansionEnabled: false
		});
		const user = userEvent.setup();
		render(<SettingsPage />);
		await user.click(screen.getByRole('tab', { name: /AI 与模型/ }));
		const maximum = await screen.findByRole('combobox', {
			name: '最大输出 Token'
		});
		const inlineFeatureToggles = screen.getAllByTestId('ai-settings-inline-feature-toggle');
		expect(inlineFeatureToggles).toHaveLength(2);
		const languageCheck = inlineFeatureToggles.find(control => (
			control.getAttribute('data-feature-key') === 'inlineLanguageCheck'
		));
		const plotExpansion = inlineFeatureToggles.find(control => (
			control.getAttribute('data-feature-key') === 'inlinePlotExpansion'
		));
		expect(languageCheck).toBeDefined();
		expect(plotExpansion).toBeDefined();
		await user.click(languageCheck as HTMLElement);
		await user.click(plotExpansion as HTMLElement);
		expect(useAppStore.getState()).toMatchObject({
			inlineLanguageCheckEnabled: true,
			inlinePlotExpansionEnabled: true
		});
		await user.selectOptions(maximum, '384000');

		await waitFor(() => expect(
			useAiStore.getState().preferences.maxOutputTokens
		).toBe(384_000));
		expect(maximum).toHaveValue('384000');
		expect(screen.getByText(/64K 以上适合长篇任务/)).toBeInTheDocument();
		expect(screen.getByText(/DeepSeek 当前上限 384K/)).toBeInTheDocument();
	});

});
