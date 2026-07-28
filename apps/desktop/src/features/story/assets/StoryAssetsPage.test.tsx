import { fireEvent, render, screen } from '@testing-library/react';
import {
	StorySchemaRegistry,
	parseLocation
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { StoryAssetsPage } from './StoryAssetsPage';

const timestamp = '2026-07-27T00:00:00.000Z';

describe('StoryAssetsPage', () => {
	it('opens the empty-state AI item workflow and renders a structured card', async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		const character = StorySchemaRegistry.parse('character', {
			id: 'character:xu-qing',
			type: 'character',
			title: '徐青',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 1,
			factionIds: [],
			goals: [],
			desires: [],
			fears: [],
			values: [],
			secrets: [],
			evidenceIds: []
		});
		const location = parseLocation({
			id: 'location:old-station',
			type: 'location',
			title: '旧火车站',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 1,
			travelLinks: [],
			factionIds: [],
			rules: [],
			evidenceIds: []
		});
		render(
			<StoryAssetsPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve({
					items: [],
					states: [],
					characters: [character as never],
					locations: [location]
				})}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 0
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建物品' }));
		expect(screen.getByRole('complementary', { name: 'AI 物品助手' })).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: '生成物品候选' }));

		expect(await screen.findByRole('heading', { name: '无字站牌' })).toBeInTheDocument();
		expect(screen.getByText('证明零号月台曾经存在，并指向被删去的线路。')).toBeInTheDocument();
		await desktopBridge.deleteDeepSeekKey();
	});
});
