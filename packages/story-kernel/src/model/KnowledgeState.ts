import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import type { StateConfirmation } from './StateRecord';

export const knowledgeStatuses = ['knows', 'believes-true', 'believes-false', 'unknown'] as const;
export type KnowledgeStatus = typeof knowledgeStatuses[number];
export type KnowledgeSubject = StoryId | 'reader';

export interface KnowledgeState {
	readonly id: StoryId;
	readonly informationId: StoryId;
	readonly subject: KnowledgeSubject;
	readonly status: KnowledgeStatus;
	readonly effectiveFrom: StoryPosition;
	readonly effectiveUntil?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
	readonly confirmation: StateConfirmation;
	readonly revision: number;
}

export function parseKnowledgeState(value: {
	readonly id: string;
	readonly informationId: string;
	readonly subject: string;
	readonly status: string;
	readonly effectiveFrom: Parameters<typeof parseStoryPosition>[0];
	readonly effectiveUntil?: Parameters<typeof parseStoryPosition>[0];
	readonly evidenceIds: readonly string[];
	readonly confirmation: string;
	readonly revision: number;
}): KnowledgeState {
	if (!knowledgeStatuses.includes(value.status as KnowledgeStatus)) {
		throw new Error('invalidKnowledgeStatus');
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
		informationId: parseStoryId(value.informationId),
		subject: value.subject === 'reader' ? 'reader' : parseStoryId(value.subject),
		status: value.status as KnowledgeStatus,
		effectiveFrom,
		...(effectiveUntil ? { effectiveUntil } : {}),
		evidenceIds: value.evidenceIds.map(parseStoryId),
		confirmation: value.confirmation as StateConfirmation,
		revision: value.revision
	};
}

export function getKnowledgeAt(
	states: readonly KnowledgeState[],
	informationId: StoryId | string,
	subject: string,
	narrativeOrder: number
): KnowledgeState | undefined {
	return states
		.filter(state => (
			state.informationId === informationId
			&& state.subject === subject
			&& state.effectiveFrom.narrativeOrder <= narrativeOrder
			&& (!state.effectiveUntil || narrativeOrder < state.effectiveUntil.narrativeOrder)
		))
		.sort((left, right) => (
			right.effectiveFrom.narrativeOrder - left.effectiveFrom.narrativeOrder
			|| Number(right.confirmation === 'confirmed') - Number(left.confirmation === 'confirmed')
			|| left.id.localeCompare(right.id)
		))[0];
}
