import { EditTransactionService } from '@writing-buddy/project';
import {
	parseReviewState,
	ReviewResolutionService,
	runLocalReview,
	serializeReviewState
} from './index';

describe('local review', () => {
	it('finds deterministic issues and accepts, restores and marks stale', () => {
		const content = '夜雨落下。。  林墨推开门。';
		const result = runLocalReview('project', 'chapter', content);
		expect(result.issues.map(issue => issue.ruleId)).toEqual(['duplicate-punctuation', 'suspicious-whitespace']);
		const service = new ReviewResolutionService(new EditTransactionService());
		const accepted = service.accept(result.issues[0], content);
		expect(accepted.issue.status).toBe('accepted');
		expect(accepted.content).toBe('夜雨落下。  林墨推开门。');
		const restored = service.restore(accepted.issue, accepted.content);
		expect(restored).toMatchObject({ issue: { status: 'open' }, content });
		const stale = service.accept(result.issues[0], '完全不同的正文');
		expect(stale.issue.status).toBe('stale');
	});

	it('restores accepted and ignored issues after an application restart', () => {
		const content = '一句话。。';
		const issue = runLocalReview('project', 'chapter', content).issues[0];
		expect(issue).toBeDefined();
		if (!issue) {
			return;
		}
		const accepted = new ReviewResolutionService(new EditTransactionService()).accept(issue, content);
		const restarted = new ReviewResolutionService(new EditTransactionService());
		expect(restarted.restore(accepted.issue, accepted.content)).toMatchObject({
			issue: { status: 'open' },
			content
		});
		const ignored = restarted.ignore(issue);
		expect(restarted.restore(ignored, content)).toMatchObject({
			issue: { status: 'open' },
			content
		});
	});

	it('serializes only complete Next review state', () => {
		const issue = runLocalReview('project', 'chapter', '一句话。。').issues[0];
		const serialized = serializeReviewState(issue ? [issue] : []);
		expect(parseReviewState(serialized).issues).toHaveLength(1);
		expect(() => parseReviewState('{"schemaVersion":1,"issues":[{"id":"legacy"}]}')).toThrow('reviewStateInvalid');
	});
});
