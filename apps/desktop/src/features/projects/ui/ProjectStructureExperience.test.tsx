import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App';
import { useAppStore } from '../../../app/store';

function resetWorkspace(): void {
	localStorage.clear();
	useAppStore.setState({
		recentProjectRoot: 'browser-fixture',
		recentProjectRoots: ['browser-fixture'],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		activeMode: 'works',
		search: '',
		error: undefined,
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		structureMoveBusy: false,
		structureMoveAnnouncement: undefined,
		structureUndo: undefined
	});
}

describe('project structure drag experience', () => {
	beforeEach(resetWorkspace);

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('exposes focused drag handles and disables reordering while filtering', async () => {
		render(<App />);
		await screen.findByRole('main', { name: '作品仪表盘' });

		expect(screen.getByRole('button', { name: '拖动卷：第一卷 灰城之下' })).toBeEnabled();
		expect(screen.getByRole('button', { name: '拖动章节：第一章 停摆的时钟' })).toBeEnabled();
		expect(screen.getByRole('button', { name: '拖动卷：第二卷 雾中来客' })).toBeEnabled();

		act(() => useAppStore.getState().setSearch('旅人'));
		expect(screen.getByText('清除搜索后可调整结构')).toBeInTheDocument();
		expect(screen.getByRole('button', {
			name: '拖动章节：第二章 迷路的旅人，清除搜索后可调整结构'
		})).toBeDisabled();
	});

	it('persists a move and restores the exact order with the toast undo action', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '作品仪表盘' });
		const snapshot = useAppStore.getState().snapshot;
		expect(snapshot).toBeDefined();

		await act(async () => {
			await useAppStore.getState().moveProjectStructure({
				commandId: 'test-move-first-chapter',
				entityType: 'chapter',
				entityIds: ['chapter-a11ce001'],
				from: { containerId: 'volume-a11ce001', index: 0 },
				to: { containerId: 'volume-a11ce001', index: 1 },
				expectedProjectRevision: snapshot?.projectRevision ?? ''
			});
		});
		expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters.map(chapter => chapter.id))
			.toEqual(['chapter-a11ce002', 'chapter-a11ce001']);
		expect(screen.getByText('项目结构已更新')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: '撤销' }));
		await waitFor(() => {
			expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters.map(chapter => chapter.id))
				.toEqual(['chapter-a11ce001', 'chapter-a11ce002']);
		});
		expect(screen.queryByText('项目结构已更新')).not.toBeInTheDocument();
	});

	it('supports Ctrl+Z outside the editor after a cross-volume move', async () => {
		const user = userEvent.setup();
		render(<App />);
		await screen.findByRole('main', { name: '作品仪表盘' });
		const snapshot = useAppStore.getState().snapshot;

		await act(async () => {
			await useAppStore.getState().moveProjectStructure({
				commandId: 'test-cross-volume',
				entityType: 'chapter',
				entityIds: ['chapter-a11ce002'],
				from: { containerId: 'volume-a11ce001', index: 1 },
				to: { containerId: 'volume-a11ce002', index: 1 },
				expectedProjectRevision: snapshot?.projectRevision ?? ''
			});
		});
		expect(useAppStore.getState().snapshot?.project.volumes[1]?.chapters.map(chapter => chapter.id))
			.toEqual(['chapter-a11ce003', 'chapter-a11ce002']);

		await user.keyboard('{Control>}z{/Control}');
		await waitFor(() => {
			expect(useAppStore.getState().snapshot?.project.volumes[0]?.chapters.map(chapter => chapter.id))
				.toEqual(['chapter-a11ce001', 'chapter-a11ce002']);
		});
	});
});
