import type { ScenePlanActionType, ScenePlanResponse } from '@writing-buddy/ai';
import type {
	StoryRepository,
	StoryScene
} from '@writing-buddy/story-kernel';

export type ScenePlanField =
	| 'goal'
	| 'conflict'
	| 'turn'
	| 'outcome'
	| 'emotionBeats';

export interface ScenePlanCandidate {
	readonly id: string;
	readonly mode: ScenePlanActionType;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly sourceText: string;
	readonly sceneId: string;
	readonly sceneRevision: number;
	readonly sceneRange: {
		readonly start: number;
		readonly end: number;
		readonly revision: number;
	};
	readonly response: ScenePlanResponse;
	readonly createdAt: string;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export function createScenePlanCandidate(input: {
	readonly mode: ScenePlanActionType;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly sourceText: string;
	readonly scene: StoryScene;
	readonly response: ScenePlanResponse;
}): ScenePlanCandidate {
	if (
		!input.resourceId
		|| input.sourceRevision < 0
		|| !input.sourceText.trim()
	) {
		throw new Error('invalidScenePlanCandidate');
	}
	return {
		id: `scene-plan:${crypto.randomUUID()}`,
		mode: input.mode,
		resourceId: input.resourceId,
		sourceRevision: input.sourceRevision,
		sourceText: input.sourceText,
		sceneId: input.scene.id,
		sceneRevision: input.scene.revision,
		sceneRange: {
			start: input.scene.manuscriptRange.start,
			end: input.scene.manuscriptRange.end,
			revision: input.scene.manuscriptRange.revision
		},
		response: input.response,
		createdAt: new Date().toISOString(),
		status: 'candidate'
	};
}

export function isScenePlanCandidateStale(
	candidate: ScenePlanCandidate,
	currentSourceRevision: number,
	currentContent: string,
	currentScene: StoryScene
): boolean {
	return candidate.sourceRevision !== currentSourceRevision
		|| currentScene.id !== candidate.sceneId
		|| currentScene.revision !== candidate.sceneRevision
		|| currentScene.manuscriptRange.revision !== candidate.sceneRange.revision
		|| currentScene.manuscriptRange.start !== candidate.sceneRange.start
		|| currentScene.manuscriptRange.end !== candidate.sceneRange.end
		|| currentContent.slice(candidate.sceneRange.start, candidate.sceneRange.end)
			!== candidate.sourceText;
}

function hasResponseField(
	response: ScenePlanResponse,
	field: ScenePlanField
): boolean {
	if (field === 'emotionBeats') {
		return Boolean(response.emotionBeats?.length);
	}
	return Boolean(response[field]?.trim());
}

export class ScenePlanningService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createSnapshot: () => Promise<unknown>
	) {}

	async apply(
		candidate: ScenePlanCandidate,
		selectedFields: readonly ScenePlanField[],
		currentSourceRevision: number,
		currentContent: string,
		currentScene: StoryScene
	): Promise<StoryScene> {
		if (
			candidate.status !== 'candidate'
			|| isScenePlanCandidateStale(
				candidate,
				currentSourceRevision,
				currentContent,
				currentScene
			)
		) {
			throw new Error('staleScenePlanCandidate');
		}
		const latestScene = await this.repository.get<StoryScene>('scene', candidate.sceneId);
		if (
			!latestScene
			|| isScenePlanCandidateStale(
				candidate,
				currentSourceRevision,
				currentContent,
				latestScene
			)
		) {
			throw new Error('staleScenePlanCandidate');
		}
		const fields = [...new Set(selectedFields)];
		if (!fields.length || fields.some(field => !hasResponseField(candidate.response, field))) {
			throw new Error('invalidScenePlanFieldSelection');
		}

		const updated: StoryScene = { ...latestScene };
		if (fields.includes('goal') && candidate.response.goal !== undefined) {
			updated.goal = candidate.response.goal;
		}
		if (fields.includes('conflict') && candidate.response.conflict !== undefined) {
			updated.conflict = candidate.response.conflict;
		}
		if (fields.includes('turn') && candidate.response.turn !== undefined) {
			updated.turn = candidate.response.turn;
		}
		if (fields.includes('outcome') && candidate.response.outcome !== undefined) {
			updated.outcome = candidate.response.outcome;
		}
		if (fields.includes('emotionBeats') && candidate.response.emotionBeats !== undefined) {
			updated.emotionBeats = [...candidate.response.emotionBeats];
		}

		await this.createSnapshot();
		return await this.repository.save(updated, latestScene.revision) as StoryScene;
	}
}
