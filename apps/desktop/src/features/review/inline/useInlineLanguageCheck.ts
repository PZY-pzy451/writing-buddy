import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewIssue } from '@writing-buddy/review';
import { desktopBridge } from '../../../platform/bridge';
import {
	INLINE_LANGUAGE_CHECK_COOLDOWN_MS,
	INLINE_LANGUAGE_CHECK_DEBOUNCE_MS,
	InlineLanguageCheckCache,
	InlineLanguageCheckRunError,
	InlineLanguageCheckRunner,
	planInlineLanguageCheckSlice,
	rebaseInlineLanguageIssues,
	reconcileInlineLanguageIssues,
	replaceInlineLanguageIssuesInSlice
} from './InlineLanguageCheckService';

export type InlineLanguageCheckStatus =
	| 'off'
	| 'waiting'
	| 'checking'
	| 'ready'
	| 'needs-setup'
	| 'error';

interface PreviousEditorState {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly enabled: boolean;
	readonly retryNonce: number;
}

export function useInlineLanguageCheck(input: {
	readonly enabled: boolean;
	readonly ready: boolean;
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly cursorOffset: number;
}): {
	readonly issues: readonly ReviewIssue[];
	readonly status: InlineLanguageCheckStatus;
	readonly statusMessage: string;
	readonly checkedAt?: number;
	readonly retry: () => void;
} {
	const [issues, setIssues] = useState<readonly ReviewIssue[]>([]);
	const [status, setStatus] = useState<InlineLanguageCheckStatus>(
		input.enabled ? 'waiting' : 'off'
	);
	const [statusMessage, setStatusMessage] = useState(
		input.enabled ? '等待检查当前段落' : '已关闭'
	);
	const [checkedAt, setCheckedAt] = useState<number | undefined>(undefined);
	const [retryNonce, setRetryNonce] = useState(0);
	const [runner] = useState(() => new InlineLanguageCheckRunner(desktopBridge));
	const [cache] = useState(() => new InlineLanguageCheckCache());
	const previousRef = useRef<PreviousEditorState | undefined>(undefined);
	const revisionRef = useRef(0);
	const cursorOffsetRef = useRef(input.cursorOffset);
	const cooldownUntilRef = useRef(0);

	useEffect(() => {
		cursorOffsetRef.current = input.cursorOffset;
	}, [input.cursorOffset]);

	const retry = useCallback(() => {
		cooldownUntilRef.current = 0;
		setRetryNonce(current => current + 1);
	}, []);

	useEffect(() => {
		const previous = previousRef.current;
		const force = input.enabled
			&& previous !== undefined
			&& (!previous.enabled || previous.retryNonce !== retryNonce);
		previousRef.current = {
			projectId: input.projectId,
			resourceId: input.resourceId,
			content: input.content,
			enabled: input.enabled,
			retryNonce
		};
		revisionRef.current += 1;
		const revision = revisionRef.current;

		if (!input.enabled) {
			void runner.cancel();
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setIssues([]);
				setStatus('off');
				setStatusMessage('已关闭');
				setCheckedAt(undefined);
			});
			return;
		}

		if (!input.ready) {
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setStatus('waiting');
				setStatusMessage('正在准备编辑器…');
			});
			return;
		}

		if (
			!previous
			|| previous.projectId !== input.projectId
			|| previous.resourceId !== input.resourceId
		) {
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setIssues([]);
				setStatus('ready');
				setStatusMessage('等待正文变化');
			});
			return;
		}
		queueMicrotask(() => {
			if (revision !== revisionRef.current) return;
			setIssues(current => reconcileInlineLanguageIssues(current, input.content));
		});

		const slice = planInlineLanguageCheckSlice({
			previousContent: force ? undefined : previous?.content,
			content: input.content,
			cursorOffset: cursorOffsetRef.current,
			force
		});
		if (!slice) {
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setStatus('ready');
				setStatusMessage('当前段落没有足够文本');
			});
			return;
		}

		queueMicrotask(() => {
			if (revision !== revisionRef.current) return;
			setIssues(current => replaceInlineLanguageIssuesInSlice({
				current,
				replacement: [],
				slice,
				content: input.content
			}));
			setStatus('waiting');
			setStatusMessage('停笔后检查变化段落');
		});

		const timer = window.setTimeout(() => {
			void (async () => {
				const cached = cache.get(slice);
				let relativeIssues = cached;
				if (!relativeIssues) {
					if (Date.now() < cooldownUntilRef.current) {
						setStatus('error');
						setStatusMessage('请求暂缓，请稍后重试');
						return;
					}
					const provider = await desktopBridge.getAiProviderStatus();
					if (revision !== revisionRef.current) return;
					if (!provider.secret.configured) {
						setStatus('needs-setup');
						setStatusMessage('需要先配置 DeepSeek');
						return;
					}
					setStatus('checking');
					setStatusMessage('正在检查变化段落…');
					relativeIssues = await runner.run({
						projectId: input.projectId,
						resourceId: input.resourceId,
						slice,
						preferences: provider.preferences
					});
					if (!relativeIssues) return;
					cache.set(slice, relativeIssues);
				}

				if (
					revision !== revisionRef.current
					|| input.content.slice(slice.start, slice.end) !== slice.content
				) {
					return;
				}
				const rebased = rebaseInlineLanguageIssues({
					issues: relativeIssues,
					slice,
					content: input.content,
					projectId: input.projectId,
					resourceId: input.resourceId
				});
				setIssues(current => replaceInlineLanguageIssuesInSlice({
					current,
					replacement: rebased,
					slice,
					content: input.content
				}));
				setStatus('ready');
				setStatusMessage(rebased.length > 0
					? `发现 ${rebased.length} 处明确问题`
					: '未发现明确问题');
				setCheckedAt(Date.now());
			})().catch(error => {
				if (revision !== revisionRef.current) return;
				const detail = error instanceof InlineLanguageCheckRunError
					? error.detail
					: {
						code: 'unknown' as const,
						message: error instanceof Error ? error.message : '内联检查失败。',
						retryable: true
					};
				if (detail.retryable) {
					cooldownUntilRef.current = Date.now() + INLINE_LANGUAGE_CHECK_COOLDOWN_MS;
				}
				setStatus(detail.code === 'authentication_failed'
					|| detail.code === 'invalid_configuration'
					? 'needs-setup'
					: 'error');
				setStatusMessage(detail.message);
			});
		}, INLINE_LANGUAGE_CHECK_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timer);
			void runner.cancel();
		};
	}, [
		input.content,
		input.enabled,
		input.projectId,
		input.ready,
		input.resourceId,
		cache,
		retryNonce,
		runner
	]);

	return {
		issues,
		status,
		statusMessage,
		checkedAt,
		retry
	};
}
