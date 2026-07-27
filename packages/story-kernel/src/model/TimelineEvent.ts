import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export type StoryTimeKind = 'exact' | 'date' | 'relative' | 'range' | 'unknown';

export interface RelativeStoryTime {
	readonly anchorEventId: StoryId;
	readonly offsetMinutes: number;
}

export interface UncertainStoryTimeRange {
	readonly earliest?: string;
	readonly latest?: string;
}

export interface TimelineEvent extends StoryResourceBase {
	readonly type: 'timelineEvent';
	readonly storyStart?: string;
	readonly storyEnd?: string;
	readonly storyTimeKind: StoryTimeKind;
	readonly relativeTime?: RelativeStoryTime;
	readonly uncertainRange?: UncertainStoryTimeRange;
	readonly narrativePosition: StoryPosition;
	readonly eventType: string;
	readonly participantIds: readonly StoryId[];
	readonly locationIds: readonly StoryId[];
	readonly itemIds: readonly StoryId[];
	readonly predecessorIds: readonly StoryId[];
	readonly consequenceIds: readonly StoryId[];
	readonly plotThreadIds: readonly StoryId[];
	readonly informationIds: readonly StoryId[];
	readonly evidenceIds: readonly StoryId[];
}

interface PositionInput {
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly narrativeOrder: number;
	readonly storyTime?: string;
}

interface TimelineEventInput {
	readonly id: string;
	readonly type: 'timelineEvent';
	readonly title: string;
	readonly aliases: readonly string[];
	readonly summary?: string;
	readonly tags: readonly string[];
	readonly schemaVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly revision: number;
	readonly storyStart?: string;
	readonly storyEnd?: string;
	readonly storyTimeKind?: StoryTimeKind;
	readonly relativeTime?: {
		readonly anchorEventId: string;
		readonly offsetMinutes: number;
	};
	readonly uncertainRange?: {
		readonly earliest?: string;
		readonly latest?: string;
	};
	readonly narrativePosition: PositionInput;
	readonly eventType: string;
	readonly participantIds: readonly string[];
	readonly locationIds: readonly string[];
	readonly itemIds: readonly string[];
	readonly predecessorIds: readonly string[];
	readonly consequenceIds: readonly string[];
	readonly plotThreadIds?: readonly string[];
	readonly informationIds?: readonly string[];
	readonly evidenceIds: readonly string[];
}

function inferStoryTimeKind(value: TimelineEventInput): StoryTimeKind {
	if (value.storyTimeKind) {
		return value.storyTimeKind;
	}
	if (value.relativeTime) {
		return 'relative';
	}
	if (value.uncertainRange) {
		return 'range';
	}
	if (!value.storyStart) {
		return 'unknown';
	}
	return /^\d{4}-\d{2}-\d{2}$/u.test(value.storyStart) ? 'date' : 'exact';
}

function validDateOrder(start?: string, end?: string): boolean {
	if (!start || !end) {
		return true;
	}
	const startMs = Date.parse(start);
	const endMs = Date.parse(end);
	return Number.isNaN(startMs) || Number.isNaN(endMs) || endMs >= startMs;
}

export function parseTimelineEvent(value: TimelineEventInput): TimelineEvent {
	const base = parseStoryResourceBase(value);
	if (!value.eventType.trim()) {
		throw new Error('invalidTimelineEventType');
	}
	if (!validDateOrder(value.storyStart, value.storyEnd)) {
		throw new Error('invalidTimelineEventInterval');
	}
	if (
		value.relativeTime
		&& (!Number.isFinite(value.relativeTime.offsetMinutes)
			|| value.relativeTime.anchorEventId === value.id)
	) {
		throw new Error('invalidRelativeStoryTime');
	}
	const storyTimeKind = inferStoryTimeKind(value);
	return {
		...base,
		type: 'timelineEvent',
		...(value.storyStart ? { storyStart: value.storyStart } : {}),
		...(value.storyEnd ? { storyEnd: value.storyEnd } : {}),
		storyTimeKind,
		...(value.relativeTime ? {
			relativeTime: {
				anchorEventId: parseStoryId(value.relativeTime.anchorEventId),
				offsetMinutes: value.relativeTime.offsetMinutes
			}
		} : {}),
		...(value.uncertainRange ? {
			uncertainRange: {
				...(value.uncertainRange.earliest ? { earliest: value.uncertainRange.earliest } : {}),
				...(value.uncertainRange.latest ? { latest: value.uncertainRange.latest } : {})
			}
		} : {}),
		narrativePosition: parseStoryPosition(value.narrativePosition),
		eventType: value.eventType.trim(),
		participantIds: value.participantIds.map(parseStoryId),
		locationIds: value.locationIds.map(parseStoryId),
		itemIds: value.itemIds.map(parseStoryId),
		predecessorIds: value.predecessorIds.map(parseStoryId),
		consequenceIds: value.consequenceIds.map(parseStoryId),
		plotThreadIds: (value.plotThreadIds ?? []).map(parseStoryId),
		informationIds: (value.informationIds ?? []).map(parseStoryId),
		evidenceIds: value.evidenceIds.map(parseStoryId)
	};
}
