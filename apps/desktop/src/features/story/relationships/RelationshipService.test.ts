import { describe, expect, it } from 'vitest';
import {
	parseRelationship,
	parseStoryId,
	parseStoryPosition,
	type Character,
	type Relationship,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import { RelationshipService } from './RelationshipService';

const timestamp = '2026-07-27T00:00:00.000Z';
const position = (order: number) => parseStoryPosition({
	chapterId: 'chapter:chapter-001',
	narrativeOrder: order
});

function relationship(
	id: string,
	source: string,
	target: string,
	relationshipType: string,
	from: number,
	until?: number
): Relationship {
	return parseRelationship({
		id,
		type: 'relationship',
		title: relationshipType,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0,
		sourceCharacterId: source,
		targetCharacterId: target,
		relationshipType,
		visibility: 'private',
		effectiveFrom: {
			chapterId: 'chapter:chapter-001',
			narrativeOrder: from
		},
		...(until === undefined ? {} : {
			effectiveUntil: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: until
			}
		}),
		evidenceIds: []
	});
}

const relationships = [
	relationship('relationship:lin-doubts-shen', 'character:lin', 'character:shen', '怀疑', 2),
	relationship('relationship:shen-protects-lin', 'character:shen', 'character:lin', '保护', 4),
	relationship('relationship:lin-trusts-shen', 'character:lin', 'character:shen', '信任', 10)
];

function character(id: string, title: string): Character {
	return {
		id: parseStoryId(id),
		type: 'character',
		title,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 0,
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: []
	};
}

function repositoryFor(items: readonly Relationship[]): StoryRepository {
	return {
		get: () => Promise.resolve(undefined),
		list: type => Promise.resolve((type === 'relationship' ? items : []) as never),
		save: resource => Promise.resolve(resource as never),
		commit: () => Promise.resolve([]),
		moveToTrash: () => Promise.resolve(),
		restoreFromTrash: () => Promise.reject(new Error('notFound'))
	};
}

describe('RelationshipService', () => {
	it('keeps direction and effective ranges distinct at a time slice', async () => {
		const service = new RelationshipService(repositoryFor(relationships));

		const atFive = await service.getRelationshipsAt(position(5));
		const atTen = await service.getRelationshipsAt(position(10));

		expect(atFive.map(item => `${item.sourceCharacterId}->${item.targetCharacterId}:${item.relationshipType}`))
			.toEqual([
				'character:lin->character:shen:怀疑',
				'character:shen->character:lin:保护'
			]);
		expect(atTen).toHaveLength(3);
	});

	it('builds a bounded graph view model and reports omitted data', () => {
		const service = new RelationshipService(repositoryFor([]));
		const characters = Array.from({ length: 153 }, (_, index) => (
			character(`character:person-${index}`, `人物 ${index}`)
		));
		const manyRelationships = Array.from({ length: 510 }, (_, index) => (
			relationship(
				`relationship:edge-${index}`,
				`character:person-${index % 150}`,
				`character:person-${(index + 1) % 150}`,
				'认识',
				0
			)
		));

		const graph = service.buildGraphViewModel(characters, manyRelationships);

		expect(graph.nodes).toHaveLength(150);
		expect(graph.edges).toHaveLength(500);
		expect(graph.omittedNodes).toBe(3);
		expect(graph.omittedEdges).toBe(10);
	});
});
