import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import type { StateConfirmation } from './StateRecord';

export const itemActions = [
	'acquired',
	'transferred',
	'used',
	'lost',
	'destroyed',
	'adjusted'
] as const;

export type ItemAction = typeof itemActions[number];

export interface ItemState {
	readonly id: StoryId;
	readonly itemId: StoryId;
	readonly action: ItemAction;
	readonly quantity: number;
	readonly holderCharacterId?: StoryId;
	readonly locationId?: StoryId;
	readonly condition?: string;
	readonly effectiveFrom: StoryPosition;
	readonly effectiveUntil?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
	readonly confirmation: StateConfirmation;
	readonly revision: number;
}

export function parseItemState(value: {
	readonly id: string;
	readonly itemId: string;
	readonly action: string;
	readonly quantity: number;
	readonly holderCharacterId?: string;
	readonly locationId?: string;
	readonly condition?: string;
	readonly effectiveFrom: Parameters<typeof parseStoryPosition>[0];
	readonly effectiveUntil?: Parameters<typeof parseStoryPosition>[0];
	readonly evidenceIds: readonly string[];
	readonly confirmation: string;
	readonly revision: number;
}): ItemState {
	if (!itemActions.includes(value.action as ItemAction)) {
		throw new Error('invalidItemAction');
	}
	if (!Number.isFinite(value.quantity)) {
		throw new Error('invalidItemQuantity');
	}
	if (!['confirmed', 'pending'].includes(value.confirmation)) {
		throw new Error('invalidStateConfirmation');
	}
	if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
		throw new Error('invalidRevision');
	}
	const effectiveFrom = parseStoryPosition(value.effectiveFrom);
	const effectiveUntil = value.effectiveUntil ? parseStoryPosition(value.effectiveUntil) : undefined;
	if (effectiveUntil && effectiveUntil.narrativeOrder <= effectiveFrom.narrativeOrder) {
		throw new Error('invalidStateInterval');
	}
	return {
		id: parseStoryId(value.id),
		itemId: parseStoryId(value.itemId),
		action: value.action as ItemAction,
		quantity: value.quantity,
		...(value.holderCharacterId ? { holderCharacterId: parseStoryId(value.holderCharacterId) } : {}),
		...(value.locationId ? { locationId: parseStoryId(value.locationId) } : {}),
		...(value.condition?.trim() ? { condition: value.condition.trim() } : {}),
		effectiveFrom,
		...(effectiveUntil ? { effectiveUntil } : {}),
		evidenceIds: value.evidenceIds.map(parseStoryId),
		confirmation: value.confirmation as StateConfirmation,
		revision: value.revision
	};
}

export function getItemStateAt(
	states: readonly ItemState[],
	itemId: StoryId | string,
	narrativeOrder: number
): ItemState | undefined {
	return states
		.filter(state => (
			state.itemId === itemId
			&& state.effectiveFrom.narrativeOrder <= narrativeOrder
			&& (!state.effectiveUntil || narrativeOrder < state.effectiveUntil.narrativeOrder)
		))
		.sort((left, right) => (
			right.effectiveFrom.narrativeOrder - left.effectiveFrom.narrativeOrder
			|| Number(right.confirmation === 'confirmed') - Number(left.confirmation === 'confirmed')
			|| left.id.localeCompare(right.id)
		))[0];
}
