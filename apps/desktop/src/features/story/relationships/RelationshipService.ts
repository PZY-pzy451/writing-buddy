import {
	isRelationshipActiveAt,
	parseRelationship,
	type Character,
	type Relationship,
	type StoryPosition,
	type StoryRepository
} from '@writing-buddy/story-kernel';

export interface RelationshipGraphNode {
	readonly id: string;
	readonly label: string;
	readonly role?: Character['role'];
}

export interface RelationshipGraphEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	readonly label: string;
	readonly strength: number;
	readonly visibility: Relationship['visibility'];
}

export interface RelationshipGraphViewModel {
	readonly nodes: readonly RelationshipGraphNode[];
	readonly edges: readonly RelationshipGraphEdge[];
	readonly omittedNodes: number;
	readonly omittedEdges: number;
}

export interface RelationshipGraphOptions {
	readonly focusCharacterId?: string;
	readonly hops?: 1 | 2;
	readonly nodeLimit?: number;
	readonly edgeLimit?: number;
}

export function filterRelationshipsAt(
	relationships: readonly Relationship[],
	position: StoryPosition
): readonly Relationship[] {
	return relationships.filter(relationship => isRelationshipActiveAt(relationship, position));
}

function focusedIds(
	relationships: readonly Relationship[],
	focusCharacterId: string,
	hops: 1 | 2
): ReadonlySet<string> {
	const ids = new Set([focusCharacterId]);
	for (let hop = 0; hop < hops; hop += 1) {
		for (const relationship of relationships) {
			if (ids.has(relationship.sourceCharacterId) || ids.has(relationship.targetCharacterId)) {
				ids.add(relationship.sourceCharacterId);
				ids.add(relationship.targetCharacterId);
			}
		}
	}
	return ids;
}

export function circularGraphLayout(
	nodes: readonly RelationshipGraphNode[],
	width = 760,
	height = 680
): Readonly<Record<string, { readonly x: number; readonly y: number }>> {
	const centerX = width / 2;
	const centerY = height / 2;
	const radius = Math.max(90, Math.min(width, height) * 0.36);
	return Object.fromEntries(nodes.map((node, index) => {
		const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
		return [node.id, {
			x: centerX + Math.cos(angle) * radius,
			y: centerY + Math.sin(angle) * radius
		}];
	}));
}

export class RelationshipService {
	constructor(private readonly repository: StoryRepository) {}

	async getRelationshipsAt(position: StoryPosition): Promise<readonly Relationship[]> {
		const relationships = await this.repository.list('relationship') as unknown as readonly Relationship[];
		return filterRelationshipsAt(relationships, position);
	}

	async upsertRelationship(relationship: Relationship): Promise<Relationship> {
		const parsed = parseRelationship(relationship);
		const saved = await this.repository.save(parsed, relationship.revision);
		return parseRelationship(saved as unknown as Parameters<typeof parseRelationship>[0]);
	}

	buildGraphViewModel(
		characters: readonly Character[],
		relationships: readonly Relationship[],
		options: RelationshipGraphOptions = {}
	): RelationshipGraphViewModel {
		const nodeLimit = options.nodeLimit ?? 150;
		const edgeLimit = options.edgeLimit ?? 500;
		const focus = options.focusCharacterId
			? focusedIds(relationships, options.focusCharacterId, options.hops ?? 2)
			: undefined;
		const candidates = focus
			? characters.filter(character => focus.has(character.id))
			: characters;
		const nodes = candidates.slice(0, nodeLimit).map(character => ({
			id: character.id,
			label: character.title,
			...(character.role ? { role: character.role } : {})
		}));
		const nodeIds = new Set(nodes.map(node => node.id));
		const eligibleEdges = relationships.filter(relationship => (
			nodeIds.has(relationship.sourceCharacterId)
			&& nodeIds.has(relationship.targetCharacterId)
		));
		const edges = eligibleEdges.slice(0, edgeLimit).map(relationship => ({
			id: relationship.id,
			source: relationship.sourceCharacterId,
			target: relationship.targetCharacterId,
			label: relationship.relationshipType,
			strength: relationship.strength ?? 0.5,
			visibility: relationship.visibility
		}));
		return {
			nodes,
			edges,
			omittedNodes: Math.max(0, candidates.length - nodes.length),
			omittedEdges: Math.max(0, relationships.length - edges.length)
		};
	}
}
