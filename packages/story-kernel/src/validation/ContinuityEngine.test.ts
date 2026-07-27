import { describe, expect, it } from 'vitest';
import {
	aggregateContinuityIssues,
	resolveContinuityIssue,
	type ContinuityCandidate
} from './ContinuityEngine';

const first: ContinuityCandidate = {
	sourceId: 'local-1',
	layer: 'text-rule',
	ruleId: 'continuity.location',
	severity: 'warning',
	title: '地点不一致',
	message: '人物在相邻场景中出现在不同地点。',
	dedupeKey: 'location:lin',
	evidence: [{
		id: 'evidence-1',
		resourceId: 'chapter:one',
		start: 2,
		end: 5,
		quote: '旧车站',
		expectedRevision: 'rev-1',
		label: '第一处'
	}]
};

describe('ContinuityEngine', () => {
	it('deduplicates candidates and keeps multiple layers and evidence sources', () => {
		const issues = aggregateContinuityIssues({
			candidates: [
				first,
				{
					...first,
					sourceId: 'kernel-1',
					layer: 'story-kernel',
					severity: 'error',
					evidence: [{
						id: 'evidence-2',
						resourceId: 'chapter:two',
						start: 8,
						end: 10,
						quote: '港口',
						label: '第二处'
					}]
				}
			],
			now: '2026-07-27T09:00:00.000Z'
		});
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			severity: 'error',
			layers: ['text-rule', 'story-kernel']
		});
		expect(issues[0]?.evidence).toHaveLength(2);
	});

	it('marks evidence stale when its source revision changed', () => {
		expect(aggregateContinuityIssues({
			candidates: [first],
			currentRevisions: { 'chapter:one': 'rev-2' }
		})[0]?.status).toBe('stale');
	});

	it('caps AI-only findings at warning and preserves resolution state', () => {
		const [generated] = aggregateContinuityIssues({
			candidates: [{ ...first, sourceId: 'ai-1', layer: 'ai', severity: 'error' }],
			now: '2026-07-27T09:00:00.000Z'
		});
		if (!generated) throw new Error('fixtureIssueMissing');
		const resolved = resolveContinuityIssue(generated, 'resolved', '2026-07-27T09:01:00.000Z');
		const [rerun] = aggregateContinuityIssues({
			candidates: [{ ...first, sourceId: 'ai-1', layer: 'ai', severity: 'error' }],
			previous: [resolved],
			now: '2026-07-27T09:02:00.000Z'
		});
		expect(rerun).toMatchObject({ severity: 'warning', status: 'resolved' });
	});
});
