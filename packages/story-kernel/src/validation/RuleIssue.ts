import type { TimelineEvent } from '../model/TimelineEvent';

export type TimelineRuleId =
	| 'timeline.impossible-overlap'
	| 'timeline.predecessor-inversion'
	| 'location.insufficient-travel-time';

export interface RuleEvidencePosition {
	readonly eventId: string;
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly storyTime?: string;
	readonly evidenceIds: readonly string[];
}

export interface RuleIssue {
	readonly id: string;
	readonly ruleId: TimelineRuleId;
	readonly severity: 'warning' | 'error';
	readonly title: string;
	readonly message: string;
	readonly evidence: readonly RuleEvidencePosition[];
}

export function ruleEvidenceFor(event: TimelineEvent): RuleEvidencePosition {
	return {
		eventId: event.id,
		chapterId: event.narrativePosition.chapterId,
		...(event.narrativePosition.sceneId ? { sceneId: event.narrativePosition.sceneId } : {}),
		...(event.storyStart ? { storyTime: event.storyStart } : {}),
		evidenceIds: event.evidenceIds
	};
}

export function stableRuleIssueId(
	ruleId: TimelineRuleId,
	eventIds: readonly string[]
): string {
	const normalized = eventIds
		.slice()
		.sort()
		.map(id => id.replace(/[^a-z0-9-]/giu, '-'))
		.join('--');
	return `rule-issue:${ruleId.replace('.', '-')}:${normalized}`;
}
