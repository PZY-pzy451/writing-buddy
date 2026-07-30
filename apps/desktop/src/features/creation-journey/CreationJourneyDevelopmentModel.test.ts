import { describe, expect, it } from 'vitest';
import {
	answerCreationGuidanceQuestion,
	createCreationJourneyState,
	parseCreationJourneyState,
	resolveJourneyImpact,
	setCreationGuidanceQuestion,
	toggleJourneyLock,
	updateStoryCore,
	updateStoryDirection,
	updateStoryOutlineNode,
	type CreationJourneyState
} from './CreationJourneyModel';

const now = () => '2026-07-30T01:02:03.000Z';

function completedState(): CreationJourneyState {
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
		core: {
			oneSentence: '失忆记者必须在一夜内找回被抹去的车站真相。',
			protagonist: '失忆记者林越',
			goal: '找回记忆并公开真相',
			obstacle: '操控记忆的站长',
			stakes: '失败会让城市忘记失踪者',
			mystery: '雨痕为何每天相同',
			readerExperience: '克制而紧张的悬疑体验',
			endingDirection: '公开真相但失去私人记忆',
			confirmedAt: '2026-07-30T01:00:00.000Z'
		},
		directions: [
			{
				id: 'journey-direction:truth',
				title: '公开真相',
				premise: '调查集体遗忘事故。',
				centralConflict: '真相会摧毁私人记忆。',
				endingPromise: '以公开与遗忘的交换收束。',
				tone: '克制悬疑'
			},
			{
				id: 'journey-direction:loop',
				title: '打破循环',
				premise: '车站困在同一个雨夜。',
				centralConflict: '接近出口就会失忆。',
				endingPromise: '主动留下守门结束循环。',
				tone: '高概念惊悚'
			},
			{
				id: 'journey-direction:family',
				title: '寻找姐姐',
				premise: '事故真相指向失踪的姐姐。',
				centralConflict: '姐姐可能制造了循环。',
				endingPromise: '以姐妹之间的选择收束。',
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

describe('CreationJourney phase 1.2C development model', () => {
	it('migrates a stale version-1 journey to version 2 without losing author work', () => {
		const state = completedState() as CreationJourneyState & {
			guidance: unknown;
			locks: unknown;
			impacts: unknown;
		};
		const legacy = { ...state } as Record<string, unknown>;
		delete legacy.guidance;
		delete legacy.locks;
		delete legacy.impacts;
		const migrated = parseCreationJourneyState(JSON.stringify({
			...legacy,
			schemaVersion: 1,
			stale: {
				directions: true,
				outline: true,
				chapters: true
			}
		}));

		expect(migrated.schemaVersion).toBe(2);
		expect(migrated.revision).toBe(state.revision);
		expect(migrated.core).toEqual(state.core);
		expect(migrated.directions).toEqual(state.directions);
		expect(migrated.outline).toEqual(state.outline);
		expect(migrated.chapters).toEqual(state.chapters);
		expect(migrated.impacts.filter(impact => impact.status === 'pending')).toHaveLength(11);
		expect(migrated.guidance).toEqual({ answers: [] });
		expect(migrated.locks).toEqual({
			coreFields: [],
			directionIds: [],
			outlineNodeIds: [],
			chapterIds: []
		});
	});

	it('records one confirmed guidance answer without changing story content', () => {
		const state = completedState();
		const questioned = setCreationGuidanceQuestion(state, {
			id: 'journey-question:stakes',
			stage: 'core',
			prompt: '失败时，主角最不能承受失去什么？',
			rationale: '这会让核心冲突具有个人代价。',
			options: [
				{ id: 'journey-option:memory', label: '最后的记忆', description: '失去与姐姐有关的最后记忆。' },
				{ id: 'journey-option:city', label: '整座城市', description: '城市会永久遗忘失踪者。' },
				{ id: 'journey-option:identity', label: '自己的身份', description: '主角会从所有记录中消失。' }
			]
		}, now);
		const answered = answerCreationGuidanceQuestion(questioned, {
			source: 'option',
			optionId: 'journey-option:memory'
		}, now);

		expect(answered.guidance.currentQuestion).toBeUndefined();
		expect(answered.guidance.answers).toEqual([{
			questionId: 'journey-question:stakes',
			stage: 'core',
			source: 'option',
			answerText: '最后的记忆：失去与姐姐有关的最后记忆。',
			answeredAt: now()
		}]);
		expect(answered.core).toEqual(state.core);
		expect(answered.directions).toEqual(state.directions);
		expect(answered.impacts).toEqual([]);
	});

	it('blocks manual writes to locked author decisions', () => {
		const state = completedState();
		const coreLocked = toggleJourneyLock(state, {
			kind: 'core',
			field: 'stakes'
		}, true, now);
		const directionLocked = toggleJourneyLock(coreLocked, {
			kind: 'direction',
			id: 'journey-direction:truth'
		}, true, now);

		expect(() => updateStoryCore(coreLocked, { stakes: 'replace me' }, now))
			.toThrow('creationJourneyTargetLocked');
		expect(() => updateStoryDirection(
			directionLocked,
			'journey-direction:truth',
			{ premise: 'replace me' },
			now
		)).toThrow('creationJourneyTargetLocked');
	});

	it('preserves downstream drafts and deduplicates exact pending impacts', () => {
		const state = completedState();
		const changedOnce = updateStoryCore(state, { stakes: 'first change' }, now);
		const changedTwice = updateStoryCore(changedOnce, { stakes: 'second change' }, now);

		expect(changedTwice.directions).toEqual(state.directions);
		expect(changedTwice.outline).toEqual(state.outline);
		expect(changedTwice.chapters).toEqual(state.chapters);
		expect(changedTwice.impacts.filter(impact => impact.status === 'pending')).toHaveLength(11);
		expect(changedTwice.stale).toEqual({
			directions: true,
			outline: true,
			chapters: true
		});
	});

	it('resolves only the selected impact and propagates outline edits only to chapters', () => {
		const changed = updateStoryCore(completedState(), { stakes: 'changed' }, now);
		const directionImpact = changed.impacts.find(impact => (
			impact.targetKind === 'direction'
			&& impact.targetId === 'journey-direction:truth'
		));
		expect(directionImpact).toBeDefined();

		const kept = resolveJourneyImpact(changed, directionImpact!.id, 'kept', now);
		expect(kept.impacts.find(impact => impact.id === directionImpact!.id)?.status).toBe('kept');
		expect(kept.impacts.filter(impact => impact.status === 'pending')).toHaveLength(10);

		const outlineChanged = updateStoryOutlineNode(
			completedState(),
			'journey-outline:1',
			{ summary: 'A revised turn' },
			now
		);
		expect(outlineChanged.impacts.filter(impact => impact.status === 'pending')).toHaveLength(3);
		expect(outlineChanged.impacts.every(impact => impact.targetKind === 'chapter')).toBe(true);
		expect(outlineChanged.stale).toEqual({
			directions: false,
			outline: false,
			chapters: true
		});
	});

	it('rejects regeneration resolution for a materialized chapter', () => {
		const state = completedState();
		const materialized = {
			...state,
			chapters: state.chapters.map((chapter, index) => ({
				...chapter,
				resourceId: `chapter:materialized-${index + 1}`
			}))
		};
		const changed = updateStoryOutlineNode(
			materialized,
			'journey-outline:1',
			{ summary: 'A revised turn' },
			now
		);
		const impact = changed.impacts.find(item => item.targetKind === 'chapter');

		expect(() => resolveJourneyImpact(changed, impact!.id, 'updated', now))
			.toThrow('creationJourneyMaterializedChapterLocked');
		expect(resolveJourneyImpact(changed, impact!.id, 'kept', now)
			.impacts.find(item => item.id === impact!.id)?.status).toBe('kept');
	});

	it('rejects orphan locks and stale flags that disagree with pending impacts', () => {
		const state = completedState();
		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			locks: {
				...state.locks,
				directionIds: ['journey-direction:missing']
			}
		}))).toThrow('creationJourneyStateInvalid');
		expect(() => parseCreationJourneyState(JSON.stringify({
			...state,
			stale: {
				...state.stale,
				chapters: true
			}
		}))).toThrow('creationJourneyStateInvalid');
	});
});
