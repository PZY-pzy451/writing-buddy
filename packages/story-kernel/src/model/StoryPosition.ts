import { parseStoryId, type StoryId } from '../ids/StoryId';

export type StoryDateTime = string & { readonly __brand: 'StoryDateTime' };

export interface StoryPosition {
	readonly chapterId: StoryId;
	readonly sceneId?: StoryId;
	readonly narrativeOrder: number;
	readonly storyTime?: StoryDateTime;
}

export function parseStoryPosition(value: {
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly narrativeOrder: number;
	readonly storyTime?: string;
}): StoryPosition {
	if (!Number.isSafeInteger(value.narrativeOrder) || value.narrativeOrder < 0) {
		throw new Error('invalidNarrativeOrder');
	}
	if (value.storyTime !== undefined && value.storyTime.trim().length === 0) {
		throw new Error('invalidStoryTime');
	}
	return {
		chapterId: parseStoryId(value.chapterId),
		...(value.sceneId ? { sceneId: parseStoryId(value.sceneId) } : {}),
		narrativeOrder: value.narrativeOrder,
		...(value.storyTime ? { storyTime: value.storyTime as StoryDateTime } : {})
	};
}
