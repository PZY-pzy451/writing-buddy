import { describe, expect, it } from 'vitest';
import { EditTransactionService } from '@writing-buddy/project';
import { buildContextPack } from '@writing-buddy/story-kernel';
import {
	createRewriteCandidate,
	isRewriteCandidateStale,
	SelectionRewriteService
} from './SelectionRewriteService';

function candidate() {
	const pack = buildContextPack({
		actionType: 'polish',
		instruction: '润色',
		selection: { text: '非常非常安静', resourceId: 'chapter:one', revision: 4, start: 2, end: 8 },
		candidates: [],
		budgetTokens: 512
	});
	return createRewriteCandidate({
		pack,
		response: {
			suggestion: '格外安静',
			rationale: '删除重复表达。',
			potentialImpact: '不改变情节。'
		}
	});
}

describe('SelectionRewriteService', () => {
	it('accepts an author-confirmed candidate and supports undo', () => {
		const service = new SelectionRewriteService(new EditTransactionService());
		const current = '夜里非常非常安静。';
		const applied = service.accept(candidate(), 4, current);
		expect(applied.content).toBe('夜里格外安静。');
		expect(service.undo(applied.content).content).toBe(current);
	});

	it('accepts an edited partial candidate', () => {
		const current = '夜里非常非常安静。';
		const applied = new SelectionRewriteService(new EditTransactionService())
			.accept(candidate(), 4, current, '很安静');
		expect(applied.content).toBe('夜里很安静。');
	});

	it('marks candidates stale after revision or source text changes', () => {
		const value = candidate();
		expect(isRewriteCandidateStale(value, 5, '夜里非常非常安静。')).toBe(true);
		expect(() => new SelectionRewriteService(new EditTransactionService())
			.accept(value, 4, '夜里并不安静。')).toThrow('staleRewriteCandidate');
	});
});
