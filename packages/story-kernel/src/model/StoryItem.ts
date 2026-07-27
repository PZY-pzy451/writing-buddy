import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export interface StoryItem extends StoryResourceBase {
	readonly type: 'item';
	readonly itemType?: string;
	readonly unique: boolean;
	readonly quantityUnit?: string;
	readonly description?: string;
	readonly restrictions: readonly string[];
	readonly plotFunction?: string;
	readonly evidenceIds: readonly StoryId[];
}

type StoryItemInput = Omit<StoryItem, 'id' | 'evidenceIds'> & {
	readonly id: string;
	readonly evidenceIds?: readonly string[];
};

export function parseStoryItem(value: StoryItemInput): StoryItem {
	const base = parseStoryResourceBase(value);
	return {
		...base,
		type: 'item',
		...(value.itemType?.trim() ? { itemType: value.itemType.trim() } : {}),
		unique: value.unique,
		...(value.quantityUnit?.trim() ? { quantityUnit: value.quantityUnit.trim() } : {}),
		...(value.description?.trim() ? { description: value.description.trim() } : {}),
		restrictions: [...value.restrictions],
		...(value.plotFunction?.trim() ? { plotFunction: value.plotFunction.trim() } : {}),
		evidenceIds: (value.evidenceIds ?? []).map(parseStoryId)
	};
}
