import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import {
	parseForeshadowing,
	parsePlotThread,
	parseStoryScene
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { PlotBoardPage } from './PlotBoardPage';

const timestamp = '2026-07-27T00:00:00.000Z';
const base = { aliases: [], tags: [], schemaVersion: 1 as const, createdAt: timestamp, updatedAt: timestamp, revision: 0, evidenceIds: [] };

describe('PlotBoardPage', () => {
	it('shows a keyboard-accessible board, selects a plot thread and changes its lifecycle', async () => {
		const user = userEvent.setup();
		render(<PlotBoardPage projectRoot="fixture" loadData={() => Promise.resolve({
			threads: [parsePlotThread({
				...base, id: 'plot-thread:notebook', type: 'plotThread', title: '遗失笔记',
				status: 'active', dramaticQuestion: '笔记记录了什么？', sceneIds: ['scene:first']
			})],
			foreshadowing: [parseForeshadowing({
				...base, id: 'foreshadowing:clock', type: 'foreshadowing', title: '停摆时钟',
				status: 'planted', readerVisibility: 0.4
			})]
		})} />);
		const thread = await screen.findByTestId('plot-thread-select');
		expect(thread).toHaveAttribute('data-thread-id', 'plot-thread:notebook');
		expect(thread).toBeEnabled();
		await user.click(thread);
		const lifecycle = screen.getByTestId('plot-thread-status');
		expect(lifecycle).toHaveAttribute('data-thread-id', 'plot-thread:notebook');
		await user.selectOptions(lifecycle, 'at-risk');
		expect(lifecycle).toHaveValue('at-risk');
		const save = screen.getByTestId('plot-thread-save');
		expect(save).toHaveAttribute('data-thread-id', 'plot-thread:notebook');
		expect(save).toBeEnabled();
		await user.click(screen.getByRole('tab', { name: '伏笔表' }));
		expect(screen.getByRole('table', { name: '伏笔生命周期表' })).toBeInTheDocument();
		const clue = screen.getByTestId('foreshadowing-select');
		expect(clue).toBe(screen.getByRole('button', { name: '停摆时钟' }));
		expect(clue).toHaveAttribute('data-foreshadowing-id', 'foreshadowing:clock');
		expect(clue).toBeEnabled();
		await user.click(clue);
	});

	it('opens the enabled AI plot panel, keeps secrets private, deduplicates repeated generation and shows success', async () => {
		const user = userEvent.setup();
		const startAiGeneration = vi.spyOn(desktopBridge, 'startAiGeneration');
		await desktopBridge.saveDeepSeekKey('browser-fixture');
		render(
			<PlotBoardPage
				projectRoot="browser-fixture"
				loadData={() => Promise.resolve({ threads: [], foreshadowing: [] })}
				chapters={[{
					resourceId: 'chapter:chapter-000000a1',
					chapterId: 'chapter-000000a1',
					title: '第一章 · 雨夜旧站',
					path: 'chapters/chapter-001.md',
					narrativeOrder: 0,
					volumeId: 'volume:volume-00000001',
					volumeTitle: '第一卷'
				}]}
			/>
		);

		const aiEntries = screen.getAllByTestId('plot-board-ai-open');
		expect(aiEntries.map(entry => entry.dataset.entry).sort())
			.toEqual(['empty', 'toolbar']);
		const toolbarEntry = aiEntries.find(entry => entry.dataset.entry === 'toolbar');
		expect(toolbarEntry).toBeDefined();
		await user.click(toolbarEntry!);
		expect(screen.getByRole('complementary', { name: 'AI 剧情线与伏笔助手' })).toBeInTheDocument();
		const actions = screen.getAllByTestId('plot-ai-action');
		expect(actions.map(action => action.dataset.action)).toEqual([
			'generate-plot-thread',
			'generate-plot-consequences',
			'extract-plot-progress',
			'generate-foreshadowing',
			'generate-foreshadowing-payoff',
			'extract-foreshadowing'
		]);
		expect(actions[0]).toHaveAttribute('aria-selected', 'true');
		const initialToggles = screen.getAllByTestId('plot-ai-toggle');
		expect(initialToggles.map(toggle => toggle.dataset.toggle))
			.toEqual(['volume', 'author-secrets']);
		const volumeToggle = initialToggles[0];
		const secretToggle = initialToggles[1];
		expect(secretToggle).not.toBeChecked();
		await user.click(volumeToggle);
		expect(volumeToggle).toBeChecked();
		const instruction = screen.getByTestId('plot-ai-instruction');
		await user.clear(instruction);
		await user.type(instruction, '生成一条可追踪且保留作者决定权的调查线。');
		expect(instruction).toHaveValue('生成一条可追踪且保留作者决定权的调查线。');
		const generate = screen.getByRole('button', { name: '生成剧情资料候选' });
		expect(generate).toHaveAttribute('data-testid', 'plot-ai-generate');
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				generate.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});

		expect(await screen.findByRole('heading', { name: '零号月台调查' })).toBeInTheDocument();
		expect(startAiGeneration).toHaveBeenCalledOnce();
		expect(screen.getByText('剧情前提')).toBeInTheDocument();
		expect(screen.getByText(/AI 建议/)).toBeInTheDocument();
		const candidateToggle = screen.getAllByTestId('plot-ai-toggle').find(toggle => (
			toggle.dataset.toggle === 'candidate'
		));
		expect(candidateToggle).toBeDefined();
		expect(candidateToggle).toHaveAttribute('data-candidate-id');
		expect(candidateToggle).toBeChecked();
		await user.click(candidateToggle!);
		expect(candidateToggle).not.toBeChecked();
		await user.click(candidateToggle!);
		expect(candidateToggle).toBeChecked();
		await desktopBridge.deleteDeepSeekKey();
	});

	it('shows the scene grid, selects links by pointer and keyboard, closes details and opens manuscript evidence', async () => {
		const user = userEvent.setup();
		const onOpenEvidence = vi.fn();
		render(
			<PlotBoardPage
				projectRoot="fixture"
				chapters={[{
					resourceId: 'chapter:first', chapterId: 'first', title: '第一章 · 雨夜旧站',
					path: 'chapters/first.md', narrativeOrder: 0
				}]}
				onOpenEvidence={onOpenEvidence}
				loadData={() => Promise.resolve({
					threads: [
						parsePlotThread({
							...base, id: 'plot-thread:notebook', type: 'plotThread', title: '遗失笔记',
							status: 'active', sceneIds: ['scene:meeting']
						}),
						parsePlotThread({
							...base, id: 'plot-thread:secret', type: 'plotThread', title: '秘密调查',
							status: 'at-risk', sceneIds: ['scene:meeting']
						})
					],
					foreshadowing: [],
					scenes: [parseStoryScene({
						...base, id: 'scene:meeting', type: 'scene', title: '站台会面',
						chapterId: 'chapter:first',
						manuscriptRange: { start: 12, end: 42, revision: 0, quote: '雨落在站台上。' },
						narrativeOrder: 1, locationIds: [], participantIds: [],
						goal: '找到笔记', conflict: '站长拒绝交谈', turn: '蓝色信封出现', outcome: '得到新线索',
						plotThreadIds: ['plot-thread:notebook'], revealInformationIds: [],
						foreshadowingIds: []
					})]
				})}
			/>
		);

		await screen.findByRole('button', { name: /遗失笔记/ });
		await user.click(screen.getByRole('tab', { name: '场景网格' }));
		expect(screen.getByRole('table', { name: '场景与剧情线关联表' })).toBeInTheDocument();
		const search = screen.getByTestId('scene-plot-grid-search');
		expect(search).toHaveAccessibleName('搜索场景网格');
		expect(search).toBeEnabled();
		await user.click(search);
		await user.keyboard('不存在');
		expect(screen.getByText('当前条件下没有场景')).toBeInTheDocument();
		const clearFilter = screen.getByRole('button', { name: '清除筛选' });
		await user.click(clearFilter);
		expect(search).toHaveFocus();

		const filters = screen.getAllByTestId('scene-plot-grid-filter');
		expect(filters).toHaveLength(4);
		expect(filters.map(control => control.dataset.filter)).toEqual([
			'all', 'unlinked', 'incomplete', 'needs-sync'
		]);
		await user.click(filters[0]);

		const link = screen.getAllByTestId('scene-plot-grid-link').find(control => (
			control.dataset.threadId === 'plot-thread:notebook'
		));
		expect(link).toBeDefined();
		if (!link) throw new Error('Expected the reciprocal notebook plot link.');
		expect(link).toHaveAttribute('data-scene-id', 'scene:meeting');
		expect(link).toHaveAttribute('data-thread-id', 'plot-thread:notebook');
		expect(link).toBeEnabled();
		await user.click(link);
		expect(screen.getByRole('heading', { name: '站台会面' })).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '关闭场景详情' }));

		const scene = screen.getByTestId('scene-plot-grid-scene');
		expect(scene).toHaveAttribute('data-scene-id', 'scene:meeting');
		scene.focus();
		await user.keyboard('{Enter}');
		expect(screen.getByRole('heading', { name: '站台会面' })).toBeInTheDocument();
		expect(screen.getByText('蓝色信封出现')).toBeInTheDocument();
		expect(screen.getByText(/秘密调查（待同步）/)).toBeInTheDocument();
		const openManuscript = screen.getByTestId('plot-scene-open-manuscript');
		expect(openManuscript).toHaveAttribute('data-scene-id', 'scene:meeting');
		await user.click(openManuscript);
		expect(onOpenEvidence).toHaveBeenCalledWith({
			resourceId: 'chapter:first',
			range: { start: 12, end: 42 },
			quotePreview: '雨落在站台上。'
		});
	});
});
