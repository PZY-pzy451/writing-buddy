import { describe, expect, it, vi } from 'vitest';
import { parseForeshadowing } from '../model/Foreshadowing';
import { parseTimelineEvent } from '../model/TimelineEvent';
import type { StoryRepository } from '../repository/StoryRepository';
import { StorySchemaRegistry } from '../schema/schemaRegistry';
import type { StoryResource } from '../schema/resourceSchemas';
import {
	commitStoryMutation,
	createSceneAssociationUpdates,
	findNarrativeCausalityConflicts,
	movePlotThreadStatus,
	reorderTimelineEvents,
	undoStoryMutation
} from './StoryDragTransaction';

const now = '2026-07-28T00:00:00.000Z';

function scene(): Extract<StoryResource, { readonly type: 'scene' }> {
	return StorySchemaRegistry.parse('scene', {
		id: 'scene:station',
		type: 'scene',
		title: '旧车站',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 3,
		chapterId: 'chapter:opening',
		manuscriptRange: {
			start: 0,
			end: 4,
			revision: 1,
			quote: '夜雨落下'
		},
		narrativeOrder: 10,
		locationIds: [],
		participantIds: [],
		plotThreadIds: [],
		revealInformationIds: [],
		foreshadowingIds: [],
		evidenceIds: []
	}) as Extract<StoryResource, { readonly type: 'scene' }>;
}

function timelineEvent(input: {
	readonly id: string;
	readonly title: string;
	readonly order: number;
	readonly predecessors?: readonly string[];
}) {
	return parseTimelineEvent({
		id: input.id,
		type: 'timelineEvent',
		title: input.title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 1,
		storyTimeKind: 'unknown',
		narrativePosition: {
			chapterId: 'chapter:opening',
			narrativeOrder: input.order
		},
		eventType: '情节',
		participantIds: [],
		locationIds: [],
		itemIds: [],
		predecessorIds: [...(input.predecessors ?? [])],
		consequenceIds: [],
		plotThreadIds: [],
		foreshadowingIds: [],
		informationIds: [],
		evidenceIds: []
	});
}

describe('StoryDragTransaction', () => {
	it('creates explicit scene associations without changing manuscript anchors', () => {
		const original = scene();
		const [characterUpdate] = createSceneAssociationUpdates({
			scene: original,
			sourceId: 'character:lin',
			kind: 'character-appearance'
		});
		const [itemUpdate] = createSceneAssociationUpdates({
			scene: original,
			sourceId: 'item:umbrella',
			kind: 'item-appearance'
		});

		expect(characterUpdate).toMatchObject({
			participantIds: ['character:lin'],
			manuscriptRange: original.manuscriptRange
		});
		expect(itemUpdate).toMatchObject({
			itemIds: ['item:umbrella'],
			manuscriptRange: original.manuscriptRange
		});
		expect(original.participantIds).toEqual([]);
		expect(original.itemIds).toBeUndefined();
	});

	it('updates the scene link and foreshadowing lifecycle together', () => {
		const clue = parseForeshadowing({
			id: 'foreshadowing:ticket',
			type: 'foreshadowing',
			title: '旧车票',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 2,
			status: 'planted',
			reminderPositions: [],
			readerVisibility: 0.2,
			plotThreadIds: [],
			evidenceIds: []
		});
		const [sceneUpdate, clueUpdate] = createSceneAssociationUpdates({
			scene: scene(),
			sourceId: clue.id,
			kind: 'foreshadowing-payoff',
			foreshadowing: clue
		});

		expect(sceneUpdate).toMatchObject({
			foreshadowingIds: [clue.id]
		});
		expect(clueUpdate).toMatchObject({
			status: 'resolved',
			actualPayoffAt: {
				chapterId: 'chapter:opening',
				sceneId: 'scene:station',
				narrativeOrder: 10
			}
		});
	});

	it('reorders on existing narrative slots and reports predecessor inversions', () => {
		const cause = timelineEvent({
			id: 'timeline-event:cause',
			title: '发现钥匙',
			order: 10
		});
		const result = timelineEvent({
			id: 'timeline-event:result',
			title: '打开门',
			order: 20,
			predecessors: [cause.id]
		});
		const updates = reorderTimelineEvents({
			events: [cause, result],
			activeId: result.id,
			overId: cause.id
		});
		const nextById = new Map(updates.map(event => [event.id, event]));
		const next = [cause, result].map(event => nextById.get(event.id) ?? event);

		expect(nextById.get(result.id)?.narrativePosition.narrativeOrder).toBe(10);
		expect(nextById.get(cause.id)?.narrativePosition.narrativeOrder).toBe(20);
		expect(findNarrativeCausalityConflicts(next)).toEqual([{
			eventId: result.id,
			eventTitle: result.title,
			predecessorId: cause.id,
			predecessorTitle: cause.title
		}]);
	});

	it('does not create a plot mutation for a no-op column drop', () => {
		const thread = StorySchemaRegistry.parse('plotThread', {
			id: 'plot-thread:main',
			type: 'plotThread',
			title: '主线',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			updatedAt: now,
			revision: 4,
			status: 'active',
			evidenceIds: []
		});
		expect(movePlotThreadStatus(thread as never, 'active')).toBeUndefined();
		expect(movePlotThreadStatus(thread as never, 'resolved')).toMatchObject({
			status: 'resolved'
		});
	});

	it('uses returned revisions to guard the inverse commit', async () => {
		const before = scene();
		const after = { ...before, participantIds: ['character:lin'] };
		const saved = { ...after, revision: 4 };
		const restored = { ...before, revision: 5 };
		const commit = vi.fn()
			.mockResolvedValueOnce([saved])
			.mockResolvedValueOnce([restored]);
		const repository = { commit } as unknown as StoryRepository;
		const receipt = await commitStoryMutation({
			repository,
			before: [before],
			after: [after],
			description: '已关联人物'
		});
		await undoStoryMutation({ repository, receipt });

		expect(commit).toHaveBeenNthCalledWith(1, [{
			resource: after,
			expectedRevision: 3
		}]);
		expect(commit).toHaveBeenNthCalledWith(2, [{
			resource: before,
			expectedRevision: 4
		}]);
	});
});
