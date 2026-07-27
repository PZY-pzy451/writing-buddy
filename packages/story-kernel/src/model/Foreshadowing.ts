import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export const foreshadowingStatuses = ['planted', 'reminded', 'resolved', 'overdue', 'abandoned'] as const;
export type ForeshadowingStatus = typeof foreshadowingStatuses[number];

export interface Foreshadowing extends StoryResourceBase {
	readonly type: 'foreshadowing';
	readonly status: ForeshadowingStatus;
	readonly plantedAt?: StoryPosition;
	readonly surfaceMeaning?: string;
	readonly trueMeaning?: string;
	readonly reminderPositions: readonly StoryPosition[];
	readonly plannedPayoffAt?: StoryPosition;
	readonly actualPayoffAt?: StoryPosition;
	readonly readerVisibility: number;
	readonly plotThreadIds: readonly StoryId[];
	readonly evidenceIds: readonly StoryId[];
}

type ForeshadowingInput = Omit<
	Foreshadowing,
	'id' | 'status' | 'plantedAt' | 'reminderPositions' | 'plannedPayoffAt' | 'actualPayoffAt' | 'readerVisibility' | 'plotThreadIds' | 'evidenceIds'
> & {
	readonly id: string;
	readonly status?: string;
	readonly plantedAt?: Parameters<typeof parseStoryPosition>[0];
	readonly reminderPositions?: readonly Parameters<typeof parseStoryPosition>[0][];
	readonly plannedPayoffAt?: Parameters<typeof parseStoryPosition>[0];
	readonly actualPayoffAt?: Parameters<typeof parseStoryPosition>[0];
	readonly readerVisibility?: number;
	readonly plotThreadIds?: readonly string[];
	readonly evidenceIds?: readonly string[];
};

function isStatus(value: string): value is ForeshadowingStatus {
	return foreshadowingStatuses.some(status => status === value);
}

export function parseForeshadowing(value: ForeshadowingInput): Foreshadowing {
	const base = parseStoryResourceBase(value);
	const status = value.status ?? 'planted';
	const readerVisibility = value.readerVisibility ?? 0;
	if (!isStatus(status)) throw new Error('invalidForeshadowingStatus');
	if (!Number.isFinite(readerVisibility) || readerVisibility < 0 || readerVisibility > 1) {
		throw new Error('invalidReaderVisibility');
	}
	return {
		...base,
		type: 'foreshadowing',
		status,
		...(value.plantedAt ? { plantedAt: parseStoryPosition(value.plantedAt) } : {}),
		...(value.surfaceMeaning?.trim() ? { surfaceMeaning: value.surfaceMeaning.trim() } : {}),
		...(value.trueMeaning?.trim() ? { trueMeaning: value.trueMeaning.trim() } : {}),
		reminderPositions: (value.reminderPositions ?? []).map(parseStoryPosition),
		...(value.plannedPayoffAt ? { plannedPayoffAt: parseStoryPosition(value.plannedPayoffAt) } : {}),
		...(value.actualPayoffAt ? { actualPayoffAt: parseStoryPosition(value.actualPayoffAt) } : {}),
		readerVisibility,
		plotThreadIds: (value.plotThreadIds ?? []).map(parseStoryId),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
