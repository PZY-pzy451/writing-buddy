import { describe, expect, it, vi } from 'vitest';
import type { CreationJourneyAiInput } from '@writing-buddy/ai';
import { OutlineHierarchyGenerationService } from './OutlineHierarchyGenerationService';

type Input = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'expand-volume-to-chapters' }
>;

const input: Input = {
	schemaVersion: 1,
	operation: 'expand-volume-to-chapters',
	expectedCount: 1,
	story: {
		genre: '都市悬疑',
		premise: '记者调查旧车站。'
	},
	volume: {
		id: 'journey-outline:volume-1',
		title: '第一卷',
		summary: '记者进入旧站。',
		goal: '建立谜团',
		conflict: '记忆消退',
		outcome: '确认列车存在',
		hook: '站长认出记者'
	},
	lockedDecisions: []
};

function validResponse(): string {
	return JSON.stringify({
		operation: 'expand-volume-to-chapters',
		parentId: input.volume.id,
		chapters: [{
			title: '第一章 夜雨名单',
			summary: '记者拿到名单。',
			goal: '取得证据',
			conflict: '站长阻止',
			outcome: '发现自己的名字',
			hook: '停运列车亮灯',
			povHint: '记者'
		}]
	});
}

describe('OutlineHierarchyGenerationService', () => {
	it('deduplicates an in-flight split and repairs malformed JSON at most once', async () => {
		const runner = vi.fn()
			.mockResolvedValueOnce('{"operation":"expand-volume-to-chapters"}')
			.mockResolvedValueOnce(validResponse());
		const service = new OutlineHierarchyGenerationService(runner);
		const first = service.generate(input);
		const second = service.generate(input);

		expect(first).toBe(second);
		await expect(first).resolves.toMatchObject({
			operation: 'expand-volume-to-chapters',
			parentId: input.volume.id
		});
		expect(runner).toHaveBeenCalledTimes(2);
		expect(runner.mock.calls[1]?.[0]).toMatchObject({ repairAttempt: 1 });
	});

	it('does not start a third request after a failed repair', async () => {
		const runner = vi.fn().mockResolvedValue('{}');
		const service = new OutlineHierarchyGenerationService(runner);
		await expect(service.generate(input)).rejects.toThrow('invalidCreationJourneyResponse');
		expect(runner).toHaveBeenCalledTimes(2);
	});
});
