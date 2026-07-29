import {
	flattenChapters,
	type ChapterDescriptor
} from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import type { ReviewIssue } from '@writing-buddy/review';

export interface DashboardStoryItem {
	readonly id: string;
	readonly title: string;
	readonly tags: readonly string[];
}

export interface DashboardKernelData {
	readonly plotThreads: readonly DashboardStoryItem[];
	readonly foreshadowing: readonly DashboardStoryItem[];
	readonly pendingFacts: readonly DashboardStoryItem[];
}

export interface StoryDashboardModel {
	readonly title: string;
	readonly chapterCount: number;
	readonly totalWords: number;
	readonly recentChapter?: ChapterDescriptor;
	readonly recentChapters: readonly ChapterDescriptor[];
	readonly activePlotThreads: readonly DashboardStoryItem[];
	readonly overdueForeshadowing: number;
	readonly openReviewIssues: number;
	readonly pendingFacts: number;
	readonly pendingTotal: number;
}

export function selectStoryDashboardModel(
	snapshot: ProjectSnapshot,
	issues: readonly ReviewIssue[],
	kernel: DashboardKernelData,
	preferredChapterId?: string
): StoryDashboardModel {
	const chapters = flattenChapters(snapshot.project);
	const recentChapter = chapters.find(chapter => chapter.id === preferredChapterId)
		?? chapters[0];
	const recentChapters = recentChapter
		? [
				recentChapter,
				...chapters.filter(chapter => chapter.id !== recentChapter.id)
			].slice(0, 3)
		: [];
	const totalWords = chapters.reduce(
		(total, chapter) => total + (snapshot.wordCounts[chapter.id] ?? 0),
		0
	);
	const activePlotThreads = kernel.plotThreads.filter(thread => (
		thread.tags.length === 0 || thread.tags.includes('active')
	));
	const overdueForeshadowing = kernel.foreshadowing.filter(item => (
		item.tags.includes('overdue')
	)).length;
	const openReviewIssues = issues.filter(issue => issue.status === 'open').length;
	const pendingFacts = kernel.pendingFacts.filter(item => (
		item.tags.length === 0 || item.tags.includes('pending-confirmation')
	)).length;

	return {
		title: snapshot.project.title,
		chapterCount: chapters.length,
		totalWords,
		recentChapter,
		recentChapters,
		activePlotThreads,
		overdueForeshadowing,
		openReviewIssues,
		pendingFacts,
		pendingTotal: overdueForeshadowing + openReviewIssues + pendingFacts
	};
}
