export interface TravelLinkRule {
	readonly fromLocationId: string;
	readonly toLocationId: string;
	readonly minimumMinutes: number;
	readonly bidirectional?: boolean;
	readonly mode?: string;
}

export function minimumTravelMinutes(
	links: readonly TravelLinkRule[],
	fromLocationId: string,
	toLocationId: string
): number | undefined {
	const durations = links
		.filter(link => (
			(link.fromLocationId === fromLocationId && link.toLocationId === toLocationId)
			|| (
				link.bidirectional
				&& link.fromLocationId === toLocationId
				&& link.toLocationId === fromLocationId
			)
		))
		.map(link => link.minimumMinutes)
		.filter(duration => Number.isFinite(duration) && duration >= 0);
	return durations.length ? Math.min(...durations) : undefined;
}

export function elapsedMinutes(startMs: number, endMs: number): number {
	return Math.max(0, Math.round((endMs - startMs) / 60_000));
}
