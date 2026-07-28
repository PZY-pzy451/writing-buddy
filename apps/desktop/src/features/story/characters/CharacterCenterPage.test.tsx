import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	parseStoryId,
	type Character,
	type StateRecord
} from '@writing-buddy/story-kernel';
import {
	CharacterCenterPage,
	type CharacterCenterData
} from './CharacterCenterPage';
import { desktopBridge } from '../../../platform/bridge';

const timestamp = '2026-07-27T00:00:00.000Z';
const storyId = (value: string) => parseStoryId(value);
const characters: readonly Character[] = [
	{
		id: storyId('character:lin-yue'),
		type: 'character',
		title: '林越',
		aliases: [],
		tags: ['主角'],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		role: 'protagonist',
		factionIds: [],
		goals: ['找回笔记'],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: [storyId('evidence:lin-intro')]
	},
	{
		id: storyId('character:shen-qing'),
		type: 'character',
		title: '沈青',
		aliases: [],
		tags: ['关键人物'],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		role: 'supporting',
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: []
	}
];

const states: readonly StateRecord[] = [{
	id: storyId('state:lin-location'),
	characterId: storyId('character:lin-yue'),
	kind: 'location',
	value: '旧车站',
	effectiveFrom: {
		chapterId: storyId('chapter:chapter-001'),
		narrativeOrder: 0
	},
	evidenceIds: [storyId('evidence:station-arrival')],
	confirmation: 'confirmed',
	revision: 0
}, {
	id: storyId('state:lin-location-conflict'),
	characterId: storyId('character:lin-yue'),
	kind: 'location',
	value: '临江旅社',
	effectiveFrom: {
		chapterId: storyId('chapter:chapter-001'),
		narrativeOrder: 0
	},
	evidenceIds: [storyId('evidence:hotel-register')],
	confirmation: 'pending',
	revision: 0
}];

const data: CharacterCenterData = { characters, states };

describe('CharacterCenterPage', () => {
	it('renders the three-column character workspace with current state evidence and conflicts', async () => {
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		expect(await screen.findByRole('heading', { name: '林越' })).toBeInTheDocument();
		fireEvent.click(screen.getByRole('tab', { name: '当前状态' }));

		expect(screen.getByText('旧车站')).toBeInTheDocument();
		expect(screen.getByText('存在 1 条冲突来源')).toBeInTheDocument();
		expect(screen.getByText('evidence:station-arrival')).toBeInTheDocument();
	});

	it('guards dirty edits before changing the selected character', async () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
			/>
		);

		const title = await screen.findByRole('textbox', { name: '人物姓名' });
		fireEvent.change(title, { target: { value: '林越（修订）' } });
		fireEvent.click(screen.getByRole('button', { name: /沈青/ }));

		expect(confirm).toHaveBeenCalledOnce();
		expect(screen.getByRole('heading', { name: '林越' })).toBeInTheDocument();
		expect(title).toHaveValue('林越（修订）');
	});

	it('saves confirmed character edits through the injected repository action', async () => {
		const saveCharacter = vi.fn((character: Character) => Promise.resolve(character));
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
				saveCharacter={saveCharacter}
			/>
		);

		fireEvent.change(await screen.findByRole('textbox', { name: '人物姓名' }), {
			target: { value: '林越·修订' }
		});
		fireEvent.click(screen.getByRole('button', { name: '保存人物' }));

		await waitFor(() => expect(saveCharacter).toHaveBeenCalledWith(
			expect.objectContaining({ title: '林越·修订' })
		));
		expect(screen.getByText('已保存')).toBeInTheDocument();
	});

	it('opens the empty-state AI workflow and renders exactly three generated candidates', async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<CharacterCenterPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve({ characters: [], states: [] })}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 0
				}]}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '用 AI 创建人物' }));
		expect(screen.getByRole('complementary', { name: 'AI 人物助手' })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: '选择人物分析章节' })).toHaveValue(
			'chapter:chapter-000000a1'
		);
		fireEvent.click(screen.getByRole('button', { name: '生成候选' }));

		expect(await screen.findByRole('heading', { name: '顾遥' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: '唐砚' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: '温禾' })).toBeInTheDocument();
		await desktopBridge.deleteDeepSeekKey();
	});
});
