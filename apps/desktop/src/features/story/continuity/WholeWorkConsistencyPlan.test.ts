import { describe, expect, it } from 'vitest';
import type { ReviewIssue } from '@writing-buddy/review';
import type { WholeWorkConsistencyPlanError } from './WholeWorkConsistencyPlan';
import {
	deduplicateStoryConsistencyIssues,
	planWholeWorkConsistency,
	toStoryConsistencySources
} from './WholeWorkConsistencyPlan';

function source(index: number, length = 10): {
	readonly resourceId: `chapter:chapter-${number}`;
	readonly sourceRevision: string;
	readonly content: string;
	readonly title: string;
} {
	return {
		resourceId: `chapter:chapter-${index}`,
		sourceRevision: `revision-${index}`,
		content: '章'.repeat(length),
		title: `第 ${index} 章`
	};
}

describe('whole-work consistency batch plan', () => {
	it('covers manuscript order and overlaps the chapter at a 12-source boundary', () => {
		const plan = planWholeWorkConsistency(Array.from({ length: 13 }, (_, index) => source(index + 1)));

		expect(plan.batches).toHaveLength(2);
		expect(plan.batches[0]).toHaveLength(12);
		expect(plan.batches[1].map(item => item.title)).toEqual(['第 12 章', '第 13 章']);
		expect(plan).toMatchObject({ writtenChapterCount: 13, overlapCount: 1, skippedEmptyCount: 0 });
	});

	it('uses aggregate character limits and reports empty chapters without sending them', () => {
		const plan = planWholeWorkConsistency([
			source(1, 80_000),
			source(2, 80_000),
			{ ...source(3), content: '   ' }
		]);

		expect(plan.batches).toHaveLength(1);
		expect(plan.skippedEmptyCount).toBe(1);
		expect(plan.totalCharacters).toBe(160_000);
	});

	it('fails before execution when one written chapter exceeds the native contract', () => {
		expect(() => planWholeWorkConsistency([
			source(1, 100_001),
			source(2)
		])).toThrowError(expect.objectContaining<Partial<WholeWorkConsistencyPlanError>>({
			code: 'chapterTooLong',
			chapterTitle: '第 1 章'
		}));
	});

	it('fails when an entire written work cannot fit in eight bounded requests', () => {
		expect(() => planWholeWorkConsistency(
			Array.from({ length: 91 }, (_, index) => source(index + 1))
		)).toThrowError(expect.objectContaining<Partial<WholeWorkConsistencyPlanError>>({
			code: 'tooManyBatches'
		}));
	});

	it('strips display-only titles and deduplicates overlap findings', () => {
		const stripped = toStoryConsistencySources([source(1), source(2)]);
		expect(stripped[0]).not.toHaveProperty('title');
		const issue = { id: 'ai-continuity:same' } as ReviewIssue;
		expect(deduplicateStoryConsistencyIssues([issue, issue])).toEqual([issue]);
	});
});
