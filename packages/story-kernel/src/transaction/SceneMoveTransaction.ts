import type { MentionLink } from '../model/MentionLink';
import type { StoryScene } from '../model/Scene';
import type { StoryResource } from '../schema/resourceSchemas';
import { StorySchemaRegistry } from '../schema/schemaRegistry';

export interface SceneMoveLocation {
	readonly containerId: string;
	readonly index: number;
}

export interface SceneMoveIntent {
	readonly sceneId: string;
	readonly from: SceneMoveLocation;
	readonly to: SceneMoveLocation;
}

export interface SceneMoveManuscript {
	readonly chapterId: string;
	readonly content: string;
}

export interface SceneMoveManuscriptChange {
	readonly chapterId: string;
	readonly before: string;
	readonly after: string;
}

export interface SceneMovePlan {
	readonly manuscripts: readonly SceneMoveManuscriptChange[];
	readonly beforeResources: readonly StoryResource[];
	readonly afterResources: readonly StoryResource[];
	readonly beforeMentions: readonly MentionLink[];
	readonly afterMentions: readonly MentionLink[];
	readonly orderedScenes: readonly StoryScene[];
	readonly description: string;
}

interface TextRange {
	readonly start: number;
	readonly end: number;
}

function fail(code: string): never {
	throw new Error(code);
}

function orderedScenes(scenes: readonly StoryScene[], chapterId: string): readonly StoryScene[] {
	return scenes
		.filter(scene => scene.chapterId === chapterId)
		.sort((left, right) => (
			left.narrativeOrder - right.narrativeOrder
			|| left.manuscriptRange.start - right.manuscriptRange.start
			|| left.id.localeCompare(right.id)
		));
}

function validateChapterScenes(
	scenes: readonly StoryScene[],
	chapterId: string,
	content: string
): void {
	const narrative = orderedScenes(scenes, chapterId);
	const manuscript = narrative.slice().sort((left, right) => (
		left.manuscriptRange.start - right.manuscriptRange.start
		|| left.manuscriptRange.end - right.manuscriptRange.end
		|| left.id.localeCompare(right.id)
	));
	if (narrative.some((scene, index) => scene.id !== manuscript[index]?.id)) {
		fail('sceneMoveAnchorInvalid');
	}
	for (const [index, scene] of manuscript.entries()) {
		const range = scene.manuscriptRange;
		if (
			!Number.isSafeInteger(range.start)
			|| !Number.isSafeInteger(range.end)
			|| range.start < 0
			|| range.end <= range.start
			|| range.end > content.length
			|| content.slice(range.start, range.end).slice(0, 500) !== range.quote
			|| (index > 0 && (manuscript[index - 1]?.manuscriptRange.end ?? 0) > range.start)
		) {
			fail('sceneMoveAnchorInvalid');
		}
	}
}

function removeRange(range: TextRange, cut: TextRange): TextRange {
	if (range.end <= cut.start) return range;
	if (range.start >= cut.end) {
		const length = cut.end - cut.start;
		return { start: range.start - length, end: range.end - length };
	}
	fail('sceneMoveMentionBoundaryConflict');
}

function insertRange(range: TextRange, offset: number, length: number): TextRange {
	return range.start >= offset
		? { start: range.start + length, end: range.end + length }
		: range;
}

function insertionOffset(
	content: string,
	scenes: readonly StoryScene[],
	index: number
): number {
	if (index < 0 || index > scenes.length) {
		fail('sceneMoveTargetInvalid');
	}
	if (scenes.length === 0) return content.length;
	if (index === 0) return scenes[0]?.manuscriptRange.start ?? content.length;
	if (index === scenes.length) {
		return scenes[index - 1]?.manuscriptRange.end ?? content.length;
	}
	return scenes[index]?.manuscriptRange.start ?? content.length;
}

function nextAnchorRevision(
	chapterId: string,
	scenes: readonly StoryScene[],
	mentions: readonly MentionLink[]
): number {
	return Math.max(
		0,
		...scenes
			.filter(scene => scene.chapterId === chapterId)
			.map(scene => scene.manuscriptRange.revision),
		...mentions
			.filter(mention => mention.chapterId === chapterId)
			.map(mention => mention.anchor.revision)
	) + 1;
}

function sceneWithRange(
	scene: StoryScene,
	chapterId: string,
	range: TextRange,
	narrativeOrder: number,
	revision: number,
	content: string
): StoryScene {
	return StorySchemaRegistry.parse('scene', {
		...scene,
		chapterId,
		narrativeOrder,
		manuscriptRange: {
			start: range.start,
			end: range.end,
			revision,
			quote: content.slice(range.start, range.end).slice(0, 500)
		}
	}) as StoryScene;
}

