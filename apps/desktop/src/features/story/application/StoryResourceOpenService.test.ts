import { describe, expect, it } from 'vitest';
import type { ResourceDescriptor } from '@writing-buddy/domain';
import { ResourceTabManager } from '@writing-buddy/project';
import {
	StorySchemaRegistry,
	storyResourceTypes,
	type StoryRepository,
	type StoryResource,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import validResources from '../../../../../../packages/story-kernel/src/schema/fixtures/valid-resources.json';
import {
	buildStoryTabKey,
	getStoryResourceRegistration,
	parseStoryTabKey
} from './StoryResourceRegistry';
import { StoryResourceOpenService } from './StoryResourceOpenService';

class MemoryStoryRepository implements StoryRepository {
	readonly resources = new Map<string, StoryResource>();
	readonly trash = new Map<string, StoryResource>();

	constructor(resources: readonly StoryResource[] = []) {
		for (const resource of resources) {
			this.resources.set(`${resource.type}:${resource.id}`, resource);
		}
	}

	get<T extends StoryResource = StoryResource>(
		type: StoryResourceType,
		id: string
	): Promise<T | undefined> {
		return Promise.resolve(this.resources.get(`${type}:${id}`) as T | undefined);
	}

	list<T extends StoryResource = StoryResource>(
		type: StoryResourceType
	): Promise<readonly T[]> {
		return Promise.resolve([...this.resources.values()]
			.filter(resource => resource.type === type) as unknown as readonly T[]);
	}

	save(resource: unknown): Promise<StoryResource> {
		const parsed = StorySchemaRegistry.parse(
			(resource as { readonly type: StoryResourceType }).type,
			resource
		);
		this.resources.set(`${parsed.type}:${parsed.id}`, parsed);
		return Promise.resolve(parsed);
	}

	commit(): Promise<readonly StoryResource[]> {
		return Promise.resolve([]);
	}

	moveToTrash(type: StoryResourceType, id: string): Promise<void> {
		const key = `${type}:${id}`;
		const resource = this.resources.get(key);
		if (!resource) {
			return Promise.reject(new Error('storyResourceNotFound'));
		}
		this.trash.set(key, resource);
		this.resources.delete(key);
		return Promise.resolve();
	}

	restoreFromTrash(type: StoryResourceType, id: string): Promise<StoryResource> {
		const key = `${type}:${id}`;
		const resource = this.trash.get(key);
		if (!resource) {
			return Promise.reject(new Error('storyTrashNotFound'));
		}
		this.resources.set(key, resource);
		this.trash.delete(key);
		return Promise.resolve(resource);
	}
}

function character(): StoryResource {
	return StorySchemaRegistry.parse('character', validResources.character);
}

describe('StoryResourceRegistry', () => {
	it('registers every Story Kernel resource type with a stable route and tab key', () => {
		for (const type of storyResourceTypes) {
			const registration = getStoryResourceRegistration(type);
			const key = buildStoryTabKey(type, `${registration.idPrefix}:example`);
			expect(registration.view).toBe('placeholder');
			expect(registration.route).toBe(`story/${type}/:id`);
			expect(parseStoryTabKey(key)).toEqual({
				type,
				id: `${registration.idPrefix}:example`
			});
		}
	});
});

describe('StoryResourceOpenService', () => {
	it('opens a Story resource once and deduplicates its workspace tab', async () => {
		const tabs = new ResourceTabManager();
		const service = new StoryResourceOpenService(
			new MemoryStoryRepository([character()]),
			tabs,
			'project-story'
		);

		const first = await service.openStoryResource({
			type: 'character',
			id: 'character:lin-yue'
		});
		const second = await service.openStoryResource({
			type: 'character',
			id: 'character:lin-yue'
		});

		expect(first.status).toBe('ready');
		expect(second.tab.id).toBe('story:character:character:lin-yue');
		expect(tabs.state.resources).toHaveLength(1);
		expect(tabs.state.activeId).toBe(second.tab.id);
	});

	it('restores persisted tabs and gives deleted resources an explicit recovery state', async () => {
		const tabs = new ResourceTabManager();
		const service = new StoryResourceOpenService(
			new MemoryStoryRepository([character()]),
			tabs,
			'project-story'
		);
		const existingKey = buildStoryTabKey('character', 'character:lin-yue');
		const missingKey = buildStoryTabKey('scene', 'scene:missing');

		const restored = await service.restoreStoryResources(
			[existingKey, 'chapter-a', missingKey],
			missingKey
		);

		expect(restored).toHaveLength(2);
		expect(restored[0]?.status).toBe('ready');
		expect(restored[1]).toMatchObject({
			status: 'missing',
			reference: { type: 'scene', id: 'scene:missing' },
			tab: { id: missingKey, title: '资源不存在' }
		});
		expect(tabs.state.resources.map((tab: ResourceDescriptor) => tab.id))
			.toEqual([existingKey, missingKey]);
		expect(tabs.state.activeId).toBe(missingKey);
	});

	it('replaces a missing tab with the recovered resource after restoring from trash', async () => {
		const tabs = new ResourceTabManager();
		const repository = new MemoryStoryRepository([character()]);
		await repository.moveToTrash('character', 'character:lin-yue');
		const service = new StoryResourceOpenService(repository, tabs, 'project-story');

		const missing = await service.openStoryResource({
			type: 'character',
			id: 'character:lin-yue'
		});
		const restored = await service.restoreFromTrash(missing.reference);

		expect(missing.status).toBe('missing');
		expect(restored.status).toBe('ready');
		expect(tabs.state.resources).toHaveLength(1);
		expect(tabs.state.resources[0]?.title).toBe(character().title);
	});
});
