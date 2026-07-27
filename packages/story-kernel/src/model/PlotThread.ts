import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export const plotThreadStatuses = ['planned', 'active', 'at-risk', 'resolved', 'abandoned'] as const;
export type PlotThreadStatus = typeof plotThreadStatuses[number];

export interface PlotThread extends StoryResourceBase {
	readonly type: 'plotThread';
	readonly status: PlotThreadStatus;
	readonly premise?: string;
	readonly stakes?: string;
	readonly dramaticQuestion?: string;
	readonly startPosition?: StoryPosition;
	readonly targetResolution?: StoryPosition;
	readonly actualResolution?: StoryPosition;
	readonly participantIds: readonly StoryId[];
	readonly sceneIds: readonly StoryId[];
	readonly evidenceIds: readonly StoryId[];
}

type PlotThreadInput = Omit<
	PlotThread,
	'id' | 'status' | 'startPosition' | 'targetResolution' | 'actualResolution' | 'participantIds' | 'sceneIds' | 'evidenceIds'
> & {
	readonly id: string;
	readonly status?: string;
	readonly startPosition?: Parameters<typeof parseStoryPosition>[0];
	readonly targetResolution?: Parameters<typeof parseStoryPosition>[0];
	readonly actualResolution?: Parameters<typeof parseStoryPosition>[0];
	readonly participantIds?: readonly string[];
	readonly sceneIds?: readonly string[];
	readonly evidenceIds?: readonly string[];
};

function isStatus(value: string): value is PlotThreadStatus {
	return plotThreadStatuses.some(status => status === value);
}

export function parsePlotThread(value: PlotThreadInput): PlotThread {
	const base = parseStoryResourceBase(value);
	const status = value.status ?? 'planned';
	if (!isStatus(status)) throw new Error('invalidPlotThreadStatus');
	return {
		...base,
		type: 'plotThread',
		status,
		...(value.premise?.trim() ? { premise: value.premise.trim() } : {}),
		...(value.stakes?.trim() ? { stakes: value.stakes.trim() } : {}),
		...(value.dramaticQuestion?.trim() ? { dramaticQuestion: value.dramaticQuestion.trim() } : {}),
		...(value.startPosition ? { startPosition: parseStoryPosition(value.startPosition) } : {}),
		...(value.targetResolution ? { targetResolution: parseStoryPosition(value.targetResolution) } : {}),
		...(value.actualResolution ? { actualResolution: parseStoryPosition(value.actualResolution) } : {}),
		participantIds: (value.participantIds ?? []).map(parseStoryId),
		sceneIds: (value.sceneIds ?? []).map(parseStoryId),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
