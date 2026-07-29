import {
	DEFAULT_AI_PREFERENCES,
	type AiGenerateRequest,
	type AiStreamEvent
} from '@writing-buddy/ai';
import type { ReviewIssue } from '@writing-buddy/review';
import { describe, expect, it, vi } from 'vitest';
import {
	InlineLanguageCheckCache,
	InlineLanguageCheckRunner,
	planInlineLanguageCheckSlice,
	rebaseInlineLanguageIssues,
	replaceInlineLanguageIssuesInSlice
} from './InlineLanguageCheckService';

describe('inline language check slices', () => {
	it('checks only the changed paragraph and preserves JavaScript UTF-16 offsets', () => {
		const previousContent = '第一段没有变化。\nHe typed something in the rain.\n第三段没有变化。';
		const content = '第一段没有变化。\nHe typed somthing in the rain.\n第三段没有变化。';
		const slice = planInlineLanguageCheckSlice({ previousContent, content });
		expect(slice).toMatchObject({
			start: content.indexOf('He typed'),
			content: 'He typed somthing in the rain.'
		});
		expect(slice?.end).toBe(slice!.start + slice!.content.length);
	});

	it('uses the cursor paragraph for explicit checks and bounds long slices', () => {
		const content = `开头。\n${'很长的句子。'.repeat(700)}\n结尾。`;
		const cursorOffset = content.indexOf('很长') + 2_700;
		const slice = planInlineLanguageCheckSlice({
			content,
			cursorOffset,
			force: true
		});
		expect(slice).toBeDefined();
		expect(slice!.content.length).toBeLessThanOrEqual(2_400);
		expect(slice!.start).toBeLessThanOrEqual(cursorOffset);
		expect(slice!.end).toBeGreaterThan(cursorOffset);
	});

	it('does not split a surrogate pair at a bounded edge', () => {
		const content = `${'字'.repeat(2_399)}😀尾`;
		const slice = planInlineLanguageCheckSlice({
			content,
			cursorOffset: 0,
			force: true
		});
		expect(slice).toBeDefined();
		expect(slice!.content.endsWith('\uD83D')).toBe(false);
		expect(slice!.content.length).toBeLessThanOrEqual(2_400);
	});

	it('rebases verified relative issues and replaces only the checked slice', () => {
		const content = '开头。\nHe typed somthing.\n结尾。';
		const slice = planInlineLanguageCheckSlice({
			content,
			cursorOffset: content.indexOf('somthing'),
			force: true
		})!;
		const relativeStart = slice.content.indexOf('somthing');
		const issue = {
			id: 'relative',
			projectId: 'project',
			resourceId: 'chapter',
			ruleId: 'ai-inline-language-check',
			severity: 'warning',
			status: 'open',
			title: '英文拼写错误',
			message: '拼写错误。',
			anchor: {
				start: relativeStart,
				end: relativeStart + 8,
				before: '',
				target: 'somthing',
				after: '',
				sourceHash: ''
			},
			replacement: 'something',
			createdAt: '2026-07-29T00:00:00.000Z',
			updatedAt: '2026-07-29T00:00:00.000Z',
			origin: 'ai'
		} satisfies ReviewIssue;
		const rebased = rebaseInlineLanguageIssues({
			issues: [issue],
			slice,
			content,
			projectId: 'project',
			resourceId: 'chapter'
		});
		expect(rebased[0]?.anchor).toMatchObject({
			start: content.indexOf('somthing'),
			target: 'somthing'
		});
		expect(replaceInlineLanguageIssuesInSlice({
			current: [],
			replacement: rebased,
			slice,
			content
		})).toEqual(rebased);
	});

	it('caches only an exact matching slice body', () => {
		const cache = new InlineLanguageCheckCache();
		const slice = planInlineLanguageCheckSlice({
			content: 'He typed somthing.',
			cursorOffset: 10,
			force: true
		})!;
		cache.set(slice, []);
		expect(cache.get(slice)).toEqual([]);
		expect(cache.get({ ...slice, content: 'He typed something.' })).toBeUndefined();
	});

	it('runs the dedicated bounded job and parses verified results', async () => {
		const startAiGeneration = vi.fn((
			request: AiGenerateRequest,
			listener: (event: AiStreamEvent) => void
		) => {
			listener({ type: 'job_started', jobId: request.jobId });
			listener({
				type: 'content_delta',
				jobId: request.jobId,
				text: JSON.stringify({
					issues: [{
						start: 9,
						end: 17,
						target: 'somthing',
						severity: 'warning',
						title: '英文拼写错误',
						message: '拼写错误。',
						replacement: 'something'
					}]
				})
			});
			listener({ type: 'completed', jobId: request.jobId });
			return Promise.resolve();
		});
		const runner = new InlineLanguageCheckRunner({
			startAiGeneration,
			cancelAiJob: vi.fn(() => Promise.resolve(true))
		});
		const slice = planInlineLanguageCheckSlice({
			content: 'He typed somthing.',
			cursorOffset: 12,
			force: true
		})!;
		const issues = await runner.run({
			projectId: 'project',
			resourceId: 'chapter',
			slice,
			preferences: DEFAULT_AI_PREFERENCES
		});
		const request = startAiGeneration.mock.calls[0]?.[0];
		expect(request?.jobType).toBe('inline-language-check');
		expect(request?.options).toMatchObject({
			thinkingMode: 'disabled',
			maxOutputTokens: 1024
		});
		expect(issues?.[0]).toMatchObject({
			ruleId: 'ai-inline-language-check',
			anchor: { target: 'somthing' },
			replacement: 'something'
		});
	});

	it('settles and cancels an in-flight slice without accepting stale output', async () => {
		const cancelAiJob = vi.fn(() => Promise.resolve(true));
		const runner = new InlineLanguageCheckRunner({
			startAiGeneration: vi.fn(() => new Promise<void>(() => undefined)),
			cancelAiJob
		});
		const slice = planInlineLanguageCheckSlice({
			content: 'He typed somthing.',
			cursorOffset: 12,
			force: true
		})!;
		const pending = runner.run({
			projectId: 'project',
			resourceId: 'chapter',
			slice,
			preferences: DEFAULT_AI_PREFERENCES
		});
		await Promise.resolve();
		await runner.cancel();
		await expect(pending).resolves.toBeUndefined();
		expect(cancelAiJob).toHaveBeenCalledTimes(1);
	});
});
