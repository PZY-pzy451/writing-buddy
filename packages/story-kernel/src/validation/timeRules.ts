import type { TimelineEvent } from '../model/TimelineEvent';
import { storyTimeMilliseconds } from '../query/TimelineQuery';
import { elapsedMinutes, minimumTravelMinutes, type TravelLinkRule } from './locationRules';
import {
	ruleEvidenceFor,
	stableRuleIssueId,
	type RuleIssue
} from './RuleIssue';

export interface TimelineRuleSnapshot {
	readonly events: readonly TimelineEvent[];
	readonly travelLinks: readonly TravelLinkRule[];
}

interface EventInterval {
	readonly event: TimelineEvent;
	readonly start: number;
	readonly end: number;
}

function eventInterval(event: TimelineEvent): EventInterval | undefined {
	const start = storyTimeMilliseconds(event.storyStart)
		?? storyTimeMilliseconds(event.uncertainRange?.earliest);
	if (start === undefined) {
		return undefined;
	}
	const end = storyTimeMilliseconds(event.storyEnd)
		?? storyTimeMilliseconds(event.uncertainRange?.latest)
		?? start;
	return { event, start, end: Math.max(start, end) };
}

function intersects(left: EventInterval, right: EventInterval): boolean {
	return left.start <= right.end && right.start <= left.end;
}

function sharesValue(left: readonly string[], right: readonly string[]): boolean {
	return left.some(value => right.includes(value));
}

function differentKnownLocations(left: TimelineEvent, right: TimelineEvent): boolean {
	return left.locationIds.length > 0
		&& right.locationIds.length > 0
		&& !sharesValue(left.locationIds, right.locationIds);
}

function overlapIssues(intervals: readonly EventInterval[]): readonly RuleIssue[] {
	const issues: RuleIssue[] = [];
	for (let leftIndex = 0; leftIndex < intervals.length; leftIndex += 1) {
		const left = intervals[leftIndex];
		if (!left) {
			continue;
		}
		for (let rightIndex = leftIndex + 1; rightIndex < intervals.length; rightIndex += 1) {
			const right = intervals[rightIndex];
			if (
				!right
				|| !intersects(left, right)
				|| !sharesValue(left.event.participantIds, right.event.participantIds)
				|| !differentKnownLocations(left.event, right.event)
			) {
				continue;
			}
			const participant = left.event.participantIds.find(id => right.event.participantIds.includes(id));
			issues.push({
				id: stableRuleIssueId('timeline.impossible-overlap', [left.event.id, right.event.id]),
				ruleId: 'timeline.impossible-overlap',
				severity: 'error',
				title: '人物同时出现在两个地点',
				message: `${participant ?? '同一人物'}参与的“${left.event.title}”与“${right.event.title}”时间重叠，但地点不同。`,
				evidence: [ruleEvidenceFor(left.event), ruleEvidenceFor(right.event)]
			});
		}
	}
	return issues;
}

function predecessorIssues(
	events: readonly TimelineEvent[],
	intervalById: ReadonlyMap<string, EventInterval>
): readonly RuleIssue[] {
	const issues: RuleIssue[] = [];
	for (const event of events) {
		const current = intervalById.get(event.id);
		if (!current) {
			continue;
		}
		for (const predecessorId of event.predecessorIds) {
			const predecessor = intervalById.get(predecessorId);
			if (!predecessor || current.start >= predecessor.end) {
				continue;
			}
			issues.push({
				id: stableRuleIssueId('timeline.predecessor-inversion', [predecessor.event.id, event.id]),
				ruleId: 'timeline.predecessor-inversion',
				severity: 'error',
				title: '事件早于前置事件',
				message: `“${event.title}”在前置事件“${predecessor.event.title}”结束前已经发生。`,
				evidence: [ruleEvidenceFor(predecessor.event), ruleEvidenceFor(event)]
			});
		}
	}
	return issues;
}

function travelIssues(
	intervals: readonly EventInterval[],
	links: readonly TravelLinkRule[]
): readonly RuleIssue[] {
	const byParticipant = new Map<string, EventInterval[]>();
	for (const interval of intervals) {
		for (const participantId of interval.event.participantIds) {
			byParticipant.set(participantId, [...(byParticipant.get(participantId) ?? []), interval]);
		}
	}
	const issues: RuleIssue[] = [];
	for (const [participantId, participantEvents] of byParticipant) {
		const ordered = participantEvents.slice().sort((left, right) => left.start - right.start);
		for (let index = 1; index < ordered.length; index += 1) {
			const previous = ordered[index - 1];
			const current = ordered[index];
			const from = previous?.event.locationIds[0];
			const to = current?.event.locationIds[0];
			if (!previous || !current || !from || !to || from === to || current.start < previous.end) {
				continue;
			}
			const required = minimumTravelMinutes(links, from, to);
			if (required === undefined) {
				continue;
			}
			const available = elapsedMinutes(previous.end, current.start);
			if (available >= required) {
				continue;
			}
			issues.push({
				id: stableRuleIssueId('location.insufficient-travel-time', [previous.event.id, current.event.id]),
				ruleId: 'location.insufficient-travel-time',
				severity: 'warning',
				title: '移动时间不足',
				message: `${participantId}从 ${from} 到 ${to} 至少需要 ${required} 分钟，两个事件之间仅有 ${available} 分钟。`,
				evidence: [ruleEvidenceFor(previous.event), ruleEvidenceFor(current.event)]
			});
		}
	}
	return issues;
}

export function runTimelineRules(snapshot: TimelineRuleSnapshot): readonly RuleIssue[] {
	const intervals = snapshot.events
		.map(eventInterval)
		.filter((interval): interval is EventInterval => interval !== undefined);
	const intervalById = new Map(intervals.map(interval => [interval.event.id, interval]));
	return [
		...overlapIssues(intervals),
		...predecessorIssues(snapshot.events, intervalById),
		...travelIssues(intervals, snapshot.travelLinks)
	].sort((left, right) => left.id.localeCompare(right.id));
}
