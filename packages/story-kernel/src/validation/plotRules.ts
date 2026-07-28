import type { Foreshadowing } from '../model/Foreshadowing';
import type { PlotThread } from '../model/PlotThread';
import type { StoryPosition } from '../model/StoryPosition';
import type { RuleEvidencePosition, RuleIssue } from './RuleIssue';
import { stableRuleIssueId } from './RuleIssue';

function evidenceFor(
	resource: PlotThread | Foreshadowing,
	position?: StoryPosition
): RuleEvidencePosition {
	return {
		eventId: resource.id,
		chapterId: position?.chapterId ?? 'chapter:unassigned',
		...(position?.sceneId ? { sceneId: position.sceneId } : {}),
		...(position?.storyTime ? { storyTime: position.storyTime } : {}),
		evidenceIds: resource.evidenceIds
	};
}

export function runPlotRules(
	threads: readonly PlotThread[],
	foreshadowing: readonly Foreshadowing[],
	currentNarrativeOrder: number
): readonly RuleIssue[] {
	const issues: RuleIssue[] = [];
	for (const thread of threads) {
		if (
			['planned', 'active', 'at-risk'].includes(thread.status)
			&& thread.targetResolution
			&& thread.targetResolution.narrativeOrder < currentNarrativeOrder
		) {
			issues.push({
				id: stableRuleIssueId('plot.thread-at-risk', [thread.id]),
				ruleId: 'plot.thread-at-risk',
				severity: 'warning',
				title: '剧情线超过计划解决位置',
				message: `${thread.title} 尚未解决，计划位置已过去。`,
				evidence: [evidenceFor(thread, thread.targetResolution)]
			});
		}
	}
	for (const clue of foreshadowing) {
		if (
			clue.actualPayoffAt
			&& clue.plannedPayoffAt
			&& clue.actualPayoffAt.narrativeOrder < clue.plannedPayoffAt.narrativeOrder
		) {
			issues.push({
				id: stableRuleIssueId('plot.foreshadowing-early-payoff', [clue.id]),
				ruleId: 'plot.foreshadowing-early-payoff',
				severity: 'warning',
				title: '伏笔早于计划位置回收',
				message: `${clue.title} 的实际回收早于作者计划位置，请确认是否提前泄露。`,
				evidence: [
					evidenceFor(clue, clue.actualPayoffAt),
					evidenceFor(clue, clue.plannedPayoffAt)
				]
			});
		}
		if (
			!['resolved', 'abandoned'].includes(clue.status)
			&& clue.plannedPayoffAt
			&& clue.plannedPayoffAt.narrativeOrder < currentNarrativeOrder
		) {
			issues.push({
				id: stableRuleIssueId('plot.foreshadowing-overdue', [clue.id]),
				ruleId: 'plot.foreshadowing-overdue',
				severity: 'warning',
				title: '伏笔超过计划回收位置',
				message: `${clue.title} 尚未完成实际回收。`,
				evidence: [
					evidenceFor(clue, clue.plantedAt),
					evidenceFor(clue, clue.plannedPayoffAt)
				]
			});
		}
	}
	return issues;
}
