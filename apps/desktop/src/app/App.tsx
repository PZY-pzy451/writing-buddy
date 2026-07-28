import { AlertTriangle, BookOpenText, LoaderCircle, PanelBottomOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from './store';
import { TopBar } from '../shell/TopBar';
import { GlobalRail } from '../shell/GlobalRail';
import { StatusBar } from '../shell/StatusBar';
import { ProjectSidebar } from '../workspace/ProjectSidebar';
import { ResourceTabs } from '../workspace/ResourceTabs';
import { WriterHeader } from '../workspace/WriterHeader';
import { SystemPage } from '../workspace/SystemPage';
import { ChapterEditor } from '../editor/ChapterEditor';
import { ResourceEditor } from '../resources/ResourceEditor';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { TaskDock } from '../review/TaskDock';
import { ExternalConflictDialog } from '../editor/ExternalConflictDialog';
import { ProjectOpenErrorDialog } from '../features/projects/ui/ProjectOpenErrorDialog';
import { ProjectCreationWizard } from '../features/projects/ui/ProjectCreationWizard';
import { ProjectWelcome } from '../features/projects/ui/ProjectWelcome';
import { ProjectStructureUndoToast } from '../features/projects/ui/ProjectStructureUndoToast';
import { StoryStudioRoute, StoryWorkspaceRoute } from './routes';
import { StoryDashboardPage } from '../features/story/dashboard/StoryDashboardPage';
import { AiGenerationDrawer } from '../features/ai/drawer/AiGenerationDrawer';
import { aiGenerationStore } from '../features/ai/drawer/aiGenerationStore';
import { AppEmptyState } from '../features/shared/presentation/AppEmptyState';
import '../theme/visualPolish.css';

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
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const dockOpen = useAppStore(state => state.dockOpen);
	const toggleDock = useAppStore(state => state.toggleDock);
	const verifyExternalChange = useAppStore(state => state.verifyExternalChange);
	const sidebarWidth = useAppStore(state => state.sidebarWidth);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const dockHeight = useAppStore(state => state.dockHeight);
	const sourceRevision = useAppStore(state => state.session?.state.version);

	useEffect(() => {
		void bootstrap();
	}, [bootstrap]);

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			const modifier = event.ctrlKey || event.metaKey;
			const key = event.key.toLocaleLowerCase();
			if (modifier && key === 's') {
				event.preventDefault();
				void useAppStore.getState().save();
			}
			if (modifier && key === 'z') {
				const target = event.target;
				const editing = target instanceof HTMLElement
					&& (target.matches('input, textarea, [contenteditable="true"]')
						|| Boolean(target.closest('.monaco-editor')));
				const state = useAppStore.getState();
				if (!editing && state.structureUndo) {
					event.preventDefault();
					void state.undoProjectStructureMove();
				}
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
			if (useAppStore.getState().session?.state.dirty) {
				event.preventDefault();
			}
		};
		window.addEventListener('beforeunload', beforeUnload);
		let dispose: (() => void) | undefined;
		if ('__TAURI_INTERNALS__' in window) {
			void import('@tauri-apps/api/window')
				.then(({ getCurrentWindow }) => getCurrentWindow().onCloseRequested(event => {
					if (useAppStore.getState().session?.state.dirty
						&& !window.confirm('当前内容尚未保存。确定退出 Writing Buddy 吗？')) {
						event.preventDefault();
					}
				}))
				.then(unlisten => { dispose = unlisten; });
		}
		return () => {
			window.removeEventListener('beforeunload', beforeUnload);
			dispose?.();
		};
	}, []);

	const systemPageVisible = !['works', 'references'].includes(activeMode);
	const welcomeVisible = activeMode === 'works' && !snapshot;
	const storyStudioVisible = activeMode === 'references' && Boolean(snapshot);
	const showDashboard = !systemPageVisible && activeMode === 'works' && Boolean(snapshot) && !activeResource;
	const workspaceAssistantVisible = Boolean(snapshot) && assistantOpen && !focusMode && !systemPageVisible && !showDashboard && !storyStudioVisible;
	const workspaceDockVisible = Boolean(snapshot) && dockOpen && !focusMode && !systemPageVisible && !showDashboard && !storyStudioVisible;
	const showTextEditor = !systemPageVisible && !storyStudioVisible && (activeResource?.type === 'chapter' || activeResource?.type === 'note');
	const showStoryResource = !systemPageVisible && !storyStudioVisible && activeResource?.type === 'story';
	const showResourceEditor = !systemPageVisible && !storyStudioVisible && activeResource && !showTextEditor && !showStoryResource;

	return (
		<div
			className={`app-shell theme-${theme} accent-${accent} mode-${activeMode} ${focusMode ? 'is-focus-mode' : ''} ${systemPageVisible ? 'is-system-page' : ''} ${welcomeVisible ? 'is-welcome' : ''} ${showDashboard ? 'is-dashboard' : ''} ${storyStudioVisible ? 'is-story-studio' : ''} ${workspaceAssistantVisible ? '' : 'is-assistant-closed'} ${workspaceDockVisible ? '' : 'is-dock-closed'}`}
			style={{
				'--sidebar-width-user': `${sidebarWidth}px`,
				'--assistant-width-user': `${assistantWidth}px`,
				'--dock-height-user': `${dockHeight}px`
			} as React.CSSProperties}
		>
			<TopBar />
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
					<button className="dock-restore" type="button" onClick={toggleDock}><PanelBottomOpen size={18} />展开待处理区</button>
				)}
			</main>
			{workspaceAssistantVisible && <AssistantPanel />}
			{!focusMode && <StatusBar />}
			<AiGenerationDrawer />
			<ProjectCreationWizard />
			<ProjectStructureUndoToast />
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
