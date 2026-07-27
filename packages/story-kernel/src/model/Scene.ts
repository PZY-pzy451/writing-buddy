import type { StoryResource } from '../schema/resourceSchemas';
import { StorySchemaRegistry } from '../schema/schemaRegistry';

export type StoryScene = Extract<StoryResource, { readonly type: 'scene' }>;

export interface SceneRange {
	readonly start: number;
	readonly end: number;
}

export function parseStoryScene(value: unknown): StoryScene {
	return StorySchemaRegistry.parse('scene', value) as StoryScene;
}

export function assertSceneRange(range: SceneRange, manuscriptLength: number): void {
	if (!Number.isSafeInteger(range.start)
		|| !Number.isSafeInteger(range.end)
		|| range.start < 0
		|| range.end <= range.start
		|| range.end > manuscriptLength) {
		throw new Error('invalidSceneRange');
	}
}

export function sceneRangesOverlap(left: SceneRange, right: SceneRange): boolean {
	return left.start < right.end && right.start < left.end;
}

export function toStoryChapterId(projectChapterId: string): string {
	if (/^chapter:[a-z0-9][a-z0-9-]*$/.test(projectChapterId)) {
		return projectChapterId;
	}
	const leaf = projectChapterId
		.trim()
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (!leaf) {
		throw new Error('invalidChapterId');
	}
	return `chapter:${leaf}`;
}
