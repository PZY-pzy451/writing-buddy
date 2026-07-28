import type { Foreshadowing } from '../model/Foreshadowing';
import type { PlotThread, PlotThreadStatus } from '../model/PlotThread';
import type { StoryScene } from '../model/Scene';
import type { TimelineEvent } from '../model/TimelineEvent';
import type { StoryResource } from '../schema/resourceSchemas';
import { StorySchemaRegistry } from '../schema/schemaRegistry';
import type { StoryRepository } from '../repository/StoryRepository';

export type SceneAssociationKind =
	| 'character-appearance'
	| 'item-appearance'
	| 'foreshadowing-plant'
	| 'foreshadowing-reminder'
	| 'foreshadowing-payoff';

export interface StoryMutationReceipt {
	readonly description: string;
	readonly before: readonly StoryResource[];
	readonly saved: readonly StoryResource[];
}

export interface NarrativeCausalityConflict {
	readonly eventId: string;
	readonly eventTitle: string;
	readonly predecessorId: string;
	readonly predecessorTitle: string;
}

function samePosition(
	left: { readonly chapterId: string; readonly sceneId?: string; readonly narrativeOrder: number },
	right: { readonly chapterId: string; readonly sceneId?: string; readonly narrativeOrder: number }
): boolean {
	return left.chapterId === right.chapterId
		&& left.sceneId === right.sceneId
		&& left.narrativeOrder === right.narrativeOrder;
}

export function createSceneAssociationUpdates(input: {
	readonly scene: StoryScene;
	readonly sourceId: string;
	readonly kind: SceneAssociationKind;
	readonly foreshadowing?: Foreshadowing;
}): readonly StoryResource[] {
	const { scene, sourceId, kind } = input;
	if (kind === 'character-appearance') {
		if (scene.participantIds.includes(sourceId)) throw new Error('associationAlreadyExists');
		return [{ ...scene, participantIds: [...scene.participantIds, sourceId] }];
	}
	if (kind === 'item-appearance') {
		if (scene.itemIds?.includes(sourceId)) throw new Error('associationAlreadyExists');
		return [{ ...scene, itemIds: [...(scene.itemIds ?? []), sourceId] }];
	}
	const clue = input.foreshadowing;
	if (!clue || clue.id !== sourceId) throw new Error('invalidForeshadowingAssociation');
	const position = {
		chapterId: scene.chapterId,
		sceneId: scene.id,
		narrativeOrder: scene.narrativeOrder
	};
	const nextScene = scene.foreshadowingIds.includes(clue.id)
		? scene
		: { ...scene, foreshadowingIds: [...scene.foreshadowingIds, clue.id] };
	if (kind === 'foreshadowing-plant') {
		if (clue.plantedAt && samePosition(clue.plantedAt, position)) {
			throw new Error('associationAlreadyExists');
		}
		return [
			nextScene,
			StorySchemaRegistry.parse('foreshadowing', {
				...clue,
				plantedAt: position,
				status: 'planted'
			})
		];
	}
	if (kind === 'foreshadowing-reminder') {
		if (clue.reminderPositions.some(candidate => samePosition(candidate, position))) {
			throw new Error('associationAlreadyExists');
		}
		return [
			nextScene,
			StorySchemaRegistry.parse('foreshadowing', {
				...clue,
				reminderPositions: [...clue.reminderPositions, position],
				status: clue.status === 'resolved' ? 'resolved' : 'reminded'
			})
		];
	}
	if (clue.actualPayoffAt && samePosition(clue.actualPayoffAt, position)) {
		throw new Error('associationAlreadyExists');
	}
	return [
		nextScene,
		StorySchemaRegistry.parse('foreshadowing', {
			...clue,
			actualPayoffAt: position,
			status: 'resolved'
		})
	];
}

function move<T>(values: readonly T[], from: number, to: number): readonly T[] {
	const next = [...values];
	const [removed] = next.splice(from, 1);
	if (removed === undefined) return values;
	next.splice(to, 0, removed);
	return next;
}

export function reorderTimelineEvents(input: {
	readonly events: readonly TimelineEvent[];
	readonly activeId: string;
	readonly overId: string;
}): readonly TimelineEvent[] {
	const ordered = input.events.slice().sort((left, right) => (
		left.narrativePosition.narrativeOrder - right.narrativePosition.narrativeOrder
		|| left.id.localeCompare(right.id)
	));
	const from = ordered.findIndex(event => event.id === input.activeId);
	const to = ordered.findIndex(event => event.id === input.overId);
	if (from < 0 || to < 0) throw new Error('timelineDropTargetMissing');
	if (from === to) return [];
	const slots = ordered.map(event => event.narrativePosition.narrativeOrder);
	const moved = move(ordered, from, to);
	return moved.flatMap((event, index) => {
		const narrativeOrder = slots[index];
		if (
			narrativeOrder === undefined
			|| narrativeOrder === event.narrativePosition.narrativeOrder
		) {
			return [];
		}
		return [{
			...event,
			narrativePosition: {
				...event.narrativePosition,
				narrativeOrder
			}
		}];
	});
}

export function findNarrativeCausalityConflicts(
	events: readonly TimelineEvent[]
): readonly NarrativeCausalityConflict[] {
	const byId = new Map(events.map(event => [event.id, event]));
	const conflicts: NarrativeCausalityConflict[] = [];
	for (const event of events) {
		for (const predecessorId of event.predecessorIds) {
			const predecessor = byId.get(predecessorId);
			if (
				!predecessor
				|| predecessor.narrativePosition.narrativeOrder
					< event.narrativePosition.narrativeOrder
			) {
				continue;
			}
			conflicts.push({
				eventId: event.id,
				eventTitle: event.title,
				predecessorId: predecessor.id,
				predecessorTitle: predecessor.title
			});
		}
	}
	return conflicts;
}

export function movePlotThreadStatus(
	thread: PlotThread,
	status: PlotThreadStatus
): PlotThread | undefined {
	return thread.status === status ? undefined : { ...thread, status };
}

export async function commitStoryMutation(input: {
	readonly repository: StoryRepository;
	readonly before: readonly StoryResource[];
	readonly after: readonly StoryResource[];
	readonly description: string;
}): Promise<StoryMutationReceipt> {
	if (
		input.before.length === 0
		|| input.before.length !== input.after.length
		|| input.before.some((resource, index) => (
			resource.id !== input.after[index]?.id
			|| resource.type !== input.after[index]?.type
		))
	) {
		throw new Error('invalidStoryMutation');
	}
	const saved = await input.repository.commit(input.after.map((resource, index) => ({
		resource,
		expectedRevision: input.before[index]?.revision
	})));
	return {
		description: input.description,
		before: input.before,
		saved
	};
}

export async function undoStoryMutation(input: {
	readonly repository: StoryRepository;
	readonly receipt: StoryMutationReceipt;
}): Promise<readonly StoryResource[]> {
	if (input.receipt.before.length !== input.receipt.saved.length) {
		throw new Error('invalidStoryMutationReceipt');
	}
	return input.repository.commit(input.receipt.before.map((resource, index) => ({
		resource,
		expectedRevision: input.receipt.saved[index]?.revision
	})));
}
