import { describe, expect, it } from 'vitest';
import {
	buildCreationJourneyMessages,
	parseCreationJourneyResponse,
	type CreationJourneyAiInput
} from './index';

type VolumeInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'expand-to-volumes' }
>;

const volumeInput: VolumeInput = {
	schemaVersion: 1,
	operation: 'expand-to-volumes',
	expectedCount: 2,
	story: {
		genre: '都市悬疑',
		premise: '记者调查会重置记忆的旧车站。',
		centralConflict: '公开真相会抹去她最后的家庭记忆。'
	},
	storyBeats: Array.from({ length: 5 }, (_, index) => ({
		id: `journey-outline:beat-${index + 1}`,
		title: `节点 ${index + 1}`,
		summary: `推进 ${index + 1}`,
		purpose: `作用 ${index + 1}`
	})),
	lockedDecisions: []
};

describe('outline hierarchy AI contracts', () => {
	it('builds a privacy-bounded volume request and parses strict candidates', () => {
		const messages = buildCreationJourneyMessages(volumeInput);
		expect(messages[1]?.content).toContain('"operation":"expand-to-volumes"');
		expect(messages[1]?.content).not.toMatch(/projectId|projectRoot|apiKey|absolutePath/u);

		const response = parseCreationJourneyResponse(JSON.stringify({
			operation: 'expand-to-volumes',
			volumes: Array.from({ length: 2 }, (_, index) => ({
				title: `第 ${index + 1} 卷`,
				summary: `卷概要 ${index + 1}`,
				goal: `卷目标 ${index + 1}`,
				conflict: `卷冲突 ${index + 1}`,
				outcome: `卷结果 ${index + 1}`,
				hook: `卷钩子 ${index + 1}`,
				sourceNodeIds: [`journey-outline:beat-${index + 1}`]
			}))
		}), volumeInput);
		expect(response.operation).toBe('expand-to-volumes');
	});

	it('requires the requested parent and exact bounded count for chapters', () => {
		const input: CreationJourneyAiInput = {
			schemaVersion: 1,
			operation: 'expand-volume-to-chapters',
			expectedCount: 2,
			volume: {
				id: 'journey-outline:volume-1',
				title: '第一卷',
				summary: '记者进入旧站。',
				goal: '发现谜团',
				conflict: '记忆消退',
				outcome: '确认列车存在',
				hook: '站长认出记者'
			},
			story: volumeInput.story,
			lockedDecisions: []
		};
		expect(() => parseCreationJourneyResponse(JSON.stringify({
			operation: 'expand-volume-to-chapters',
			parentId: 'journey-outline:volume-other',
			chapters: []
		}), input)).toThrow('invalidCreationJourneyResponse');
	});

	it('validates scene-specific fields and rejects absolute paths', () => {
		const input: CreationJourneyAiInput = {
			schemaVersion: 1,
			operation: 'expand-chapter-to-scenes',
			expectedCount: 2,
			chapter: {
				id: 'journey-outline:chapter-1',
				title: '夜雨名单',
				summary: '记者取得名单。',
				goal: '拍下名单',
				conflict: '站长阻止',
				outcome: '发现自己的名字',
				hook: '列车亮灯',
				povHint: '记者'
			},
			story: volumeInput.story,
			lockedDecisions: []
		};
		const parsed = parseCreationJourneyResponse(JSON.stringify({
			operation: 'expand-chapter-to-scenes',
			parentId: input.chapter.id,
			scenes: Array.from({ length: 2 }, (_, index) => ({
				title: `场景 ${index + 1}`,
				summary: `场景概要 ${index + 1}`,
				goal: `场景目标 ${index + 1}`,
				obstacle: `场景阻碍 ${index + 1}`,
				change: `场景变化 ${index + 1}`,
				hook: `结尾钩子 ${index + 1}`,
				povHint: '记者',
				locationHint: '旧车站',
				characterHints: ['记者', '站长']
			}))
		}), input);
		expect(parsed.operation).toBe('expand-chapter-to-scenes');

		expect(() => buildCreationJourneyMessages({
			...input,
			chapter: { ...input.chapter, summary: '读取 C:\\private\\draft.md' }
		})).toThrow('invalidCreationJourneyInput');
	});
});
