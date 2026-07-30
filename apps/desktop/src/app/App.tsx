import { AlertTriangle, BookOpenText, LoaderCircle, PanelBottomOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from './store';
import { TopBar } from '../shell/TopBar';
import { GlobalRail } from '../shell/GlobalRail';
import { StatusBar } from '../shell/StatusBar';
import { ProjectSidebar } from '../workspace/ProjectSidebar';
import { ResourceTabs } from '../workspace/ResourceTabs';
import { WriterHeader } from '../workspace/WriterHeader';
import { WriterToolRail } from '../workspace/WriterToolRail';
import { SystemPage } from '../workspace/SystemPage';
import { ChapterEditor } from '../editor/ChapterEditor';
import { ResourceEditor } from '../resources/ResourceEditor';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { TaskDock } from '../review/TaskDock';
import { ExternalConflictDialog } from '../editor/ExternalConflictDialog';
import { ProjectOpenErrorDialog } from '../features/projects/ui/ProjectOpenErrorDialog';
import { ProjectCreationWizard } from '../features/projects/ui/ProjectCreationWizard';
import { ChapterCreationDialog } from '../features/projects/ui/ChapterCreationDialog';
import { ProjectWelcome } from '../features/projects/ui/ProjectWelcome';
import { ProjectStructureUndoToast } from '../features/projects/ui/ProjectStructureUndoToast';
import { StoryStudioRoute, StoryWorkspaceRoute } from './routes';
import { StoryDashboardPage } from '../features/story/dashboard/StoryDashboardPage';
import { AiGenerationDrawer } from '../features/ai/drawer/AiGenerationDrawer';
import { aiGenerationStore } from '../features/ai/drawer/aiGenerationStore';
import { AppEmptyState } from '../features/shared/presentation/AppEmptyState';
import { dispatchWorkspaceShortcut } from '../shell/workspaceShortcuts';
import { resolveWriterShortcut } from '../shell/writerShortcuts';
import { requestGlobalCreateMenu } from '../features/projects/ui/GlobalCreateRequest';
import { openAiQuickActions } from '../features/ai/drawer/openAiQuickActions';
import { QuickCaptureDialog } from '../features/quick-capture/QuickCaptureDialog';
import { SaveRecoveryBanner } from '../features/save/SaveRecoveryBanner';
import { CloseProtectionDialog } from '../features/save/CloseProtectionDialog';
import { WriterNavigator } from '../features/writer-navigator/WriterNavigator';
import '../theme/visualPolish.css';

async function destroyCurrentApplicationWindow(): Promise<void> {
	if ('__TAURI_INTERNALS__' in window) {
		const { getCurrentWindow } = await import('@tauri-apps/api/window');
		await getCurrentWindow().destroy();
		return;
	}
	window.close();
}

export function App(): React.JSX.Element {
	const bootstrap = useAppStore(state => state.bootstrap);
	const loading = useAppStore(state => state.loading);
	const error = useAppStore(state => state.error);
	const setError = useAppStore(state => state.setError);
	const projectOpenError = useAppStore(state => state.projectOpenError);
	const projectOpenBusyAction = useAppStore(state => state.projectOpenBusyAction);
	const retryProjectOpen = useAppStore(state => state.retryProjectOpen);
	const openProjectReadOnly = useAppStore(state => state.openProjectReadOnly);
	const repairProject = useAppStore(state => state.repairProject);
	const revealProjectDirectory = useAppStore(state => state.revealProjectDirectory);
	const dismissProjectOpenError = useAppStore(state => state.dismissProjectOpenError);
	const activeMode = useAppStore(state => state.activeMode);
	const activeResource = useAppStore(state => state.activeResource);
	const snapshot = useAppStore(state => state.snapshot);
	const theme = useAppStore(state => state.theme);
	const accent = useAppStore(state => state.accent);
	const focusMode = useAppStore(state => state.focusMode);
	const sidebarOpen = useAppStore(state => state.sidebarOpen);
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const manuscriptDensity = useAppStore(state => state.manuscriptDensity);
	const dockOpen = useAppStore(state => state.dockOpen);
	const toggleDock = useAppStore(state => state.toggleDock);
	const verifyExternalChange = useAppStore(state => state.verifyExternalChange);
	const sidebarWidth = useAppStore(state => state.sidebarWidth);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const dockHeight = useAppStore(state => state.dockHeight);
	const sourceRevision = useAppStore(state => state.session?.state.version);
	const writerNavigatorNotice = useAppStore(state => state.writerNavigatorNotice);
	const setWriterNavigatorNotice = useAppStore(state => state.setWriterNavigatorNotice);

	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.isComposing) return;
			const shortcutState = useAppStore.getState();
			if (event.key === 'Escape' && shortcutState.focusMode) {
				event.preventDefault();
				shortcutState.toggleFocus();
				return;
			}
			if (
				event.key === 'Escape'
				&& shortcutState.assistantOpen
				&& !shortcutState.writerToolPinned
				&& !document.querySelector('[aria-modal="true"]')
			) {
				event.preventDefault();
				shortcutState.closeWriterTool();
				return;
			}
			if (!shortcutState.focusMode && dispatchWorkspaceShortcut(event, {
				toggleSidebar: shortcutState.toggleSidebar,
				toggleAssistant: shortcutState.toggleAssistant,
				toggleDock: shortcutState.toggleDock
			})) {
				return;
			}
			const command = resolveWriterShortcut(event);
			if (!command) return;
			if (document.querySelector('[aria-modal="true"]')) return;
			if (command === 'undo') {
				const target = event.target;
				const editing = target instanceof HTMLElement
					&& (target.matches('input, textarea, [contenteditable="true"]')
						|| Boolean(target.closest('.monaco-editor')));
				if (!editing && shortcutState.structureUndo) {
					event.preventDefault();
					void shortcutState.undoProjectStructureMove();
				}
				return;
			}
			event.preventDefault();
			switch (command) {
				case 'focus-mode':
					shortcutState.toggleFocus();
					break;
				case 'quick-capture':
					shortcutState.openQuickCapture();
					break;
				case 'writer-navigator':
					shortcutState.openWriterNavigator();
					break;
				case 'full-search':
					shortcutState.setMode('search');
					break;
				case 'new-chapter':
					shortcutState.openChapterCreator();
					break;
				case 'quick-create':
					requestGlobalCreateMenu();
					break;
				case 'ai-quick-actions':
					openAiQuickActions();
					break;
				case 'save':
					void shortcutState.save();
					break;
				case 'close-tab':
					if (shortcutState.activeResource) {
						shortcutState.closeResource(shortcutState.activeResource.id);
					}
					break;
				case 'restore-tab':
					void shortcutState.restoreLastClosedResource();
					break;
				case 'switch-tab':
					void shortcutState.activateNextResource();
					break;
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, []);

	useEffect(() => {
		if (sourceRevision !== undefined) {
			aiGenerationStore.getState().markStale(sourceRevision);
		}
	}, [sourceRevision]);

	useEffect(() => {
		const checkDisk = () => {
			if (document.visibilityState === 'visible') {
				void verifyExternalChange();
			}
		};
		window.addEventListener('focus', checkDisk);
		document.addEventListener('visibilitychange', checkDisk);
		const timer = window.setInterval(checkDisk, 3000);
		return () => {
			window.removeEventListener('focus', checkDisk);
			document.removeEventListener('visibilitychange', checkDisk);
			window.clearInterval(timer);
		};
	}, [verifyExternalChange]);

	useEffect(() => {
		const beforeUnload = (event: BeforeUnloadEvent) => {
			const state = useAppStore.getState();
			state.flushWriterSession();
			if (state.saveState.type !== 'clean' || state.session?.state.dirty) {
				event.preventDefault();
			}
		};
		const pageHide = () => useAppStore.getState().flushWriterSession();
		window.addEventListener('beforeunload', beforeUnload);
		window.addEventListener('pagehide', pageHide);
		let dispose: (() => void) | undefined;
		if ('__TAURI_INTERNALS__' in window) {
			void import('@tauri-apps/api/window')
				.then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested(event => {
					const state = useAppStore.getState();
					if (!state.requestCloseProtection()) {
						event.preventDefault();
					}
				}))
				.then(unlisten => { dispose = unlisten; });
		}
		return () => {
			window.removeEventListener('beforeunload', beforeUnload);
			window.removeEventListener('pagehide', pageHide);
			dispose?.();
		};
	}, []);

	const systemPageVisible = !['works', 'planning', 'references'].includes(activeMode);
	const welcomeVisible = activeMode === 'works' && !snapshot;
	const storyStudioVisible = ['planning', 'references'].includes(activeMode) && Boolean(snapshot);
	const showDashboard = !systemPageVisible && activeMode === 'works' && Boolean(snapshot) && !activeResource;
	const workspaceAssistantVisible = Boolean(snapshot) && assistantOpen && !focusMode && !systemPageVisible && !showDashboard && !storyStudioVisible;
	const workspaceDockVisible = Boolean(snapshot) && dockOpen && !focusMode && !systemPageVisible && !showDashboard && !storyStudioVisible;
	const showTextEditor = !systemPageVisible && !storyStudioVisible && (activeResource?.type === 'chapter' || activeResource?.type === 'note');
	const showStoryResource = !systemPageVisible && !storyStudioVisible && activeResource?.type === 'story';
	const showResourceEditor = !systemPageVisible && !storyStudioVisible && activeResource && !showTextEditor && !showStoryResource;
	const writerToolRailVisible = showTextEditor
		&& activeResource?.type === 'chapter'
		&& !focusMode;

	return (
		<div
			className={`app-shell theme-${theme} accent-${accent} mode-${activeMode} manuscript-density-${manuscriptDensity} ${focusMode ? 'is-focus-mode' : ''} ${sidebarOpen ? '' : 'is-sidebar-closed'} ${systemPageVisible ? 'is-system-page' : ''} ${welcomeVisible ? 'is-welcome' : ''} ${showDashboard ? 'is-dashboard' : ''} ${storyStudioVisible ? 'is-story-studio' : ''} ${writerToolRailVisible ? 'has-writer-tools' : ''} ${workspaceAssistantVisible ? '' : 'is-assistant-closed'} ${workspaceDockVisible ? '' : 'is-dock-closed'}`}
			style={{
				'--sidebar-width-user': `${sidebarWidth}px`,
				'--assistant-width-user': `${assistantWidth}px`,
				'--dock-height-user': `${dockHeight}px`
			} as React.CSSProperties}
		>
			<TopBar />
			<SaveRecoveryBanner />
			{!focusMode && <GlobalRail />}
			{!focusMode && <ProjectSidebar />}
			<main className="center-workspace">
				{!systemPageVisible && !showDashboard && !storyStudioVisible && <ResourceTabs />}
				{!systemPageVisible && !showDashboard && !storyStudioVisible && <WriterHeader />}
				<div className="canvas-surface">
					{systemPageVisible && <SystemPage />}
					{welcomeVisible && <ProjectWelcome />}
					{showDashboard && <StoryDashboardPage />}
					{storyStudioVisible && <StoryStudioRoute />}
					{showTextEditor && <ChapterEditor />}
					{showResourceEditor && <ResourceEditor />}
					{showStoryResource && <StoryWorkspaceRoute />}
					{!systemPageVisible && !welcomeVisible && !activeResource && !showDashboard && (
						<AppEmptyState
							icon={BookOpenText}
							title="选择一个章节"
							description="从左侧作品大纲打开章节，继续写作或查看关联资料。"
							density="full"
							className="canvas-empty"
						/>
					)}
				</div>
				{workspaceDockVisible && <TaskDock />}
				{!dockOpen && !focusMode && !systemPageVisible && (
					<button
						className="dock-restore"
						type="button"
						onClick={toggleDock}
						title="展开待处理区 (Ctrl+J)"
						aria-keyshortcuts="Control+J Meta+J"
					>
						<PanelBottomOpen size={18} />展开待处理区
					</button>
				)}
			</main>
			{workspaceAssistantVisible && <AssistantPanel />}
			{writerToolRailVisible && <WriterToolRail />}
			{!focusMode && <StatusBar />}
			<AiGenerationDrawer />
			<ProjectCreationWizard />
			<ChapterCreationDialog />
			<ProjectStructureUndoToast />
			<QuickCaptureDialog />
			<WriterNavigator key={snapshot?.root ?? 'no-project'} />
			<CloseProtectionDialog onExit={destroyCurrentApplicationWindow} />
			{writerNavigatorNotice && (
				<div className="navigator-notice" role="status">
					<span>{writerNavigatorNotice}</span>
					<button
						type="button"
						onClick={() => setWriterNavigatorNotice(undefined)}
					>
						关闭
					</button>
				</div>
			)}
			{loading && <div className="loading-overlay"><LoaderCircle size={28} className="spin" /><span>正在安全读取项目…</span></div>}
			{error && (
				<div className="error-toast" role="alert">
					<AlertTriangle size={20} />
					<span>{error}</span>
					<button type="button" onClick={() => setError(undefined)}>关闭</button>
				</div>
			)}
			{projectOpenError && (
				<ProjectOpenErrorDialog
					error={projectOpenError}
					busyAction={projectOpenBusyAction}
					onRetry={() => void retryProjectOpen()}
					onOpenReadOnly={() => void openProjectReadOnly()}
					onRepair={() => void repairProject()}
					onOpenDirectory={() => void revealProjectDirectory()}
					onClose={dismissProjectOpenError}
				/>
			)}
			<ExternalConflictDialog />
		</div>
	);
}
