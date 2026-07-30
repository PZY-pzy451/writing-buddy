import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from './index';

function input(): Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'check-outline-semantics' }
> {
	return {
		schemaVersion: 1,
		operation: 'check-outline-semantics',
		story: {
			genre: '都市悬疑',
			premise: '记者追查雨夜旧站。',
			protagonistGoal: '找到失踪的妹妹',
			stakes: '失败会永远失去妹妹',
			endingDirection: '记者在真相与记忆之间作出选择'
		},
		nodes: [
			{
				id: 'journey-outline:chapter-one',
				type: 'chapter',
				parentId: 'journey-outline:volume-one',
				order: 0,
				title: '第一章 雨夜来客',
				summary: '记者进入旧站，主动追踪失踪者名单。',
				goal: '拿到名单',
				conflict: '每读一个名字就会失去一段记忆',
				outcome: '记者发现自己的名字也在名单中',
				hook: '名单末尾写着明天的日期',
				characterIds: ['character:reporter'],
				plotThreadIds: ['plot-thread:missing-sister'],
				foreshadowingIds: ['foreshadowing:tomorrow-date']
			},
			{
				id: 'journey-outline:chapter-two',
				type: 'chapter',
				parentId: 'journey-outline:volume-one',
				order: 1,
				title: '第二章 名单回声',
				summary: '记者再次进入旧站，继续读取名单。',
				goal: '查清名单来源',
				conflict: '站长拒绝回答',
				outcome: '记者得到另一份名单',
				hook: '名单末尾仍是明天的日期',
				characterIds: ['character:reporter'],
				plotThreadIds: ['plot-thread:missing-sister'],
				foreshadowingIds: ['foreshadowing:tomorrow-date']
			}
		]
	};
}

function validResponse(): string {
	return JSON.stringify({
		operation: 'check-outline-semantics',
		issues: [{
			code: 'repetitive-consecutive-chapters',
			severity: 'warning',
			title: '连续章节动作重复',
			message: '两章都以进入旧站并读取名单为主要推进。',
			nodeIds: ['journey-outline:chapter-one', 'journey-outline:chapter-two'],
			evidence: [
				{
					nodeId: 'journey-outline:chapter-one',
					field: 'summary',
					quote: '进入旧站'
				},
				{
					nodeId: 'journey-outline:chapter-two',
					field: 'summary',
					quote: '再次进入旧站'
				}
			],
			impact: '中段节奏会显得停滞。',
			suggestedAction: '让第二章由人物选择引发新的方向变化。'
		}]
	});
}

interface MutableSemanticResponse {
	issues: Array<{
		nodeIds: string[];
		evidence: Array<{ quote: string }>;
		replacement?: { summary: string };
	}>;
}

describe('outline semantic check contract', () => {
	it('builds a bounded creation-journey request without project or credential data', () => {
		const messages = buildCreationJourneyMessages(input());
		expect(messages).toHaveLength(2);
		expect(messages[1].content).toContain('check-outline-semantics');
		expect(messages[1].content).not.toMatch(/projectId|projectRoot|apiKey|credential|password/iu);
	});

	it('accepts evidence-backed, read-only semantic issues', () => {
		expect(parseCreationJourneyResponse(validResponse(), input())).toEqual({
			operation: 'check-outline-semantics',
			issues: [expect.objectContaining({
				code: 'repetitive-consecutive-chapters',
				nodeIds: ['journey-outline:chapter-one', 'journey-outline:chapter-two']
			})]
		});
	});

	it('rejects unknown nodes, forged evidence, and mutation-shaped responses', () => {
		const unknown = JSON.parse(validResponse()) as MutableSemanticResponse;
		unknown.issues[0].nodeIds = ['journey-outline:unknown'];
		expect(() => parseCreationJourneyResponse(JSON.stringify(unknown), input()))
			.toThrow('invalidCreationJourneyResponse');

		const forged = JSON.parse(validResponse()) as MutableSemanticResponse;
		forged.issues[0].evidence[0].quote = '正文中并不存在的证据';
		expect(() => parseCreationJourneyResponse(JSON.stringify(forged), input()))
			.toThrow('invalidCreationJourneyResponse');

		const mutation = JSON.parse(validResponse()) as MutableSemanticResponse;
		mutation.issues[0].replacement = { summary: '自动改写' };
		expect(() => parseCreationJourneyResponse(JSON.stringify(mutation), input()))
			.toThrow('invalidCreationJourneyResponse');
	});

	it('rejects request fields outside the strict semantic-check schema', () => {
		expect(() => buildCreationJourneyMessages({
			...input(),
			projectId: 'must-not-leave-device'
		} as never)).toThrow('invalidCreationJourneyInput');
	});
});
