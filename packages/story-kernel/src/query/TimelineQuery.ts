import type { TimelineEvent } from '../model/TimelineEvent';

export type TimelineMode = 'story-time' | 'narrative-order';

export interface TimelineWindow {
	readonly start?: string | number;
	readonly end?: string | number;
}

export interface TimelineFilters {
	readonly participantIds?: readonly string[];
	readonly locationIds?: readonly string[];
	readonly itemIds?: readonly string[];
	readonly plotThreadIds?: readonly string[];
	readonly eventTypes?: readonly string[];
}

function overlaps(values: readonly string[], filter?: readonly string[]): boolean {
	return !filter?.length || filter.some(value => values.includes(value));
}

function matchesFilters(event: TimelineEvent, filters: TimelineFilters): boolean {
	return overlaps(event.participantIds, filters.participantIds)
		&& overlaps(event.locationIds, filters.locationIds)
		&& overlaps(event.itemIds, filters.itemIds)
		&& overlaps(event.plotThreadIds, filters.plotThreadIds)
		&& (!filters.eventTypes?.length || filters.eventTypes.includes(event.eventType));
}

export function storyTimeMilliseconds(value?: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function inWindow(
	event: TimelineEvent,
	window: TimelineWindow,
	mode: TimelineMode
): boolean {
	if (mode === 'narrative-order') {
		const start = typeof window.start === 'number' ? window.start : undefined;
		const end = typeof window.end === 'number' ? window.end : undefined;
		return (start === undefined || event.narrativePosition.narrativeOrder >= start)
			&& (end === undefined || event.narrativePosition.narrativeOrder <= end);
	}
	if (window.start === undefined && window.end === undefined) {
		return true;
	}
	const eventStart = storyTimeMilliseconds(event.storyStart);
	if (eventStart === undefined) {
		return false;
	}
	const eventEnd = storyTimeMilliseconds(event.storyEnd) ?? eventStart;
	const start = typeof window.start === 'string'
		? storyTimeMilliseconds(window.start)
		: undefined;
	const end = typeof window.end === 'string'
		? storyTimeMilliseconds(window.end)
		: undefined;
	return (start === undefined || eventEnd >= start)
		&& (end === undefined || eventStart <= end);
}

export function queryEvents(
	events: readonly TimelineEvent[],
	window: TimelineWindow,
	filters: TimelineFilters,
	mode: TimelineMode
): readonly TimelineEvent[] {
	return events
		.filter(event => matchesFilters(event, filters) && inWindow(event, window, mode))
		.slice()
		.sort((left, right) => {
			if (mode === 'narrative-order') {
				return left.narrativePosition.narrativeOrder - right.narrativePosition.narrativeOrder
					|| left.id.localeCompare(right.id);
			}
			const leftTime = storyTimeMilliseconds(left.storyStart) ?? Number.POSITIVE_INFINITY;
			const rightTime = storyTimeMilliseconds(right.storyStart) ?? Number.POSITIVE_INFINITY;
			return leftTime - rightTime
				|| left.narrativePosition.narrativeOrder - right.narrativePosition.narrativeOrder
				|| left.id.localeCompare(right.id);
		});
}
