import { describe, expect, it } from 'vitest';
import type { RuleIssue } from '@writing-buddy/story-kernel';
import { timelineRuleIssueToReviewIssues } from './TimelineReviewAdapter';

const issue: RuleIssue = {
	id: 'rule-issue:overlap:a:b',
	ruleId: 'timeline.impossible-overlap',
	severity: 'error',
	title: '人物同时出现在两个地点',
	message: '林越的两个事件时间重叠。',
	evidence: [{
		eventId: 'timeline-event:a',
		chapterId: 'chapter:chapter-001',
		sceneId: 'scene:scene-001',
		storyTime: '2026-07-27T10:00:00.000Z',
		evidenceIds: ['evidence:a']
	}, {
		eventId: 'timeline-event:b',
		chapterId: 'chapter:chapter-002',
		sceneId: 'scene:scene-002',
		storyTime: '2026-07-27T10:30:00.000Z',
		evidenceIds: ['evidence:b']
	}]
};

describe('TimelineReviewAdapter', () => {
	it('maps every rule evidence position to a locatable review issue', () => {
		const reviews = timelineRuleIssueToReviewIssues(
			'project-one',
			issue,
			evidence => ({
				resourceId: evidence.chapterId.replace('chapter:', ''),
				content: `事件：${evidence.eventId}`,
				start: 0,
				end: 2
			})
		);

		expect(reviews).toHaveLength(2);
		expect(reviews.map(review => review.resourceId)).toEqual(['chapter-001', 'chapter-002']);
		expect(reviews.every(review => review.ruleId === issue.ruleId)).toBe(true);
	});
});
