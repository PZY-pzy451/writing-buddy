import { flattenChapters, type TextFile } from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { createTextAnchor, type TextAnchor } from '@writing-buddy/review';
import type { StoryResourceType, StoryScene } from '@writing-buddy/story-kernel';

export type WriterNavigatorResultKind =
	| 'chapter'
	| 'scene'
	| 'manuscript'
	| 'resource'
	| 'setting'
	| 'command';

export type WriterNavigatorGroup =
	| '最近使用'
	| '章节'
	| '场景'
	| '正文'
	| '资料'
	| '设置'
	| '命令';

export type WriterNavigatorCommandId =
	| 'quick-capture'
	| 'organize-chapter'
	| 'toggle-focus'
	| 'reset-layout'
	| 'save';

export interface WriterNavigatorResult {
	readonly id: string;
	readonly kind: WriterNavigatorResultKind;
	readonly group: WriterNavigatorGroup;
	readonly title: string;
	readonly subtitle?: string;
	readonly preview?: string;
	readonly searchText: string;
	readonly recent?: boolean;
	readonly chapterId?: string;
	readonly chapterPath?: string;
	readonly offset?: number;
	readonly anchor?: TextAnchor;
	readonly storyType?: StoryResourceType;
	readonly storyId?: string;
	readonly resourceId?: string;
	readonly commandId?: WriterNavigatorCommandId;
	readonly settingId?: 'appearance' | 'shortcuts' | 'ai';
}

export interface WriterNavigatorStorySummary {
	readonly id: string;
	readonly type: StoryResourceType;
	readonly title: string;
	readonly summary?: string;
}

export interface WriterNavigatorCatalogInput {
	readonly snapshot: ProjectSnapshot;
	readonly scenes: readonly StoryScene[];
	readonly storyResources: readonly WriterNavigatorStorySummary[];
	readonly recentIds: readonly string[];
}

export type NavigatorReadText = (
	projectRoot: string,
	relativePath: string
) => Promise<TextFile>;

export interface ManuscriptSearchCache {
	readonly files: Map<string, Promise<TextFile>>;
}

const commands: readonly Omit<WriterNavigatorResult, 'recent'>[] = [
	{
		id: 'command:quick-capture',
		kind: 'command',
		group: '命令',
		title: '快速记录',
		subtitle: '记录当前灵感，不离开正文',
		searchText: '快速记录 灵感 笔记 capture',
		commandId: 'quick-capture'
	},
	{
		id: 'command:organize-chapter',
		kind: 'command',
		group: '命令',
		title: '整理本章',
		subtitle: '查看范围和 Token，不会自动调用 AI',
		searchText: '整理本章 提取 资料 organize',
		commandId: 'organize-chapter'
	},
	{
		id: 'command:toggle-focus',
		kind: 'command',
		group: '命令',
		title: '切换专注模式',
		subtitle: '临时隐藏辅助界面',
		searchText: '切换专注模式 focus F11',
		commandId: 'toggle-focus'
	},
	{
		id: 'command:save',
		kind: 'command',
		group: '命令',
		title: '保存当前正文',
		subtitle: '安全写入本地项目',
		searchText: '保存当前正文 save Ctrl S',
		commandId: 'save'
	},
	{
		id: 'command:reset-layout',
		kind: 'command',
		group: '命令',
		title: '恢复当前工作区布局',
		subtitle: '恢复当前模式的默认面板',
		searchText: '恢复当前工作区布局 reset layout',
		commandId: 'reset-layout'
	}
];

const settings: readonly Omit<WriterNavigatorResult, 'recent'>[] = [
	{
		id: 'setting:appearance',
		kind: 'setting',
		group: '设置',
		title: '外观与主题',
		searchText: '设置 外观 主题 强调色',
		settingId: 'appearance'
	},
	{
		id: 'setting:shortcuts',
		kind: 'setting',
		group: '设置',
		title: '键盘快捷键',
		searchText: '设置 键盘 快捷键 shortcuts',
		settingId: 'shortcuts'
	},
	{
		id: 'setting:ai',
		kind: 'setting',
		group: '设置',
		title: 'AI 与模型',
		searchText: '设置 AI 模型 DeepSeek',
		settingId: 'ai'
	}
];

function projectChapterId(storyChapterId: string): string {
	return storyChapterId.startsWith('chapter:')
		? storyChapterId.slice('chapter:'.length)
		: storyChapterId;
}

function withRecent(
	result: Omit<WriterNavigatorResult, 'recent'>,
	recentIds: ReadonlySet<string>
): WriterNavigatorResult {
	return recentIds.has(result.id) ? { ...result, recent: true } : result;
}

