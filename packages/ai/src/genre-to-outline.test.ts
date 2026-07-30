import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from './index';

const input: CreationJourneyAiInput = {
	schemaVersion: 1,
	operation: 'generate-from-genre',
	genre: '都市悬疑 + 科幻',
	premise: '能看见死亡日期的记者遇见了一个没有日期的人。',
	scale: 'novel',
	tones: ['克制', '压迫'],
	protagonistHints: ['调查记者'],
	requiredElements: ['旧车站'],
	excludedElements: ['穿越'],
	endingPreference: 'bittersweet',
	audience: '成年悬疑读者',
	structureTemplateId: 'three-act'
};

function validResponse(): string {
	return JSON.stringify({
		operation: 'generate-from-genre',
		outline: {
			title: '无日期的人',
			genre: '都市悬疑 + 科幻',
			premise: '能看见死亡日期的记者遇见了一个没有日期的人。',
			themePromise: '知道命运是否仍然意味着拥有选择',
			protagonistGoal: '查明无日期者与旧车站事故的关系',
			centralConflict: '每一次调查都会提前身边人的死亡日期',
			stakes: '整座城市会被写入同一份死亡名单',
			mysteryQuestion: '谁在为城市标注死亡日期',
			endingDirection: '记者毁掉名单，也失去预知能力',
			structureTemplateId: 'three-act'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节拍 ${index + 1}`,
			summary: `第 ${index + 1} 次推进调查并产生不可逆变化。`,
			goal: '取得新的调查线索',
			conflict: '线索会让一名相关者陷入危险',
			outcome: '主角得到答案但付出代价',
			hook: '名单上出现新的异常',
			povHint: '调查记者'
		})),
		suggestedCharacters: [{
			title: '无日期者',
			summary: '唯一没有死亡日期的人。',
			role: 'deuteragonist'
		}],
		suggestedWorldRules: [{
			title: '死亡日期可见规则',
			summary: '只有主角能够看见，日期会因主动选择改变。',
			category: 'other'
		}],
		warnings: [{
			code: 'mystery-density',
			message: '中段需要避免连续揭示造成悬念透支。',
			nodeIndexes: [2, 3]
		}]
	});
}

describe('genre-to-outline AI contract', () => {
	it('sends only the bounded author brief and no project identity, path, or secret', () => {
		const messages = buildCreationJourneyMessages(input);
		const payload = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;

		expect(payload).toEqual(input);
		expect(JSON.stringify(payload)).not.toMatch(
			/projectId|projectRoot|apiKey|credential|password|absolutePath/iu
		);
		expect(messages[0]?.content).toContain('generate-from-genre');
	});

	it('accepts one strict outline root and five to eight structured story beats', () => {
		const response = parseCreationJourneyResponse(validResponse(), input);

		expect(response.operation).toBe('generate-from-genre');
		if (response.operation !== 'generate-from-genre') return;
		expect(response.storyBeats).toHaveLength(5);
		expect(response.storyBeats[0]).toMatchObject({
			title: '故事节拍 1',
			goal: '取得新的调查线索',
			conflict: '线索会让一名相关者陷入危险'
		});
	});

	it('rejects Markdown, unknown fields, invalid counts, and unsafe input fields', () => {
		expect(() => parseCreationJourneyResponse(
			`大纲如下：\n${validResponse()}`,
			input
		)).toThrow('invalidCreationJourneyResponse');

		const unknown = JSON.parse(validResponse()) as Record<string, unknown>;
		unknown.markdown = '# 大纲';
		expect(() => parseCreationJourneyResponse(JSON.stringify(unknown), input))
			.toThrow('invalidCreationJourneyResponse');

		const tooShort = JSON.parse(validResponse()) as {
			storyBeats: unknown[];
		};
		tooShort.storyBeats = tooShort.storyBeats.slice(0, 4);
		expect(() => parseCreationJourneyResponse(JSON.stringify(tooShort), input))
			.toThrow('invalidCreationJourneyResponse');

		expect(() => buildCreationJourneyMessages({
			...input,
			projectId: 'project-secret'
		} as CreationJourneyAiInput)).toThrow('invalidCreationJourneyInput');
	});
});

