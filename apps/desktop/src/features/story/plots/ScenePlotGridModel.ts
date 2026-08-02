import type {
	PlotThread,
	StoryScene
} from '@writing-buddy/story-kernel';
import type { AiChapterSource } from '../ai-context/AiChapterSource';

export type ScenePlotLinkHealth = 'reciprocal' | 'scene-only' | 'thread-only';
export type ScenePlotGridFilter = 'all' | 'unlinked' | 'incomplete' | 'needs-sync';

export interface ScenePlotGridLink {
	readonly thread: PlotThread;
	readonly health: ScenePlotLinkHealth;
}

export interface ScenePlotGridRow {
	readonly scene: StoryScene;
	readonly chapter?: AiChapterSource;
	readonly sceneNumber: number;
	readonly links: readonly ScenePlotGridLink[];
	readonly unknownThreadIds: readonly string[];
	readonly missingBeats: readonly ('goal' | 'conflict' | 'turn' | 'outcome')[];
}

export interface ScenePlotGridModel {
	readonly threads: readonly PlotThread[];
	readonly rows: readonly ScenePlotGridRow[];
	readonly reciprocalLinkCount: number;
	readonly oneSidedLinkCount: number;
	readonly unlinkedSceneCount: number;
	readonly incompleteSceneCount: number;
	readonly danglingThreadSceneLinkCount: number;
}

const beatFields = ['goal', 'conflict', 'turn', 'outcome'] as const;

function normalizedIds(ids: readonly { toString(): string }[]): ReadonlySet<string> {
	return new Set(ids.map(id => id.toString()));
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right, 'zh-CN');
}

export function buildScenePlotGrid(
	scenes: readonly StoryScene[],
	threads: readonly PlotThread[],
	chapters: readonly AiChapterSource[]
): ScenePlotGridModel {
	const chapterOrder = new Map<string, { readonly chapter: AiChapterSource; readonly order: number }>();
	chapters.forEach((chapter, order) => {
		chapterOrder.set(chapter.resourceId, { chapter, order });
		chapterOrder.set(chapter.chapterId, { chapter, order });
	});
	const sceneIds = new Set(scenes.map(scene => scene.id.toString()));
	const orderedThreads = [...threads].sort((left, right) => (
		(left.startPosition?.narrativeOrder ?? Number.MAX_SAFE_INTEGER)
		- (right.startPosition?.narrativeOrder ?? Number.MAX_SAFE_INTEGER)
		|| compareText(left.title, right.title)
		|| compareText(left.id.toString(), right.id.toString())
	));
	const knownThreadIds = new Set(orderedThreads.map(thread => thread.id.toString()));
	const threadSceneIds = new Map(orderedThreads.map(thread => [
		thread.id.toString(),
		normalizedIds(thread.sceneIds)
	]));

	const orderedRows = scenes.map(scene => {
		const sceneThreadIds = normalizedIds(scene.plotThreadIds);
		const links = orderedThreads.flatMap(thread => {
			const sceneHasThread = sceneThreadIds.has(thread.id.toString());
			const threadHasScene = threadSceneIds.get(thread.id.toString())?.has(scene.id.toString()) ?? false;
			if (!sceneHasThread && !threadHasScene) return [];
			return [{
				thread,
				health: sceneHasThread && threadHasScene
					? 'reciprocal' as const
					: sceneHasThread ? 'scene-only' as const : 'thread-only' as const
			}];
		});
		return {
			scene,
			chapter: chapterOrder.get(scene.chapterId.toString())?.chapter,
			sceneNumber: 0,
			links,
			unknownThreadIds: [...sceneThreadIds].filter(id => !knownThreadIds.has(id)).sort(compareText),
			missingBeats: beatFields.filter(field => !scene[field]?.trim())
		};
	}).sort((left, right) => {
		const leftChapter = chapterOrder.get(left.scene.chapterId.toString())?.order ?? Number.MAX_SAFE_INTEGER;
		const rightChapter = chapterOrder.get(right.scene.chapterId.toString())?.order ?? Number.MAX_SAFE_INTEGER;
		return leftChapter - rightChapter
			|| left.scene.narrativeOrder - right.scene.narrativeOrder
			|| compareText(left.scene.title, right.scene.title)
			|| compareText(left.scene.id.toString(), right.scene.id.toString());
	});
	const sceneCountByChapter = new Map<string, number>();
	const rows = orderedRows.map(row => {
		const chapterId = row.scene.chapterId.toString();
		const sceneNumber = (sceneCountByChapter.get(chapterId) ?? 0) + 1;
		sceneCountByChapter.set(chapterId, sceneNumber);
		return { ...row, sceneNumber };
	});
	const reciprocalLinkCount = rows.reduce(
		(total, row) => total + row.links.filter(link => link.health === 'reciprocal').length,
		0
	);
	const oneSidedLinkCount = rows.reduce(
		(total, row) => total + row.links.filter(link => link.health !== 'reciprocal').length + row.unknownThreadIds.length,
		0
	);
	return {
		threads: orderedThreads,
		rows,
		reciprocalLinkCount,
		oneSidedLinkCount,
		unlinkedSceneCount: rows.filter(row => row.links.length === 0 && row.unknownThreadIds.length === 0).length,
		incompleteSceneCount: rows.filter(row => row.missingBeats.length > 0).length,
		danglingThreadSceneLinkCount: orderedThreads.reduce(
			(total, thread) => total + thread.sceneIds.filter(id => !sceneIds.has(id.toString())).length,
			0
		)
	};
}

export function filterScenePlotGridRows(
	rows: readonly ScenePlotGridRow[],
	filter: ScenePlotGridFilter,
	query: string
): readonly ScenePlotGridRow[] {
	const needle = query.trim().toLocaleLowerCase('zh-CN');
	return rows.filter(row => {
		const filterMatches = filter === 'all'
			|| (filter === 'unlinked' && row.links.length === 0 && row.unknownThreadIds.length === 0)
			|| (filter === 'incomplete' && row.missingBeats.length > 0)
			|| (filter === 'needs-sync' && (
				row.links.some(link => link.health !== 'reciprocal') || row.unknownThreadIds.length > 0
			));
		if (!filterMatches || !needle) return filterMatches;
		return [
			row.scene.title,
			row.scene.summary,
			row.scene.goal,
			row.scene.conflict,
			row.scene.turn,
			row.scene.outcome,
			row.chapter?.title,
			...row.links.map(link => link.thread.title)
		].some(value => value?.toLocaleLowerCase('zh-CN').includes(needle));
	});
}
