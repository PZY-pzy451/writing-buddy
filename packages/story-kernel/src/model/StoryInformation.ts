import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export const informationTruthStatuses = ['confirmed', 'disputed', 'unknown'] as const;
export type InformationTruthStatus = typeof informationTruthStatuses[number];

export interface StoryInformation extends StoryResourceBase {
	readonly type: 'information';
	readonly truthStatement: string;
	readonly truthStatus: InformationTruthStatus;
	readonly authorSecret: boolean;
	readonly excludeFromAiByDefault: boolean;
	readonly truthEffectiveFrom?: StoryPosition;
	readonly readerRevealAt?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
}

type StoryInformationInput = Omit<
	StoryInformation,
	'id' | 'truthStatus' | 'truthEffectiveFrom' | 'readerRevealAt' | 'evidenceIds' | 'excludeFromAiByDefault'
> & {
	readonly id: string;
	readonly truthStatus?: string;
	readonly excludeFromAiByDefault?: boolean;
	readonly truthEffectiveFrom?: Parameters<typeof parseStoryPosition>[0];
	readonly readerRevealAt?: Parameters<typeof parseStoryPosition>[0];
	readonly evidenceIds?: readonly string[];
};

export function parseStoryInformation(value: StoryInformationInput): StoryInformation {
	const base = parseStoryResourceBase(value);
	const truthStatus = value.truthStatus ?? 'unknown';
	if (!informationTruthStatuses.includes(truthStatus as InformationTruthStatus)) {
		throw new Error('invalidInformationTruthStatus');
	}
	if (!value.truthStatement?.trim()) {
		throw new Error('invalidTruthStatement');
	}
	return {
		...base,
		type: 'information',
		truthStatement: value.truthStatement.trim(),
		truthStatus: truthStatus as InformationTruthStatus,
		authorSecret: value.authorSecret,
		excludeFromAiByDefault: value.excludeFromAiByDefault ?? value.authorSecret,
		...(value.truthEffectiveFrom ? { truthEffectiveFrom: parseStoryPosition(value.truthEffectiveFrom) } : {}),
		...(value.readerRevealAt ? { readerRevealAt: parseStoryPosition(value.readerRevealAt) } : {}),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
