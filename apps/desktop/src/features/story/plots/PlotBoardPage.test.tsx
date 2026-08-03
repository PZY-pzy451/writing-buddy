import { act, fireEvent, render, screen } from '@testing-library/react';
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
	it('provides a keyboard-accessible board and lifecycle table', async () => {
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
		expect(await screen.findByRole('button', { name: /遗失笔记/ })).toBeInTheDocument();
		await user.click(screen.getByRole('tab', { name: '伏笔表' }));
		expect(screen.getByRole('table', { name: '伏笔生命周期表' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '停摆时钟' })).toBeEnabled();
	});

	it('keeps author secrets private by default and reviews generated plot candidates', async () => {
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

		fireEvent.click(await screen.findByRole('button', { name: 'AI 剧情线与伏笔' }));
		expect(screen.getByRole('complementary', { name: 'AI 剧情线与伏笔助手' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /允许发送作者秘密/ })).not.toBeChecked();
		const generate = screen.getByRole('button', { name: '生成剧情资料候选' });
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
		await desktopBridge.deleteDeepSeekKey();
	});

	it('maps real scenes to plot threads and locates the selected scene manuscript', async () => {
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
		expect(screen.getByRole('button', { name: '站台会面推进遗失笔记：关联正常' })).toBeEnabled();
		await user.click(screen.getByRole('button', { name: '查看场景节拍：站台会面' }));
		expect(screen.getByRole('heading', { name: '站台会面' })).toBeInTheDocument();
		expect(screen.getByText('蓝色信封出现')).toBeInTheDocument();
		expect(screen.getByText(/秘密调查（待同步）/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: '打开场景正文' }));
		expect(onOpenEvidence).toHaveBeenCalledWith({
			resourceId: 'chapter:first',
			range: { start: 12, end: 42 },
			quotePreview: '雨落在站台上。'
		});
	});
});
