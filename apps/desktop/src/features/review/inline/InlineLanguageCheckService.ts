import {
	AI_INLINE_LANGUAGE_CHECK_MAX_CHARS,
	buildInlineLanguageCheckMessages,
	nextAiJobState,
	parseInlineLanguageCheckResponse,
	type AiGenerateRequest,
	type AiJobState,
	type AiProviderPreferences,
	type AiStreamEvent,
	type PublicAiError
} from '@writing-buddy/ai';
import type { DesktopBridge } from '@writing-buddy/platform-ports';
import {
	createTextAnchor,
	hashText,
	resolveAnchor,
	type ReviewIssue
} from '@writing-buddy/review';
import { normalizeAiError } from '../../ai/stores/aiStore';

export const INLINE_LANGUAGE_CHECK_DEBOUNCE_MS = 1_200;
export const INLINE_LANGUAGE_CHECK_COOLDOWN_MS = 10_000;
export const INLINE_LANGUAGE_CHECK_MIN_TEXT_LENGTH = 4;
const INLINE_LANGUAGE_CONTEXT_TARGET = 360;
const INLINE_LANGUAGE_CACHE_LIMIT = 64;

export interface InlineLanguageCheckSlice {
	readonly start: number;
	readonly end: number;
	readonly content: string;
	readonly fingerprint: string;
}

export interface InlineLanguageCheckRunInput {
	readonly projectId: string;
	readonly resourceId: string;
	readonly slice: InlineLanguageCheckSlice;
	readonly preferences: AiProviderPreferences;
}

type InlineLanguageBridge = Pick<
	DesktopBridge,
	'startAiGeneration' | 'cancelAiJob'
>;

interface ActiveInlineLanguageJob {
	readonly jobId: string;
	readonly finishCancelled: () => void;
}

export class InlineLanguageCheckRunError extends Error {
	constructor(readonly detail: PublicAiError) {
		super(detail.message);
		this.name = 'InlineLanguageCheckRunError';
	}
}

export class InlineLanguageCheckRunner {
	private active?: ActiveInlineLanguageJob;

	constructor(private readonly bridge: InlineLanguageBridge) {}

	async run(
		input: InlineLanguageCheckRunInput
	): Promise<readonly ReviewIssue[] | undefined> {
		await this.cancel();
		const modelId = input.preferences.defaultModelId;
		if (!modelId) {
			throw new InlineLanguageCheckRunError(normalizeAiError('invalid_configuration'));
		}
		const jobId = crypto.randomUUID();
		const request: AiGenerateRequest = {
			jobId,
			jobType: 'inline-language-check',
			providerId: 'deepseek',
			modelId,
			messages: buildInlineLanguageCheckMessages(input.slice.content),
			options: {
				stream: true,
				thinkingMode: 'disabled',
				maxOutputTokens: 1024,
				responseFormat: 'json_object'
			}
		};

		return new Promise<readonly ReviewIssue[] | undefined>((resolve, reject) => {
			let output = '';
			let state: AiJobState = 'created';
			let settled = false;
			const finish = (
				result: readonly ReviewIssue[] | undefined,
				error?: PublicAiError
			) => {
				if (settled) return;
				settled = true;
				if (this.active?.jobId === jobId) {
					this.active = undefined;
				}
				if (error) {
					reject(new InlineLanguageCheckRunError(error));
				} else {
					resolve(result);
				}
			};
			this.active = {
				jobId,
				finishCancelled: () => finish(undefined)
			};
			const onEvent = (event: AiStreamEvent) => {
				if (event.jobId !== jobId || settled) return;
				try {
					state = nextAiJobState(state, event);
				} catch {
					return;
				}
				switch (event.type) {
					case 'content_delta':
						output += event.text;
						if (output.length > 64_000) {
							finish(undefined, normalizeAiError('invalid_request'));
						}
						break;
					case 'completed':
						try {
							finish(parseInlineLanguageCheckResponse({
								projectId: input.projectId,
								resourceId: input.resourceId,
								content: input.slice.content,
								response: output
							}));
						} catch {
							finish(undefined, {
								code: 'invalid_request',
								message: 'AI 返回的内联检查结果无法验证，请重试。',
								retryable: true
							});
						}
						break;
					case 'cancelled':
						finish(undefined);
						break;
					case 'failed':
						finish(undefined, event.error);
						break;
					default:
						break;
				}
			};
			void this.bridge.startAiGeneration(request, onEvent).catch(error => {
				finish(undefined, normalizeAiError(error));
			});
		});
	}

