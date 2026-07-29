import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import type { InlineLanguageCheckStatus } from '../../review/inline/useInlineLanguageCheck';
import {
	INLINE_PLOT_EXPANSION_COOLDOWN_MS,
	INLINE_PLOT_EXPANSION_DEBOUNCE_MS,
	InlinePlotExpansionCache,
	InlinePlotExpansionRunError,
	InlinePlotExpansionRunner,
	isInlinePlotExpansionSuggestionCurrent,
	planInlinePlotExpansion,
	type InlinePlotExpansionPlan,
	type InlinePlotExpansionSuggestion
} from './InlinePlotExpansionService';

export type InlinePlotExpansionStatus =
	| 'off'
	| 'waiting'
	| 'paused'
	| 'checking'
	| 'ready'
	| 'ineligible'
	| 'needs-setup'
	| 'error';

interface PreviousEditorState {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly cursorOffset: number;
	readonly selectionActive: boolean;
	readonly enabled: boolean;
	readonly retryNonce: number;
}

interface PendingExpansion {
	readonly revision: number;
	readonly dueAt: number;
	readonly plan: InlinePlotExpansionPlan;
}

export function useInlinePlotExpansion(input: {
	readonly enabled: boolean;
	readonly ready: boolean;
	readonly readOnly: boolean;
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly cursorOffset: number;
	readonly selectionActive: boolean;
	readonly languageStatus: InlineLanguageCheckStatus;
}): {
	readonly suggestion?: InlinePlotExpansionSuggestion;
	readonly status: InlinePlotExpansionStatus;
	readonly statusMessage: string;
	readonly retry: () => void;
	readonly reject: () => void;
	readonly markAccepted: () => void;
} {
	const [suggestion, setSuggestion] = useState<InlinePlotExpansionSuggestion>();
	const [status, setStatus] = useState<InlinePlotExpansionStatus>(
		input.enabled ? 'ready' : 'off'
	);
	const [statusMessage, setStatusMessage] = useState(
		input.enabled ? '在完整句末停笔即可预览' : '已关闭'
	);
	const [retryNonce, setRetryNonce] = useState(0);
	const [pendingVersion, setPendingVersion] = useState(0);
	const [runner] = useState(() => new InlinePlotExpansionRunner(desktopBridge));
	const [cache] = useState(() => new InlinePlotExpansionCache());
	const previousRef = useRef<PreviousEditorState | undefined>(undefined);
	const pendingRef = useRef<PendingExpansion | undefined>(undefined);
	const revisionRef = useRef(0);
	const cooldownUntilRef = useRef(0);
	const suppressNextEditRef = useRef(false);
	const editDueAtRef = useRef(0);
	const editCursorSyncUntilRef = useRef(0);
	const suggestionRef = useRef<InlinePlotExpansionSuggestion | undefined>(
		undefined
	);

	const retry = useCallback(() => {
		cooldownUntilRef.current = 0;
		setRetryNonce(current => current + 1);
	}, []);

	const reject = useCallback(() => {
		revisionRef.current += 1;
		pendingRef.current = undefined;
		void runner.cancel();
		suggestionRef.current = undefined;
		setSuggestion(undefined);
		setStatus(input.enabled ? 'ready' : 'off');
		setStatusMessage(input.enabled ? '预览已忽略' : '已关闭');
	}, [input.enabled, runner]);

	const markAccepted = useCallback(() => {
		suppressNextEditRef.current = true;
		revisionRef.current += 1;
		pendingRef.current = undefined;
		void runner.cancel();
		suggestionRef.current = undefined;
		setSuggestion(undefined);
		setStatus(input.enabled ? 'ready' : 'off');
		setStatusMessage(input.enabled ? '已插入，可用 Ctrl+Z 撤销' : '已关闭');
	}, [input.enabled, runner]);

	useEffect(() => {
		const previous = previousRef.current;
		const sameResource = previous !== undefined
			&& previous.projectId === input.projectId
			&& previous.resourceId === input.resourceId;
		const force = input.enabled
			&& sameResource
			&& (!previous.enabled || previous.retryNonce !== retryNonce);
		const contentChanged = sameResource && previous.content !== input.content;
		const cursorChanged = sameResource
			&& previous.cursorOffset !== input.cursorOffset;
		const selectionChanged = sameResource
			&& previous.selectionActive !== input.selectionActive;
		const activeSuggestion = suggestionRef.current;
		const acceptedInsertion = activeSuggestion
			? [
				activeSuggestion.insertion,
				activeSuggestion.insertion.replace(/\n/gu, '\r\n')
			].find(candidate => (
				input.content.slice(
					activeSuggestion.cursorOffset,
					activeSuggestion.cursorOffset + candidate.length
				) === candidate
				&& input.content.slice(0, activeSuggestion.cursorOffset)
					=== activeSuggestion.sourceContent.slice(
						0,
						activeSuggestion.cursorOffset
					)
				&& input.content.slice(activeSuggestion.cursorOffset + candidate.length)
					=== activeSuggestion.sourceContent.slice(activeSuggestion.cursorOffset)
			))
			: undefined;
		const suggestionAccepted = contentChanged
			&& activeSuggestion !== undefined
			&& acceptedInsertion !== undefined;

		previousRef.current = {
			projectId: input.projectId,
			resourceId: input.resourceId,
			content: input.content,
			cursorOffset: input.cursorOffset,
			selectionActive: input.selectionActive,
			enabled: input.enabled,
			retryNonce
		};
		revisionRef.current += 1;
		const revision = revisionRef.current;

		if (!input.enabled || input.readOnly) {
			pendingRef.current = undefined;
			void runner.cancel();
			suggestionRef.current = undefined;
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setSuggestion(undefined);
				setStatus('off');
				setStatusMessage(input.readOnly ? '只读模式不可用' : '已关闭');
			});
			return;
		}

		if (!input.ready) {
			pendingRef.current = undefined;
			suggestionRef.current = undefined;
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setSuggestion(undefined);
				setStatus('waiting');
				setStatusMessage('正在准备编辑器…');
			});
			return;
		}

		if (!sameResource) {
			pendingRef.current = undefined;
			void runner.cancel();
			suggestionRef.current = undefined;
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setSuggestion(undefined);
				setStatus('ready');
				setStatusMessage('在完整句末停笔即可预览');
			});
			return;
		}

		if (contentChanged || cursorChanged || selectionChanged || force) {
			pendingRef.current = undefined;
			void runner.cancel();
			if (contentChanged || force) {
				suggestionRef.current = undefined;
			}
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setSuggestion(undefined);
			});
		}

		if (suggestionAccepted || (contentChanged && suppressNextEditRef.current)) {
			suppressNextEditRef.current = false;
			editDueAtRef.current = 0;
			editCursorSyncUntilRef.current = 0;
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setStatus('ready');
				setStatusMessage('已插入，可用 Ctrl+Z 撤销');
			});
			return;
		}

		if (contentChanged) {
			editDueAtRef.current = Date.now() + INLINE_PLOT_EXPANSION_DEBOUNCE_MS;
			editCursorSyncUntilRef.current = Date.now() + 250;
		}
		const cursorFollowsEdit = !contentChanged
			&& (cursorChanged || selectionChanged)
			&& editDueAtRef.current > 0
			&& Date.now() <= editCursorSyncUntilRef.current;

		if (!contentChanged && !force && !cursorFollowsEdit) {
			if (cursorChanged || selectionChanged) {
				editDueAtRef.current = 0;
				editCursorSyncUntilRef.current = 0;
				queueMicrotask(() => {
					if (revision !== revisionRef.current) return;
					setStatus('ready');
					setStatusMessage('在完整句末停笔即可预览');
				});
			}
			return;
		}

		const plan = planInlinePlotExpansion({
			projectId: input.projectId,
			resourceId: input.resourceId,
			content: input.content,
			cursorOffset: input.cursorOffset,
			selectionActive: input.selectionActive
		});
		if (!plan) {
			queueMicrotask(() => {
				if (revision !== revisionRef.current) return;
				setStatus('ineligible');
				setStatusMessage('请将光标放在完整句末');
			});
			return;
		}

		pendingRef.current = {
			revision,
			dueAt: force
				? Date.now() + INLINE_PLOT_EXPANSION_DEBOUNCE_MS
				: editDueAtRef.current,
			plan
		};
		queueMicrotask(() => {
			if (revision !== revisionRef.current) return;
			setStatus('waiting');
			setStatusMessage('停笔后生成情节预览');
			setPendingVersion(current => current + 1);
		});
	}, [
		input.content,
		input.cursorOffset,
		input.enabled,
		input.projectId,
		input.readOnly,
		input.ready,
		input.resourceId,
		input.selectionActive,
		retryNonce,
		runner
	]);

	const languageBusy = input.languageStatus === 'waiting'
		|| input.languageStatus === 'checking';

	useEffect(() => {
		const pending = pendingRef.current;
		if (!pending) return;
		if (languageBusy) {
			void runner.cancel();
			queueMicrotask(() => {
				if (pending.revision !== revisionRef.current) return;
				setStatus('paused');
				setStatusMessage('等待 AI 语法检查完成');
			});
			return;
		}
		const delay = Math.max(0, pending.dueAt - Date.now());
		const timer = window.setTimeout(() => {
			void (async () => {
				if (
					pending.revision !== revisionRef.current
					|| pendingRef.current?.plan.fingerprint !== pending.plan.fingerprint
				) {
					return;
				}
				if (Date.now() < cooldownUntilRef.current) {
					pendingRef.current = undefined;
					setStatus('error');
					setStatusMessage('请求暂缓，请稍后重试');
					return;
				}
				const provider = await desktopBridge.getAiProviderStatus();
				if (pending.revision !== revisionRef.current) return;
				if (!provider.secret.configured) {
					pendingRef.current = undefined;
					setStatus('needs-setup');
					setStatusMessage('需要先配置 DeepSeek');
					return;
				}
				setStatus('checking');
				setStatusMessage('正在生成情节预览…');
				let nextSuggestion = cache.get(pending.plan);
				if (!nextSuggestion) {
					nextSuggestion = await runner.run({
						plan: pending.plan,
						preferences: provider.preferences
					});
					if (!nextSuggestion) return;
					cache.set(pending.plan, nextSuggestion);
				}
				if (
					pending.revision !== revisionRef.current
					|| !isInlinePlotExpansionSuggestionCurrent(nextSuggestion, {
						projectId: input.projectId,
						resourceId: input.resourceId,
						content: input.content,
						cursorOffset: input.cursorOffset
					})
				) {
					return;
				}
				pendingRef.current = undefined;
				suggestionRef.current = nextSuggestion;
				setSuggestion(nextSuggestion);
				setStatus('ready');
				setStatusMessage('按 Tab 接受 · Esc 忽略');
			})().catch(error => {
				if (pending.revision !== revisionRef.current) return;
				pendingRef.current = undefined;
				const detail = error instanceof InlinePlotExpansionRunError
					? error.detail
					: {
						code: 'unknown' as const,
						message: error instanceof Error ? error.message : '情节预览生成失败。',
						retryable: true
					};
				if (detail.retryable) {
					cooldownUntilRef.current = Date.now()
						+ INLINE_PLOT_EXPANSION_COOLDOWN_MS;
				}
				setStatus(detail.code === 'authentication_failed'
					|| detail.code === 'invalid_configuration'
					? 'needs-setup'
					: 'error');
				setStatusMessage(detail.message);
			});
		}, delay);

		return () => {
			window.clearTimeout(timer);
			void runner.cancel();
		};
	}, [
		cache,
		input.content,
		input.cursorOffset,
		input.projectId,
		input.resourceId,
		languageBusy,
		pendingVersion,
		runner
	]);

	return {
		suggestion,
		status,
		statusMessage,
		retry,
		reject,
		markAccepted
	};
}
