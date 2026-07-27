import {
	storyResourceTypes,
	type StoryResourceType
} from '@writing-buddy/story-kernel';

export interface StoryResourceRegistration {
	readonly type: StoryResourceType;
	readonly label: string;
	readonly pluralLabel: string;
	readonly idPrefix: string;
	readonly route: `story/${StoryResourceType}/:id`;
	readonly view: 'placeholder';
}

const registrations = [
	['chapter', '章节', '章节', 'chapter'],
	['scene', '场景', '场景', 'scene'],
	['character', '人物', '人物', 'character'],
	['location', '地点', '地点', 'location'],
	['faction', '势力', '势力', 'faction'],
	['item', '物品', '物品与叙事资产', 'item'],
	['worldRule', '世界规则', '世界规则', 'world-rule'],
	['timelineEvent', '时间线事件', '时间线事件', 'timeline-event'],
	['relationship', '人物关系', '人物关系', 'relationship'],
	['plotThread', '剧情线', '剧情线与伏笔', 'plot-thread'],
	['foreshadowing', '伏笔', '剧情线与伏笔', 'foreshadowing'],
	['information', '故事信息', '信息权限', 'information']
] as const satisfies readonly [
	StoryResourceType,
	string,
	string,
	string
][];

const storyResourceRegistry = new Map<StoryResourceType, StoryResourceRegistration>(
	registrations.map(([type, label, pluralLabel, idPrefix]) => [
		type,
		{
			type,
			label,
			pluralLabel,
			idPrefix,
			route: `story/${type}/:id`,
			view: 'placeholder'
		}
	])
);

if (storyResourceRegistry.size !== storyResourceTypes.length) {
	throw new Error('incompleteStoryResourceRegistry');
}

export function getStoryResourceRegistration(
	type: StoryResourceType
): StoryResourceRegistration {
	const registration = storyResourceRegistry.get(type);
	if (!registration) {
		throw new Error('unknownStoryResourceType');
	}
	return registration;
}

export function listStoryResourceRegistrations(): readonly StoryResourceRegistration[] {
	return storyResourceTypes.map(type => getStoryResourceRegistration(type));
}

export function buildStoryTabKey(type: StoryResourceType, id: string): string {
	return `story:${type}:${id}`;
}

export function buildStoryRoute(type: StoryResourceType, id: string): string {
	return `story/${type}/${encodeURIComponent(id)}`;
}

export function parseStoryTabKey(
	value: string
): { readonly type: StoryResourceType; readonly id: string } | undefined {
	if (!value.startsWith('story:')) {
		return undefined;
	}
	const [, type, ...idParts] = value.split(':');
	const id = idParts.join(':');
	if (!type || !storyResourceTypes.includes(type as StoryResourceType) || !id) {
		return undefined;
	}
	return { type: type as StoryResourceType, id };
}
