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

	constructor(content?: string) {
		this.content = content;
	}

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
	readonly trash = new Map<string, unknown>();
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

	moveStoryResourceToTrash(_root: string, type: string, id: string): Promise<void> {
		const key = this.key(type, id);
		const resource = this.resources.get(key);
		if (!resource) return Promise.reject(new Error('storyResourceNotFound'));
		this.trash.set(key, resource);
		this.resources.delete(key);
		return Promise.resolve();
	}

	restoreStoryResourceFromTrash(_root: string, type: string, id: string): Promise<unknown> {
		const key = this.key(type, id);
		const resource = this.trash.get(key);
		if (!resource) return Promise.reject(new Error('storyTrashNotFound'));
		this.resources.set(key, resource);
		this.trash.delete(key);
		return Promise.resolve(resource);
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

function createSceneResponse(
	candidates: readonly {
		readonly id: string;
		readonly title: string;
		readonly evidence: { readonly start: number; readonly end: number; readonly quote: string } | null;
		readonly positionalFields?: Readonly<Record<string, unknown>>;
	}[]
): string {
	return JSON.stringify({
		candidates: candidates.map(candidate => ({
			operation: 'create',
			resource: {
				id: candidate.id,
				type: 'scene',
				title: candidate.title,
				aliases: [],
				tags: [],
				evidenceIds: [],
				locationIds: [],
				participantIds: [],
				itemIds: [],
				plotThreadIds: [],
				revealInformationIds: [],
				foreshadowingIds: [],
				...candidate.positionalFields
			},
			confidence: 0.9,
			rationale: '正文描述了完整场景。',
			evidence: candidate.evidence
		}))
	});
}

function createEveryResourceTypeResponse(): string {
	const position = {
		chapterId: 'chapter:chapter-001',
		narrativeOrder: 0
	};
	const resources: readonly Record<string, unknown>[] = [
		{
			id: 'character:stress-protagonist',
			type: 'character',
			title: '压测主角',
			role: 'protagonist'
		},
		{
			id: 'character:stress-supporting',
			type: 'character',
			title: '压测配角',
			role: 'supporting'
		},
		{
			id: 'scene:stress-scene',
			type: 'scene',
			title: '压测场景'
		},
		{
			id: 'location:stress-station',
			type: 'location',
			title: '压测车站',
			mapPoint: null
		},
		{
			id: 'faction:stress-watch',
			type: 'faction',
			title: '压测守望会'
		},
		{
			id: 'item:stress-envelope',
			type: 'item',
			title: '压测信封',
			unique: null,
			restrictions: null
		},
		{
			id: 'world-rule:stress-silence',
			type: 'worldRule',
			title: '压测静默规则',
			statement: '零点后不得播报真实姓名。'
		},
		{
			id: 'timeline-event:stress-arrival',
			type: 'timelineEvent',
			title: '压测抵达',
			narrativePosition: position,
			eventType: 'arrival'
		},
		{
			id: 'relationship:stress-pair',
			type: 'relationship',
			title: '压测同盟',
			sourceCharacterId: 'character:stress-protagonist',
			targetCharacterId: 'character:stress-supporting',
			relationshipType: '同盟',
			visibility: 'private',
			effectiveFrom: position,
			history: []
		},
		{
			id: 'plot-thread:stress-signal',
			type: 'plotThread',
			title: '压测信号线',
			status: 'active'
		},
		{
			id: 'foreshadowing:stress-code',
			type: 'foreshadowing',
			title: '压测密码',
			readerVisibility: 0.2
		},
		{
			id: 'information:stress-truth',
			type: 'information',
			title: '压测真相',
			truthStatement: '信号来自已停运的车站。',
			authorSecret: true
		}
	];
	return JSON.stringify({
		candidates: resources.map(resource => ({
			operation: 'create',
			resource,
			confidence: 0.9,
			rationale: '正文提供了可核对的信息。',
			evidence: null
		}))
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
	it('stages and atomically confirms every generatable resource type with repaired safe defaults', async () => {
		const expectedTypes = [
			'character',
			'scene',
			'location',
			'faction',
			'item',
			'worldRule',
			'timelineEvent',
			'relationship',
			'plotThread',
			'foreshadowing',
			'information'
		] as const;
		const { gateway, service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '提取全部 Story Kernel 类型。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: expectedTypes,
			response: createEveryResourceTypeResponse(),
			now
		});

		expect(new Set(batch.candidates.map(candidate => candidate.resourceType)))
			.toEqual(new Set(expectedTypes));
		expect(batch.candidates).toHaveLength(12);
		expect(batch.candidates.every(candidate => (
			candidate.conflicts.length === 0 && candidate.normalizedResource !== undefined
		))).toBe(true);
		expect(batch.candidates.find(candidate => candidate.resourceType === 'item')?.normalizedResource)
			.toMatchObject({ unique: false, restrictions: [] });
		expect(batch.candidates.find(candidate => candidate.resourceType === 'location')?.normalizedResource)
			.not.toHaveProperty('mapPoint');

		const confirmed = await service.confirm(
			batch.id,
			batch.candidates.map(candidate => candidate.id),
			'2026-07-27T08:01:00.000Z'
		);
		expect(gateway.commitCalls).toBe(1);
		expect(gateway.resources).toHaveLength(12);
		expect(confirmed.candidates.every(candidate => candidate.status === 'accepted')).toBe(true);
	});

	it('recovers a persisted old item candidate without another AI request', async () => {
		const storage = new MemoryStorage(JSON.stringify({
			schemaVersion: 1,
			updatedAt: now,
			batches: [{
				id: 'generation-batch:old-item-defaults',
				schemaVersion: 1,
				sourceResourceId: 'chapter:chapter-001',
				sourceRevision: '7',
				baseOffset: 0,
				instruction: '提取蓝色信封。',
				targetTypes: ['item'],
				candidates: [{
					id: 'generation-candidate:old-blue-envelope',
					operation: 'create',
					resourceType: 'item',
					resourceId: 'item:blue-envelope',
					title: '蓝色信封',
					rawResource: {
						id: 'item:blue-envelope',
						type: 'item',
						title: '蓝色信封',
						aliases: [],
						tags: [],
						evidenceIds: [],
						description: '一只等待开启的蓝色信封。'
					},
					confidence: 0.95,
					rationale: '正文明确描述了蓝色信封。',
					conflicts: [{
						code: 'invalid-schema',
						message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
						blocking: true,
						details: [{
							path: 'unique',
							message: 'unique不符合 Story Kernel 约束：Invalid input',
							expected: '布尔值',
							actual: '未提供'
						}]
					}],
					status: 'pending',
					createdAt: now,
					updatedAt: now
				}],
				createdAt: now,
				updatedAt: now
			}]
		}));
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const store = new StoryKernelGenerationStore('D:/Novel', storage);
		const service = new StoryKernelGenerationService(store, repository);

		const reopened = await store.load();
		expect(reopened[0]?.candidates[0]).toMatchObject({
			conflicts: [],
			normalizedResource: {
				type: 'item',
				title: '蓝色信封',
				unique: false,
				restrictions: []
			}
		});

		const confirmed = await service.confirm(
			reopened[0].id,
			[reopened[0].candidates[0].id],
			'2026-07-27T08:01:00.000Z'
		);
		expect(confirmed.candidates[0]?.status).toBe('accepted');
		await expect(repository.get('item', 'item:blue-envelope')).resolves.toMatchObject({
			unique: false,
			restrictions: []
		});
	});

	it('repairs and confirms AI character role aliases before strict validation', async () => {
		const { repository, service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '从正文生成魏峥的人物候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '魏峥正在用黄铜扳手敲床栏。',
			targetTypes: ['character'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'character:wei-zheng',
						type: 'character',
						title: '魏峥',
						role: 'supporting_character'
					},
					confidence: 0.9,
					rationale: '正文明确出现魏峥。',
					evidence: { start: 0, end: 2, quote: '魏峥' }
				}]
			}),
			now
		});

		expect(batch.candidates[0]).toMatchObject({
			conflicts: [],
			rawResource: { role: 'supporting' },
			normalizedResource: { role: 'supporting' }
		});
		await service.confirm(batch.id, [batch.candidates[0]?.id ?? '']);
		await expect(repository.get('character', 'character:wei-zheng'))
			.resolves.toMatchObject({ role: 'supporting' });
	});

	it('recovers a persisted character blocked only by an optional role label', async () => {
		const storage = new MemoryStorage(JSON.stringify({
			schemaVersion: 1,
			updatedAt: now,
			batches: [{
				id: 'generation-batch:old-character-role',
				schemaVersion: 1,
				sourceResourceId: 'chapter:chapter-001',
				sourceRevision: '7',
				baseOffset: 0,
				instruction: '提取魏峥。',
				targetTypes: ['character'],
				candidates: [{
					id: 'generation-candidate:old-character-role',
					operation: 'create',
					resourceType: 'character',
					resourceId: 'character:wei-zheng',
					title: '魏峥',
					rawResource: {
						id: 'character:wei-zheng',
						type: 'character',
						title: '魏峥',
						aliases: [],
						tags: [],
						evidenceIds: [],
						role: '重要配角'
					},
					confidence: 0.9,
					rationale: '正文明确出现魏峥。',
					conflicts: [{
						code: 'invalid-schema',
						message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
						blocking: true,
						details: [{
							path: 'role',
							message: 'role需要使用protagonist / antagonist / supporting / minor。',
							expected: 'protagonist / antagonist / supporting / minor',
							actual: '"重要配角"'
						}]
					}],
					status: 'pending',
					createdAt: now,
					updatedAt: now
				}],
				createdAt: now,
				updatedAt: now
			}]
		}));
		const gateway = new MemoryStoryGateway();
		const repository = new DesktopStoryRepository('D:/Novel', gateway);
		const store = new StoryKernelGenerationStore('D:/Novel', storage);
		const service = new StoryKernelGenerationService(store, repository);

		const reopened = await store.load();
		expect(reopened[0]?.candidates[0]).toMatchObject({
			conflicts: [],
			rawResource: { role: 'supporting' },
			normalizedResource: { role: 'supporting' }
		});
		await service.confirm(
			reopened[0]?.id ?? '',
			[reopened[0]?.candidates[0]?.id ?? '']
		);
		await expect(repository.get('character', 'character:wei-zheng'))
			.resolves.toMatchObject({ role: 'supporting' });
	});

	it('keeps non-text character roles blocked instead of guessing', async () => {
		const { service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '从正文生成人物。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '魏峥。',
			targetTypes: ['character'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'character:bad-role',
						type: 'character',
						title: '魏峥',
						role: 42
					},
					confidence: 0.9,
					rationale: '正文明确出现人物。',
					evidence: { start: 0, end: 2, quote: '魏峥' }
				}]
			}),
			now
		});

		expect(batch.candidates[0]?.normalizedResource).toBeUndefined();
		expect(batch.candidates[0]?.conflicts).toEqual([
			expect.objectContaining({ code: 'invalid-schema' })
		]);
	});

	it('does not recover a persisted item with explicit wrong field types', async () => {
		const storage = new MemoryStorage(JSON.stringify({
			schemaVersion: 1,
			updatedAt: now,
			batches: [{
				id: 'generation-batch:bad-item-types',
				schemaVersion: 1,
				sourceResourceId: 'chapter:chapter-001',
				sourceRevision: '7',
				baseOffset: 0,
				instruction: '提取蓝色信封。',
				targetTypes: ['item'],
				candidates: [{
					id: 'generation-candidate:bad-blue-envelope',
					operation: 'create',
					resourceType: 'item',
					resourceId: 'item:blue-envelope',
					title: '蓝色信封',
					rawResource: {
						id: 'item:blue-envelope',
						type: 'item',
						title: '蓝色信封',
						aliases: [],
						tags: [],
						evidenceIds: [],
						unique: 'yes',
						restrictions: {}
					},
					confidence: 0.95,
					rationale: '正文明确描述了蓝色信封。',
					conflicts: [{
						code: 'invalid-schema',
						message: '字段结构不符合 Story Kernel，修正前无法确认写入。',
						blocking: true
					}],
					status: 'pending',
					createdAt: now,
					updatedAt: now
				}],
				createdAt: now,
				updatedAt: now
			}]
		}));
		const store = new StoryKernelGenerationStore('D:/Novel', storage);

		const reopened = await store.load();
		expect(reopened[0]?.candidates[0]?.normalizedResource).toBeUndefined();
		expect(reopened[0]?.candidates[0]?.conflicts).toEqual([
			expect.objectContaining({ code: 'invalid-schema' })
		]);
	});

	it('anchors, persists, reopens, and explicitly resolves chapter reconciliation', async () => {
		const { service, store } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '整理本章并对照计划。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['timelineEvent'],
			chapterPlan: {
				nodeId: 'journey-outline:chapter-001',
				revision: 4,
				locked: false,
				title: '找到沈青',
				summary: '林越在旧车站找到沈青。',
				goal: '找到沈青',
				conflict: '车站被封锁',
				outcome: '沈青答应同行',
				hook: '沈青交出车票'
			},
			response: JSON.stringify({
				candidates: [],
				reconciliation: {
					actual: {
						summary: '林越在旧车站遇见沈青。',
						goal: '找到沈青',
						conflict: '车站被封锁',
						outcome: '两人只完成初次相遇',
						hook: '沈青仍未交出车票'
					},
					differences: [{
						field: 'outcome',
						planned: '沈青答应同行',
						actual: '两人只完成初次相遇',
						evidence: { start: 6, end: 10, quote: '遇见沈青' }
					}]
				}
			}),
			now
		});

		expect(batch.chapterReconciliation).toMatchObject({
			planNodeId: 'journey-outline:chapter-001',
			planRevision: 4,
			status: 'pending'
		});
		expect(batch.chapterReconciliation?.differences[0]?.evidence).toMatchObject({
			resourceId: 'chapter:chapter-001',
			revisionId: '7',
			quotePreview: '遇见沈青',
			confirmedByAuthor: false
		});
		expect((await store.load())[0]?.chapterReconciliation).toEqual(
			batch.chapterReconciliation
		);

		const resolved = await service.resolveChapterReconciliation(
			batch.id,
			'difference-kept',
			'2026-07-27T08:02:00.000Z'
		);
		expect(resolved.chapterReconciliation?.status).toBe('difference-kept');
		await expect(
			service.resolveChapterReconciliation(batch.id, 'outline-updated')
		).rejects.toThrow('chapterReconciliationAlreadyResolved');
	});

	it('rejects reconciliation values that diverge from the submitted plan or actual record', async () => {
		const { service } = createHarness();
		const common = {
			instruction: '整理本章并对照计划。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['character'] as const,
			chapterPlan: {
				nodeId: 'journey-outline:chapter-one',
				revision: 4,
				locked: false,
				title: '第一章',
				summary: '林越前往旧车站。',
				goal: '找到沈青',
				conflict: '车站被封锁',
				outcome: '沈青答应同行',
				hook: '沈青交出车票'
			},
			now
		};
		const actual = {
			summary: '林越在旧车站遇见沈青。',
			goal: '找到沈青',
			conflict: '车站被封锁',
			outcome: '两人只完成初次相遇',
			hook: '沈青仍未交出车票'
		};
		const evidence = { start: 6, end: 10, quote: '遇见沈青' };

		await expect(service.stageFromResponse({
			...common,
			response: JSON.stringify({
				candidates: [],
				reconciliation: {
					actual,
					differences: [{
						field: 'outcome',
						planned: '并非输入计划',
						actual: actual.outcome,
						evidence
					}]
				}
			})
		})).rejects.toThrow('invalidChapterReconciliationResponse');
		await expect(service.stageFromResponse({
			...common,
			response: JSON.stringify({
				candidates: [],
				reconciliation: {
					actual,
					differences: [{
						field: 'outcome',
						planned: common.chapterPlan.outcome,
						actual: '与 actual.outcome 不一致',
						evidence
					}]
				}
			})
		})).rejects.toThrow('invalidChapterReconciliationResponse');
	});

	it('keeps valid candidates when a later candidate is structurally incomplete', async () => {
		const { service, store } = createHarness();
		const response = JSON.parse(createResponse()) as {
			candidates: Array<Record<string, unknown>>;
		};
		response.candidates.push({
			operation: 'create',
			resource: {
				id: 'location:broken',
				type: 'location',
				title: null,
				aliases: [],
				tags: [],
				evidenceIds: []
			},
			confidence: 0.8,
			rationale: '结构不完整。',
			evidence: null
		});

		const batch = await service.stageFromResponse({
			instruction: '从正文生成候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['character', 'location', 'relationship'],
			response: JSON.stringify(response),
			now
		});

		expect(batch.candidates).toHaveLength(4);
		expect(batch.responseDiagnostics).toEqual([{
			candidateIndex: 4,
			path: 'candidates.4.resource',
			code: 'invalidStoryKernelGenerationResource'
		}]);
		await expect(store.load()).resolves.toEqual([
			expect.objectContaining({ responseDiagnostics: batch.responseDiagnostics })
		]);
	});

	it('stages an item with conservative defaults when AI omits item-only fields', async () => {
		const { repository, service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '提取正文中的蓝色信封。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['item'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'item:blue-envelope',
						type: 'item',
						title: '蓝色信封',
						aliases: [],
						tags: [],
						evidenceIds: [],
						description: '一只等待开启的蓝色信封。'
					},
					confidence: 0.95,
					rationale: '正文明确出现该物品。',
					evidence: null
				}]
			}),
			now
		});

		expect(batch.candidates).toHaveLength(1);
		expect(batch.candidates[0]).toMatchObject({
			conflicts: [],
			normalizedResource: {
				type: 'item',
				title: '蓝色信封',
				unique: false,
				restrictions: []
			}
		});

		const confirmed = await service.confirm(
			batch.id,
			[batch.candidates[0].id],
			'2026-07-27T08:01:00.000Z'
		);
		expect(confirmed.candidates[0]?.status).toBe('accepted');
		await expect(repository.get('item', 'item:blue-envelope')).resolves.toMatchObject({
			unique: false,
			restrictions: []
		});
	});

	it('keeps explicitly malformed item fields blocked instead of coercing them', async () => {
		const { service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '提取正文中的蓝色信封。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['item'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'item:blue-envelope',
						type: 'item',
						title: '蓝色信封',
						aliases: [],
						tags: [],
						evidenceIds: [],
						unique: 'yes',
						restrictions: {}
					},
					confidence: 0.95,
					rationale: '正文明确出现该物品。',
					evidence: null
				}]
			}),
			now
		});

		expect(batch.candidates[0]?.normalizedResource).toBeUndefined();
		expect(batch.candidates[0]?.conflicts).toEqual([
			expect.objectContaining({ code: 'invalid-schema' })
		]);
	});

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

	it('returns an undo receipt and reverses newly created resources into recoverable Trash', async () => {
		const { gateway, repository, service, store } = createHarness();
		const batch = await stageValidBatch(service);
		const selected = batch.candidates.map(candidate => candidate.id);

		const confirmation = await service.confirmWithReceipt(
			batch.id,
			selected,
			'2026-07-27T08:01:00.000Z'
		);
		expect(confirmation.receipt.entries).toHaveLength(4);
		expect(confirmation.receipt.entries.every(entry => entry.before === undefined)).toBe(true);

		const reverted = await service.undoConfirmation(
			confirmation.receipt,
			'2026-07-27T08:02:00.000Z'
		);
		expect(reverted.candidates.every(candidate => candidate.status === 'rejected')).toBe(true);
		expect(await repository.get('character', 'character:lin-yue')).toBeUndefined();
		expect(gateway.trash.size).toBe(4);
		expect((await store.load())[0]?.candidates.every(candidate => (
			candidate.status === 'rejected'
		))).toBe(true);
	});

	it('restores an updated resource and refuses undo after a concurrent revision change', async () => {
		const { gateway, repository, service } = createHarness();
		const original = await repository.save({
			id: 'location:old-station',
			type: 'location',
			title: '旧车站',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			locationType: '废弃车站',
			travelLinks: [],
			factionIds: [],
			rules: [],
			evidenceIds: []
		}, 0);
		const originalAuthorFields = Object.fromEntries(
			Object.entries(original).filter(([key]) => (
				!['schemaVersion', 'createdAt', 'updatedAt', 'revision'].includes(key)
			))
		);
		const batch = await service.stageFromResponse({
			instruction: '只更新正文明确说明的地点。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '旧车站已经重新开放。',
			targetTypes: ['location'],
			response: JSON.stringify({
				candidates: [{
					operation: 'update',
					resource: {
						...originalAuthorFields,
						title: '重新开放的旧车站'
					},
					confidence: 0.95,
					rationale: '正文明确说明车站重新开放。',
					evidence: { start: 0, end: 9, quote: '旧车站已经重新开放' }
				}]
			}),
			now
		});
		const confirmation = await service.confirmWithReceipt(
			batch.id,
			[batch.candidates[0]?.id ?? '']
		);
		expect((await repository.get('location', original.id))?.title)
			.toBe('重新开放的旧车站');

		await service.undoConfirmation(confirmation.receipt);
		expect(await repository.get('location', original.id)).toMatchObject({
			title: '旧车站',
			revision: 3
		});

		const currentLocation = await repository.get('location', original.id);
		if (!currentLocation) throw new Error('testLocationMissing');
		const currentAuthorFields = Object.fromEntries(
			Object.entries(currentLocation).filter(([key]) => (
				!['schemaVersion', 'createdAt', 'updatedAt', 'revision'].includes(key)
			))
		);
		const nextBatch = await service.stageFromResponse({
			instruction: '再次更新地点。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '8',
			content: '车站再次停运。',
			targetTypes: ['location'],
			response: JSON.stringify({
				candidates: [{
					operation: 'update',
					resource: {
						...currentAuthorFields,
						title: '再次停运的旧车站'
					},
					confidence: 0.9,
					rationale: '正文明确说明再次停运。',
					evidence: { start: 0, end: 6, quote: '车站再次停运' }
				}]
			})
		});
		const nextConfirmation = await service.confirmWithReceipt(
			nextBatch.id,
			[nextBatch.candidates[0]?.id ?? '']
		);
		const key = `location:${original.id}`;
		const current = gateway.resources.get(key) as { readonly revision: number };
		gateway.resources.set(key, { ...current, revision: current.revision + 1 });

		await expect(service.undoConfirmation(nextConfirmation.receipt))
			.rejects.toThrow('storyKernelGenerationUndoConflict');
		expect(await repository.get('location', original.id)).toMatchObject({
			title: '再次停运的旧车站'
		});
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

	it('grounds a scene from the authoritative source and re-anchors a unique quote', async () => {
		const { repository, service } = createHarness();
		const sceneContent = '夜雨落在旧车站的玻璃顶上。';
		const batch = await service.stageFromResponse({
			instruction: '从正文生成场景候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: sceneContent,
			baseOffset: 12,
			targetTypes: ['scene'],
			response: createSceneResponse([{
				id: 'scene:rainy-old-station',
				title: '夜雨旧站',
				evidence: { start: 99, end: 101, quote: '夜雨' },
				positionalFields: {
					chapterId: 'chapter:model-invented',
					manuscriptRange: {
						start: 999,
						end: 1_999,
						revision: 999,
						quote: '模型臆造的位置'
					},
					narrativeOrder: 999
				}
			}]),
			now
		});

		const candidate = batch.candidates[0];
		expect(candidate?.conflicts).toEqual([]);
		expect(candidate?.evidence).toMatchObject({
			resourceId: 'chapter:chapter-001',
			range: { start: 12, end: 14 },
			revisionId: '7',
			quotePreview: '夜雨'
		});
		expect(candidate?.normalizedResource).toMatchObject({
			id: 'scene:rainy-old-station',
			type: 'scene',
			chapterId: 'chapter:chapter-001',
			manuscriptRange: {
				start: 12,
				end: 12 + sceneContent.length,
				revision: 7,
				quote: sceneContent
			},
			narrativeOrder: 0
		});

		await expect(service.confirm(batch.id, [candidate?.id ?? ''])).resolves.toMatchObject({
			candidates: [expect.objectContaining({ status: 'accepted' })]
		});
		expect(await repository.get('scene', 'scene:rainy-old-station')).toMatchObject({
			chapterId: 'chapter:chapter-001',
			manuscriptRange: { start: 12, end: 12 + sceneContent.length }
		});
	});

	it('blocks ambiguous evidence instead of guessing between repeated quotes', async () => {
		const { service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '从正文生成人物候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '林越回头，林越停步。',
			targetTypes: ['character'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'character:lin-yue-repeat',
						type: 'character',
						title: '林越',
						aliases: [],
						tags: [],
						evidenceIds: [],
						factionIds: [],
						goals: [],
						desires: [],
						fears: [],
						values: [],
						secrets: []
					},
					confidence: 0.9,
					rationale: '正文明确出现人物。',
					evidence: { start: 99, end: 101, quote: '林越' }
				}]
			}),
			now
		});

		expect(batch.candidates[0]?.conflicts.map(item => item.code))
			.toContain('invalid-evidence');
		expect(batch.candidates[0]?.evidence).toBeUndefined();
	});

	it('omits null optional location fields and persists the valid candidate', async () => {
		const { repository, service } = createHarness();
		await repository.save({
			id: 'location:station-yard',
			type: 'location',
			title: '站外空地',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			travelLinks: [],
			factionIds: [],
			rules: [],
			evidenceIds: []
		}, 0);
		const content = '夜雨落在旧车站的玻璃顶上';
		const batch = await service.stageFromResponse({
			instruction: '从正文生成地点候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content,
			targetTypes: ['location'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'location:old-station-roof',
						type: 'location',
						title: '旧车站玻璃顶',
						aliases: [],
						summary: null,
						tags: [],
						evidenceIds: [],
						parentLocationId: null,
						locationType: '车站构造',
						mapPoint: null,
						travelLinks: [{
							targetLocationId: 'location:station-yard',
							minimumMinutes: 2,
							mode: null
						}],
						factionIds: [],
						rules: []
					},
					confidence: 0.9,
					rationale: '原文明确提到旧车站的玻璃顶。',
					evidence: { start: 3, end: content.length, quote: content.slice(3) }
				}]
			}),
			now
		});

		const candidate = batch.candidates[0];
		expect(candidate?.conflicts).toEqual([]);
		expect(candidate?.normalizedResource).not.toHaveProperty('summary');
		expect(candidate?.normalizedResource).not.toHaveProperty('parentLocationId');
		expect(candidate?.normalizedResource).not.toHaveProperty('mapPoint');
		expect(candidate?.normalizedResource).toMatchObject({
			travelLinks: [{
				targetLocationId: 'location:station-yard',
				minimumMinutes: 2
			}]
		});
		expect(candidate?.normalizedResource).not.toHaveProperty('travelLinks.0.mode');

		await expect(service.confirm(batch.id, [candidate?.id ?? ''])).resolves.toMatchObject({
			candidates: [expect.objectContaining({ status: 'accepted' })]
		});
		expect(await repository.get('location', 'location:old-station-roof')).toMatchObject({
			id: 'location:old-station-roof',
			title: '旧车站玻璃顶',
			locationType: '车站构造'
		});
	});

	it('keeps required null fields blocked at the response boundary', async () => {
		const { service } = createHarness();
		await expect(service.stageFromResponse({
			instruction: '从正文生成地点候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '旧车站',
			targetTypes: ['location'],
			response: JSON.stringify({
				candidates: [{
					operation: 'create',
					resource: {
						id: 'location:missing-title',
						type: 'location',
						title: null,
						aliases: [],
						tags: [],
						evidenceIds: [],
						mapPoint: null,
						travelLinks: [],
						factionIds: [],
						rules: []
					},
					confidence: 0.9,
					rationale: '候选缺少必填标题。',
					evidence: { start: 0, end: 3, quote: '旧车站' }
				}]
			}),
			now
		})).rejects.toThrow('invalidStoryKernelGenerationResource');
	});

	it('does not hide unknown null fields or null array entries', async () => {
		const { service } = createHarness();
		const batch = await service.stageFromResponse({
			instruction: '从正文生成地点候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: '旧车站',
			targetTypes: ['location'],
			response: JSON.stringify({
				candidates: [
					{
						operation: 'create',
						resource: {
							id: 'location:unknown-null-field',
							type: 'location',
							title: '未知字段地点',
							aliases: [],
							tags: [],
							evidenceIds: [],
							modelInventedField: null,
							travelLinks: [],
							factionIds: [],
							rules: []
						},
						confidence: 0.8,
						rationale: '包含未知字段。',
						evidence: { start: 0, end: 3, quote: '旧车站' }
					},
					{
						operation: 'create',
						resource: {
							id: 'location:null-array-entry',
							type: 'location',
							title: '空数组项地点',
							aliases: [],
							tags: [],
							evidenceIds: [],
							travelLinks: [],
							factionIds: [],
							rules: [null]
						},
						confidence: 0.8,
						rationale: '数组包含 null。',
						evidence: { start: 0, end: 3, quote: '旧车站' }
					}
				]
			}),
			now
		});

		for (const candidate of batch.candidates) {
			expect(candidate.normalizedResource).toBeUndefined();
			expect(candidate.conflicts.map(item => item.code)).toContain('invalid-schema');
		}
	});

	it('blocks overlapping and multiple scene candidates for one source range', async () => {
		const { repository, service } = createHarness();
		await repository.save({
			id: 'scene:existing',
			type: 'scene',
			title: '已有场景',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 0,
			chapterId: 'chapter:chapter-001',
			manuscriptRange: { start: 0, end: 2, revision: 7, quote: '夜雨' },
			narrativeOrder: 0,
			locationIds: [],
			participantIds: [],
			plotThreadIds: [],
			revealInformationIds: [],
			foreshadowingIds: [],
			evidenceIds: []
		}, 0);
		const sceneContent = '夜雨落在旧车站。';
		const batch = await service.stageFromResponse({
			instruction: '从正文生成场景候选。',
			sourceResourceId: 'chapter:chapter-001',
			sourceRevision: '7',
			content: sceneContent,
			targetTypes: ['scene'],
			response: createSceneResponse([
				{ id: 'scene:first', title: '第一候选', evidence: null },
				{ id: 'scene:second', title: '第二候选', evidence: null }
			]),
			now
		});

		for (const candidate of batch.candidates) {
			expect(candidate.conflicts.map(item => item.message)).toEqual(expect.arrayContaining([
				expect.stringContaining('当前正文范围已属于场景'),
				expect.stringContaining('一次正文范围只能生成一个新场景候选')
			]));
		}
	});
});
