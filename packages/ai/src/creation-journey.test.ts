import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	CREATION_JOURNEY_SYSTEM_PROMPT,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from './index';

const core = {
	oneSentence: '失忆记者必须在一夜内找回被抹去的车站事故真相。',
	protagonist: '失忆记者林越',
	goal: '找回事发当夜的记忆并公开真相',
	obstacle: '操控记忆的站长与不断重置的夜晚',
	stakes: '失败会让整座城市忘记失踪者',
	mystery: '玻璃顶上的雨痕为什么每天完全相同',
	readerExperience: '悬疑、压迫，又保留人物选择的温度',
	endingDirection: '林越公开真相，但失去关于姐姐的最后记忆'
};

const direction = {
	title: '公开真相',
	premise: '调查一场被集体遗忘的事故。',
	centralConflict: '真相会摧毁主角仅存的私人记忆。',
	endingPromise: '以公开与遗忘的交换收束。',
	tone: '克制悬疑'
};

describe('creation journey AI contract', () => {
	it('builds one bounded author-triggered operation without project metadata', () => {
		const input: CreationJourneyAiInput = {
			schemaVersion: 1,
			operation: 'organize-core',
			elements: [
				{ category: 'place', text: '旧车站玻璃顶' },
				{ category: 'character', text: '失忆记者' },
				{ category: 'event', text: '每天重置的夜雨' }
			]
		};
		const messages = buildCreationJourneyMessages(input);

		expect(messages[0]?.content).toBe(CREATION_JOURNEY_SYSTEM_PROMPT);
		expect(JSON.parse(messages[1]?.content ?? '{}')).toEqual(input);
		expect(messages[1]?.content).not.toMatch(/projectId|projectRoot|apiKey/iu);
	});

	it('rejects unknown input fields, incomplete idea sets, and oversized author text', () => {
		expect(() => buildCreationJourneyMessages({
			schemaVersion: 1,
			operation: 'organize-core',
			elements: [
				{ category: 'place', text: '旧车站' },
				{ category: 'event', text: '夜雨' }
			]
		} as never)).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			schemaVersion: 1,
			operation: 'generate-directions',
			core,
			projectRoot: 'D:/Novel'
		} as never)).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			schemaVersion: 1,
			operation: 'organize-core',
			elements: [
				{ category: 'place', text: '旧'.repeat(501) },
				{ category: 'event', text: '夜雨' },
				{ category: 'character', text: '记者' }
			]
		} as never)).toThrow('invalidCreationJourneyInput');
	});

	it('strictly parses exactly three directions', () => {
		const response = parseCreationJourneyResponse(JSON.stringify({
			operation: 'generate-directions',
			directions: [
				direction,
				{ ...direction, title: '打破循环' },
				{ ...direction, title: '寻找姐姐' }
			]
		}));

		expect(response.operation).toBe('generate-directions');
		if (response.operation === 'generate-directions') {
			expect(response.directions).toHaveLength(3);
		}
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'generate-directions',
			directions: [direction, { ...direction, title: '打破循环' }]
		}))).toThrow('invalidCreationJourneyResponse');
	});

	it('strictly parses 5–8 outline nodes and exactly three chapter proposals', () => {
		const nodes = Array.from({ length: 5 }, (_, index) => ({
			title: `节点 ${index + 1}`,
			summary: `推进 ${index + 1}`,
			purpose: '推动调查'
		}));
		expect(parseCreationJourneyResponse(JSON.stringify({
			operation: 'generate-outline',
			nodes
		})).operation).toBe('generate-outline');
		expect(parseCreationJourneyResponse(JSON.stringify({
			operation: 'split-chapters',
			chapters: Array.from({ length: 3 }, (_, index) => ({
				title: `第 ${index + 1} 章`,
				goal: '形成一个明确选择',
				summary: '推动主角靠近真相',
				sourceNodeIndexes: [index]
			}))
		})).operation).toBe('split-chapters');
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'split-chapters',
			chapters: [{
				title: '第一章',
				goal: '开场',
				summary: '进入车站',
				sourceNodeIndexes: [0]
			}]
		}))).toThrow('invalidCreationJourneyResponse');
	});

	it('rejects prose-wrapped JSON and extra response fields', () => {
		expect(() => parseCreationJourneyResponse(`候选如下：${JSON.stringify({
			operation: 'organize-core',
			core
		})}`)).toThrow('invalidCreationJourneyResponse');
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'organize-core',
			core,
			saved: true
		}))).toThrow('invalidCreationJourneyResponse');
	});
});
