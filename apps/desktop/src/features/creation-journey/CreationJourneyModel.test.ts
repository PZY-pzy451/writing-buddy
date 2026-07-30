import { describe, expect, it } from 'vitest';
import {
	advanceCreationJourney,
	confirmStoryCore,
	createCreationJourneyState,
	parseCreationJourneyState,
	selectStoryDirections,
	serializeCreationJourneyState,
	updateStoryCore,
	type CreationJourneyState
} from './CreationJourneyModel';

const now = () => '2026-07-30T01:02:03.000Z';

function completeCore(): CreationJourneyState['core'] {
	return {
		oneSentence: '失忆记者必须在一夜内找回被抹去的车站事故真相。',
		protagonist: '失忆记者林越',
		goal: '找回事发当夜的记忆并公开真相',
		obstacle: '操控记忆的站长与不断重置的夜晚',
		stakes: '失败会让整座城市忘记失踪者',
		mystery: '玻璃顶上的雨痕为什么每天完全相同',
		readerExperience: '悬疑、压迫，又保留人物选择的温度',
		endingDirection: '林越公开真相，但必须放弃关于姐姐的最后记忆'
	};
}

function validState(): CreationJourneyState {
	const initial = createCreationJourneyState('novel-001', {
		id: (() => {
			let index = 0;
			return () => `journey-element:${++index}`;
		})(),
		now
	});
	return {
		...initial,
		elements: initial.elements.map((element, index) => ({
			...element,
			text: ['旧车站玻璃顶', '失忆记者', '每天重置的夜雨'][index]
		})),
		core: completeCore(),
		directions: [
			{
				id: 'journey-direction:truth',
				title: '公开真相',
				premise: '调查一场被集体遗忘的事故。',
				centralConflict: '真相会摧毁主角仅存的私人记忆。',
				endingPromise: '以公开与遗忘的交换收束。',
				tone: '克制悬疑'
			},
			{
				id: 'journey-direction:loop',
				title: '打破循环',
				premise: '主角发现车站困在同一个雨夜。',
				centralConflict: '每次接近出口都会失去一段记忆。',
				endingPromise: '以主动留下守门结束循环。',
				tone: '高概念惊悚'
			},
			{
				id: 'journey-direction:family',
				title: '寻找姐姐',
				premise: '事故真相指向主角失踪的姐姐。',
				centralConflict: '姐姐可能正是循环的制造者。',
				endingPromise: '以姐妹之间的艰难选择收束。',
				tone: '情感悬疑'
			}
		],
		selectedDirectionIds: ['journey-direction:truth'],
		outline: Array.from({ length: 5 }, (_, index) => ({
			id: `journey-outline:${index + 1}`,
			title: `节点 ${index + 1}`,
			summary: `第 ${index + 1} 个故事推进`,
			purpose: '推进调查'
		})),
		chapters: Array.from({ length: 3 }, (_, index) => ({
			id: `journey-chapter:${index + 1}`,
			title: `第 ${index + 1} 章`,
			goal: '推进主角调查',
			summary: '形成一次可见的选择',
			sourceNodeIds: [`journey-outline:${index + 1}`]
		}))
	};
}

describe('CreationJourneyModel', () => {
	it('creates three editable idea slots and strictly bounds element count', () => {
		const state = createCreationJourneyState('novel-001', { now });

		expect(state.elements).toHaveLength(3);
		expect(state.stage).toBe('elements');
		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			elements: state.elements.slice(0, 2)
		}))).toThrow('creationJourneyStateInvalid');
		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			elements: [...state.elements, ...state.elements, ...state.elements]
		}))).toThrow('creationJourneyStateInvalid');
	});

	it('accepts only zero or exactly three directions and chapter proposals', () => {
		const state = validState();

		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			directions: state.directions.slice(0, 2)
		}))).toThrow('creationJourneyStateInvalid');
		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			chapters: state.chapters.slice(0, 2)
		}))).toThrow('creationJourneyStateInvalid');
		expect(parseCreationJourneyState(serializeCreationJourneyState(state)).chapters).toHaveLength(3);
	});

	it('marks every existing downstream draft stale without deleting author work', () => {
		const state = {
			...validState(),
			core: {
				...completeCore(),
				confirmedAt: '2026-07-30T01:00:00.000Z'
			}
		};
		const next = updateStoryCore(state, { stakes: '失败会让姐姐永远不存在' }, now);

		expect(next.core.stakes).toBe('失败会让姐姐永远不存在');
		expect(next.core.confirmedAt).toBeUndefined();
		expect(next.directions).toEqual(state.directions);
		expect(next.outline).toEqual(state.outline);
		expect(next.chapters).toEqual(state.chapters);
		expect(next.stale).toEqual({
			directions: true,
			outline: true,
			chapters: true
		});
	});

	it('allows one direction or a two-direction merge but rejects every other count', () => {
		const state = validState();

		expect(selectStoryDirections(state, ['journey-direction:truth'], now).selectedDirectionIds)
			.toEqual(['journey-direction:truth']);
		expect(selectStoryDirections(state, [
			'journey-direction:truth',
			'journey-direction:family'
		], now).selectedDirectionIds).toHaveLength(2);
		expect(() => selectStoryDirections(state, [], now)).toThrow('creationJourneyDirectionSelectionInvalid');
		expect(() => selectStoryDirections(state, state.directions.map(direction => direction.id), now))
			.toThrow('creationJourneyDirectionSelectionInvalid');
	});

	it('requires explicit author confirmation before directions can begin', () => {
		const state = {
			...validState(),
			directions: [],
			selectedDirectionIds: [],
			outline: [],
			chapters: []
		};

		expect(() => advanceCreationJourney(state, 'directions', now))
			.toThrow('creationJourneyCoreConfirmationRequired');
		const confirmed = confirmStoryCore(state, now);
		expect(advanceCreationJourney(confirmed, 'directions', now).stage).toBe('directions');
	});

	it('round-trips author text and versioned state without loss', () => {
		const state = validState();
		const parsed = parseCreationJourneyState(serializeCreationJourneyState(state));

		expect(parsed).toEqual(state);
		expect(parsed.core.oneSentence).toContain('一夜内');
		expect(parsed.outline.map(node => node.title)).toEqual([
			'节点 1',
			'节点 2',
			'节点 3',
			'节点 4',
			'节点 5'
		]);
	});
});
