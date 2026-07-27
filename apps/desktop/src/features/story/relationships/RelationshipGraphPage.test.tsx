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
import { desktopBridge } from '../../../platform/bridge';

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

	it('renders generated bidirectional candidates as separate virtual graph edges', async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<RelationshipGraphPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve(data)}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 3
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: 'AI 关系助手' }));
		fireEvent.click(screen.getByRole('tab', { name: '生成双向关系' }));
		fireEvent.click(screen.getByRole('button', { name: '生成关系候选' }));

		expect(await screen.findByRole('button', {
			name: 'AI 候选关系：林越到沈青，谨慎结盟'
		})).toBeInTheDocument();
		expect(screen.getByRole('button', {
			name: 'AI 候选关系：沈青到林越，暗中保护'
		})).toBeInTheDocument();
		await desktopBridge.deleteDeepSeekKey();
	});
});
