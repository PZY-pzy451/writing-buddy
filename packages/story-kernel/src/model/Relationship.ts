import { parseStoryId, type StoryId } from '../ids/StoryId';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';
import { parseStoryResourceBase, type StoryResourceBase } from './StoryResourceBase';

export type RelationshipVisibility = 'public' | 'private' | 'secret';

export interface RelationshipChange {
	readonly effectiveFrom: StoryPosition;
	readonly relationshipType: string;
	readonly strength?: number;
	readonly visibility: RelationshipVisibility;
	readonly evidenceIds: readonly StoryId[];
}

export interface Relationship extends StoryResourceBase {
	readonly type: 'relationship';
	readonly sourceCharacterId: StoryId;
	readonly targetCharacterId: StoryId;
	readonly relationshipType: string;
	readonly strength?: number;
	readonly visibility: RelationshipVisibility;
	readonly description?: string;
	readonly effectiveFrom: StoryPosition;
	readonly effectiveUntil?: StoryPosition;
	readonly evidenceIds: readonly StoryId[];
	readonly history: readonly RelationshipChange[];
}

interface PositionInput {
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly narrativeOrder: number;
	readonly storyTime?: string;
}

interface RelationshipInput {
	readonly id: string;
	readonly type: 'relationship';
	readonly title: string;
	readonly aliases: readonly string[];
	readonly summary?: string;
	readonly tags: readonly string[];
	readonly schemaVersion: number;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly revision: number;
	readonly sourceCharacterId: string;
	readonly targetCharacterId: string;
	readonly relationshipType: string;
	readonly strength?: number;
	readonly visibility: string;
	readonly description?: string;
	readonly effectiveFrom: PositionInput;
	readonly effectiveUntil?: PositionInput;
	readonly evidenceIds: readonly string[];
	readonly history?: readonly {
		readonly effectiveFrom: PositionInput;
		readonly relationshipType: string;
		readonly strength?: number;
		readonly visibility: string;
		readonly evidenceIds: readonly string[];
	}[];
}

function parseVisibility(value: string): RelationshipVisibility {
	if (!['public', 'private', 'secret'].includes(value)) {
		throw new Error('invalidRelationshipVisibility');
	}
	return value as RelationshipVisibility;
}

function parseStrength(value?: number): number | undefined {
	if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1)) {
		throw new Error('invalidRelationshipStrength');
	}
	return value;
}

export function isRelationshipActiveAt(
	relationship: Relationship,
	position: StoryPosition
): boolean {
	return relationship.effectiveFrom.narrativeOrder <= position.narrativeOrder
		&& (
			!relationship.effectiveUntil
			|| position.narrativeOrder < relationship.effectiveUntil.narrativeOrder
		);
}

export function parseRelationship(value: RelationshipInput): Relationship {
	const base = parseStoryResourceBase(value);
	if (value.sourceCharacterId === value.targetCharacterId) {
		throw new Error('relationshipEndpointsMustDiffer');
	}
	if (!value.relationshipType.trim()) {
		throw new Error('invalidRelationshipType');
	}
	const effectiveFrom = parseStoryPosition(value.effectiveFrom);
	const effectiveUntil = value.effectiveUntil
		? parseStoryPosition(value.effectiveUntil)
		: undefined;
	if (
		effectiveUntil
		&& effectiveUntil.narrativeOrder <= effectiveFrom.narrativeOrder
	) {
		throw new Error('invalidRelationshipInterval');
	}
	const strength = parseStrength(value.strength);
	return {
		...base,
		type: 'relationship',
		sourceCharacterId: parseStoryId(value.sourceCharacterId),
		targetCharacterId: parseStoryId(value.targetCharacterId),
		relationshipType: value.relationshipType.trim(),
		...(strength === undefined ? {} : { strength }),
		visibility: parseVisibility(value.visibility),
		...(value.description ? { description: value.description } : {}),
		effectiveFrom,
		...(effectiveUntil ? { effectiveUntil } : {}),
		evidenceIds: value.evidenceIds.map(parseStoryId),
		history: (value.history ?? []).map(change => {
			const changeStrength = parseStrength(change.strength);
			return {
				effectiveFrom: parseStoryPosition(change.effectiveFrom),
				relationshipType: change.relationshipType.trim(),
				...(changeStrength === undefined ? {} : { strength: changeStrength }),
				visibility: parseVisibility(change.visibility),
				evidenceIds: change.evidenceIds.map(parseStoryId)
			};
		})
	};
}
