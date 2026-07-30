import { describe, expect, it } from 'vitest';
import {
	addStoryOutlineNode,
	createCreationJourneyState,
	moveStoryOutlineNode,
	parseCreationJourneyState,
	removeStoryOutlineNode,
	restoreStructuredOutlineSnapshot,
	serializeCreationJourneyState,
	setGeneratedGenreOutline,
	toggleJourneyLock,
	updateGenreToOutlineInput,
	updateStoryOutlineNode,
	updateStoryOutlineRoot
} from './CreationJourneyModel';

const now = () => '2026-07-30T06:00:00.000Z';

function generatedState() {
	let id = 0;
	const initial = updateGenreToOutlineInput(
		createCreationJourneyState('outline-project', { startRoute: 'genre', now }),
		{ genre: '都市悬疑' },
		now
	);
	return setGeneratedGenreOutline(initial, {
		outline: {
			title: '雨夜旧站',
			genre: '都市悬疑',
			premise: '记者追查只在雨夜出现的旧车站。',
			centralConflict: '公开真相会抹去她最后的家庭记忆。'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节点 ${index + 1}`,
			summary: `推进调查 ${index + 1}`,
			goal: `取得线索 ${index + 1}`,
			conflict: `遭遇阻碍 ${index + 1}`,
			outcome: `留下变化 ${index + 1}`
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	}, {
		id: prefix => `${prefix}:workspace-${++id}`,
		now
	});
}

describe('structured outline model', () => {
	it('edits the story root and rich node fields without materializing chapters', () => {
		const state = generatedState();
		const rootEdited = updateStoryOutlineRoot(state, {
			title: '玻璃顶上的雨',
			stakes: '失败会让整座城市遗忘失踪者。'
		}, now);
		const nodeEdited = updateStoryOutlineNode(rootEdited, rootEdited.outline[0].id, {
			hook: '玻璃顶出现第二组雨痕',
			povHint: '记者林越'
		}, now);

		expect(rootEdited.storyOutline).toMatchObject({
			title: '玻璃顶上的雨',
			stakes: '失败会让整座城市遗忘失踪者。',
			revision: 2
		});
		expect(nodeEdited.outline[0]).toMatchObject({
			hook: '玻璃顶出现第二组雨痕',
			povHint: '记者林越',
			revision: 2
		});
		expect(nodeEdited.chapters).toEqual([]);
	});

	it('creates, deletes, reorders, and locks only project-owned story beats', () => {
		const state = generatedState();
		const added = addStoryOutlineNode(state, now, () => 'journey-outline:manual');
		expect(added.outline).toHaveLength(6);
		expect(added.outline.at(-1)).toMatchObject({
			id: 'journey-outline:manual',
			type: 'story_beat',
			order: 5,
			source: 'manual'
		});

		const moved = moveStoryOutlineNode(added, 5, 1, now);
		expect(moved.outline.map(node => node.id).slice(0, 2)).toEqual([
			state.outline[0].id,
			'journey-outline:manual'
		]);
		expect(moved.outline.map(node => node.order)).toEqual([0, 1, 2, 3, 4, 5]);

		const locked = toggleJourneyLock(moved, {
			kind: 'outline',
			id: 'journey-outline:manual'
		}, true, now);
		expect(() => updateStoryOutlineNode(locked, 'journey-outline:manual', {
			title: '不应改动'
		}, now)).toThrow('creationJourneyTargetLocked');
		expect(() => removeStoryOutlineNode(
			locked,
			'journey-outline:manual',
			now
		)).toThrow('creationJourneyTargetLocked');

		const unlocked = toggleJourneyLock(locked, {
			kind: 'outline',
			id: 'journey-outline:manual'
		}, false, now);
		const removed = removeStoryOutlineNode(unlocked, 'journey-outline:manual', now);
		expect(removed.outline).toHaveLength(5);
		expect(() => removeStoryOutlineNode(removed, removed.outline[0].id, now))
			.toThrow('creationJourneyOutlineMinimum');
	});

	it('undoes a structural change as a new revision that can be persisted', () => {
		const before = generatedState();
		const moved = moveStoryOutlineNode(before, 0, 3, now);
		const restored = restoreStructuredOutlineSnapshot(moved, before, now);

		expect(restored.outline.map(node => node.id)).toEqual(
			before.outline.map(node => node.id)
		);
		expect(restored.storyOutline?.revision).toBeGreaterThan(
			moved.storyOutline?.revision ?? 0
		);
		expect(restored.revision).toBeGreaterThan(moved.revision);
		expect(restored.chapters).toEqual([]);
	});

	it('restores root edits, node order, and centralized locks after reopen', () => {
		const state = generatedState();
		const renamed = updateStoryOutlineRoot(state, { title: '重新打开的雨夜' }, now);
		const moved = moveStoryOutlineNode(renamed, 0, 2, now);
		const locked = toggleJourneyLock(moved, {
			kind: 'outline',
			id: moved.outline[1].id
		}, true, now);
		const reopened = parseCreationJourneyState(serializeCreationJourneyState(locked));

		expect(reopened.storyOutline?.title).toBe('重新打开的雨夜');
		expect(reopened.outline.map(node => node.id)).toEqual(
			moved.outline.map(node => node.id)
		);
		expect(reopened.outline.map(node => node.order)).toEqual([0, 1, 2, 3, 4]);
		expect(reopened.locks.outlineNodeIds).toEqual([moved.outline[1].id]);
	});

	it('rejects duplicate story-resource links before the native persistence boundary', () => {
		const state = generatedState();
		const malformed = {
			...state,
			outline: state.outline.map((node, index) => index === 0
				? { ...node, characterIds: ['character:one', 'character:one'] }
				: node)
		};

		expect(() => parseCreationJourneyState(JSON.stringify(malformed)))
			.toThrow('creationJourneyStateInvalid');
	});
});
