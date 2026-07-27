import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export interface Faction extends StoryResourceBase {
	readonly type: 'faction';
	readonly ideology?: string;
	readonly goals: readonly string[];
	readonly allyFactionIds: readonly StoryId[];
	readonly enemyFactionIds: readonly StoryId[];
	readonly territoryLocationIds: readonly StoryId[];
	readonly evidenceIds: readonly StoryId[];
}

type FactionInput = Omit<
	Faction,
	'id' | 'allyFactionIds' | 'enemyFactionIds' | 'territoryLocationIds' | 'evidenceIds'
> & {
	readonly id: string;
	readonly goals?: readonly string[];
	readonly allyFactionIds?: readonly string[];
	readonly enemyFactionIds?: readonly string[];
	readonly territoryLocationIds?: readonly string[];
	readonly evidenceIds?: readonly string[];
};

export function parseFaction(value: FactionInput): Faction {
	const base = parseStoryResourceBase(value);
	const allies = new Set(value.allyFactionIds ?? []);
	const enemies = new Set(value.enemyFactionIds ?? []);
	if (allies.has(value.id) || enemies.has(value.id)) {
		throw new Error('factionCannotTargetItself');
	}
	for (const id of allies) {
		if (enemies.has(id)) {
			throw new Error('factionAllianceConflict');
		}
	}
	return {
		...base,
		type: 'faction',
		...(value.ideology?.trim() ? { ideology: value.ideology.trim() } : {}),
		goals: [...(value.goals ?? [])],
		allyFactionIds: [...allies].map(parseStoryId),
		enemyFactionIds: [...enemies].map(parseStoryId),
		territoryLocationIds: (value.territoryLocationIds ?? []).map(parseStoryId),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
