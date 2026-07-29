import {
	DEFAULT_AI_PREFERENCES,
	type AiGenerateRequest,
	type AiStreamEvent
} from '@writing-buddy/ai';
import { describe, expect, it, vi } from 'vitest';
import {
	InlinePlotExpansionCache,
	InlinePlotExpansionRunner,
	buildInlinePlotExpansionMessages,
	createInlinePlotExpansionSuggestion,
	isInlinePlotExpansionSuggestionCurrent,
	planInlinePlotExpansion
} from './InlinePlotExpansionService';

const source = '林墨推开候车室的木门，看见墙上的时钟停在二十三点十七分。';

function plan(content = source) {
	return planInlinePlotExpansion({
		projectId: 'project',
		resourceId: 'chapter:one',
		content,
		cursorOffset: content.length,
		selectionActive: false
	})!;
}

describe('inline Tab plot expansion', () => {
	it('plans only a bounded sentence-end source before a collapsed cursor', () => {
		const value = plan();
		expect(value).toMatchObject({
			projectId: 'project',
			resourceId: 'chapter:one',
			cursorOffset: source.length,
			source
		});
		expect(value.documentContent).toBe(source);
	});

	it('rejects selections, mid-line cursors, short text, and incomplete sentences', () => {
		const base = {
			projectId: 'project',
			resourceId: 'chapter:one',
			content: source,
			cursorOffset: source.length,
			selectionActive: false
		};
		expect(planInlinePlotExpansion({ ...base, selectionActive: true })).toBeUndefined();
		expect(planInlinePlotExpansion({
			...base,
			cursorOffset: source.indexOf('墙上')
		})).toBeUndefined();
		expect(planInlinePlotExpansion({ ...base, content: '雨停了。', cursorOffset: 4 }))
			.toBeUndefined();
		expect(planInlinePlotExpansion({
			...base,
			content: `${source}他继续向前`,
			cursorOffset: source.length + 6
		})).toBeUndefined();
	});

	it('keeps a 4,000-unit source without splitting a UTF-16 surrogate pair', () => {
		const content = `${'字'.repeat(4_020)}😀钟声又响了一次。`;
		const value = plan(content);
		expect(value.source.length).toBeLessThanOrEqual(4_000);
		const firstCodeUnit = value.source.charCodeAt(0);
		expect(firstCodeUnit >= 0xDC00 && firstCodeUnit <= 0xDFFF).toBe(false);
	});

	it('builds the existing grounded continuation contract with no trailing text', () => {
		const content = `${source}\n不应发送`;
		const value = planInlinePlotExpansion({
			projectId: 'project',
			resourceId: 'chapter:one',
			content,
			cursorOffset: source.length,
			selectionActive: false
		})!;
		const messages = buildInlinePlotExpansionMessages(value);
		const payload = JSON.parse(messages[1].content) as {
			readonly context: readonly { readonly priority: string; readonly content: string }[];
		};
		expect(messages[0].content).toContain('continuation assistant');
		expect(payload.context).toHaveLength(2);
		expect(payload.context.find(item => item.priority === 'P1')?.content).toBe(source);
		expect(messages[1].content).not.toContain('不应发送');
		expect(messages[1].content).not.toMatch(/projectRoot|apiKey|credential/iu);
	});

	it('formats a current ghost-text insertion and caches only its exact document', () => {
		const value = plan();
		const suggestion = createInlinePlotExpansionSuggestion(value, {
			title: '追随钟声',
			content: '林墨抬起头，循着钟声走向站台尽头。',
			rationale: '延续时钟线索并推进人物行动。'
		});
		expect(suggestion.insertion).toBe('\n\n林墨抬起头，循着钟声走向站台尽头。');
		expect(isInlinePlotExpansionSuggestionCurrent(suggestion, {
			projectId: 'project',
			resourceId: 'chapter:one',
			content: source,
			cursorOffset: source.length
		})).toBe(true);
		expect(isInlinePlotExpansionSuggestionCurrent(suggestion, {
			projectId: 'project',
			resourceId: 'chapter:one',
			content: `${source}变更`,
			cursorOffset: source.length
		})).toBe(false);
		const cache = new InlinePlotExpansionCache();
		cache.set(value, suggestion);
		expect(cache.get(value)).toEqual(suggestion);
		expect(cache.get({ ...value, documentContent: `${source}变更` })).toBeUndefined();
	});

	it('runs one thinking-disabled 512-token continuation request', async () => {
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => {
			listener({ type: 'job_started', jobId: request.jobId });
			listener({
				type: 'content_delta',
				jobId: request.jobId,
				text: JSON.stringify({
					candidates: [{
						title: '追随钟声',
						content: '林墨抬起头，循着钟声走向站台尽头。',
						rationale: '延续时钟线索并推进人物行动。'
					}]
				})
			});
			listener({ type: 'completed', jobId: request.jobId });
			return Promise.resolve();
		});
		const runner = new InlinePlotExpansionRunner({
			startAiGeneration,
			cancelAiJob: vi.fn(() => Promise.resolve(true))
		});
		const suggestion = await runner.run({
			plan: plan(),
			preferences: DEFAULT_AI_PREFERENCES
		});
		const request = startAiGeneration.mock.calls[0]?.[0];
		expect(request?.jobType).toBe('manuscript-continuation');
		expect(request?.options).toMatchObject({
			thinkingMode: 'disabled',
			maxOutputTokens: 512,
			responseFormat: 'json_object'
		});
		expect(suggestion?.insertion).toContain('循着钟声');
	});

	it('settles and cancels a stale in-flight preview', async () => {
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const runner = new InlinePlotExpansionRunner({
			startAiGeneration: vi.fn(() => new Promise<void>(() => undefined)),
			cancelAiJob
		});
		const pending = runner.run({
			plan: plan(),
			preferences: DEFAULT_AI_PREFERENCES
		});
		await Promise.resolve();
		await runner.cancel();
		await expect(pending).resolves.toBeUndefined();
		expect(cancelAiJob).toHaveBeenCalledOnce();
	});
});
