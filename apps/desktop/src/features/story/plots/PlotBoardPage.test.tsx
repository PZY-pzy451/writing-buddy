import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseForeshadowing, parsePlotThread } from '@writing-buddy/story-kernel';
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
		fireEvent.click(screen.getByRole('button', { name: '生成剧情资料候选' }));

		expect(await screen.findByRole('heading', { name: '零号月台调查' })).toBeInTheDocument();
		expect(screen.getByText('剧情前提')).toBeInTheDocument();
		expect(screen.getByText(/AI 建议/)).toBeInTheDocument();
		await desktopBridge.deleteDeepSeekKey();
	});
});
