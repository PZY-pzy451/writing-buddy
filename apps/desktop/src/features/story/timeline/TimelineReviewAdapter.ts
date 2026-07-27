import type {
	RuleEvidencePosition,
	RuleIssue
} from '@writing-buddy/story-kernel';
import {
	createTextAnchor,
	type ReviewIssue
} from '@writing-buddy/review';

export interface ResolvedRuleEvidence {
	readonly resourceId: string;
	readonly content: string;
	readonly start: number;
	readonly end: number;
}

export type RuleEvidenceResolver = (
	evidence: RuleEvidencePosition
) => ResolvedRuleEvidence | undefined;

export function timelineRuleIssueToReviewIssues(
	projectId: string,
	issue: RuleIssue,
	resolveEvidence: RuleEvidenceResolver,
	now = new Date().toISOString()
): readonly ReviewIssue[] {
	return issue.evidence.flatMap((evidence, index) => {
		const resolved = resolveEvidence(evidence);
		if (!resolved) {
			return [];
		}
		return [{
			id: `${issue.id}:evidence-${index + 1}`,
			projectId,
			resourceId: resolved.resourceId,
			ruleId: issue.ruleId,
			severity: issue.severity,
			status: 'open',
			title: issue.title,
			message: `${issue.message}（相关位置 ${index + 1}/${issue.evidence.length}）`,
			anchor: createTextAnchor(
				resolved.content,
				resolved.start,
				resolved.end
			),
			createdAt: now,
			updatedAt: now,
			origin: 'local'
		} satisfies ReviewIssue];
	});
}
