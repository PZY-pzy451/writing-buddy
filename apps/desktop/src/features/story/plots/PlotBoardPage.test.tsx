import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseForeshadowing, parsePlotThread } from '@writing-buddy/story-kernel';
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
});