	async cancel(): Promise<void> {
		const active = this.active;
		if (!active) return;
		this.active = undefined;
		active.finishCancelled();
		await this.bridge.cancelAiJob(active.jobId).catch(() => false);
	}
}

export class InlineLanguageCheckCache {
	private readonly entries = new Map<string, {
		readonly content: string;
		readonly issues: readonly ReviewIssue[];
	}>();

	get(slice: InlineLanguageCheckSlice): readonly ReviewIssue[] | undefined {
		const entry = this.entries.get(slice.fingerprint);
		if (!entry || entry.content !== slice.content) return undefined;
		this.entries.delete(slice.fingerprint);
		this.entries.set(slice.fingerprint, entry);
		return entry.issues;
	}

	set(slice: InlineLanguageCheckSlice, issues: readonly ReviewIssue[]): void {
		this.entries.delete(slice.fingerprint);
		this.entries.set(slice.fingerprint, {
			content: slice.content,
			issues
		});
		while (this.entries.size > INLINE_LANGUAGE_CACHE_LIMIT) {
			const oldest = this.entries.keys().next().value;
			if (!oldest) break;
			this.entries.delete(oldest);
		}
	}
}

export function planInlineLanguageCheckSlice(input: {
	readonly previousContent?: string;
	readonly content: string;
	readonly cursorOffset?: number;
	readonly force?: boolean;
}): InlineLanguageCheckSlice | undefined {
	const content = input.content;
	if (!content.trim()) return undefined;
	let changedStart: number;
	let changedEnd: number;
	if (input.force || input.previousContent === undefined) {
		changedStart = clampOffset(input.cursorOffset ?? 0, content.length);
		changedEnd = changedStart;
	} else {
		const change = changedRange(input.previousContent, content);
		if (!change) return undefined;
		changedStart = change.start;
		changedEnd = change.end;
	}

	const paragraphStart = content.lastIndexOf('\n', Math.max(0, changedStart - 1)) + 1;
	const newlineAfter = content.indexOf('\n', Math.max(changedStart, changedEnd));
	const paragraphEnd = newlineAfter < 0 ? content.length : newlineAfter;
	let start = paragraphStart;
	let end = paragraphEnd;

	if (end - start > AI_INLINE_LANGUAGE_CHECK_MAX_CHARS) {
		const changeSpan = Math.max(1, changedEnd - changedStart);
		const boundedSpan = Math.min(changeSpan, AI_INLINE_LANGUAGE_CHECK_MAX_CHARS);
		const desiredStart = clampOffset(
			changedStart - INLINE_LANGUAGE_CONTEXT_TARGET,
			Math.max(paragraphStart, paragraphEnd - AI_INLINE_LANGUAGE_CHECK_MAX_CHARS)
		);
		start = Math.max(
			paragraphStart,
			Math.min(desiredStart, paragraphEnd - AI_INLINE_LANGUAGE_CHECK_MAX_CHARS)
		);
		end = Math.min(
			paragraphEnd,
			Math.max(start + boundedSpan, start + AI_INLINE_LANGUAGE_CHECK_MAX_CHARS)
		);
		if (end - start > AI_INLINE_LANGUAGE_CHECK_MAX_CHARS) {
			end = start + AI_INLINE_LANGUAGE_CHECK_MAX_CHARS;
		}
		start = sentenceBoundaryAfter(content, start, changedStart);
		if (end - start > AI_INLINE_LANGUAGE_CHECK_MAX_CHARS) {
			end = start + AI_INLINE_LANGUAGE_CHECK_MAX_CHARS;
		}
		end = sentenceBoundaryBefore(content, end, Math.max(changedEnd, start + 1));
	}

	start = safeUtf16Boundary(content, start, -1);
	end = safeUtf16Boundary(content, end, 1);
	if (end - start > AI_INLINE_LANGUAGE_CHECK_MAX_CHARS) {
		end = safeUtf16Boundary(
			content,
			start + AI_INLINE_LANGUAGE_CHECK_MAX_CHARS,
			-1
		);
	}
	const sliceContent = content.slice(start, end);
	if (
		sliceContent.replace(/\s/gu, '').length < INLINE_LANGUAGE_CHECK_MIN_TEXT_LENGTH
		|| end <= start
	) {
		return undefined;
	}
	return {
		start,
		end,
		content: sliceContent,
		fingerprint: hashText(sliceContent)
	};
}