function mentionWithRange(
	mention: MentionLink,
	chapterId: string,
	range: TextRange,
	revision: number,
	content: string
): MentionLink {
	return {
		...mention,
		chapterId: chapterId as MentionLink['chapterId'],
		anchor: {
			...mention.anchor,
			start: range.start,
			end: range.end,
			revision,
			...(mention.status === 'active'
				? { quote: content.slice(range.start, range.end) }
				: {}),
			before: content.slice(Math.max(0, range.start - 64), range.start),
			after: content.slice(range.end, range.end + 64)
		}
	};
}

function assertMentionAnchor(mention: MentionLink, content: string): void {
	const { start, end, quote } = mention.anchor;
	if (
		!Number.isSafeInteger(start)
		|| !Number.isSafeInteger(end)
		|| start < 0
		|| end <= start
		|| end > content.length
		|| (mention.status === 'active' && content.slice(start, end) !== quote)
	) {
		fail('sceneMoveAnchorInvalid');
	}
}

function migrateScenePositions(
	resource: StoryResource,
	sceneId: string,
	chapterId: string,
	narrativeOrder: number
): StoryResource | undefined {
	let changed = false;
	const visit = (value: unknown): unknown => {
		if (Array.isArray(value)) {
			return value.map(visit);
		}
		if (!value || typeof value !== 'object') {
			return value;
		}
		const object = value as Readonly<Record<string, unknown>>;
		const next = Object.fromEntries(
			Object.entries(object).map(([key, child]) => [key, visit(child)])
		);
		if (
			object.sceneId === sceneId
			&& typeof object.chapterId === 'string'
			&& typeof object.narrativeOrder === 'number'
		) {
			next.chapterId = chapterId;
			next.narrativeOrder = narrativeOrder;
			changed ||= object.chapterId !== chapterId
				|| object.narrativeOrder !== narrativeOrder;
		}
		return next;
	};
	const candidate = visit(resource);
	return changed
		? StorySchemaRegistry.parse(resource.type, candidate)
		: undefined;
}

