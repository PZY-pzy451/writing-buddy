import { flattenChapters } from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import type { RailMode } from '../../app/store';

export const authorPrimaryModes = [
	'works',
	'planning',
	'references',
	'review',
	'versions'
] as const satisfies readonly RailMode[];

export type AuthorPrimaryMode = typeof authorPrimaryModes[number];

export type AuthorProductStage =
	| 'start'
	| 'outline'
	| 'structure'
	| 'draft'
	| 'longform';

export interface PrimaryModePresentation {
	readonly disabled: boolean;
	readonly muted: boolean;
	readonly hint: string;
}

export function deriveAuthorProductStage(
	snapshot?: ProjectSnapshot
): AuthorProductStage {
	if (!snapshot) return 'start';
	const chapters = flattenChapters(snapshot.project);
	if (chapters.length === 0) return 'outline';
	const draftedChapters = chapters.filter(chapter => (
		(snapshot.wordCounts[chapter.id] ?? 0) > 0
	));
	if (draftedChapters.length === 0) return 'structure';
	return draftedChapters.length >= 2 ? 'longform' : 'draft';
}

export function primaryModePresentation(
	stage: AuthorProductStage,
	mode: AuthorPrimaryMode
): PrimaryModePresentation {
	if (stage === 'start') {
		return mode === 'works'
			? { disabled: false, muted: false, hint: '开始一个故事' }
			: { disabled: true, muted: true, hint: '打开或创建作品后可用' };
	}
	if (stage === 'outline') {
		if (mode === 'works') return { disabled: false, muted: false, hint: '回到故事起点' };
		if (mode === 'planning') return { disabled: false, muted: false, hint: '推荐：完善故事结构' };
		return { disabled: false, muted: true, hint: '正文产生后更有用' };
	}
	if (stage === 'structure') {
		if (mode === 'works') return { disabled: false, muted: false, hint: '推荐：开始写正文' };
		if (mode === 'planning') return { disabled: false, muted: false, hint: '调整章节与场景' };
		return { disabled: false, muted: true, hint: '写作推进后逐步参与' };
	}
	return {
		disabled: false,
		muted: false,
		hint: mode === 'works'
			? '继续当前写作任务'
			: mode === 'planning'
				? '规划故事接下来怎样发展'
				: mode === 'references'
					? '管理当前相关和长期故事信息'
					: mode === 'review'
						? '检查并整理作品'
						: '查看版本、快照与恢复记录'
	};
}

export function isLongformLibraryTool(
	stage: AuthorProductStage
): boolean {
	return stage === 'draft' || stage === 'longform';
}
