import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	parseRelationship,
	parseStoryId,
	type Character
} from '@writing-buddy/story-kernel';
import {
	RelationshipGraphPage,
	type RelationshipPageData
} from './RelationshipGraphPage';

const timestamp = '2026-07-27T00:00:00.000Z';
const characters: readonly Character[] = ['林越', '沈青'].map((title, index) => ({
	id: parseStoryId(index === 0 ? 'character:lin-yue' : 'character:shen-qing'),
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
}));
const data: RelationshipPageData = {
	characters,
	relationships: [
		parseRelationship({
			id: 'relationship:lin-doubts-shen',
			type: 'relationship',
			title: '林越怀疑沈青',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:lin-yue',
			targetCharacterId: 'character:shen-qing',
			relationshipType: '怀疑',
			strength: 0.7,
			visibility: 'private',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 3
			},
			evidenceIds: ['evidence:rain-dialogue']
		}),
		parseRelationship({
			id: 'relationship:shen-protects-lin',
			type: 'relationship',
			title: '沈青保护林越',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:shen-qing',
			targetCharacterId: 'character:lin-yue',
			relationshipType: '保护',
			strength: 0.9,
			visibility: 'secret',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 8
			},
			evidenceIds: ['evidence:station-rescue']
		})
	]
};

describe('RelationshipGraphPage', () => {
	it('provides an accessible directional matrix and inspector evidence', async () => {
		render(
			<RelationshipGraphPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		fireEvent.click(await screen.findByRole('tab', { name: '关系矩阵' }));
		expect(screen.getByRole('table', { name: '人物有向关系矩阵' })).toBeInTheDocument();

		const directedCell = screen.getByRole('button', { name: '林越 到 沈青：怀疑，强度 70%' });
		fireEvent.click(directedCell);
		expect(screen.getByRole('heading', { name: '怀疑' })).toBeInTheDocument();
		expect(screen.getByText('evidence:rain-dialogue')).toBeInTheDocument();
	});

	it('filters the matrix by narrative position without merging reverse edges', async () => {
		render(
			<RelationshipGraphPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		fireEvent.click(await screen.findByRole('tab', { name: '关系矩阵' }));
		fireEvent.change(screen.getByRole('spinbutton', { name: '叙事位置' }), {
			target: { value: '4' }
		});

		expect(screen.getByText('怀疑')).toBeInTheDocument();
		expect(screen.queryByText('保护')).not.toBeInTheDocument();
	});
});
