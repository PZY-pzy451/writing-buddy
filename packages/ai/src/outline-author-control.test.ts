import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput,
	type CreationJourneyAiResponse
} from './index';

type AlternativesResponse = Extract<
	CreationJourneyAiResponse,
	{ readonly operation: 'generate-outline-alternatives' }
>;

const input: Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-outline-alternatives' }
> = {
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
				premise: '记者调查会重置记忆的旧车站。',
				centralConflict: '真相会抹去私人记忆。'
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
	lockedDecisions: [{
		key: 'outline:journey-outline:node-4',
		content: '{"title":"锁定的结局节点"}'
	}]
};

function validResponse(): string {
	return JSON.stringify({
		operation: 'generate-outline-alternatives',
		targetId: input.target.id,
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

describe('outline author-control AI contract', () => {
	it('sends bounded outline context without project identity, paths, or secrets', () => {
		const messages = buildCreationJourneyMessages(input);
		const payload: unknown = JSON.parse(messages[1]?.content ?? '{}');
		expect(payload).toEqual(input);
		expect(messages[1]?.content).not.toMatch(
			/projectId|projectRoot|apiKey|credential|password|absolutePath/iu
		);
		expect(messages[0]?.content).toContain('三个实质不同');
	});

	it('requires exactly three distinct alternatives for the exact target', () => {
		const response = parseCreationJourneyResponse(validResponse(), input);
		expect(response.operation).toBe('generate-outline-alternatives');
		if (response.operation !== 'generate-outline-alternatives') return;
		expect(response.alternatives).toHaveLength(3);

		const wrongTarget = JSON.parse(validResponse()) as AlternativesResponse;
		wrongTarget.targetId = 'journey-outline:other';
		expect(() => parseCreationJourneyResponse(
			JSON.stringify(wrongTarget),
			input
		)).toThrow('invalidCreationJourneyResponse');

		const duplicate = JSON.parse(validResponse()) as AlternativesResponse;
		duplicate.alternatives[1].replacement = duplicate.alternatives[0].replacement;
		expect(() => parseCreationJourneyResponse(
			JSON.stringify(duplicate),
			input
		)).toThrow('invalidCreationJourneyResponse');
	});

	it('rejects a locked target, unknown fields, path content, and invalid repair markers', () => {
		expect(() => buildCreationJourneyMessages({
			...input,
			lockedDecisions: [{
				key: `outline:${input.target.id}`,
				content: 'locked'
			}]
		})).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			...input,
			projectId: 'secret'
		} as never)).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			...input,
			target: {
				...input.target,
				current: {
					...input.target.current,
					summary: '读取 C:\\private\\outline.json'
				}
			}
		})).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			...input,
			repairAttempt: 2
		} as never)).toThrow('invalidCreationJourneyInput');
	});
});
