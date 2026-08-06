import { act, screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { aiGenerationStore } from '../features/ai/drawer/aiGenerationStore';
import { useAppStore } from './store';

export type WriterWorkspaceUser = ReturnType<typeof userEvent.setup>;

export function resetWriterWorkspaceFixture(): void {
	localStorage.clear();
	aiGenerationStore.getState().reset();
	useAppStore.setState({
		recentProjectRoot: undefined,
		recentProjectRoots: [],
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		writerSessions: {},
		documentViews: {},
		expandedTreeNodes: [],
		projectOpenError: undefined,
		pendingProjectRoot: undefined,
		projectOpenBusyAction: undefined,
		loading: false,
		error: undefined,
		projectWizardOpen: false,
		projectWizardStartRoute: undefined,
		chapterCreatorOpen: false,
		chapterCreateBusy: false,
		chapterStatusBusy: false,
		chapterExportBusy: false,
		chapterExportReceipts: [],
		writingProgress: {},
		recentlyClosedResources: [],
		activeMode: 'works',
		focusMode: false,
		sidebarOpen: true,
		sidebarWidth: 320,
		assistantOpen: true,
		writerTool: 'outline',
		writerToolPinned: false,
		sceneBarExpanded: true,
		manuscriptDensity: 'comfortable',
		assistantWidth: 360,
		dockOpen: true,
		dockHeight: 240
	});
}

export async function openWriterFixtureAndContinue(
	user: WriterWorkspaceUser
): Promise<void> {
	const recent = await screen.findByRole('navigation', { name: '最近作品' });
	await user.click(within(recent.parentElement as HTMLElement).getByRole(
		'button',
		{ name: '打开项目' }
	));
	await screen.findByRole('main', { name: '写作首页' });
	await user.click(screen.getByRole('button', { name: '继续上次位置' }));
	await screen.findByRole('heading', { level: 1, name: '第一章 停摆的时钟' });
	await act(async () => {
		await new Promise<void>(resolve => window.setTimeout(resolve, 0));
	});
}
