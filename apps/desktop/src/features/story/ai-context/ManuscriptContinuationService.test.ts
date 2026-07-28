import { EditTransactionService } from '@writing-buddy/project';
import {
	ContinuationService,
	createContinuationCandidate,
	isContinuationCandidateStale
} from './ManuscriptContinuationService';

function candidate() {
	return createContinuationCandidate({
		mode: 'continue-paragraph',
		resourceId: 'chapter:one',
		sourceRevision: 4,
		cursorOffset: 7,
		currentContent: '雨落在站台。',
		response: {
			candidates: [{
				title: '继续',
				content: '林越抬起头，钟声正从雾里靠近。',
				rationale: '延续当前感官线索。'
			}]
		}
	});
}

describe('ContinuationService', () => {
	it('inserts only the author-selected candidate and supports undo', () => {
		const current = '雨落在站台。';
		const service = new ContinuationService(new EditTransactionService());
		const value = candidate();
		const applied = service.accept(value, value.candidates[0].id, 4, current);
		expect(applied.insertion).toBe('\n\n林越抬起头，钟声正从雾里靠近。');
		expect(applied.content).toBe(`${current}${applied.insertion}`);
		expect(service.undo(applied.content).content).toBe(current);
	});

	it('blocks insertion after revision or cursor-anchor changes', () => {
		const value = candidate();
		expect(isContinuationCandidateStale(value, 5, '雨落在站台。')).toBe(true);
		expect(isContinuationCandidateStale(value, 4, '雨落在别处。')).toBe(true);
		expect(() => new ContinuationService(new EditTransactionService())
			.accept(value, value.candidates[0].id, 4, '雨落在别处。'))
			.toThrow('staleContinuationCandidate');
	});
});