export function buildWriterNavigatorCatalog(
	input: WriterNavigatorCatalogInput
): readonly WriterNavigatorResult[] {
	const recentIds = new Set(input.recentIds);
	const chapters = flattenChapters(input.snapshot.project);
	const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]));
	const results: WriterNavigatorResult[] = [];
	for (const chapter of chapters) {
		results.push(withRecent({
			id: `chapter:${chapter.id}`,
			kind: 'chapter',
			group: '章节',
			title: chapter.title,
			subtitle: chapter.scene.location || chapter.scene.time || '章节',
			searchText: [
				chapter.title,
				chapter.scene.location,
				chapter.scene.time,
				chapter.scene.pov
			].filter(Boolean).join(' '),
			chapterId: chapter.id,
			chapterPath: chapter.file,
			offset: 0
		}, recentIds));
	}
	for (const scene of [...input.scenes].sort(
		(first, second) => first.narrativeOrder - second.narrativeOrder
	)) {
		const chapterId = projectChapterId(scene.chapterId);
		const chapter = chapterById.get(chapterId);
		if (!chapter) continue;
		const title = scene.summary?.trim() || `场景 ${scene.narrativeOrder}`;
		results.push(withRecent({
			id: `scene:${scene.id}`,
			kind: 'scene',
			group: '场景',
			title,
			subtitle: chapter.title,
			preview: scene.summary,
			searchText: `${title} ${chapter.title}`,
			chapterId,
			chapterPath: chapter.file,
			offset: scene.manuscriptRange.start
		}, recentIds));
	}
	for (const resource of input.snapshot.resources) {
		results.push(withRecent({
			id: `project-resource:${resource.id}`,
			kind: 'resource',
			group: '资料',
			title: resource.title,
			subtitle: resource.type,
			searchText: `${resource.title} ${resource.type}`,
			resourceId: resource.id
		}, recentIds));
	}
	for (const resource of input.storyResources) {
		results.push(withRecent({
			id: `story:${resource.id}`,
			kind: 'resource',
			group: '资料',
			title: resource.title,
			subtitle: resource.type,
			preview: resource.summary,
			searchText: `${resource.title} ${resource.type} ${resource.summary ?? ''}`,
			storyType: resource.type,
			storyId: resource.id
		}, recentIds));
	}
	results.push(
		...settings.map(result => withRecent(result, recentIds)),
		...commands.map(result => withRecent(result, recentIds))
	);
	return results;
}

function resultScore(result: WriterNavigatorResult, normalizedQuery: string): number {
	const title = result.title.toLocaleLowerCase();
	const searchText = result.searchText.toLocaleLowerCase();
	let score = title === normalizedQuery
		? 0
		: title.startsWith(normalizedQuery)
			? 10
			: title.includes(normalizedQuery)
				? 20
				: searchText.includes(normalizedQuery)
					? 30
					: 1_000;
	if (result.recent) score -= 2;
	if (result.kind === 'command') score += 20;
	return score;
}

export function sortWriterNavigatorResults(
	results: readonly WriterNavigatorResult[],
	query: string
): readonly WriterNavigatorResult[] {
	const normalized = query.trim().toLocaleLowerCase();
	return [...results]
		.filter(result => !normalized || result.searchText.toLocaleLowerCase().includes(normalized))
		.sort((first, second) => (
			resultScore(first, normalized) - resultScore(second, normalized)
			|| first.title.localeCompare(second.title, 'zh-CN')
			|| first.id.localeCompare(second.id)
		));
}

function excerptFor(content: string, start: number, end: number): string {
	return content
		.slice(Math.max(0, start - 34), Math.min(content.length, end + 46))
		.replace(/(?:\\r|\\n)+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
}

function occurrences(
	content: string,
	query: string,
	maximum: number
): readonly number[] {
	const normalizedContent = content.toLocaleLowerCase();
	const normalizedQuery = query.toLocaleLowerCase();
	const positions: number[] = [];
	let offset = normalizedContent.indexOf(normalizedQuery);
	while (offset >= 0 && positions.length < maximum) {
		positions.push(offset);
		offset = normalizedContent.indexOf(
			normalizedQuery,
			offset + Math.max(1, normalizedQuery.length)
		);
	}
	return positions;
}

export function createManuscriptSearchCache(): ManuscriptSearchCache {
	return { files: new Map() };
}

export async function searchManuscriptOccurrences(
	snapshot: ProjectSnapshot,
	query: string,
	readText: NavigatorReadText,
	concurrency = 4,
	cache = createManuscriptSearchCache()
): Promise<readonly WriterNavigatorResult[]> {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return [];
	const chapters = flattenChapters(snapshot.project);
	const results: WriterNavigatorResult[] = [];
	let nextIndex = 0;
	const worker = async () => {
		while (nextIndex < chapters.length && results.length < 40) {
			const chapter = chapters[nextIndex++];
			if (!chapter) continue;
			const cacheKey = `${snapshot.root}\u0000${chapter.file}`;
			let pending = cache.files.get(cacheKey);
			if (!pending) {
				pending = readText(snapshot.root, chapter.file);
				cache.files.set(cacheKey, pending);
			}
			let file: TextFile;
			try {
				file = await pending;
			} catch {
				cache.files.delete(cacheKey);
				continue;
			}
			for (const start of occurrences(file.content, normalizedQuery, 3)) {
				const end = start + normalizedQuery.length;
				results.push({
					id: `manuscript:${chapter.id}:${start}:${normalizedQuery}`,
					kind: 'manuscript',
					group: '正文',
					title: chapter.title,
					subtitle: excerptFor(file.content, start, end),
					preview: excerptFor(file.content, start, end),
					searchText: `${chapter.title} ${normalizedQuery}`,
					chapterId: chapter.id,
					chapterPath: chapter.file,
					offset: start,
					anchor: createTextAnchor(file.content, start, end)
				});
				if (results.length >= 40) break;
			}
		}
	};
	await Promise.all(Array.from(
		{ length: Math.min(Math.max(1, concurrency), Math.max(1, chapters.length)) },
		() => worker()
	));
	return results.sort((first, second) => (
		(first.chapterId ?? '').localeCompare(second.chapterId ?? '')
		|| (first.offset ?? 0) - (second.offset ?? 0)
	));
}
