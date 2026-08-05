import { describe, expect, it } from 'vitest';
import {
	parsePlotThread,
	parseStoryScene
} from '@writing-buddy/story-kernel';
import {
	buildScenePlotGrid,
	filterScenePlotGridRows
} from './ScenePlotGridModel';

const timestamp = '2026-08-02T00:00:00.000Z';
const base = {
	aliases: [],
	tags: [],
	schemaVersion: 1 as const,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 0,
	evidenceIds: []
};

function scene(input: {
	readonly id: string;
	readonly chapterId: string;
	readonly order: number;
	readonly title: string;
	readonly plotThreadIds?: readonly string[];
	readonly complete?: boolean;
}) {
	return parseStoryScene({
		...base,
		id: input.id,
		type: 'scene',
		title: input.title,
		chapterId: input.chapterId,
		manuscriptRange: { start: 0, end: 10, revision: 0, quote: input.title },
		narrativeOrder: input.order,
		locationIds: [],
		participantIds: [],
		plotThreadIds: input.plotThreadIds ?? [],
		revealInformationIds: [],
		foreshadowingIds: [],
		...(input.complete ? {
			goal: '取得线索', conflict: '对方拒绝', turn: '信封出现', outcome: '线索到手'
		} : {})
	});
}

function thread(input: { readonly id: string; readonly title: string; readonly sceneIds: readonly string[] }) {
	return parsePlotThread({
		...base,
		id: input.id,
		type: 'plotThread',
		title: input.title,
		sceneIds: input.sceneIds
	});
}

const chapters = [
	{ resourceId: 'chapter:first', chapterId: 'first', title: '第一章', path: '1.md', narrativeOrder: 0 },
	{ resourceId: 'chapter:second', chapterId: 'second', title: '第二章', path: '2.md', narrativeOrder: 1 }
];

describe('scene plot grid model control effects: scene-plot-grid-filter, scene-plot-grid-link', () => {
	it('reports invalid one-sided links while ordering real scenes by manuscript chapter', () => {
		const model = buildScenePlotGrid([
			scene({ id: 'scene:later', chapterId: 'chapter:second', order: 1, title: '后来', plotThreadIds: ['plot-thread:main'] }),
			scene({ id: 'scene:first', chapterId: 'chapter:first', order: 2, title: '开端', plotThreadIds: ['plot-thread:main', 'plot-thread:scene-only'], complete: true })
		], [
			thread({ id: 'plot-thread:main', title: '主线', sceneIds: ['scene:first', 'scene:later'] }),
			thread({ id: 'plot-thread:scene-only', title: '单边线', sceneIds: [] }),
			thread({ id: 'plot-thread:thread-only', title: '反向单边线', sceneIds: ['scene:later', 'scene:missing'] })
		], chapters);

		expect(model.rows.map(row => row.scene.title)).toEqual(['开端', '后来']);
		expect(model.rows[0]?.links.map(link => [link.thread.title, link.health])).toEqual([
			['单边线', 'scene-only'],
			['主线', 'reciprocal']
		]);
		expect(model.rows[1]?.links.map(link => [link.thread.title, link.health])).toEqual([
			['反向单边线', 'thread-only'],
			['主线', 'reciprocal']
		]);
		expect(model).toMatchObject({
			reciprocalLinkCount: 2,
			oneSidedLinkCount: 2,
			unlinkedSceneCount: 0,
			incompleteSceneCount: 1,
			danglingThreadSceneLinkCount: 1
		});
	});

	it('keeps unknown chapters and relation IDs visible, supports task filters and restores all rows after an unmatched search', () => {
		const unlinked = scene({ id: 'scene:unlinked', chapterId: 'chapter:unknown', order: 1, title: '失去归属' });
		const unknownThread = scene({
			id: 'scene:unknown-thread', chapterId: 'chapter:first', order: 3,
			title: '陌生线索', plotThreadIds: ['plot-thread:missing']
		});
		const model = buildScenePlotGrid([unlinked, unknownThread], [], chapters);

		expect(model.rows.at(-1)?.chapter).toBeUndefined();
		expect(model.rows[0]?.unknownThreadIds).toEqual(['plot-thread:missing']);
		expect(filterScenePlotGridRows(model.rows, 'unlinked', '')).toHaveLength(1);
		expect(filterScenePlotGridRows(model.rows, 'needs-sync', '')).toHaveLength(1);
		expect(filterScenePlotGridRows(model.rows, 'all', '陌生')).toHaveLength(1);
		expect(filterScenePlotGridRows(model.rows, 'all', '不存在')).toHaveLength(0);
		expect(filterScenePlotGridRows(model.rows, 'all', '')).toHaveLength(2);
	});
});
