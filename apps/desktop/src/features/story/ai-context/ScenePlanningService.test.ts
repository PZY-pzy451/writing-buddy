import type {
	StoryRepository,
	StoryResource,
	StoryScene
} from '@writing-buddy/story-kernel';
import {
	ScenePlanningService,
	createScenePlanCandidate,
	type ScenePlanField
} from './ScenePlanningService';

const scene: StoryScene = {
	id: 'scene:station',
	type: 'scene',
	title: '雨夜车站',
	aliases: [],
	tags: [],
	schemaVersion: 1,
	createdAt: '2026-07-27T00:00:00.000Z',
	updatedAt: '2026-07-27T00:00:00.000Z',
	revision: 2,
	chapterId: 'chapter:one',
	manuscriptRange: { start: 0, end: 7, revision: 4, quote: '雨落在站台。' },
	narrativeOrder: 0,
	locationIds: [],
	participantIds: [],
	goal: '找到入口。',
	plotThreadIds: [],
	revealInformationIds: [],
	foreshadowingIds: [],
	evidenceIds: []
};

class SceneRepository implements StoryRepository {
	current = scene;
	readonly events: string[];

	constructor(events: string[]) {
		this.events = events;
	}

	get<T extends StoryResource = StoryResource>(): Promise<T | undefined> {
		return Promise.resolve(this.current as T);
	}

	list<T extends StoryResource = StoryResource>(): Promise<readonly T[]> {
		return Promise.resolve([this.current] as unknown as readonly T[]);
	}

	save(resource: unknown, expectedRevision?: number): Promise<StoryResource> {
		this.events.push(`save:${expectedRevision}`);
		this.current = { ...(resource as StoryScene), revision: 3 };
		return Promise.resolve(this.current);
	}

	commit(): Promise<readonly StoryResource[]> {
		return Promise.resolve([]);
	}

	moveToTrash(): Promise<void> {
		return Promise.resolve();
	}

	restoreFromTrash(): Promise<StoryResource> {
		return Promise.reject(new Error('notNeeded'));
	}
}

describe('ScenePlanningService', () => {
	it('snapshots and applies only selected fields with a scene revision guard', async () => {
		const events: string[] = [];
		const repository = new SceneRepository(events);
		const service = new ScenePlanningService(repository, () => {
			events.push('snapshot');
			return Promise.resolve('snapshot:scene-plan');
		});
		const candidate = createScenePlanCandidate({
			mode: 'generate-outline',
			resourceId: 'chapter:one',
			sourceRevision: 4,
			sourceText: '雨落在站台。',
			scene,
			response: {
				goal: '找到失踪者。',
				conflict: '站务员阻拦。',
				turn: '钟声恢复。',
				outcome: '发现地下通道。',
				emotionBeats: [{ label: '逼近', emotion: '警觉', intensity: 0.8 }],
				rationale: '依据正文。'
			}
		});
		const selected: readonly ScenePlanField[] = ['conflict', 'turn'];

		const saved = await service.apply(candidate, selected, 4, '雨落在站台。', scene);

		expect(events).toEqual(['snapshot', 'save:2']);
		expect(saved.goal).toBe('找到入口。');
		expect(saved.conflict).toBe('站务员阻拦。');
		expect(saved.turn).toBe('钟声恢复。');
		expect(saved.outcome).toBeUndefined();
	});

	it('rejects stale manuscript and scene revisions before snapshot', async () => {
		const events: string[] = [];
		const service = new ScenePlanningService(new SceneRepository(events), () => {
			events.push('snapshot');
			return Promise.resolve('snapshot:scene-plan');
		});
		const candidate = createScenePlanCandidate({
			mode: 'generate-goal',
			resourceId: 'chapter:one',
			sourceRevision: 4,
			sourceText: '雨落在站台。',
			scene,
			response: { goal: '找到失踪者。', rationale: '依据正文。' }
		});

		await expect(service.apply(
			candidate,
			['goal'],
			5,
			'雨落在站台。',
			scene
		)).rejects.toThrow('staleScenePlanCandidate');
		await expect(service.apply(
			candidate,
			['goal'],
			4,
			'雨落在站台。',
			{ ...scene, revision: 3 }
		)).rejects.toThrow('staleScenePlanCandidate');
		expect(events).toEqual([]);
	});
});
