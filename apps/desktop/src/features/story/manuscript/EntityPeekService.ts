import type {
	MentionLink,
	StoryRepository,
	StoryResource
} from '@writing-buddy/story-kernel';
import {
	storyReferenceFromId
} from '../application/StoryResourceRegistry';

export interface EntityPeekSummary {
	readonly kindLabel: string;
	readonly lines: readonly string[];
}

export interface EntityPeekResult {
	readonly mention?: MentionLink;
	readonly resource: StoryResource;
	readonly summary: EntityPeekSummary;
	readonly backlinks: readonly MentionLink[];
}

interface BacklinkReader {
	listBacklinks(resourceId: string): Promise<readonly MentionLink[]>;
}

const roleLabels: Readonly<Record<string, string>> = {
	protagonist: '主角',
	antagonist: '对手',
	supporting: '配角',
	minor: '次要人物'
};

const kindLabels: Readonly<Record<string, string>> = {
	character: '人物',
	location: '地点',
	item: '物品',
	foreshadowing: '伏笔',
	worldRule: '世界规则',
	faction: '势力',
	information: '故事信息',
	plotThread: '剧情线',
	timelineEvent: '时间线事件',
	relationship: '人物关系',
	scene: '场景',
	chapter: '章节'
};

export function collectMentionCandidates(
	mentions: readonly MentionLink[],
	offset: number
): readonly MentionLink[] {
	return mentions.filter(mention => (
		mention.status === 'active'
		&& mention.anchor.start <= offset
		&& offset < mention.anchor.end
	));
}

function resourceSummary(resource: StoryResource): EntityPeekSummary {
	const lines: string[] = [];
	if (resource.type === 'character') {
		if (resource.role) lines.push(`身份：${roleLabels[resource.role] ?? resource.role}`);
		if (resource.goals[0]) lines.push(`目标：${resource.goals[0]}`);
		if (resource.speechStyle) lines.push(`说话风格：${resource.speechStyle}`);
	} else if (resource.type === 'location') {
		if (resource.locationType) lines.push(`类型：${resource.locationType}`);
		if (resource.rules[0]) lines.push(`规则：${resource.rules[0]}`);
	} else if (resource.type === 'item') {
		if (resource.description) lines.push(resource.description);
		if (resource.plotFunction) lines.push(`剧情作用：${resource.plotFunction}`);
	} else if (resource.type === 'foreshadowing') {
		lines.push(`状态：${resource.status}`);
		if (resource.surfaceMeaning) lines.push(`表层含义：${resource.surfaceMeaning}`);
	} else if (resource.type === 'worldRule') {
		if (resource.statement) lines.push(resource.statement);
		if (resource.scope) lines.push(`适用范围：${resource.scope}`);
	} else if (resource.summary) {
		lines.push(resource.summary);
	}
	return {
		kindLabel: kindLabels[resource.type] ?? resource.type,
		lines: lines.slice(0, 3)
	};
}

export class EntityPeekService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly backlinks: BacklinkReader
	) {}

	async load(mention: MentionLink): Promise<EntityPeekResult> {
		if (mention.status !== 'active') {
			throw new Error('entityPeekLinkUnavailable');
		}
		return this.loadResource(mention.resourceId, mention);
	}

	async loadResource(
		resourceId: string,
		mention?: MentionLink
	): Promise<EntityPeekResult> {
		const reference = storyReferenceFromId(resourceId);
		if (!reference) {
			throw new Error('entityPeekLinkUnavailable');
		}
		const resource = await this.repository.get(reference.type, reference.id);
		if (!resource) {
			throw new Error('entityPeekResourceMissing');
		}
		const backlinks = await this.backlinks.listBacklinks(resourceId);
		return {
			...(mention ? { mention } : {}),
			resource,
			summary: resourceSummary(resource),
			backlinks
		};
	}
}
