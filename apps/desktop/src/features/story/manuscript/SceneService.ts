import {
	assertSceneRange,
	sceneRangesOverlap,
	type StoryRepository,
	type StoryScene
} from '@writing-buddy/story-kernel';

export interface CreateSceneInput {
	readonly chapterId: string;
	readonly title: string;
	readonly start: number;
	readonly end: number;
	readonly manuscript: string;
}

export class SceneOverlapError extends Error {
	constructor(readonly conflictingSceneId: string) {
		super('Scene ranges cannot overlap.');
		this.name = 'SceneOverlapError';
	}
}

function defaultSceneId(): string {
	return `scene:${globalThis.crypto.randomUUID()}`;
}

function currentUtc(): string {
	return new Date().toISOString();
}

export class SceneService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createId: () => string = defaultSceneId,
		private readonly now: () => string = currentUtc
	) {}

	async listScenesForChapter(chapterId: string): Promise<readonly StoryScene[]> {
		const scenes = await this.repository.list<StoryScene>('scene');
		return scenes
			.filter(scene => scene.chapterId === chapterId)
			.sort((left, right) => (
				left.narrativeOrder - right.narrativeOrder
				|| left.manuscriptRange.start - right.manuscriptRange.start
			));
	}

	async createScene(input: CreateSceneInput): Promise<StoryScene> {
		assertSceneRange(input, input.manuscript.length);
		const scenes = await this.listScenesForChapter(input.chapterId);
		this.assertNoOverlap(scenes, input);
		const timestamp = this.now();
		const saved = await this.repository.save({
			id: this.createId(),
			type: 'scene',
			title: input.title,
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			chapterId: input.chapterId,
			manuscriptRange: {
				start: input.start,
				end: input.end,
				revision: 0,
				quote: input.manuscript.slice(input.start, input.end).slice(0, 500)
			},
			narrativeOrder: scenes.length,
			locationIds: [],
			participantIds: [],
			plotThreadIds: [],
			revealInformationIds: [],
			foreshadowingIds: []
		}, 0);
		return saved as StoryScene;
	}

	async updateSceneRange(
		sceneId: string,
		start: number,
		end: number,
		manuscript: string
	): Promise<StoryScene> {
		assertSceneRange({ start, end }, manuscript.length);
		const scene = await this.repository.get<StoryScene>('scene', sceneId);
		if (!scene) {
			throw new Error('storyResourceNotFound');
		}
		const others = (await this.listScenesForChapter(scene.chapterId))
			.filter(candidate => candidate.id !== scene.id);
		this.assertNoOverlap(others, { start, end });
		const saved = await this.repository.save({
			...scene,
			manuscriptRange: {
				start,
				end,
				revision: scene.manuscriptRange.revision,
				quote: manuscript.slice(start, end).slice(0, 500)
			}
		}, scene.revision);
		return saved as StoryScene;
	}

	async findSceneAtOffset(
		chapterId: string,
		offset: number
	): Promise<StoryScene | undefined> {
		return (await this.listScenesForChapter(chapterId)).find(scene => (
			scene.manuscriptRange.start <= offset && offset < scene.manuscriptRange.end
		));
	}

	unlinkScene(sceneId: string): Promise<void> {
		return this.repository.moveToTrash('scene', sceneId);
	}

	private assertNoOverlap(
		scenes: readonly StoryScene[],
		range: { readonly start: number; readonly end: number }
	): void {
		const conflict = scenes.find(scene => sceneRangesOverlap(scene.manuscriptRange, range));
		if (conflict) {
			throw new SceneOverlapError(conflict.id);
		}
	}
}
