import { describe, expect, it } from 'vitest';
import {
	createCreationJourneyState,
	setGeneratedGenreOutline,
	toggleJourneyLock,
	updateGenreToOutlineInput
} from './CreationJourneyModel';
import {
	applyHierarchyExpansionPreview,
	buildHierarchyExpansionPreview,
	validateWritableHierarchy
} from './OutlineHierarchyExpansionModel';

const now = () => '2026-07-30T08:00:00.000Z';

function outlineState() {
	let sequence = 0;
	return setGeneratedGenreOutline(
		updateGenreToOutlineInput(
			createCreationJourneyState('hierarchy-project', { startRoute: 'genre', now }),
			{ genre: '都市悬疑' },
			now
		),
		{
			outline: {
				title: '雨夜旧站',
				genre: '都市悬疑',
				premise: '记者追查只在雨夜出现的旧车站。'
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
		},
		{
			id: prefix => `${prefix}:hierarchy-${++sequence}`,
			now
		}
	);
}

const volumeCandidates = [
	{
		title: '第一卷 雨夜来客',
		summary: '记者发现旧车站与失踪案有关。',
		goal: '建立谜团',
		conflict: '记忆开始消退',
		outcome: '记者决定进入旧站',
		hook: '玻璃顶出现第二组雨痕'
	},
	{
		title: '第二卷 无日期的人',
		summary: '记者追查没有死亡日期的女孩。',
		goal: '揭示规则',
		conflict: '真相会抹去家人',
		outcome: '记者选择继续追查',
		hook: '站长说出记者的旧名'
	}
] as const;

describe('outline hierarchy expansion model', () => {
	it('previews volumes without mutating the outline and applies only after confirmation', () => {
		const state = outlineState();
		let sequence = 0;
		const preview = buildHierarchyExpansionPreview(
			state,
			{ kind: 'story' },
			volumeCandidates,
			() => `journey-outline:volume-${++sequence}`
		);

		expect(state.outline.filter(node => node.type === 'volume')).toEqual([]);
		expect(preview).toMatchObject({
			target: { kind: 'story' },
			childType: 'volume',
			createCount: 2,
			conflicts: []
		});

		const applied = applyHierarchyExpansionPreview(state, preview, now);
		expect(applied.outline.filter(node => node.type === 'volume')).toHaveLength(2);
		expect(applied.outline.filter(node => node.type === 'story_beat')).toHaveLength(5);
		expect(applied.revision).toBe(state.revision + 1);
	});

	it('blocks duplicate candidates and preserves existing locked children', () => {
		const state = outlineState();
		const initial = applyHierarchyExpansionPreview(
			state,
			buildHierarchyExpansionPreview(
				state,
				{ kind: 'story' },
				volumeCandidates,
				(_, index) => `journey-outline:volume-${index + 1}`
			),
			now
		);
		const firstVolume = initial.outline.find(node => node.type === 'volume');
		expect(firstVolume).toBeDefined();
		const locked = toggleJourneyLock(initial, {
			kind: 'outline',
			id: firstVolume!.id
		}, true, now);
		const preview = buildHierarchyExpansionPreview(
			locked,
			{ kind: 'story' },
			[
				volumeCandidates[0],
				{ ...volumeCandidates[1], title: '第三卷 回声尽头' }
			],
			(_, index) => `journey-outline:replacement-${index + 1}`
		);

		expect(preview.lockedPreservedIds).toContain(firstVolume!.id);
		expect(preview.existingPreservedIds).toHaveLength(2);
		expect(preview.conflicts).toEqual([
			expect.objectContaining({ code: 'duplicate-title', title: '第一卷 雨夜来客' })
		]);
		expect(() => applyHierarchyExpansionPreview(locked, preview, now))
			.toThrow('outlineHierarchyExpansionConflict');
	});

	it('builds volume → chapter → scene projections with valid parentage', () => {
		const state = outlineState();
		const withVolume = applyHierarchyExpansionPreview(
			state,
			buildHierarchyExpansionPreview(
				state,
				{ kind: 'story' },
				[volumeCandidates[0]],
				() => 'journey-outline:volume-1'
			),
			now
		);
		const withChapter = applyHierarchyExpansionPreview(
			withVolume,
			buildHierarchyExpansionPreview(
				withVolume,
				{ kind: 'volume', id: 'journey-outline:volume-1' },
				[{
					title: '第一章 夜雨名单',
					summary: '记者在旧站拿到失踪者名单。',
					goal: '取得名单',
					conflict: '站长阻止',
					outcome: '名单出现记者姓名',
					hook: '列车在停运轨道进站',
					povHint: '记者'
				}],
				() => 'journey-outline:chapter-1'
			),
			now
		);
		const complete = applyHierarchyExpansionPreview(
			withChapter,
			buildHierarchyExpansionPreview(
				withChapter,
				{ kind: 'chapter', id: 'journey-outline:chapter-1' },
				[{
					title: '玻璃顶下的名单',
					summary: '记者潜入候车厅。',
					goal: '拍下名单',
					conflict: '站长封锁出口',
					outcome: '记者发现自己的名字',
					hook: '停运列车亮灯',
					povHint: '记者',
					locationHint: '旧车站候车厅',
					characterHints: ['记者', '站长']
				}],
				() => 'journey-outline:scene-1'
			),
			now
		);

		expect(complete.outline.find(node => node.id === 'journey-outline:chapter-1'))
			.toMatchObject({ type: 'chapter', parentId: 'journey-outline:volume-1', order: 0 });
		expect(complete.outline.find(node => node.id === 'journey-outline:scene-1'))
			.toMatchObject({ type: 'scene', parentId: 'journey-outline:chapter-1', order: 0 });
		expect(validateWritableHierarchy(complete)).toEqual({
			volumeCount: 1,
			chapterCount: 1,
			sceneCount: 1
		});
	});

	it('rejects missing scene coverage and renderer-supplied canonical IDs', () => {
		const state = outlineState();
		const withVolume = applyHierarchyExpansionPreview(
			state,
			buildHierarchyExpansionPreview(
				state,
				{ kind: 'story' },
				[volumeCandidates[0]],
				() => 'journey-outline:volume-1'
			),
			now
		);
		expect(() => validateWritableHierarchy(withVolume))
			.toThrow('outlineHierarchyIncomplete');

		const tampered = {
			...withVolume,
			outline: withVolume.outline.map(node => node.type === 'volume'
				? { ...node, resourceId: 'volume:renderer-supplied' }
				: node)
		};
		expect(() => validateWritableHierarchy(tampered))
			.toThrow('outlineHierarchyAlreadyMaterialized');
	});
});
