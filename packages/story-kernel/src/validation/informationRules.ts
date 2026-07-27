import type { StoryInformation } from '../model/StoryInformation';
import type { RuleIssue } from './RuleIssue';
import { stableRuleIssueId } from './RuleIssue';

export function runInformationRules(information: readonly StoryInformation[]): readonly RuleIssue[] {
	return information.flatMap(fact => {
		if (
			!fact.truthEffectiveFrom
			|| !fact.readerRevealAt
			|| fact.readerRevealAt.narrativeOrder >= fact.truthEffectiveFrom.narrativeOrder
		) {
			return [];
		}
		return [{
			id: stableRuleIssueId('information.premature-reveal', [fact.id]),
			ruleId: 'information.premature-reveal',
			severity: 'warning',
			title: '读者揭示早于事实生效',
			message: `“${fact.title}”计划在事实成立前向读者揭示，请核对叙事顺序。`,
			evidence: [{
				eventId: fact.id,
				chapterId: fact.readerRevealAt.chapterId,
				...(fact.readerRevealAt.sceneId ? { sceneId: fact.readerRevealAt.sceneId } : {}),
				...(fact.readerRevealAt.storyTime ? { storyTime: fact.readerRevealAt.storyTime } : {}),
				evidenceIds: fact.evidenceIds
			}]
		} satisfies RuleIssue];
	});
}
