import { DEFAULT_AI_PREFERENCES } from '@writing-buddy/ai';
import { desktopBridge } from '../../platform/bridge';
import { useAiStore } from './stores/aiStore';

export function createDeferred<T>(): {
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

export async function resetAiSettingsActionState(): Promise<void> {
	await desktopBridge.deleteDeepSeekKey();
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

export async function configureAiSettingsKey(): Promise<void> {
	await useAiStore.getState().initialize();
	await useAiStore.getState().saveKeyAndValidate('fixture-key');
}
