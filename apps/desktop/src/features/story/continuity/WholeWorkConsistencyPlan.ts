import {
	AI_CHAPTER_REVIEW_MAX_CHARS,
	type StoryConsistencySourceInput
} from '@writing-buddy/ai';
import type { ReviewIssue } from '@writing-buddy/review';

export const WHOLE_WORK_MAX_SOURCES_PER_BATCH = 12;
export const WHOLE_WORK_MAX_CHARS_PER_BATCH = 160_000;
export const WHOLE_WORK_MAX_BATCHES = 8;

export interface WholeWorkConsistencySource extends StoryConsistencySourceInput {
	readonly title: string;
}

export interface WholeWorkConsistencyPlan {
	readonly batches: readonly (readonly WholeWorkConsistencySource[])[];
	readonly writtenChapterCount: number;
	readonly skippedEmptyCount: number;
	readonly overlapCount: number;
	readonly totalCharacters: number;
}

export type WholeWorkConsistencyPlanErrorCode =
	| 'notEnoughWrittenChapters'
	| 'chapterTooLong'
	| 'chaptersCannotShareBatch'
	| 'tooManyBatches';

export class WholeWorkConsistencyPlanError extends Error {
	constructor(
		readonly code: WholeWorkConsistencyPlanErrorCode,
		readonly chapterTitle?: string
	) {
		super(code);
		this.name = 'WholeWorkConsistencyPlanError';
	}
}

function canAdd(
	batch: readonly WholeWorkConsistencySource[],
	candidate: WholeWorkConsistencySource,
	characterCount: number
): boolean {
	return batch.length < WHOLE_WORK_MAX_SOURCES_PER_BATCH
		&& characterCount + candidate.content.length <= WHOLE_WORK_MAX_CHARS_PER_BATCH;
}

export function planWholeWorkConsistency(
	sources: readonly WholeWorkConsistencySource[]
): WholeWorkConsistencyPlan {
	const written = sources.filter(source => source.content.trim());
	const skippedEmptyCount = sources.length - written.length;
	if (written.length < 2) {
		throw new WholeWorkConsistencyPlanError('notEnoughWrittenChapters');
	}
	const oversized = written.find(source => source.content.length > AI_CHAPTER_REVIEW_MAX_CHARS);
	if (oversized) {
		throw new WholeWorkConsistencyPlanError('chapterTooLong', oversized.title);
	}

	const batches: WholeWorkConsistencySource[][] = [];
	let cursor = 0;
	let overlapCount = 0;
	while (cursor < written.length) {
		const batch: WholeWorkConsistencySource[] = [];
		let characterCount = 0;
		let usedOverlap = false;
		const previous = cursor > 0 ? written[cursor - 1] : undefined;
		const current = written[cursor];
		if (
			previous
			&& current
			&& previous.content.length + current.content.length <= WHOLE_WORK_MAX_CHARS_PER_BATCH
		) {
			batch.push(previous);
			characterCount += previous.content.length;
			usedOverlap = true;
		}

		const firstNewIndex = cursor;
		while (cursor < written.length) {
			const candidate = written[cursor];
			if (!candidate || !canAdd(batch, candidate, characterCount)) break;
			batch.push(candidate);
			characterCount += candidate.content.length;
			cursor += 1;
		}

		if (cursor === firstNewIndex || batch.length < 2) {
			throw new WholeWorkConsistencyPlanError(
				'chaptersCannotShareBatch',
				written[firstNewIndex]?.title
			);
		}
		if (usedOverlap) overlapCount += 1;
		batches.push(batch);
		if (batches.length > WHOLE_WORK_MAX_BATCHES) {
			throw new WholeWorkConsistencyPlanError('tooManyBatches');
		}
	}

	return {
		batches,
		writtenChapterCount: written.length,
		skippedEmptyCount,
		overlapCount,
		totalCharacters: written.reduce((total, source) => total + source.content.length, 0)
	};
}

export function toStoryConsistencySources(
	batch: readonly WholeWorkConsistencySource[]
): readonly StoryConsistencySourceInput[] {
	return batch.map(source => ({
		resourceId: source.resourceId,
		sourceRevision: source.sourceRevision,
		content: source.content
	}));
}

export function deduplicateStoryConsistencyIssues(
	issues: readonly ReviewIssue[]
): readonly ReviewIssue[] {
	return [...new Map(issues.map(issue => [issue.id, issue])).values()];
}
