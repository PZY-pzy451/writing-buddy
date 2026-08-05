import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { parseFaction, parseLocation, parseWorldRule } from '@writing-buddy/story-kernel';
import { WorldbuildingPage } from './WorldbuildingPage';
import { desktopBridge } from '../../../platform/bridge';

const timestamp = '2026-07-27T00:00:00.000Z';
const base = <T extends 'location' | 'faction' | 'worldRule'>(id: string, type: T, title: string) => ({
	id, type, title, aliases: [], tags: [], schemaVersion: 1 as const,
	createdAt: timestamp, updatedAt: timestamp, revision: 0, evidenceIds: []
});

describe('WorldbuildingPage', () => {
	it('selects locations, factions and rules by pointer and keeps editable rules visible', async () => {
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
		const location = (await screen.findAllByTestId('world-location-select'))
			.find(candidate => candidate.dataset.locationId === 'location:station')!;
		expect(location).toHaveAttribute('data-location-id', 'location:station');
		await user.click(location);
		expect(screen.getByRole('img', { name: '静态地点示意图' })).toBeInTheDocument();
		const mapLocation = screen.getByTestId('world-map-location-select');
		expect(mapLocation).toHaveAttribute('data-location-id', 'location:station');
		await user.click(mapLocation);
		await user.click(screen.getByRole('tab', { name: '势力' }));
		const faction = screen.getByTestId('world-resource-select');
		expect(faction).toHaveAttribute('data-resource-kind', 'faction');
		expect(faction).toHaveAttribute('data-resource-id', 'faction:railway');
		await user.click(faction);
		expect(await screen.findByRole('heading', { name: '铁路局' })).toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: '世界规则' }));
		const rule = screen.getByTestId('world-resource-select');
		expect(rule).toHaveAttribute('data-resource-kind', 'worldRule');
		expect(rule).toHaveAttribute('data-resource-id', 'world-rule:clock');
		await user.click(rule);
		expect(screen.getByDisplayValue('机械钟停止。')).toBeInTheDocument();
	});

	it('opens AI worldbuilding, edits inputs, deduplicates repeated generation and toggles structured fields', async () => {
		const user = userEvent.setup();
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<WorldbuildingPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve({ locations: [], factions: [], rules: [] })}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 0
				}]}
			/>
		);

		await screen.findByRole('button', { name: '用 AI 创建世界资料' });
		const aiEntries = screen.getAllByTestId('worldbuilding-ai-open');
		expect(aiEntries.map(entry => entry.dataset.entry).sort()).toEqual(['empty', 'toolbar']);
		await user.click(aiEntries.find(entry => entry.dataset.entry === 'empty')!);
		expect(screen.getByRole('complementary', { name: 'AI 世界观助手' })).toBeInTheDocument();
		const actions = screen.getAllByTestId('world-ai-action');
		expect(actions.map(action => action.dataset.action)).toEqual([
			'generate-world-entry',
			'extract-worldbuilding'
		]);
		const target = screen.getByTestId('world-ai-target');
		expect(target).toHaveValue('location');
		const instruction = screen.getByTestId('world-ai-instruction');
		await user.clear(instruction);
		await user.type(instruction, '生成一处带有明确边界与规则的地点。');
		expect(instruction).toHaveValue('生成一处带有明确边界与规则的地点。');
		const generate = screen.getByTestId('world-ai-generate');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByRole('heading', { name: '雾钟广场' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(screen.getByRole('heading', { name: '封闭月台' })).toBeInTheDocument();
		const fieldToggle = screen.getAllByTestId('world-ai-field-toggle')[0];
		expect(fieldToggle).toHaveAttribute('data-candidate-id');
		expect(fieldToggle).toHaveAttribute('data-field-id');
		expect(fieldToggle).toBeChecked();
		await user.click(fieldToggle);
		expect(fieldToggle).not.toBeChecked();
		await user.click(fieldToggle);
		expect(fieldToggle).toBeChecked();
		const apply = screen.getAllByTestId('world-ai-apply')[0];
		expect(apply).toHaveAttribute('data-candidate-id');
		expect(apply).toBeEnabled();
		await desktopBridge.deleteDeepSeekKey();
	});
});