export function planSceneMove(input: {
	readonly intent: SceneMoveIntent;
	readonly manuscripts: readonly SceneMoveManuscript[];
	readonly scenes: readonly StoryScene[];
	readonly mentions: readonly MentionLink[];
	readonly resources: readonly StoryResource[];
}): SceneMovePlan {
	const sourceContent = input.manuscripts.find(
		manuscript => manuscript.chapterId === input.intent.from.containerId
	)?.content;
	const targetContent = input.manuscripts.find(
		manuscript => manuscript.chapterId === input.intent.to.containerId
	)?.content;
	if (sourceContent === undefined || targetContent === undefined) {
		fail('sceneMoveTargetInvalid');
	}
	const sameChapter = input.intent.from.containerId === input.intent.to.containerId;
	validateChapterScenes(
		input.scenes,
		input.intent.from.containerId,
		sourceContent
	);
	if (!sameChapter) {
		validateChapterScenes(
			input.scenes,
			input.intent.to.containerId,
			targetContent
		);
	}

	const sourceOrdered = orderedScenes(input.scenes, input.intent.from.containerId);
	const moved = sourceOrdered[input.intent.from.index];
	if (!moved || moved.id !== input.intent.sceneId) {
		fail('sceneMoveSourceChanged');
	}
	const cut = {
		start: moved.manuscriptRange.start,
		end: moved.manuscriptRange.end
	};
	const payload = sourceContent.slice(cut.start, cut.end);
	const payloadLength = cut.end - cut.start;
	const sourceRemaining = sourceOrdered
		.filter(scene => scene.id !== moved.id)
		.map(scene => ({
			scene,
			range: removeRange(scene.manuscriptRange, cut)
		}));
	const sourceAfterRemoval = sourceContent.slice(0, cut.start) + sourceContent.slice(cut.end);

	const targetBeforeInsert = sameChapter
		? sourceAfterRemoval
		: targetContent;
	const targetRemaining = sameChapter
		? sourceRemaining
		: orderedScenes(input.scenes, input.intent.to.containerId)
			.map(scene => ({ scene, range: scene.manuscriptRange }));
	const insertion = insertionOffset(
		targetBeforeInsert,
		targetRemaining.map(({ scene, range }) => ({
			...scene,
			manuscriptRange: { ...scene.manuscriptRange, ...range }
		})),
		input.intent.to.index
	);
	const targetAfter = targetBeforeInsert.slice(0, insertion)
		+ payload
		+ targetBeforeInsert.slice(insertion);
	const sourceAfter = sameChapter ? targetAfter : sourceAfterRemoval;

	const finalTargetEntries = targetRemaining.map(({ scene, range }) => ({
		scene,
		range: insertRange(range, insertion, payloadLength)
	}));
	finalTargetEntries.splice(input.intent.to.index, 0, {
		scene: moved,
		range: { start: insertion, end: insertion + payloadLength }
	});
	const finalSourceEntries = sameChapter ? [] : sourceRemaining;
	const originalFinalIds = sameChapter
		? sourceOrdered.map(scene => scene.id)
		: [];
	if (
		sameChapter
		&& originalFinalIds.every((id, index) => id === finalTargetEntries[index]?.scene.id)
		&& sourceContent === targetAfter
	) {
		fail('sceneMoveNoChange');
	}

	const sourceRevision = nextAnchorRevision(
		input.intent.from.containerId,
		input.scenes,
		input.mentions
	);
	const targetRevision = sameChapter
		? sourceRevision
		: nextAnchorRevision(input.intent.to.containerId, input.scenes, input.mentions);
	const changedScenes = [
		...finalSourceEntries.map(({ scene, range }, narrativeOrder) => sceneWithRange(
			scene,
			input.intent.from.containerId,
			range,
			narrativeOrder,
			sourceRevision,
			sourceAfter
		)),
		...finalTargetEntries.map(({ scene, range }, narrativeOrder) => sceneWithRange(
			scene,
			input.intent.to.containerId,
			range,
			narrativeOrder,
			targetRevision,
			targetAfter
		))
	];
	const beforeSceneById = new Map(input.scenes.map(scene => [scene.id, scene]));
	const beforeResources: StoryResource[] = changedScenes.map(scene => {
		const before = beforeSceneById.get(scene.id);
		return before ?? fail('sceneMoveSourceChanged');
	});
	const afterResources: StoryResource[] = [...changedScenes];

	const movedFinalOrder = finalTargetEntries.findIndex(entry => entry.scene.id === moved.id);
	for (const resource of input.resources) {
		if (resource.type === 'scene') continue;
		const migrated = migrateScenePositions(
			resource,
			moved.id,
			input.intent.to.containerId,
			movedFinalOrder
		);
		if (migrated) {
			beforeResources.push(resource);
			afterResources.push(migrated);
		}
	}

	const beforeMentions: MentionLink[] = [];
	const afterMentions: MentionLink[] = [];
	for (const mention of input.mentions) {
		const inSource = mention.chapterId === input.intent.from.containerId;
		const inTarget = mention.chapterId === input.intent.to.containerId;
		if (!inSource && !inTarget) {
			if (mention.sceneId === moved.id) {
				fail('sceneMoveAnchorInvalid');
			}
			continue;
		}
		const content = inSource ? sourceContent : targetContent;
		assertMentionAnchor(mention, content);
		const fullyInside = inSource
			&& mention.anchor.start >= cut.start
			&& mention.anchor.end <= cut.end;
		const overlapsCut = inSource
			&& mention.anchor.start < cut.end
			&& mention.anchor.end > cut.start;
		if (
			(overlapsCut && !fullyInside)
			|| (mention.sceneId === moved.id && !fullyInside)
			|| (fullyInside && mention.sceneId && mention.sceneId !== moved.id)
		) {
			fail('sceneMoveMentionBoundaryConflict');
		}

		let chapterId: string;
		let range: TextRange;
		let revision: number;
		let nextContent: string;
		if (fullyInside) {
			chapterId = input.intent.to.containerId;
			range = {
				start: insertion + mention.anchor.start - cut.start,
				end: insertion + mention.anchor.end - cut.start
			};
			revision = targetRevision;
			nextContent = targetAfter;
		} else if (sameChapter) {
			chapterId = input.intent.from.containerId;
			range = insertRange(removeRange(mention.anchor, cut), insertion, payloadLength);
			revision = sourceRevision;
			nextContent = sourceAfter;
		} else if (inSource) {
			chapterId = input.intent.from.containerId;
			range = removeRange(mention.anchor, cut);
			revision = sourceRevision;
			nextContent = sourceAfter;
		} else {
			chapterId = input.intent.to.containerId;
			range = insertRange(mention.anchor, insertion, payloadLength);
			revision = targetRevision;
			nextContent = targetAfter;
		}
		beforeMentions.push(mention);
		afterMentions.push(mentionWithRange(
			mention,
			chapterId,
			range,
			revision,
			nextContent
		));
	}

	return {
		manuscripts: sameChapter
			? [{
				chapterId: input.intent.from.containerId,
				before: sourceContent,
				after: sourceAfter
			}]
			: [{
				chapterId: input.intent.from.containerId,
				before: sourceContent,
				after: sourceAfter
			}, {
				chapterId: input.intent.to.containerId,
				before: targetContent,
				after: targetAfter
			}],
		beforeResources,
		afterResources,
		beforeMentions,
		afterMentions,
		orderedScenes: changedScenes.slice().sort((left, right) => (
			left.chapterId.localeCompare(right.chapterId)
			|| left.narrativeOrder - right.narrativeOrder
		)),
		description: sameChapter
			? `已将“${moved.title}”移到本章第 ${movedFinalOrder + 1} 个场景。`
			: `已将“${moved.title}”移到目标章节第 ${movedFinalOrder + 1} 个场景。`
	};
}
