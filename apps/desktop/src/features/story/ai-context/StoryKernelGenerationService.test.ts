import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	DesktopStoryRepository,
	type StorySaveEntry,
	type StoryStorageGateway
} from '@writing-buddy/story-kernel';
import { describe, expect, it } from 'vitest';
import {
	StoryKernelGenerationService,
	StoryKernelGenerationStore,
	type StoryKernelGenerationStoragePort
} from './StoryKernelGenerationService';

class MemoryStorage implements StoryKernelGenerationStoragePort {
	private content: string | undefined;
	private hash = '';

	readText(): Promise<TextFile> {
		if (this.content === undefined) return Promise.reject(new Error('readFailed'));
		return Promise.resolve({
			content: this.content,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false,
			hash: this.hash
		});
	}

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		if (request.expectedHash !== this.hash) {
			return Promise.reject(new Error('externalChange'));
		}
		this.content = request.content;
		this.hash = `hash-${request.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			byteLength: request.content.length,
			modifiedAt: '2026-07-27T08:00:00.000Z'
		});
	}
}

class MemoryStoryGateway implements StoryStorageGateway {
	readonly resources = new Map<string, unknown>();
	commitCalls = 0;
	failNextCommit = false;

	private key(type: string, id: string): string {
		return `${type}:${id}`;
	}

	getStoryResource(_root: string, type: string, id: string): Promise<unknown> {
		return Promise.resolve(this.resources.get(this.key(type, id)));
	}

	listStoryResources(_root: string, type: string): Promise<readonly unknown[]> {
		return Promise.resolve([...this.resources.entries()]
			.filter(([key]) => key.startsWith(`${type}:`))
			.map(([, value]) => value));
	}

	saveStoryResources(
		_root: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]> {
		this.commitCalls += 1;
		if (this.failNextCommit) {
			this.failNextCommit = false;
			return Promise.reject(new Error('storyWriteFailed'));
		}
		const prepared = entries.map(entry => {
			const resource = entry.resource as {
				readonly type: string;
				readonly id: string;
				readonly revision: number;
			};
			const key = this.key(resource.type, resource.id);
			const current = this.resources.get(key) as { readonly revision: number } | undefined;
			const actualRevision = current?.revision ?? 0;
			if (
				(entry.expectedAbsent && current)
				|| (
					entry.expectedRevision !== undefined
					&& entry.expectedRevision !== actualRevision
				)
			) {
				throw new Error(`storyRevisionConflict:${actualRevision}`);
			}
			return {
				key,
				value: { ...resource, revision: actualRevision + 1 }
			};
		});
		for (const entry of prepared) this.resources.set(entry.key, entry.value);
		return Promise.resolve(prepared.map(entry => entry.value));
	}

	moveStoryResourceToTrash(): Promise<void> {
		return Promise.resolve();
	}

	restoreStoryResourceFromTrash(): Promise<unknown> {
		return Promise.reject(new Error('storyTrashNotFound'));
	}
}

const now = '2026-07-27T08:00:00.000Z';
const content = '林越在旧车站遇见沈青。';

function createResponse(): string {
	return JSON.stringify({
		candidates: [
			{
				operation: 'create',
				resource: {
					id: 'character:lin-yue',
					type: 'character',
					title: '林越',
					aliases: [],
					tags: ['主角'],
					evidenceIds: [],
					role: 'protagonist',
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: []
				},
				confidence: 0.98,
				rationale: '正文明确出现人物。',
				evidence: { start: 0, end: 2, quote: '林越' }
			},
			{
				operation: 'create',
				resource: {
					id: 'character:shen-qing',
					type: 'character',
					title: '沈青',
					aliases: [],
					tags: [],
					evidenceIds: [],
					role: 'supporting',
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: []
				},
				confidence: 0.96,
				rationale: '正文明确出现人物。',
				evidence: { start: 8, end: 10, quote: '沈青' }
			},
			{
				operation: 'create',
				resource: {
					id: 'location:old-station',
					type: 'location',
					title: '旧车站',
					aliases: [],
					tags: [],
					evidenceIds: [],
					locationType: '车站',
					travelLinks: [],
					factionIds: [],
					rules: []
				},
				confidence: 0.95,
				rationale: '正文明确给出地点。',
				evidence: { start: 3, end: 6, quote: '旧车站' }
			},
			{
				operation: 'create',
				resource: {
					id: 'relationship:lin-yue-meets-shen-qing',
					type: 'relationship',
					title: '林越遇见沈青',
					aliases: [],
					tags: [],
					evidenceIds: [],
					sourceCharacterId: 'character:lin-yue',
					targetCharacterId: 'character:shen-qing',
					relationshipType: '初次相遇',
					visibility: 'public',
					effectiveFrom: {
						chapterId: 'chapter:chapter-001',
						narrativeOrder: 0
					},
					history: []
				},
				confidence: 0.9,
				rationale: '正文描述两人相遇。',
				evidence: { start: 0, end: 11, quote: content }
			}
		]
	});
}

function createHarness() {
	const storage = new MemoryStorage();
	const gateway = new MemoryStoryGateway();
	const repository = new DesktopStoryRepository('D:/Novel', gateway);
	const store = new StoryKernelGenerationStore('D:/Novel', storage);
	return {
		gateway,
		repository,
		store,
		service: new StoryKernelGenerationService(store, repository)
	};
}

async function stageValidBatch(
	service: StoryKernelGenerationService
) {
	return service.stageFromResponse({
		instruction: '从正文生成主要人物、地点和关系。',
		sourceResourceId: 'chapter:chapter-001',
		sourceRevision: '7',
		content,
		targetTypes: ['character', 'location', 'relationship'],
		response: createResponse(),
		now
	});
}

describe('StoryKernelGenerationService', () => {
	it('stages complete resources, validates dependencies, then confirms one atomic batch', async () => {
		const { gateway, repository, service, store } = createHarness();
		const batch = await stageValidBatch(service);

		expect(batch.candidates).toHaveLength(4);
		expect(batch.candidates.every(candidate => candidate.conflicts.length === 0)).toBe(true);
		expect(batch.candidates[0]?.evidence).toMatchObject({
			confirmedByAuthor: false,
			resourceId: 'chapter:chapter-001',
			revisionId: '7'
		});
		expect(gateway.commitCalls).toBe(0);

		const confirmed = await service.confirm(
			batch.id,
			batch.candidates.map(candidate => candidate.id),
			'2026-07-27T08:01:00.000Z'
		);

		expect(gateway.commitCalls).toBe(1);
		expect(confirmed.candidates.every(candidate => candidate.status === 'accepted')).toBe(true);
		expect(confirmed.candidates[0]?.evidence).toMatchObject({
			confirmedByAuthor: true,
			confirmedAt: '2026-07-27T08:01:00.000Z'
		});
		expect((await repository.get('character', 'character:lin-yue'))?.revision).toBe(1);
		expect((await repository.get('relationship', 'relationship:lin-yue-meets-shen-qing'))?.revision)
			.toBe(1);
		expect((await store.load())[0]?.candidates.every(candidate => candidate.status === 'accepted'))
			.toBe(true);
	});

	it('blocks create collisions and all generated resources that depend on them', async () => {
		const { repository, service } = createHarness();
		const existing = {
			id: 'character:lin-yue',
			type: 'character',
			title: '林越',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			factionIds: [],
			goals: [],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		} as const;
		await repository.save(existing, 0);

		const batch = await stageValidBatch(service);
		const collision = batch.candidates.find(candidate => candidate.resourceId === existing.id);
		const dependency = batch.candidates.find(
			candidate => candidate.resourceId === 'relationship:lin-yue-meets-shen-qing'
		);

		expect(collision?.conflicts.map(item => item.code)).toContain('create-collision');
		expect(dependency?.conflicts.map(item => item.code)).toContain('blocked-dependency');
		await expect(service.confirm(batch.id, [collision?.id ?? '']))
			.rejects.toThrow('storyKernelGenerationCandidateBlocked');
	});

	it('keeps every candidate pending when the atomic repository commit fails', async () => {
		const { gateway, service, store } = createHarness();
		const batch = await stageValidBatch(service);
		gateway.failNextCommit = true;

		await expect(service.confirm(
			batch.id,
			batch.candidates.map(candidate => candidate.id)
		)).rejects.toThrow();

		expect(gateway.resources.size).toBe(0);
		expect((await store.load())[0]?.candidates.every(candidate => candidate.status === 'pending'))
			.toBe(true);
	});

	it('persists a field-specific diagnostic for invalid foreshadowing visibility', async () => {
		const { service, store } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '从正文生成伏笔候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '是',
			targetTypes: ['foreshadowing'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'foreshadowing:signal-tower-message',
						type: 'foreshadowing',
						title: '信号塔的无声警告',
						aliases: [],
						tags: ['信号塔'],
						evidenceIds: [],
						status: 'planted',
						reminderPositions: [],
						readerVisibility: 'hidden',
						plotThreadIds: []
					},
					confidence: 0.65,
					rationale: '候选需要作者确认。',
					evidence: { start: 0, end: 1, quote: '是' }
				}]
			}),
			now
		});

		const schemaConflict = batch.candidates[0]?.conflicts.find(
			item => item.code === 'invalid-schema'
		);
		expect(schemaConflict).toMatchObject({
			message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
			details: [{
				path: 'readerVisibility',
				expected: '0–1 之间的数字',
				actual: '"hidden"'
			}]
		});
		expect(schemaConflict?.details?.[0]?.message).toContain('不能使用“hidden”');
		expect((await store.load())[0]?.candidates[0]?.conflicts[0]?.details)
			.toEqual(schemaConflict?.details);
	});
});
