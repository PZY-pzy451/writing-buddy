import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';

export const characterStateKinds = [
	'location',
	'lifeStatus',
	'health',
	'emotion',
	'currentGoal',
	'inventory',
	'knowledge',
	'misconception',
	'ability'
] as const;

export type CharacterStateKind = typeof characterStateKinds[number];
export type CharacterStateValue = string | number | boolean | readonly string[] | null;
export type StateConfirmation = 'confirmed' | 'pending';

export interface StateRecord {
	readonly id: StoryId;
	readonly characterId: StoryId;
	readonly kind: CharacterStateKind;
	readonly value: CharacterStateValue;
	readonly effectiveFrom: StoryPosition;
	readonly effectiveUntil?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
	readonly confirmation: StateConfirmation;
	readonly revision: number;
}

export interface StateResolution {
	readonly current: StateRecord;
	readonly conflicts: readonly StateRecord[];
}

export type CharacterStateSnapshot = Readonly<
	Partial<Record<CharacterStateKind, StateResolution>>
>;

function assertStateValue(value: unknown): asserts value is CharacterStateValue {
	if (
		value === null
		|| typeof value === 'string'
		|| typeof value === 'number'
		|| typeof value === 'boolean'
		|| (Array.isArray(value) && value.every(item => typeof item === 'string'))
	) {
		return;
	}
	throw new Error('invalidStateValue');
}

function comparePosition(left: StoryPosition, right: StoryPosition): number {
	return left.narrativeOrder - right.narrativeOrder;
}

function equalStateValue(left: CharacterStateValue, right: CharacterStateValue): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function parseStateRecord(value: {
	readonly id: string;
	readonly characterId: string;
	readonly kind: string;
	readonly value: unknown;
	readonly effectiveFrom: {
		readonly chapterId: string;
		readonly sceneId?: string;
		readonly narrativeOrder: number;
		readonly storyTime?: string;
	};
	readonly effectiveUntil?: {
		readonly chapterId: string;
		readonly sceneId?: string;
		readonly narrativeOrder: number;
		readonly storyTime?: string;
	};
	readonly evidenceIds: readonly string[];
	readonly confirmation: string;
	readonly revision: number;
}): StateRecord {
	if (!characterStateKinds.includes(value.kind as CharacterStateKind)) {
		throw new Error('invalidCharacterStateKind');
	}
	assertStateValue(value.value);
	if (!['confirmed', 'pending'].includes(value.confirmation)) {
		throw new Error('invalidStateConfirmation');
	}
	if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
		throw new Error('invalidRevision');
	}
	const effectiveFrom = parseStoryPosition(value.effectiveFrom);
	const effectiveUntil = value.effectiveUntil
		? parseStoryPosition(value.effectiveUntil)
		: undefined;
	if (effectiveUntil && comparePosition(effectiveUntil, effectiveFrom) <= 0) {
		throw new Error('invalidStateInterval');
	}
	return {
		id: parseStoryId(value.id),
		characterId: parseStoryId(value.characterId),
		kind: value.kind as CharacterStateKind,
		value: Array.isArray(value.value) ? (value.value as readonly string[]).slice() : value.value,
		effectiveFrom,
		...(effectiveUntil ? { effectiveUntil } : {}),
		evidenceIds: value.evidenceIds.map(parseStoryId),
		confirmation: value.confirmation as StateConfirmation,
		revision: value.revision
	};
}

export function getStateAt(
	records: readonly StateRecord[],
	position: StoryPosition
): CharacterStateSnapshot {
	const result: Partial<Record<CharacterStateKind, StateResolution>> = {};
	for (const kind of characterStateKinds) {
		const applicable = records
			.filter(record => (
				record.kind === kind
				&& comparePosition(record.effectiveFrom, position) <= 0
				&& (!record.effectiveUntil || comparePosition(position, record.effectiveUntil) < 0)
			))
			.sort((left, right) => (
				comparePosition(right.effectiveFrom, left.effectiveFrom)
				|| Number(right.confirmation === 'confirmed') - Number(left.confirmation === 'confirmed')
				|| left.id.localeCompare(right.id)
			));
		const current = applicable[0];
		if (!current) {
			continue;
		}
		result[kind] = {
			current,
			conflicts: applicable.filter(candidate => (
				candidate !== current
				&& comparePosition(candidate.effectiveFrom, current.effectiveFrom) === 0
				&& !equalStateValue(candidate.value, current.value)
			))
		};
	}
	return result;
}
