import { render, screen } from '@testing-library/react';
import {
	parseForeshadowing,
	parseStoryItem,
	parseStoryScene,
	StorySchemaRegistry,
	type Character
} from '@writing-buddy/story-kernel';
import { StoryAssociationPage } from './StoryAssociationPage';

const timestamp = '2026-07-28T00:00:00.000Z';

const character = StorySchemaRegistry.parse('character', {
	id: 'character:lin',
	type: 'character',
	title: '林夏',
	aliases: [],
	tags: [],
	schemaVersion: 1,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 0,
	evidenceIds: []
}) as unknown as Character;

describe('StoryAssociationPage', () => {
	it('exposes explicit draggable sources and scene/holder targets', async () => {
		const { container } = render(
			<StoryAssociationPage
				projectRoot="fixture"
				chapters={[{
					resourceId: 'chapter:opening',
					chapterId: 'opening',
					title: '雨夜抵达',
					path: 'chapters/opening.md',
					narrativeOrder: 0,
					volumeId: 'volume:first',
					volumeTitle: '第一卷'
				}]}
				loadData={() => Promise.resolve({
					characters: [character],
					items: [parseStoryItem({
						id: 'item:umbrella',
						type: 'item',
						title: '旧伞',
						aliases: [],
						tags: [],
						schemaVersion: 1,
						createdAt: timestamp,
						updatedAt: timestamp,
						revision: 0,
						unique: true,
						restrictions: [],
						evidenceIds: []
					})],
					foreshadowing: [parseForeshadowing({
						id: 'foreshadowing:ticket',
						type: 'foreshadowing',
						title: '旧车票',
						aliases: [],
						tags: [],
						schemaVersion: 1,
						createdAt: timestamp,
						updatedAt: timestamp,
						revision: 0,
						status: 'planted',
						readerVisibility: 0.2,
						evidenceIds: []
					})],
					scenes: [parseStoryScene({
						id: 'scene:station',
						type: 'scene',
						title: '旧车站',
						aliases: [],
						tags: [],
						schemaVersion: 1,
						createdAt: timestamp,
						updatedAt: timestamp,
						revision: 0,
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
					})],
					itemStates: []
				})}
			/>
		);

		expect(await screen.findByRole('heading', { name: '关联编排' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '拖动人物：林夏' })).toHaveAttribute('aria-roledescription', 'draggable');
		expect(screen.getByRole('button', { name: '拖动物品：旧伞' })).toBeEnabled();
		expect(screen.getByRole('button', { name: '拖动伏笔：旧车票' })).toBeEnabled();
		expect(container.querySelector('[data-association-target="scene:scene:station"]')).toBeInTheDocument();
		expect(container.querySelector('[data-association-target="character:character:lin"]')).toBeInTheDocument();
		expect(screen.getByText('无 AI 请求 · 可撤销')).toBeInTheDocument();
	});
});
