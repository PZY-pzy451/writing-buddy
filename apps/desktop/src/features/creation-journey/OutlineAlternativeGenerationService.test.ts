import { describe, expect, it, vi } from 'vitest';
import type { CreationJourneyAiInput } from '@writing-buddy/ai';
import { OutlineAlternativeGenerationService } from './OutlineAlternativeGenerationService';

type Input = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-outline-alternatives' }
>;

const input: Input = {
	schemaVersion: 1,
	operation: 'generate-outline-alternatives',
	strategy: 'strengthen-conflict',
	target: {
		id: 'journey-outline:node-2',
		current: {
			title: '取得名单',
			summary: '记者拿到名单。',
			purpose: '推进调查',
			goal: '取得证据',
			conflict: '站长阻止记者',
			outcome: '记者带走名单',
			hook: '名单出现新名字',
			povHint: '记者'
		},
		context: {
			story: {
				genre: '都市悬疑',
				premise: '记者调查会重置记忆的旧车站。'
			},
			previous: {
				title: '进入旧站',
				summary: '记者进入车站。',
				purpose: '建立谜团'
			},
			next: {
				title: '失去记忆',
				summary: '记者付出代价。',
				purpose: '升级风险'
			}
		}
	},
	guidanceAnswers: [],
	lockedDecisions: []
};

function response(targetId = input.target.id): string {
	return JSON.stringify({
		operation: 'generate-outline-alternatives',
		targetId,
		alternatives: ['冲突升级', '人物选择', '节奏收紧'].map((label, index) => ({
			label,
			rationale: `候选依据 ${index + 1}`,
			replacement: {
				...input.target.current,
				summary: `不同的概要 ${index + 1}`,
				conflict: `不同的冲突 ${index + 1}`
			}
		}))
	});
}

describe('OutlineAlternativeGenerationService', () => {
	it('deduplicates same-tick generation and returns exactly three alternatives', async () => {
		let resolve!: (value: string) => void;
		const runner = vi.fn(() => new Promise<string>(done => {
			resolve = done;
		}));
		const service = new OutlineAlternativeGenerationService(runner);

		const first = service.generate(input);
		const second = service.generate(input);
		expect(first).toBe(second);
		expect(runner).toHaveBeenCalledTimes(1);
		resolve(response());
		await expect(first).resolves.toMatchObject({
			operation: 'generate-outline-alternatives',
			targetId: input.target.id
		});
	});

	it('performs one bounded structural repair and never a third request', async () => {
		const runner = vi.fn()
			.mockResolvedValueOnce('{"operation":"generate-outline-alternatives"}')
			.mockResolvedValueOnce(response());
		const service = new OutlineAlternativeGenerationService(runner);
		const result = await service.generate(input);
		expect(result.alternatives.some(candidate => candidate.label === '冲突升级')).toBe(true);
		expect(runner).toHaveBeenCalledTimes(2);
		expect(runner.mock.calls[1]?.[0]).toMatchObject({ repairAttempt: 1 });

		const broken = new OutlineAlternativeGenerationService(
			vi.fn().mockResolvedValue('{}')
		);
		await expect(broken.generate(input)).rejects.toThrow(
			'invalidCreationJourneyResponse'
		);
	});
});
