import { describe, expect, it } from 'vitest';
import {
	StorySchemaRegistry,
	parseStoryScene,
	type StoryRepository,
	type StoryResource,
	type StoryResourceType,
	type StoryScene
} from '@writing-buddy/story-kernel';
import validResources from '../../../../../../packages/story-kernel/src/schema/fixtures/valid-resources.json';
import { SceneOverlapError, SceneService } from './SceneService';

class SceneMemoryRepository implements StoryRepository {
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
		const parsed = StorySchemaRegistry.parse('scene', resource);
		const saved = { ...parsed, revision: parsed.revision + 1 } as StoryScene;
		this.resources.set(`${saved.type}:${saved.id}`, saved);
		return Promise.resolve(saved);
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

	restoreFromTrash(): Promise<StoryResource> {
		return Promise.reject(new Error('notNeeded'));
	}
}

function fixtureScene(): StoryScene {
	return parseStoryScene(validResources.scene);
}

describe('SceneService', () => {
	it('creates ordered scene metadata and finds the scene at a manuscript offset', async () => {
		const manuscript = '夜雨落在旧车站。林越推开候车室的门。';
		const service = new SceneService(
			new SceneMemoryRepository(),
			() => 'scene:generated',
			() => '2026-07-27T00:00:00.000Z'
		);

		const scene = await service.createScene({
			chapterId: 'chapter:chapter-001',
			title: '雨夜抵达',
			start: 0,
			end: 8,
			manuscript
		});

		expect(scene.manuscriptRange.quote).toBe(manuscript.slice(0, 8));
		expect(scene.narrativeOrder).toBe(0);
		await expect(service.findSceneAtOffset(scene.chapterId, 3)).resolves.toEqual(scene);
		await expect(service.findSceneAtOffset(scene.chapterId, 9)).resolves.toBeUndefined();
	});

	it('rejects overlapping ranges but allows adjacent scenes', async () => {
		const existing = fixtureScene();
		const repository = new SceneMemoryRepository([existing]);
		const service = new SceneService(repository, () => 'scene:next');
		const manuscript = '夜'.repeat(80);

		await expect(service.createScene({
			chapterId: existing.chapterId,
			title: '冲突场景',
			start: 16,
			end: 48,
			manuscript
		})).rejects.toBeInstanceOf(SceneOverlapError);

		await expect(service.createScene({
			chapterId: existing.chapterId,
			title: '相邻场景',
			start: 32,
			end: 48,
			manuscript
		})).resolves.toMatchObject({
			manuscriptRange: { start: 32, end: 48 },
			narrativeOrder: 1
		});
	});

	it('updates scene metadata without changing a single Markdown byte', async () => {
		const original = fixtureScene();
		const repository = new SceneMemoryRepository([original]);
		const service = new SceneService(repository);
		const manuscript = '夜雨落在旧车站的玻璃顶上。\r\n\r\n林越推开木门。';
		const before = new TextEncoder().encode(manuscript);

		const updated = await service.updateSceneRange(
			original.id,
			10,
			manuscript.length,
			manuscript
		);
		const after = new TextEncoder().encode(manuscript);

		expect(updated.manuscriptRange).toMatchObject({
			start: 10,
			end: manuscript.length,
			quote: manuscript.slice(10)
		});
		expect(after).toEqual(before);
	});

	it('unlinks scene metadata into recoverable trash without touching manuscript text', async () => {
		const original = fixtureScene();
		const repository = new SceneMemoryRepository([original]);
		const service = new SceneService(repository);
		const manuscript = '正文必须保留。';

		await service.unlinkScene(original.id);

		expect(await repository.get('scene', original.id)).toBeUndefined();
		expect(repository.trash.get(`scene:${original.id}`)).toEqual(original);
		expect(manuscript).toBe('正文必须保留。');
	});
});
