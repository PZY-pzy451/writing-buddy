import {
	buildManuscriptContinuationMessages,
	nextAiJobState,
	parseManuscriptContinuationResponse,
	type AiGenerateRequest,
	type AiJobState,
	type AiProviderPreferences,
	type AiStreamEvent,
	type ManuscriptContinuationCandidateResponse,
	type PublicAiError
} from '@writing-buddy/ai';
import type { DesktopBridge } from '@writing-buddy/platform-ports';
import { hashText } from '@writing-buddy/review';
import { normalizeAiError } from '../../ai/stores/aiStore';

export const INLINE_PLOT_EXPANSION_DEBOUNCE_MS = 2_400;
export const INLINE_PLOT_EXPANSION_COOLDOWN_MS = 10_000;
export const INLINE_PLOT_EXPANSION_MAX_SOURCE_CHARS = 4_000;
export const INLINE_PLOT_EXPANSION_MIN_SOURCE_CHARS = 24;
const INLINE_PLOT_EXPANSION_CACHE_LIMIT = 32;
const INLINE_PLOT_EXPANSION_MAX_RESULT_CHARS = 800;
const SENTENCE_END_PATTERN = /[。！？!?…」』”"')）\]]$/u;

export interface InlinePlotExpansionPlan {
	readonly projectId: string;
	readonly resourceId: string;
	readonly cursorOffset: number;
	readonly sourceStart: number;
	readonly source: string;
	readonly documentContent: string;
	readonly fingerprint: string;
}

export interface InlinePlotExpansionSuggestion {
	readonly id: string;
	readonly projectId: string;
	readonly resourceId: string;
	readonly cursorOffset: number;
	readonly sourceFingerprint: string;
	readonly sourceContent: string;
	readonly insertion: string;
	readonly title: string;
	readonly rationale: string;
}

type InlinePlotBridge = Pick<
	DesktopBridge,
	'startAiGeneration' | 'cancelAiJob'
>;

interface ActiveInlinePlotJob {
	readonly jobId: string;
	readonly finishCancelled: () => void;
}

export class InlinePlotExpansionRunError extends Error {
	constructor(readonly detail: PublicAiError) {
		super(detail.message);
		this.name = 'InlinePlotExpansionRunError';
	}
}

export class InlinePlotExpansionRunner {
	private active?: ActiveInlinePlotJob;

	constructor(private readonly bridge: InlinePlotBridge) {}

	async run(input: {
		readonly plan: InlinePlotExpansionPlan;
		readonly preferences: AiProviderPreferences;
	}): Promise<InlinePlotExpansionSuggestion | undefined> {
		await this.cancel();
		const modelId = input.preferences.defaultModelId;
		if (!modelId) {
			throw new InlinePlotExpansionRunError(normalizeAiError('invalid_configuration'));
		}
		const jobId = crypto.randomUUID();
		const request: AiGenerateRequest = {
			jobId,
			jobType: 'manuscript-continuation',
			providerId: 'deepseek',
			modelId,
			messages: buildInlinePlotExpansionMessages(input.plan),
			options: {
				stream: true,
				thinkingMode: 'disabled',
				maxOutputTokens: 512,
				responseFormat: 'json_object'
			}
		};

		return new Promise<InlinePlotExpansionSuggestion | undefined>((resolve, reject) => {
			let output = '';
			let state: AiJobState = 'created';
			let settled = false;
			const finish = (
				result: InlinePlotExpansionSuggestion | undefined,
				error?: PublicAiError
			) => {
				if (settled) return;
				settled = true;
				if (this.active?.jobId === jobId) {
					this.active = undefined;
				}
				if (error) {
					reject(new InlinePlotExpansionRunError(error));
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
							const candidate = parseManuscriptContinuationResponse(
								output,
								'continue-paragraph'
							)[0];
							finish(candidate
								? createInlinePlotExpansionSuggestion(input.plan, candidate)
								: undefined);
						} catch {
							finish(undefined, {
								code: 'invalid_request',
								message: 'AI 返回的情节拓展无法验证，请重试。',
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

export class InlinePlotExpansionCache {
	private readonly entries = new Map<string, InlinePlotExpansionSuggestion>();

	get(plan: InlinePlotExpansionPlan): InlinePlotExpansionSuggestion | undefined {
		const entry = this.entries.get(plan.fingerprint);
		if (
			!entry
			|| entry.sourceContent !== plan.documentContent
			|| entry.cursorOffset !== plan.cursorOffset
		) {
			return undefined;
		}
		this.entries.delete(plan.fingerprint);
		this.entries.set(plan.fingerprint, entry);
		return entry;
	}

	set(plan: InlinePlotExpansionPlan, suggestion: InlinePlotExpansionSuggestion): void {
		this.entries.delete(plan.fingerprint);
		this.entries.set(plan.fingerprint, suggestion);
		while (this.entries.size > INLINE_PLOT_EXPANSION_CACHE_LIMIT) {
			const oldest = this.entries.keys().next().value;
			if (!oldest) break;
			this.entries.delete(oldest);
		}
	}
}

export function planInlinePlotExpansion(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly cursorOffset: number;
	readonly selectionActive: boolean;
}): InlinePlotExpansionPlan | undefined {
	if (
		!input.projectId
		|| !input.resourceId
		|| input.selectionActive
	) {
		return undefined;
	}
	const cursorOffset = clampOffset(input.cursorOffset, input.content.length);
	const nextLineBreak = input.content.indexOf('\n', cursorOffset);
	const lineEnd = nextLineBreak < 0 ? input.content.length : nextLineBreak;
	if (input.content.slice(cursorOffset, lineEnd).trim()) {
		return undefined;
	}
	const prefix = input.content.slice(0, cursorOffset);
	const trimmedPrefix = prefix.trimEnd();
	if (
		trimmedPrefix.replace(/\s/gu, '').length < INLINE_PLOT_EXPANSION_MIN_SOURCE_CHARS
		|| !SENTENCE_END_PATTERN.test(trimmedPrefix)
	) {
		return undefined;
	}
	const sourceStart = safeUtf16Boundary(
		input.content,
		Math.max(0, cursorOffset - INLINE_PLOT_EXPANSION_MAX_SOURCE_CHARS),
		1
	);
	const source = input.content.slice(sourceStart, cursorOffset);
	if (
		!source.trim()
		|| source.length > INLINE_PLOT_EXPANSION_MAX_SOURCE_CHARS
	) {
		return undefined;
	}
	return {
		projectId: input.projectId,
		resourceId: input.resourceId,
		cursorOffset,
		sourceStart,
		source,
		documentContent: input.content,
		fingerprint: hashText(JSON.stringify({
			projectId: input.projectId,
			resourceId: input.resourceId,
			cursorOffset,
			source
		}))
	};
}

export function buildInlinePlotExpansionMessages(
	plan: InlinePlotExpansionPlan
): ReturnType<typeof buildManuscriptContinuationMessages> {
	return buildManuscriptContinuationMessages(JSON.stringify({
		schemaVersion: 1,
		actionType: 'continue-paragraph',
		context: [{
			priority: 'P0',
			kind: 'instruction',
			title: 'Tab 情节拓展',
			content: [
				'在光标处续写一个简短自然段，约 50 至 160 个中文字符。',
				'沿用现有叙事视角、人物状态和场景线索，推进一个动作、悬念或人物选择。',
				'不要复述前文，不要添加标题、解释或上下文中没有依据的核心设定。'
			].join('')
		}, {
			priority: 'P1',
			kind: 'manuscript-excerpt',
			title: '光标前文',
			content: plan.source
		}]
	}));
}

export function createInlinePlotExpansionSuggestion(
	plan: InlinePlotExpansionPlan,
	candidate: ManuscriptContinuationCandidateResponse
): InlinePlotExpansionSuggestion {
	const content = candidate.content.trim();
	if (
		!content
		|| content.length > INLINE_PLOT_EXPANSION_MAX_RESULT_CHARS
		|| !candidate.title.trim()
		|| !candidate.rationale.trim()
	) {
		throw new Error('invalidInlinePlotExpansionCandidate');
	}
	const before = plan.documentContent.slice(0, plan.cursorOffset);
	const after = plan.documentContent.slice(plan.cursorOffset);
	const prefix = before.trim() && !before.endsWith('\n\n') ? '\n\n' : '';
	const suffix = after.trim() && !after.startsWith('\n\n') ? '\n\n' : '';
	return {
		id: `inline-plot:${crypto.randomUUID()}`,
		projectId: plan.projectId,
		resourceId: plan.resourceId,
		cursorOffset: plan.cursorOffset,
		sourceFingerprint: plan.fingerprint,
		sourceContent: plan.documentContent,
		insertion: `${prefix}${content}${suffix}`,
		title: candidate.title.trim(),
		rationale: candidate.rationale.trim()
	};
}

export function isInlinePlotExpansionSuggestionCurrent(
	suggestion: InlinePlotExpansionSuggestion,
	input: {
		readonly projectId: string;
		readonly resourceId: string;
		readonly content: string;
		readonly cursorOffset: number;
	}
): boolean {
	return suggestion.projectId === input.projectId
		&& suggestion.resourceId === input.resourceId
		&& suggestion.sourceContent === input.content
		&& suggestion.cursorOffset === input.cursorOffset;
}

function safeUtf16Boundary(
	content: string,
	offset: number,
	direction: -1 | 1
): number {
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
