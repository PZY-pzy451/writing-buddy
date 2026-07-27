import { EditTransactionService } from '@writing-buddy/project';
import {
	DesktopStoryRepository,
	StorySchemaRegistry,
	buildContextPack,
	parseItemState,
	parseStoryItem,
	parseTimelineEvent,
	runItemRules,
	runTimelineRules,
	type StoryResource,
	type StoryResourceType,
	type StorySaveEntry,
	type StoryStorageGateway
} from '@writing-buddy/story-kernel';
import {
	createRewriteCandidate,
	loadGroundedContextCandidates,
	SelectionRewriteService
} from '../../src/features/story/ai-context/SelectionRewriteService';

const timestamp = '2026-07-27T00:00:00.000Z';
const projectRoot = 'memory://storyforge-professional-slice';

function key(type: StoryResourceType, id: string): string {
	return `${type}:${id}`;
}

class RestartableStoryGateway implements StoryStorageGateway {
	private resources = new Map<string, StoryResource>();
	private trash = new Map<string, StoryResource>();

	getStoryResource(
		_root: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		return Promise.resolve(this.resources.get(key(type, id)));
	}

	listStoryResources(_root: string, type: StoryResourceType): Promise<readonly unknown[]> {
		return Promise.resolve([...this.resources.values()]
			.filter(resource => resource.type === type));
	}

	saveStoryResources(
		_root: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]> {
		const saved = entries.map(entry => {
			const input = entry.resource as { readonly type: StoryResourceType; readonly id: string };
			const parsed = StorySchemaRegistry.parse(input.type, entry.resource);
			const current = this.resources.get(key(parsed.type, parsed.id));
			if (
				entry.expectedRevision !== undefined
				&& current?.revision !== entry.expectedRevision
			) {
				throw new Error(`storyRevisionConflict:${current?.revision ?? -1}`);
			}
			const next = StorySchemaRegistry.parse(parsed.type, {
				...parsed,
				revision: current ? current.revision + 1 : parsed.revision
			});
			this.resources.set(key(next.type, next.id), next);
			return next;
		});
		return Promise.resolve(saved);
	}

	moveStoryResourceToTrash(
		_root: string,
		type: StoryResourceType,
		id: string
	): Promise<void> {
		const resourceKey = key(type, id);
		const resource = this.resources.get(resourceKey);
		if (!resource) return Promise.reject(new Error('storyResourceNotFound'));
		this.trash.set(resourceKey, resource);
		this.resources.delete(resourceKey);
		return Promise.resolve();
	}

	restoreStoryResourceFromTrash(
		_root: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		const resourceKey = key(type, id);
		const resource = this.trash.get(resourceKey);
		if (!resource) return Promise.reject(new Error('storyTrashNotFound'));
		this.resources.set(resourceKey, resource);
		this.trash.delete(resourceKey);
		return Promise.resolve(resource);
	}

	snapshot(): string {
		return JSON.stringify(
			[...this.resources.values()].sort((left, right) => left.id.localeCompare(right.id))
		);
	}

	restore(snapshot: string): void {
		const resources = JSON.parse(snapshot) as readonly unknown[];
		this.resources = new Map(resources.map(value => {
			const input = value as { readonly type: StoryResourceType };
			const parsed = StorySchemaRegistry.parse(input.type, value);
			return [key(parsed.type, parsed.id), parsed];
		}));
		this.trash.clear();
	}

	backup(): string {
		return JSON.stringify({
			schemaVersion: 1,
			projectRoot,
			resources: JSON.parse(this.snapshot()) as readonly unknown[]
		});
	}

	static restartFromBackup(backup: string): RestartableStoryGateway {
		const envelope = JSON.parse(backup) as {
			readonly schemaVersion: number;
			readonly resources: readonly unknown[];
		};
		if (envelope.schemaVersion !== 1) throw new Error('unsupportedBackupVersion');
		const gateway = new RestartableStoryGateway();
		gateway.restore(JSON.stringify(envelope.resources));
		return gateway;
	}
}

function base(id: string, type: StoryResourceType, title: string) {
	return {
		id,
		type,
		title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0
	} as const;
}

