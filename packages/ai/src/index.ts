import { createTextAnchor, type ReviewIssue } from '@writing-buddy/review';
import { z } from 'zod';

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
	readonly role: AiRole;
	readonly content: string;
}

export interface AiRequest {
	readonly requestId: string;
	readonly model: string;
	readonly messages: readonly AiMessage[];
	readonly task: 'polish' | 'shorten' | 'grammar' | 'dialogue' | 'rhythm' | 'review';
}

export interface AiSuggestion {
	readonly original: string;
	readonly replacement: string;
	readonly reason: string;
	readonly scope: string;
}

export interface AiProvider {
	readonly id: string;
	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion>;
}

const responseSchema = z.object({
	replacement: z.string(),
	reason: z.string().min(1),
	scope: z.string().min(1).default('当前选区')
});

export function buildSelectionContext(input: {
	readonly projectTitle: string;
	readonly chapterTitle: string;
	readonly selection: string;
	readonly before: string;
	readonly after: string;
}): readonly AiMessage[] {
	return [
		{
			role: 'system',
			content: '你是 Writing Buddy 的写作助手。只针对作者明确选择的文字提出建议，不扩展、泄露或虚构未提供的全文。返回 JSON。'
		},
		{
			role: 'user',
			content: JSON.stringify({
				project: input.projectTitle,
				chapter: input.chapterTitle,
				selection: input.selection,
				localContext: { before: input.before, after: input.after },
				responseSchema: { replacement: 'string', reason: 'string', scope: 'string' }
			})
		}
	];
}

export function parseAiSuggestion(original: string, response: string): AiSuggestion {
	const parsed = responseSchema.parse(JSON.parse(response));
	return { original, ...parsed };
}

export class FakeAiProvider implements AiProvider {
	readonly id = 'fake';

	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion> {
		if (signal?.aborted) {
			return Promise.reject(new DOMException('Cancelled', 'AbortError'));
		}
		let selectionMessage = '';
		for (let index = request.messages.length - 1; index >= 0; index--) {
			const message = request.messages[index];
			if (message?.role === 'user') {
				selectionMessage = message.content;
				break;
			}
		}
		let original = '';
		try {
			const decoded = JSON.parse(selectionMessage) as { selection?: string };
			original = decoded.selection ?? '';
		} catch {
			original = selectionMessage;
		}
		return Promise.resolve({
			original,
			replacement: original
				.replace(/非常非常/gu, '格外')
				.replace(/然后然后/gu, '随后')
				.replace(/[ \t]{2,}/gu, ' '),
			reason: '减少重复表达，让句子更紧凑。',
			scope: '当前选区'
		});
	}
}

export function suggestionToReviewIssue(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly start: number;
	readonly end: number;
	readonly content: string;
	readonly suggestion: AiSuggestion;
}): ReviewIssue {
	const now = new Date().toISOString();
	return {
		id: `ai:${input.resourceId}:${input.start}:${crypto.randomUUID()}`,
		projectId: input.projectId,
		resourceId: input.resourceId,
		ruleId: 'ai-suggestion',
		severity: 'suggestion',
		status: 'open',
		title: 'AI 润色建议',
		message: input.suggestion.reason,
		anchor: createTextAnchor(input.content, input.start, input.end),
		replacement: input.suggestion.replacement,
		createdAt: now,
		updatedAt: now,
		origin: 'ai'
	};
}
