import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { useAppStore } from '../../../app/store';
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
		const search = screen.getByRole('textbox', { name: '搜索人物' });
		fireEvent.change(search, { target: { value: '沈' } });
		expect(screen.getAllByTestId('character-list-item')).toHaveLength(1);
		expect(screen.getByTestId('character-list-item')).toHaveTextContent('沈青');
		fireEvent.change(search, { target: { value: '' } });
		expect(document.querySelector('.character-role-filters')).toHaveAttribute('role', 'group');
		expect(screen.getAllByTestId('character-role-filter')).toHaveLength(4);
		expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getAllByTestId('character-role-filter')[0]).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getAllByTestId('character-list-item')).toHaveLength(2);
		expect(screen.getAllByTestId('character-detail-tab')).toHaveLength(7);
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
		const characterRows = screen.getAllByTestId('character-list-item');
		fireEvent.click(characterRows[0]);

		expect(confirm).not.toHaveBeenCalled();
		expect(title).toHaveValue('林越（修订）');

		fireEvent.click(characterRows[1]);

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

	it('blocks unload after a failed character edit while keeping the dirty draft redacted and retryable', async () => {
		const saveCharacter = vi.fn()
			.mockRejectedValueOnce(new Error('staleWrite C:\\private\\character.json'))
			.mockImplementation((character: Character) => Promise.resolve({
				...character,
				revision: character.revision + 1
			}));
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
				saveCharacter={saveCharacter}
			/>
		);

		await waitFor(() => expect(document.querySelector('.character-editor')).not.toBeNull());
		const title = document.querySelector('.character-editor input') as HTMLInputElement;
		fireEvent.change(title, { target: { value: '林越·修订' } });
		fireEvent.click(document.querySelector('.character-editor button[type="submit"]') as HTMLButtonElement);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('人物资料保存失败，请重试。');
		expect(alert).not.toHaveTextContent('staleWrite');
		expect(alert).not.toHaveTextContent('private');
		expect(document.querySelector('.character-editor')).not.toBeNull();
		expect(title).toHaveValue('林越·修订');
		const unload = new Event('beforeunload', { cancelable: true });
		window.dispatchEvent(unload);
		expect(unload.defaultPrevented).toBe(true);

		fireEvent.click(document.querySelector('.character-editor button[type="submit"]') as HTMLButtonElement);
		await waitFor(() => expect(saveCharacter).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
	});

	it('repeats a save from the persisted character revision and keeps the second write successful', async () => {
		const saveCharacter = vi.fn((character: Character) => Promise.resolve({
			...character,
			revision: character.revision + 1
		}));
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve(data)}
				saveCharacter={saveCharacter}
			/>
		);

		await waitFor(() => expect(document.querySelector('.character-editor')).not.toBeNull());
		let title = document.querySelector('.character-editor input') as HTMLInputElement;
		fireEvent.change(title, { target: { value: '林越·第一次修订' } });
		fireEvent.click(document.querySelector('.character-editor button[type="submit"]') as HTMLButtonElement);
		await waitFor(() => expect(saveCharacter).toHaveBeenCalledTimes(1));

		await waitFor(() => {
			expect(document.querySelector('.character-editor')).not.toBeNull();
			expect(document.querySelector('.character-editor input')).toHaveValue('林越·第一次修订');
		});
		title = document.querySelector('.character-editor input') as HTMLInputElement;
		fireEvent.change(title, { target: { value: '林越·第二次修订' } });
		fireEvent.click(document.querySelector('.character-editor button[type="submit"]') as HTMLButtonElement);

		await waitFor(() => expect(saveCharacter).toHaveBeenCalledTimes(2));
		expect(saveCharacter).toHaveBeenLastCalledWith(expect.objectContaining({
			title: '林越·第二次修订',
			revision: 2
		}));
	});

	it('TC-CHARACTER-AI-001 exposes stable controls and keeps one paid request under one hundred clicks', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
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
		expect(screen.getAllByTestId('character-ai-action')).toHaveLength(5);
		expect(screen.getByRole('combobox', { name: '选择人物分析章节' })).toHaveValue(
			'chapter:chapter-000000a1'
		);
		expect(screen.getByTestId('character-ai-instruction')).toBeEnabled();
		const generate = screen.getByTestId('character-ai-generate');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		await waitFor(() => expect(startAiGeneration).toHaveBeenCalledOnce());
		expect(await screen.findByRole('heading', { name: '顾遥' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: '唐砚' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: '温禾' })).toBeInTheDocument();
		expect(screen.getAllByTestId('character-ai-field').length).toBeGreaterThan(0);
		expect(screen.getAllByTestId('character-ai-accept')).toHaveLength(3);
		await desktopBridge.deleteDeepSeekKey();
		startAiGeneration.mockRestore();
	});

	it('TC-CHARACTER-AI-002 restarts generation after redacted provider failure on explicit retry', async () => {
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration')
			.mockRejectedValueOnce(new Error('temporary provider failure'));
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
		const generate = screen.getByRole('button', { name: '生成候选' });
		fireEvent.click(generate);
		expect(await screen.findByRole('alert')).toHaveTextContent('AI 请求失败');
		expect(screen.queryByText(/temporary provider failure/u)).not.toBeInTheDocument();
		expect(generate).toBeEnabled();
		fireEvent.click(generate);

		expect(await screen.findByRole('heading', { name: '顾遥' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledTimes(2);
		await desktopBridge.deleteDeepSeekKey();
		startAiGeneration.mockRestore();
	});

	it('TC-CHARACTER-AI-003 re-enables candidate write after redacted failure and preserves one explicit retry', async () => {
		const createSnapshot = vi.spyOn(desktopBridge, 'createSnapshot')
			.mockRejectedValueOnce(new Error('C:\\private\\author\\story.json'));
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
		fireEvent.click(screen.getByRole('button', { name: '生成候选' }));
		expect(await screen.findByRole('heading', { name: '顾遥' })).toBeInTheDocument();
		const accept = screen.getAllByRole('button', { name: '创建人物并写入所选字段' })[0];
		fireEvent.click(accept);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('人物字段写入失败，原资料没有改变，请重试。');
		expect(alert).not.toHaveTextContent('C:\\private');
		expect(accept).toBeEnabled();
		fireEvent.click(accept);

		await waitFor(() => expect(createSnapshot).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(accept).toHaveTextContent('已写入所选字段'));
		await desktopBridge.deleteDeepSeekKey();
		createSnapshot.mockRestore();
	});

	it('consumes a global create intent by opening the assistant without starting AI', async () => {
		useAppStore.setState({ contextualCreateIntent: 'character' });
		render(
			<CharacterCenterPage
				projectRoot="D:/Fixture"
				loadData={() => Promise.resolve({ characters: [], states: [] })}
			/>
		);

		expect(await screen.findByRole('complementary', { name: 'AI 人物助手' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '生成候选' })).toBeDisabled();
		expect(screen.queryByRole('heading', { name: '顾遥' })).not.toBeInTheDocument();
		expect(useAppStore.getState().contextualCreateIntent).toBeUndefined();
	});
});
