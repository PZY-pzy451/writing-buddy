export type StoryId = string & { readonly __brand: 'StoryId' };

const storyIdPattern = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;
const prefixPattern = /^[a-z][a-z0-9-]*$/;

export function parseStoryId(value: string): StoryId {
	if (!storyIdPattern.test(value)) {
		throw new Error('invalidStoryId');
	}
	return value as StoryId;
}

export function createStoryId(prefix: string): StoryId {
	if (!prefixPattern.test(prefix)) {
		throw new Error('invalidStoryIdPrefix');
	}
	return parseStoryId(`${prefix}:${globalThis.crypto.randomUUID()}`);
}
