import { describe, expect, it } from 'vitest';
import {
	parseMentionLink,
	StorySchemaRegistry,
	type MentionLink,
	type StoryRepository,
	type StoryResource,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import {
	collectMentionCandidates,
	EntityPeekService
} from './EntityPeekService';

function mention(id: string, resourceId: string, start: number, end: number): MentionLink {
	return parseMentionLink({
		id,
		resourceId,
		chapterId: 'chapter:chapter-001',
		anchor: {
			start,
			end,
			revision: 0,
			quote: '林越',
			before: '夜里',
			after: '走进车站'
		},
		displayText: '林越',
		status: 'active',
		revision: 0,
		createdAt: '2026-07-29T00:00:00.000Z',
		updatedAt: '2026-07-29T00:00:00.000Z'
	});
}

class PeekRepository implements StoryRepository {
	getCalls: string[] = [];
	resource = StorySchemaRegistry.parse('character', {
		id: 'character:lin-yue',
		type: 'character',
		title: '林越',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: '2026-07-29T00:00:00.000Z',
		updatedAt: '2026-07-29T00:00:00.000Z',
		revision: 1,
		role: 'protagonist',
		goals: ['找到失踪的姐姐'],
		factionIds: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: []
	});

	get<T extends StoryResource = StoryResource>(
		type: StoryResourceType,
		id: string
	): Promise<T | undefined> {
		this.getCalls.push(`${type}:${id}`);
		return Promise.resolve(this.resource as T);
	}

	list<T extends StoryResource = StoryResource>(): Promise<readonly T[]> {
		return Promise.resolve([]);
	}

	save(): Promise<StoryResource> {
		throw new Error('not used');
	}

	commit(): Promise<readonly StoryResource[]> {
		throw new Error('not used');
	}

	moveToTrash(): Promise<void> {
		throw new Error('not used');
	}

	restoreFromTrash(): Promise<StoryResource> {
		throw new Error('not used');
	}
}

describe('EntityPeekService', () => {
	it('returns every exact active overlap and ignores stale or adjacent links', () => {
		const overlaps = [
			mention('mention:character', 'character:lin-yue', 4, 6),
			mention('mention:location', 'location:old-station', 4, 9),
			{ ...mention('mention:stale', 'item:ticket', 4, 6), status: 'stale' as const },
			mention('mention:adjacent', 'item:lamp', 6, 8)
		];

		expect(collectMentionCandidates(overlaps, 5).map(value => value.id)).toEqual([
			'mention:character',
			'mention:location'
		]);
	});

	it('loads only the explicitly chosen exact resource and its backlinks', async () => {
		const repository = new PeekRepository();
		const links = [mention('mention:character', 'character:lin-yue', 4, 6)];
		const service = new EntityPeekService(repository, {
			listBacklinks: () => Promise.resolve(links)
		});

		const result = await service.load(links[0]);

		expect(repository.getCalls).toEqual(['character:character:lin-yue']);
		expect(result).toMatchObject({
			resource: { id: 'character:lin-yue', title: '林越' },
			summary: {
				kindLabel: '人物',
				lines: ['身份：主角', '目标：找到失踪的姐姐']
			},
			backlinks: links
		});
	});

	it('refuses an unknown or stale link instead of guessing from display text', async () => {
		const repository = new PeekRepository();
		const service = new EntityPeekService(repository, {
			listBacklinks: () => Promise.resolve([])
		});

		await expect(service.load({
			...mention('mention:stale', 'character:lin-yue', 4, 6),
			status: 'stale'
		})).rejects.toThrow('entityPeekLinkUnavailable');
		expect(repository.getCalls).toEqual([]);
	});
});
