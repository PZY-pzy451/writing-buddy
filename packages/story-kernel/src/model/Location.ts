import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export interface MapPoint {
	readonly x: number;
	readonly y: number;
}

export interface TravelLink {
	readonly targetLocationId: StoryId;
	readonly minimumMinutes: number;
	readonly mode?: string;
}

export interface Location extends StoryResourceBase {
	readonly type: 'location';
	readonly parentLocationId?: StoryId;
	readonly locationType?: string;
	readonly mapPoint?: MapPoint;
	readonly travelLinks: readonly TravelLink[];
	readonly factionIds: readonly StoryId[];
	readonly rules: readonly string[];
	readonly evidenceIds: readonly StoryId[];
}

type LocationInput = Omit<Location, 'id' | 'parentLocationId' | 'travelLinks' | 'factionIds' | 'evidenceIds'> & {
	readonly id: string;
	readonly parentLocationId?: string;
	readonly travelLinks?: readonly {
		readonly targetLocationId: string;
		readonly minimumMinutes: number;
		readonly mode?: string;
	}[];
	readonly factionIds?: readonly string[];
	readonly rules?: readonly string[];
	readonly evidenceIds?: readonly string[];
};

export function parseLocation(value: LocationInput): Location {
	const base = parseStoryResourceBase(value);
	if (
		value.mapPoint
		&& (
			!Number.isFinite(value.mapPoint.x)
			|| !Number.isFinite(value.mapPoint.y)
			|| value.mapPoint.x < 0
			|| value.mapPoint.x > 100
			|| value.mapPoint.y < 0
			|| value.mapPoint.y > 100
		)
	) {
		throw new Error('invalidLocationMapPoint');
	}
	const travelLinks = (value.travelLinks ?? []).map(link => {
		if (
			link.targetLocationId === value.id
			|| !Number.isFinite(link.minimumMinutes)
			|| link.minimumMinutes <= 0
		) {
			throw new Error('invalidLocationTravelLink');
		}
		return {
			targetLocationId: parseStoryId(link.targetLocationId),
			minimumMinutes: link.minimumMinutes,
			...(link.mode?.trim() ? { mode: link.mode.trim() } : {})
		};
	});
	return {
		...base,
		type: 'location',
		...(value.parentLocationId ? { parentLocationId: parseStoryId(value.parentLocationId) } : {}),
		...(value.locationType?.trim() ? { locationType: value.locationType.trim() } : {}),
		...(value.mapPoint ? { mapPoint: { ...value.mapPoint } } : {}),
		travelLinks,
		factionIds: (value.factionIds ?? []).map(parseStoryId),
		rules: [...(value.rules ?? [])],
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}

export function findLocationHierarchyCycles(
	locations: readonly Location[]
): readonly (readonly StoryId[])[] {
	const byId = new Map(locations.map(location => [location.id, location]));
	const completed = new Set<StoryId>();
	const cycles: StoryId[][] = [];

	for (const location of locations) {
		if (completed.has(location.id)) {
			continue;
		}
		const path: StoryId[] = [];
		const pathIndex = new Map<StoryId, number>();
		let current: Location | undefined = location;
		while (current && !completed.has(current.id)) {
			const existingIndex = pathIndex.get(current.id);
			if (existingIndex !== undefined) {
				cycles.push(path.slice(existingIndex));
				break;
			}
			pathIndex.set(current.id, path.length);
			path.push(current.id);
			current = current.parentLocationId
				? byId.get(current.parentLocationId)
				: undefined;
		}
		path.forEach(id => completed.add(id));
	}
	return cycles;
}
