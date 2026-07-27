import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseFaction, parseLocation, parseWorldRule } from '@writing-buddy/story-kernel';
import { WorldbuildingPage } from './WorldbuildingPage';

const timestamp = '2026-07-27T00:00:00.000Z';
const base = <T extends 'location' | 'faction' | 'worldRule'>(id: string, type: T, title: string) => ({
	id, type, title, aliases: [], tags: [], schemaVersion: 1 as const,
	createdAt: timestamp, updatedAt: timestamp, revision: 0, evidenceIds: []
});

describe('WorldbuildingPage', () => {
	it('navigates location hierarchy, factions and editable rules', async () => {
		const user = userEvent.setup();
		render(<WorldbuildingPage projectRoot="fixture" loadData={() => Promise.resolve({
			locations: [
				parseLocation({ ...base('location:city', 'location', '灰城'), travelLinks: [], factionIds: [], rules: [] }),
				parseLocation({ ...base('location:station', 'location', '旧车站'), parentLocationId: 'location:city', mapPoint: { x: 40, y: 60 }, travelLinks: [], factionIds: [], rules: ['所有钟停在 23:17'] })
			],
			factions: [parseFaction({ ...base('faction:railway', 'faction', '铁路局'), goals: ['封锁旧站'], allyFactionIds: [], enemyFactionIds: [], territoryLocationIds: ['location:station'] })],
			rules: [parseWorldRule({ ...base('world-rule:clock', 'worldRule', '停摆规则'), category: 'technology', statement: '机械钟停止。', exceptions: [], consequences: [] })]
		})} />);

		expect(await screen.findByRole('main', { name: '世界观中心' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /旧车站，/ }));
		expect(screen.getByRole('img', { name: '静态地点示意图' })).toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: '势力' }));
		expect(await screen.findByRole('heading', { name: '铁路局' })).toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: '世界规则' }));
		expect(screen.getByDisplayValue('机械钟停止。')).toBeInTheDocument();
	});
});
