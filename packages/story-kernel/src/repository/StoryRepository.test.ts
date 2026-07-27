import { describe, expect, it } from 'vitest';
import validResources from '../schema/fixtures/valid-resources.json';
import invalidResources from '../schema/fixtures/invalid-resources.json';
import {
	DesktopStoryRepository,
	StoryRevisionConflictError,
	type StoryStorageGateway
} from './StoryRepository';
import { StoryTransaction } from '../transaction/StoryTransaction';

class MemoryStoryGateway implements StoryStorageGateway {
	readonly resources = new Map<string, unknown>();
	readonly trash = new Map<string, unknown>();
	commitCalls = 0;

	private key(type: string, id: string): string {
		return `${type}:${id}`;
	}

	async getStoryResource(_root: string, type: string, id: string): Promise<unknown | undefined> {
		return this.resources.get(this.key(type, id));
	}

	async listStoryResources(_root: string, type: string): Promise<readonly unknown[]> {
		return [...this.resources.entries()]
			.filter(([key]) => key.startsWith(`${type}:`))
			.map(([, value]) => value);
	}

	async saveStoryResources(
		_root: string,
		entries: readonly { readonly resource: unknown; readonly expectedRevision?: number }[]
	): Promise<readonly unknown[]> {
		this.commitCalls += 1;
		const prepared = entries.map(entry => {
			const resource = entry.resource as { type: string; id: string; revision: number };
			const key = this.key(resource.type, resource.id);
			const current = this.resources.get(key) as { revision: number } | undefined;
			const actualRevision = current?.revision ?? 0;
			if (entry.expectedRevision !== undefined && entry.expectedRevision !== actualRevision) {
				throw `storyRevisionConflict:${actualRevision}`;
			}
			return {
				key,
				value: { ...resource, revision: actualRevision + 1 }
			};
		});
		for (const entry of prepared) {
			this.resources.set(entry.key, entry.value);
		}
		return prepared.map(entry => entry.value);
	}

	async moveStoryResourceToTrash(_root: string, type: string, id: string): Promise<void> {
		const key = this.key(type, id);
		const resource = this.resources.get(key);
		if (!resource) {
			throw 'storyResourceNotFound';
		}
		this.trash.set(key, resource);
		this.resources.delete(key);
	}

	async restoreStoryResourceFromTrash(_root: string, type: string, id: string): Promise<unknown> {
		const key = this.key(type, id);
		const resource = this.trash.get(key);
		if (!resource) {
			throw 'storyTrashNotFound';
		}
		this.resources.set(key, resource);
		this.trash.delete(key);
		return resource;
	}
}

describe('DesktopStoryRepository', () => {
	it('validates and saves a resource with a new revision', async () => {
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);

		const saved = await repository.save(validResources.character, 0);

		expect(saved.revision).toBe(1);
		expect((await repository.get('character', saved.id))?.title).toBe('林越');
	});

	it('maps stale revision failures without leaking transport details', async () => {
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const saved = await repository.save(validResources.item, 0);

		await expect(repository.save({ ...saved, title: '旧标题' }, 0))
			.rejects.toBeInstanceOf(StoryRevisionConflictError);
	});

	it('rejects invalid schema before any storage call', async () => {
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);

		await expect(repository.save(invalidResources.item, 0)).rejects.toThrow();
		expect(gateway.commitCalls).toBe(0);
	});

	it('validates an entire transaction before staging any resource', async () => {
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const transaction = new StoryTransaction(repository)
			.stage(validResources.character, 0)
			.stage(invalidResources.scene, 0);

		await expect(transaction.commit()).rejects.toThrow();
		expect(gateway.commitCalls).toBe(0);
		expect(gateway.resources.size).toBe(0);
	});

	it('moves resources to recoverable trash and restores them', async () => {
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const saved = await repository.save(validResources.character, 0);

		await repository.moveToTrash('character', saved.id);
		expect(await repository.get('character', saved.id)).toBeUndefined();
		await repository.restoreFromTrash('character', saved.id);
		expect((await repository.get('character', saved.id))?.title).toBe('林越');
	});
});