describe('StoryForge professional editor vertical slice', () => {
	it('keeps author control from Story creation through review, AI Undo and recovery', async () => {
		const manuscript = '夜雨落在旧车站的玻璃顶上。林越攥紧黑色笔记本，等待沈青。';
		const gateway = new RestartableStoryGateway();
		const repository = new DesktopStoryRepository(projectRoot, gateway);
		const resources = [{
			...base('character:lin-yue', 'character', '林越'),
			role: 'protagonist',
			factionIds: [],
			goals: ['确认沈青的身份'],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		}, {
			...base('character:shen-qing', 'character', '沈青'),
			role: 'supporting',
			factionIds: [],
			goals: ['保护林越'],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		}, {
			...base('location:old-station', 'location', '旧车站'),
			locationType: 'station',
			mapPoint: { x: 42, y: 58 },
			travelLinks: [],
			factionIds: [],
			rules: ['午夜后停止客运'],
			evidenceIds: []
		}, {
			...base('item:black-notebook', 'item', '黑色笔记本'),
			unique: true,
			description: '记载旧案线索的唯一笔记本。',
			restrictions: [],
			plotFunction: '推动身份谜题',
			evidenceIds: []
		}, {
			...base('scene:station-rain', 'scene', '雨夜车站'),
			chapterId: 'chapter:chapter-001',
			manuscriptRange: {
				start: 0,
				end: manuscript.length,
				revision: 0,
				quote: manuscript
			},
			narrativeOrder: 0,
			povCharacterId: 'character:lin-yue',
			locationIds: ['location:old-station'],
			participantIds: ['character:lin-yue', 'character:shen-qing'],
			plotThreadIds: [],
			revealInformationIds: [],
			foreshadowingIds: [],
			evidenceIds: []
		}, {
			...base('timeline-event:station-meeting', 'timelineEvent', '车站相遇'),
			storyStart: '2026-07-27T20:00:00.000Z',
			storyEnd: '2026-07-27T20:10:00.000Z',
			storyTimeKind: 'exact',
			narrativePosition: {
				chapterId: 'chapter:chapter-001',
				sceneId: 'scene:station-rain',
				narrativeOrder: 0
			},
			eventType: 'meeting',
			participantIds: ['character:lin-yue', 'character:shen-qing'],
			locationIds: ['location:old-station'],
			itemIds: ['item:black-notebook'],
			predecessorIds: [],
			consequenceIds: [],
			plotThreadIds: [],
			informationIds: [],
			evidenceIds: []
		}, {
			...base('relationship:lin-shen-doubt', 'relationship', '林越怀疑沈青'),
			sourceCharacterId: 'character:lin-yue',
			targetCharacterId: 'character:shen-qing',
			relationshipType: '怀疑',
			strength: 0.7,
			visibility: 'private',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				sceneId: 'scene:station-rain',
				narrativeOrder: 0
			},
			evidenceIds: [],
			history: []
		}];

		const created = await repository.commit(resources.map(resource => ({ resource })));
		expect(created).toHaveLength(7);
		expect(await repository.list('character')).toHaveLength(2);

		const itemStates = [parseItemState({
			id: 'item-state:notebook-acquired',
			itemId: 'item:black-notebook',
			action: 'acquired',
			quantity: 1,
			holderCharacterId: 'character:lin-yue',
			locationId: 'location:old-station',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				sceneId: 'scene:station-rain',
				narrativeOrder: 0
			},
			effectiveUntil: {
				chapterId: 'chapter:chapter-001',
				sceneId: 'scene:station-rain',
				narrativeOrder: 1
			},
			evidenceIds: [],
			confirmation: 'confirmed',
			revision: 0
		}), parseItemState({
			id: 'item-state:notebook-transferred',
			itemId: 'item:black-notebook',
			action: 'transferred',
			quantity: 1,
			holderCharacterId: 'character:shen-qing',
			locationId: 'location:old-station',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				sceneId: 'scene:station-rain',
				narrativeOrder: 1
			},
			evidenceIds: [],
			confirmation: 'confirmed',
			revision: 0
		})];
		const reviewIssues = [
			...runTimelineRules({
				events: (await repository.list('timelineEvent'))
					.map(value => parseTimelineEvent(value as never)),
				travelLinks: []
			}),
			...runItemRules(
				(await repository.list('item')).map(value => parseStoryItem(value as never)),
				itemStates
			)
		];
		expect(reviewIssues).toEqual([]);

		const selectionText = '攥紧黑色笔记本';
		const selectionStart = manuscript.indexOf(selectionText);
		const candidates = await loadGroundedContextCandidates({
			repository,
			chapterId: 'chapter:chapter-001',
			selectionStart
		});
		const pack = buildContextPack({
			actionType: 'polish',
			instruction: '保持事实不变，增强动作力度。',
			selection: {
				text: selectionText,
				resourceId: 'chapter:chapter-001',
				revision: 0,
				start: selectionStart,
				end: selectionStart + selectionText.length
			},
			candidates,
			budgetTokens: 2_048
		});
		expect(pack.items.some(item => item.kind === 'scene' && item.included)).toBe(true);
		expect(pack.items.some(item => item.kind === 'character' && item.included)).toBe(true);

		const rewrite = createRewriteCandidate({
			pack,
			response: {
				suggestion: '死死攥住黑色笔记本',
				rationale: '增强动作力度，不改变持有关系。',
				potentialImpact: '仅调整句子节奏。'
			}
		});
		const rewriteService = new SelectionRewriteService(new EditTransactionService());
		const applied = rewriteService.accept(rewrite, 0, manuscript);
		expect(applied.content).toContain('死死攥住黑色笔记本');
		expect(rewriteService.undo(applied.content).content).toBe(manuscript);

		const snapshot = gateway.snapshot();
		const lin = await repository.get('character', 'character:lin-yue');
		expect(lin).toBeDefined();
		await repository.save({ ...lin, title: '临时标题' }, lin?.revision);
		gateway.restore(snapshot);
		expect((await repository.get('character', 'character:lin-yue'))?.title).toBe('林越');

		const backup = gateway.backup();
		const restartedGateway = RestartableStoryGateway.restartFromBackup(backup);
		const restartedRepository = new DesktopStoryRepository(projectRoot, restartedGateway);
		expect(await restartedRepository.list('relationship')).toHaveLength(1);
		await restartedRepository.moveToTrash('item', 'item:black-notebook');
		expect(await restartedRepository.list('item')).toHaveLength(0);

		restartedGateway.restore(
			JSON.stringify((JSON.parse(backup) as { readonly resources: readonly unknown[] }).resources)
		);
		const restoredRepository = new DesktopStoryRepository(projectRoot, restartedGateway);
		expect(await restoredRepository.list('item')).toHaveLength(1);
		expect(await restoredRepository.list('scene')).toHaveLength(1);
		expect(restartedGateway.snapshot()).toBe(snapshot);
	});
});
