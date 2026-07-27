import { parseStoryId, type StoryId } from '../ids/StoryId';
import type { StoryResourceType } from '../model/StoryResourceBase';

const resourceFolders: Record<StoryResourceType, string> = {
	chapter: 'chapters',
	scene: 'scenes',
	character: 'characters',
	location: 'locations',
	faction: 'factions',
	item: 'items',
	worldRule: 'world-rules',
	timelineEvent: 'events',
	relationship: 'relationships',
	plotThread: 'plot-threads',
	foreshadowing: 'foreshadowing',
	information: 'information'
};

const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function normalizeRoot(root: string): string {
	const normalized = root.replaceAll('\\', '/').replace(/\/+$/, '');
	if (normalized.split('/').some(segment => segment === '..' || segment === '.')) {
		throw new Error('unsafeStoryRoot');
	}
	return normalized;
}

function safeFileId(value: string): StoryId {
	const leaf = value.split(':').at(-1) ?? '';
	if (windowsReservedName.test(leaf)) {
		throw new Error('reservedStoryId');
	}
	return parseStoryId(value);
}

export class StoryPaths {
	static forResource(
		root: string,
		type: StoryResourceType,
		id: string
	): string {
		const normalizedRoot = normalizeRoot(root);
		const storyId = safeFileId(id);
		const relative = `story/${resourceFolders[type]}/${encodeURIComponent(storyId)}.json`;
		return normalizedRoot ? `${normalizedRoot}/${relative}` : relative;
	}
}
