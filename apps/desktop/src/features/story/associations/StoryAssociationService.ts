import {
	createSceneAssociationUpdates,
	createStoryId,
	parseItemState,
	runItemRules,
	commitStoryMutation,
	undoStoryMutation,
	type Character,
	type Foreshadowing,
	type ItemState,
	type SceneAssociationKind,
	type StoryItem,
	type StoryMutationReceipt,
	type StoryRepository,
	type StoryResource,
	type StoryScene
} from '@writing-buddy/story-kernel';
import type { ItemStateFileStore } from '../assets/ItemAiReviewService';

export type AssociationDragSource =
	| { readonly type: 'character'; readonly id: string; readonly title: string }
	| { readonly type: 'item'; readonly id: string; readonly title: string }
	| { readonly type: 'foreshadowing'; readonly id: string; readonly title: string };

export type AssociationDropTarget =
	| { readonly type: 'chapter'; readonly id: string; readonly title: string }
	| { readonly type: 'scene'; readonly id: string; readonly title: string }
	| { readonly type: 'character'; readonly id: string; readonly title: string };

export type AssociationDropIntent =
	| {
		readonly allowed: true;
		readonly source: AssociationDragSource;
		readonly target: AssociationDropTarget;
		readonly label: string;
	}
	| {
		readonly allowed: false;
		readonly source: AssociationDragSource;
		readonly target: AssociationDropTarget;
		readonly reason: string;
	};

export type AssociationMutationReceipt =
	| { readonly kind: 'story'; readonly receipt: StoryMutationReceipt }
	| {
		readonly kind: 'item-states';
		readonly before: readonly ItemState[];
		readonly after: readonly ItemState[];
		readonly description: string;
	};

export function resolveAssociationDrop(
	source: AssociationDragSource,
	target: AssociationDropTarget
): AssociationDropIntent {
	if (
		source.type === 'character'
		&& (target.type === 'chapter' || target.type === 'scene')
	) {
		return {
			allowed: true,
			source,
			target,
			label: `将人物“${source.title}”关联到${target.type === 'chapter' ? '章节' : '场景'}“${target.title}”`
		};
	}
	if (
		source.type === 'item'
		&& ['character', 'chapter', 'scene'].includes(target.type)
	) {
		return {
			allowed: true,
			source,
			target,
			label: target.type === 'character'
				? `把“${source.title}”的持有人设为“${target.title}”`
				: `让物品“${source.title}”出现在“${target.title}”`
		};
	}
	if (
		source.type === 'foreshadowing'
		&& (target.type === 'chapter' || target.type === 'scene')
	) {
		return {
			allowed: true,
			source,
			target,
			label: `设置伏笔“${source.title}”在“${target.title}”的作用`
		};
	}
	return {
		allowed: false,
		source,
		target,
		reason: source.type === 'character'
			? '人物只能关联到章节或场景'
			: source.type === 'foreshadowing'
				? '伏笔只能关联到章节或场景'
				: '物品只能关联到人物、章节或场景'
	};
}

function closePriorState(
	states: readonly ItemState[],
	itemId: string,
	position: { readonly chapterId: string; readonly sceneId?: string; readonly narrativeOrder: number }
): readonly ItemState[] {
	const prior = states
		.filter(state => (
			state.itemId === itemId
			&& !state.effectiveUntil
			&& state.effectiveFrom.narrativeOrder < position.narrativeOrder
		))
		.sort((left, right) => (
			right.effectiveFrom.narrativeOrder - left.effectiveFrom.narrativeOrder
		))[0];
	if (!prior) return states;
	return states.map(state => state.id === prior.id
		? parseItemState({
			...state,
			effectiveUntil: position,
			revision: state.revision + 1
		})
		: state);
}

export class StoryAssociationService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly itemStateStore: ItemStateFileStore
	) {}

	async associateWithScene(input: {
		readonly scene: StoryScene;
		readonly source: AssociationDragSource;
		readonly foreshadowing?: Foreshadowing;
		readonly foreshadowingAction?: 'plant' | 'reminder' | 'payoff';
	}): Promise<AssociationMutationReceipt> {
		let kind: SceneAssociationKind;
		if (input.source.type === 'character') {
			kind = 'character-appearance';
		} else if (input.source.type === 'item') {
			kind = 'item-appearance';
		} else {
			kind = `foreshadowing-${input.foreshadowingAction ?? 'plant'}`;
		}
		const after = createSceneAssociationUpdates({
			scene: input.scene,
			sourceId: input.source.id,
			kind,
			...(input.foreshadowing ? { foreshadowing: input.foreshadowing } : {})
		});
		const originals = new Map<string, StoryResource>([
			[input.scene.id, input.scene],
			...(input.foreshadowing
				? [[input.foreshadowing.id, input.foreshadowing as unknown as StoryResource] as const]
				: [])
		]);
		const before = after.map(resource => originals.get(resource.id))
			.filter((resource): resource is StoryResource => resource !== undefined);
		const receipt = await commitStoryMutation({
			repository: this.repository,
			before,
			after,
			description: input.source.type === 'foreshadowing'
				? `已设置伏笔“${input.source.title}”`
				: `已关联“${input.source.title}”到场景“${input.scene.title}”`
		});
		return { kind: 'story', receipt };
	}

	async transferItem(input: {
		readonly item: StoryItem;
		readonly character: Character;
		readonly position: {
			readonly chapterId: string;
			readonly sceneId?: string;
			readonly narrativeOrder: number;
		};
		readonly quantity: number;
	}): Promise<AssociationMutationReceipt> {
		const before = await this.itemStateStore.load();
		const state = parseItemState({
			id: createStoryId('item-state'),
			itemId: input.item.id,
			action: 'transferred',
			quantity: input.quantity,
			holderCharacterId: input.character.id,
			effectiveFrom: input.position,
			evidenceIds: [],
			confirmation: 'confirmed',
			revision: 0
		});
		const after = [
			...closePriorState(before, input.item.id, input.position),
			state
		];
		const issues = runItemRules(
			[input.item],
			after.filter(candidate => candidate.itemId === input.item.id)
		).filter(issue => issue.severity === 'error');
		if (issues.length > 0) throw new Error('itemStateConflict');
		await this.itemStateStore.save(after);
		return {
			kind: 'item-states',
			before,
			after,
			description: `已把“${input.item.title}”转交给“${input.character.title}”`
		};
	}

	async undo(receipt: AssociationMutationReceipt): Promise<void> {
		if (receipt.kind === 'story') {
			await undoStoryMutation({ repository: this.repository, receipt: receipt.receipt });
			return;
		}
		await this.itemStateStore.save(receipt.before);
	}
}
