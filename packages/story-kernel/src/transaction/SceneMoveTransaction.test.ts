import { describe, expect, it } from 'vitest';
import { parseStoryId } from '../ids/StoryId';
import type { MentionLink } from '../model/MentionLink';
import type { StoryScene } from '../model/Scene';
import type { StoryResource } from '../schema/resourceSchemas';
import { planSceneMove } from './SceneMoveTransaction';

const timestamp = '2026-07-28T00:00:00.000Z';

function scene(
	id: string,
	title: string,
	chapterId: string,
	start: number,
	end: number,
	order: number,
	content: string
): StoryScene {
	return {
		id: `scene:${id}`,
		type: 'scene',
		title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 2,
		chapterId: `chapter:${chapterId}`,
		manuscriptRange: {
			start,
			end,
			revision: 4,
			quote: content.slice(start, end).slice(0, 500)
		},
		narrativeOrder: order,
		locationIds: [],
		participantIds: [],
		plotThreadIds: [],
		revealInformationIds: [],
		foreshadowingIds: [],
		evidenceIds: []
	};
}

function mention(
	id: string,
	chapterId: string,
	start: number,
	end: number,
	content: string,
	sceneId?: string
): MentionLink {
	return {
		id: parseStoryId(`mention:${id}`),
		resourceId: parseStoryId('character:lin'),
		chapterId: parseStoryId(`chapter:${chapterId}`),
		...(sceneId ? { sceneId: parseStoryId(`scene:${sceneId}`) } : {}),
		anchor: {
			start,
			end,
			revision: 4,
			quote: content.slice(start, end),
			before: content.slice(Math.max(0, start - 64), start),
			after: content.slice(end, end + 64)
		},
		displayText: content.slice(start, end),
		status: 'active',
		revision: 3,
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

describe('planSceneMove', () => {
	it('moves an exact UTF-16 scene slice across chapters and migrates anchors and positions', () => {
		const source = '序😀幕A|第二幕';
		const target = '目标一|尾声';
		const first = scene('first', '第一幕', 'one', 0, 5, 0, source);
		const second = scene('second', '第二幕', 'one', 6, source.length, 1, source);
		const targetScene = scene('target', '目标', 'two', 0, 3, 0, target);
		const inside = mention('inside', 'one', 1, 3, source, 'first');
		const after = mention('after', 'one', 6, source.length, source, 'second');
		const positionResource = {
			id: 'timeline-event:arrival',
			type: 'timelineEvent',
			title: '抵达',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 7,
			narrativePosition: {
				chapterId: 'chapter:one',
				sceneId: 'scene:first',
				narrativeOrder: 0
			},
			eventType: 'action',
			participantIds: [],
			locationIds: [],
			itemIds: [],
			predecessorIds: [],
			consequenceIds: [],
			directResults: [],
			impacts: [],
			plotThreadIds: [],
			foreshadowingIds: [],
			informationIds: [],
			evidenceIds: []
		} satisfies StoryResource;

		const plan = planSceneMove({
			intent: {
				sceneId: first.id,
				from: { containerId: 'chapter:one', index: 0 },
				to: { containerId: 'chapter:two', index: 1 }
			},
			manuscripts: [
				{ chapterId: 'chapter:one', content: source },
				{ chapterId: 'chapter:two', content: target }
			],
			scenes: [first, second, targetScene],
			mentions: [inside, after],
			resources: [positionResource]
		});

		expect(plan.manuscripts).toEqual([
			{ chapterId: 'chapter:one', before: source, after: '|第二幕' },
			{ chapterId: 'chapter:two', before: target, after: '目标一序😀幕A|尾声' }
		]);
		const moved = plan.afterResources.find(resource => resource.id === first.id) as StoryScene;
		expect(moved.chapterId).toBe('chapter:two');
		expect(moved.manuscriptRange).toMatchObject({
			start: 3,
			end: 8,
			quote: '序😀幕A'
		});
		const shifted = plan.afterResources.find(resource => resource.id === second.id) as StoryScene;
		expect(shifted.manuscriptRange.start).toBe(1);
		expect(plan.afterMentions.find(candidate => candidate.id === inside.id)).toMatchObject({
			chapterId: 'chapter:two',
			anchor: { start: 4, end: 6 }
		});
		expect(plan.afterMentions.find(candidate => candidate.id === after.id)).toMatchObject({
			chapterId: 'chapter:one',
			anchor: { start: 1, end: 4 }
		});
		expect(plan.afterResources.find(resource => resource.id === positionResource.id))
			.toMatchObject({
				narrativePosition: {
					chapterId: 'chapter:two',
					sceneId: first.id,
					narrativeOrder: 1
				}
			});
	});

	it('reorders inside one chapter while preserving interstitial text', () => {
		const content = 'AAA--BBB--tail';
		const first = scene('first', 'A', 'one', 0, 3, 0, content);
		const second = scene('second', 'B', 'one', 5, 8, 1, content);
		const plan = planSceneMove({
			intent: {
				sceneId: first.id,
				from: { containerId: 'chapter:one', index: 0 },
				to: { containerId: 'chapter:one', index: 1 }
			},
			manuscripts: [{ chapterId: 'chapter:one', content }],
			scenes: [first, second],
			mentions: [],
			resources: []
		});

		expect(plan.manuscripts[0]?.after).toBe('--BBBAAA--tail');
		expect(plan.orderedScenes.map(candidate => candidate.id)).toEqual([
			second.id,
			first.id
		]);
		expect(plan.orderedScenes.map(candidate => candidate.narrativeOrder)).toEqual([0, 1]);
	});

	it('rejects a stale scene quote before planning any write', () => {
		const content = 'first-second';
		const stale = {
			...scene('first', 'A', 'one', 0, 5, 0, content),
			manuscriptRange: {
				start: 0,
				end: 5,
				revision: 1,
				quote: 'other'
			}
		};
		expect(() => planSceneMove({
			intent: {
				sceneId: stale.id,
				from: { containerId: 'chapter:one', index: 0 },
				to: { containerId: 'chapter:two', index: 0 }
			},
			manuscripts: [
				{ chapterId: 'chapter:one', content },
				{ chapterId: 'chapter:two', content: '' }
			],
			scenes: [stale],
			mentions: [],
			resources: []
		})).toThrow('sceneMoveAnchorInvalid');
	});

	it('rejects a Mention that crosses the moved scene boundary', () => {
		const source = 'AAABBB';
		const moved = scene('first', 'A', 'one', 0, 3, 0, source);
		const crossing = mention('crossing', 'one', 2, 4, source);
		expect(() => planSceneMove({
			intent: {
				sceneId: moved.id,
				from: { containerId: 'chapter:one', index: 0 },
				to: { containerId: 'chapter:two', index: 0 }
			},
			manuscripts: [
				{ chapterId: 'chapter:one', content: source },
				{ chapterId: 'chapter:two', content: '' }
			],
			scenes: [moved],
			mentions: [crossing],
			resources: []
		})).toThrow('sceneMoveMentionBoundaryConflict');
	});

	it('rejects a semantic no-op', () => {
		const content = 'AAA';
		const only = scene('only', 'Only', 'one', 0, 3, 0, content);
		expect(() => planSceneMove({
			intent: {
				sceneId: only.id,
				from: { containerId: 'chapter:one', index: 0 },
				to: { containerId: 'chapter:one', index: 0 }
			},
			manuscripts: [{ chapterId: 'chapter:one', content }],
			scenes: [only],
			mentions: [],
			resources: []
		})).toThrow('sceneMoveNoChange');
	});
});
