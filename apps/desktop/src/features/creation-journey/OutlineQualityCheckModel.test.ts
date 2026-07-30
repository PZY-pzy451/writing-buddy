import { describe, expect, it } from 'vitest';
import {
	createCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput,
	type CreationJourneyState,
	type StoryOutlineNode
} from './CreationJourneyModel';
import {
	runLocalOutlineChecks,
	type OutlineManuscriptState
} from './OutlineQualityCheckModel';

function validState(): CreationJourneyState {
	let sequence = 0;
	const initial = updateGenreToOutlineInput(
		createCreationJourneyState('quality-check', { startRoute: 'genre' }),
		{ genre: '都市悬疑' }
	);
	return setGeneratedGenreOutline(initial, {
		outline: {
			title: '雨夜旧站',
			genre: '都市悬疑',
			premise: '记者追查只在雨夜出现的旧车站。'
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `故事节点 ${index + 1}`,
			summary: `记者推进调查 ${index + 1}`,
			goal: `取得线索 ${index + 1}`,
			conflict: `遭遇阻碍 ${index + 1}`,
			outcome: `留下变化 ${index + 1}`
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	}, { id: prefix => `${prefix}:quality-${++sequence}` });
}

function hierarchyNodes(): readonly StoryOutlineNode[] {
	return [
		{
			id: 'journey-outline:volume-a', title: '第一卷', summary: '雨夜来客', purpose: '',
			type: 'volume', order: 0, status: 'planned', source: 'manual', revision: 1
		},
		{
			id: 'journey-outline:chapter-a', title: '第一章', summary: '记者进入旧站', purpose: '',
			type: 'chapter', parentId: 'journey-outline:volume-a', order: 0,
			status: 'drafting', source: 'manual', revision: 1, resourceId: 'chapter:chapter-a'
		},
		{
			id: 'journey-outline:scene-a', title: '候车厅', summary: '找到失踪者名单', purpose: '',
			type: 'scene', parentId: 'journey-outline:chapter-a', order: 0,
			status: 'planned', source: 'manual', revision: 1
		}
	];
}

describe('runLocalOutlineChecks', () => {
	it('reports every deterministic structural rule without mutating the state', () => {
		const base = validState();
		const duplicate: StoryOutlineNode = {
			...hierarchyNodes()[1],
			title: '',
			summary: '',
			parentId: 'journey-outline:missing-volume',
			order: 0
		};
		const malformed = {
			...base,
			outline: [
				...base.outline,
				...hierarchyNodes(),
				duplicate,
				{
					...hierarchyNodes()[1],
					id: 'journey-outline:chapter-duplicate-order',
					resourceId: 'chapter:chapter-duplicate-order'
				},
				{
					...hierarchyNodes()[2],
					id: 'journey-outline:scene-orphan',
					parentId: 'journey-outline:volume-a',
					order: 0
				}
			]
		} as CreationJourneyState;
		const before = JSON.stringify(malformed);
		const issues = runLocalOutlineChecks(malformed);
		const codes = new Set(issues.map(issue => issue.code));

		expect(codes).toEqual(new Set([
			'empty-title',
			'empty-summary',
			'duplicate-order',
			'orphan-node',
			'scene-without-chapter',
			'chapter-without-volume',
			'duplicate-id'
		]));
		expect(issues.every(issue => (
			issue.source === 'local'
			&& issue.nodeIds.length > 0
			&& issue.message.length > 0
			&& issue.impact.length > 0
			&& issue.suggestedAction.length > 0
		))).toBe(true);
		expect(JSON.stringify(malformed)).toBe(before);
	});

	it('detects a changed locked node against the persisted baseline', () => {
		const baseline = validState();
		const target = baseline.outline[0];
		const current = {
			...baseline,
			outline: baseline.outline.map(node => node.id === target.id
				? { ...node, summary: '被绕过锁定后改写的内容' }
				: node),
			locks: { ...baseline.locks, outlineNodeIds: [target.id] }
		} as CreationJourneyState;

		const issues = runLocalOutlineChecks(current, { baseline });
		expect(issues).toEqual(expect.arrayContaining([
			expect.objectContaining({
				code: 'locked-node-modified',
				nodeIds: [target.id],
				severity: 'error'
			})
		]));
	});

	it('compares materialized chapter plans with manuscript state', () => {
		const base = validState();
		const nodes = hierarchyNodes();
		const current = { ...base, outline: [...base.outline, ...nodes] } as CreationJourneyState;
		const manuscripts: readonly OutlineManuscriptState[] = [{
			resourceId: 'chapter:chapter-a',
			status: 'completed',
			hasContent: false
		}];

		const issues = runLocalOutlineChecks(current, { manuscripts });
		expect(issues.filter(issue => issue.code === 'chapter-manuscript-status-mismatch'))
			.toHaveLength(1);
		expect(issues.find(issue => issue.code === 'chapter-manuscript-status-mismatch')?.nodeIds)
			.toEqual(['journey-outline:chapter-a']);
	});

	it('checks the maximum persisted outline in linear time', () => {
		const base = validState();
		const outline = Array.from({ length: 512 }, (_, index): StoryOutlineNode => ({
			id: `journey-outline:performance-${index}`,
			title: `节点 ${index}`,
			summary: `推进故事 ${index}`,
			purpose: '',
			type: 'volume',
			order: index,
			status: 'planned',
			source: 'manual',
			revision: 1
		}));
		const current = { ...base, outline } as CreationJourneyState;
		const startedAt = performance.now();

		expect(runLocalOutlineChecks(current)).toEqual([]);
		expect(performance.now() - startedAt).toBeLessThan(100);
	});
});