export function rebaseInlineLanguageIssues(input: {
	readonly issues: readonly ReviewIssue[];
	readonly slice: InlineLanguageCheckSlice;
	readonly content: string;
	readonly projectId: string;
	readonly resourceId: string;
}): readonly ReviewIssue[] {
	if (input.content.slice(input.slice.start, input.slice.end) !== input.slice.content) {
		return [];
	}
	const now = new Date().toISOString();
	return input.issues.flatMap((issue, index): readonly ReviewIssue[] => {
		const relativeStart = issue.anchor.start;
		const relativeEnd = issue.anchor.end;
		if (
			relativeStart < 0
			|| relativeEnd <= relativeStart
			|| relativeEnd > input.slice.content.length
			|| input.slice.content.slice(relativeStart, relativeEnd) !== issue.anchor.target
		) {
			return [];
		}
		const start = input.slice.start + relativeStart;
		const end = input.slice.start + relativeEnd;
		return [{
			...issue,
			id: `ai-inline-language:${input.resourceId}:${start}:${hashText(
				`${issue.title}:${issue.anchor.target}:${index}`
			)}`,
			projectId: input.projectId,
			resourceId: input.resourceId,
			ruleId: 'ai-inline-language-check',
			anchor: createTextAnchor(input.content, start, end),
			createdAt: now,
			updatedAt: now
		}];
	});
}

export function reconcileInlineLanguageIssues(
	issues: readonly ReviewIssue[],
	content: string
): readonly ReviewIssue[] {
	return issues.flatMap((issue): readonly ReviewIssue[] => {
		const resolved = resolveAnchor(content, issue.anchor);
		return resolved ? [{
			...issue,
			anchor: createTextAnchor(content, resolved.start, resolved.end)
		}] : [];
	});
}

export function replaceInlineLanguageIssuesInSlice(input: {
	readonly current: readonly ReviewIssue[];
	readonly replacement: readonly ReviewIssue[];
	readonly slice: InlineLanguageCheckSlice;
	readonly content: string;
}): readonly ReviewIssue[] {
	const current = reconcileInlineLanguageIssues(input.current, input.content);
	return [
		...current.filter(issue => (
			issue.anchor.end <= input.slice.start
			|| issue.anchor.start >= input.slice.end
		)),
		...input.replacement
	];
}

function changedRange(
	previousContent: string,
	content: string
): { readonly start: number; readonly end: number } | undefined {
	if (previousContent === content) return undefined;
	let start = 0;
	const prefixLimit = Math.min(previousContent.length, content.length);
	while (start < prefixLimit && previousContent[start] === content[start]) {
		start += 1;
	}
	let previousEnd = previousContent.length;
	let end = content.length;
	while (
		previousEnd > start
		&& end > start
		&& previousContent[previousEnd - 1] === content[end - 1]
	) {
		previousEnd -= 1;
		end -= 1;
	}
	return {
		start: safeUtf16Boundary(content, start, -1),
		end: safeUtf16Boundary(content, end, 1)
	};
}

function sentenceBoundaryAfter(content: string, start: number, limit: number): number {
	for (let index = start; index < Math.min(limit, start + 120); index += 1) {
		if (/[\n。！？!?；;]/u.test(content[index] ?? '')) {
			return index + 1;
		}
	}
	return start;
}

function sentenceBoundaryBefore(content: string, end: number, limit: number): number {
	for (let index = end; index > Math.max(limit, end - 120); index -= 1) {
		if (/[\n。！？!?；;]/u.test(content[index - 1] ?? '')) {
			return index;
		}
	}
	return end;
}

function safeUtf16Boundary(content: string, offset: number, direction: -1 | 1): number {
	let result = clampOffset(offset, content.length);
	if (
		result > 0
		&& result < content.length
		&& isHighSurrogate(content.charCodeAt(result - 1))
		&& isLowSurrogate(content.charCodeAt(result))
	) {
		result += direction;
	}
	return clampOffset(result, content.length);
}

function isHighSurrogate(value: number): boolean {
	return value >= 0xD800 && value <= 0xDBFF;
}

function isLowSurrogate(value: number): boolean {
	return value >= 0xDC00 && value <= 0xDFFF;
}

function clampOffset(value: number, maximum: number): number {
	return Math.max(0, Math.min(maximum, value));
}
