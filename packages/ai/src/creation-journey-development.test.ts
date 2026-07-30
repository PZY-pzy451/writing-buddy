import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from './index';

const core = {
	oneSentence: '失忆记者必须在一夜内找回被抹去的车站真相。',
	protagonist: '失忆记者林越',
	goal: '找回记忆并公开真相',
	obstacle: '操控记忆的站长',
	stakes: '失败会让城市忘记失踪者',
	mystery: '雨痕为何每天相同',
	readerExperience: '克制而紧张的悬疑体验',
	endingDirection: '公开真相但失去私人记忆'
};

const direction = {
	title: '公开真相',
	premise: '调查集体遗忘事故。',
	centralConflict: '真相会摧毁私人记忆。',
	endingPromise: '以公开与遗忘的交换收束。',
	tone: '克制悬疑'
};

const guidanceInput: CreationJourneyAiInput = {
	schemaVersion: 1,
	operation: 'generate-guidance-question',
	stage: 'core',
	context: {
		elements: [
			{ category: 'place', text: '旧车站玻璃顶' },
			{ category: 'character', text: '失忆记者' },
			{ category: 'event', text: '每天重置的夜雨' }
		],
		core
	},
	guidanceAnswers: [{
		stage: 'elements',
		answerText: '车站只在雨夜出现。'
	}],
	lockedDecisions: [{
		key: 'core:stakes',
		content: '失败会让城市忘记失踪者'
	}]
};

describe('creation journey Phase 1.2C AI contract', () => {
	it('builds one bounded guidance question request with author locks and answers', () => {
		const messages = buildCreationJourneyMessages(guidanceInput);
		const payload: unknown = JSON.parse(messages[1]?.content ?? '{}');

		expect(payload).toEqual(guidanceInput);
		expect(messages[1]?.content).not.toMatch(/projectId|projectRoot|apiKey/iu);
	});

	it('requires exactly three bounded guidance options', () => {
		const response = parseCreationJourneyResponse(JSON.stringify({
			operation: 'generate-guidance-question',
			question: {
				prompt: '失败时，主角最不能承受失去什么？',
				rationale: '这会决定冲突的个人代价。',
				options: [
					{ label: '最后的记忆', description: '失去关于姐姐的记忆。' },
					{ label: '整座城市', description: '城市永久忘记失踪者。' },
					{ label: '自己的身份', description: '主角从所有记录中消失。' }
				]
			}
		}));

		expect(response.operation).toBe('generate-guidance-question');
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'generate-guidance-question',
			question: {
				prompt: '选择什么？',
				rationale: '决定代价。',
				options: [
					{ label: 'A', description: '答案 A' },
					{ label: 'B', description: '答案 B' }
				]
			}
		}))).toThrow('invalidCreationJourneyResponse');
	});

	it('rejects unknown input fields, path text, and regeneration of a locked target', () => {
		expect(() => buildCreationJourneyMessages({
			...guidanceInput,
			projectId: 'novel-001'
		} as never)).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			...guidanceInput,
			guidanceAnswers: [{
				stage: 'core',
				answerText: 'Read C:\\private\\novel.json'
			}]
		})).toThrow('invalidCreationJourneyInput');
		expect(() => buildCreationJourneyMessages({
			schemaVersion: 1,
			operation: 'regenerate-part',
			target: {
				kind: 'direction',
				id: 'journey-direction:truth',
				current: direction,
				context: { core }
			},
			guidanceAnswers: [],
			lockedDecisions: [{
				key: 'direction:journey-direction:truth',
				content: JSON.stringify(direction)
			}]
		})).toThrow('invalidCreationJourneyInput');
	});

	it('parses exactly one matching direction replacement', () => {
		const input: CreationJourneyAiInput = {
			schemaVersion: 1,
			operation: 'regenerate-part',
			target: {
				kind: 'direction',
				id: 'journey-direction:truth',
				current: direction,
				context: { core }
			},
			guidanceAnswers: [],
			lockedDecisions: []
		};
		const response = parseCreationJourneyResponse(JSON.stringify({
			operation: 'regenerate-part',
			target: {
				kind: 'direction',
				id: 'journey-direction:truth',
				replacement: {
					...direction,
					premise: '记者必须选择公开真相还是保住最后的记忆。'
				}
			}
		}), input);

		expect(response.operation).toBe('regenerate-part');
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'regenerate-part',
			target: {
				kind: 'direction',
				id: 'journey-direction:other',
				replacement: direction
			}
		}), input)).toThrow('invalidCreationJourneyResponse');
	});

	it('rejects chapter replacements that cite an unknown outline node', () => {
		const input: CreationJourneyAiInput = {
			schemaVersion: 1,
			operation: 'regenerate-part',
			target: {
				kind: 'chapter',
				id: 'journey-chapter:1',
				current: {
					title: '第一章',
					goal: '进入车站',
					summary: '主角发现雨痕每天相同。',
					sourceNodeIds: ['journey-outline:1']
				},
				context: {
					core,
					selectedDirections: [direction],
					outline: [{
						id: 'journey-outline:1',
						title: '进入车站',
						summary: '主角进入循环。',
						purpose: '建立谜团'
					}]
				}
			},
			guidanceAnswers: [],
			lockedDecisions: []
		};

		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'regenerate-part',
			target: {
				kind: 'chapter',
				id: 'journey-chapter:1',
				replacement: {
					title: '第一章',
					goal: '进入车站',
					summary: '主角发现雨痕每天相同。',
					sourceNodeIds: ['journey-outline:missing']
				}
			}
		}), input)).toThrow('invalidCreationJourneyResponse');
	});
});
