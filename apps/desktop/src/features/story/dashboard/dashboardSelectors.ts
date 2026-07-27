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
	kernel: DashboardKernelData
): StoryDashboardModel {
	const chapters = flattenChapters(snapshot.project);
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
		recentChapter: chapters[0],
		recentChapters: chapters.slice(0, 3),
		activePlotThreads,
		overdueForeshadowing,
		openReviewIssues,
		pendingFacts,
		pendingTotal: overdueForeshadowing + openReviewIssues + pendingFacts
	};
}
