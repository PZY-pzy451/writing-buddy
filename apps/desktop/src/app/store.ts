import {
	countWords,
	findChapter,
	flattenChapters,
	type CursorState,
	type ResourceDescriptor,
	type TextFile
} from '@writing-buddy/domain';
import { DocumentSession, ResourceTabManager } from '@writing-buddy/project';
import type { MoveCommand, ProjectSnapshot } from '@writing-buddy/platform-ports';
import {
	parseReviewState,
	resolveAnchor,
	serializeReviewState,
	type ReviewIssue
} from '@writing-buddy/review';
import {
	DesktopStoryRepository,
	toStoryChapterId,
	type SelectionRewriteActionType,
	type ManuscriptContinuationMode,
	type ScenePlanActionType,
	type StoryScene
} from '@writing-buddy/story-kernel';
import type { StoryKernelGenerationResourceType } from '@writing-buddy/ai';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	ProjectOpenService,
	toPublicProjectOpenError,
	type ProjectOpenMode,
	type PublicProjectOpenError
} from '../features/projects/application/ProjectOpenService';
import {
	ProjectSceneMoveGatewayError,
	ProjectSceneMoveService,
	type ProjectSceneMoveUndoReceipt
} from '../features/projects/application/ProjectSceneMoveService';
import {
	ProjectStructureMoveGatewayError,
	ProjectStructureMoveService
} from '../features/projects/application/ProjectStructureMoveService';
import { StoryIndexService } from '../features/story/application/StoryIndexService';
import {
	StoryResourceOpenService,
	type StoryOpenResult,
	type StoryResourceReference,
	type StoryTabDescriptor
} from '../features/story/application/StoryResourceOpenService';
import { parseStoryTabKey } from '../features/story/application/StoryResourceRegistry';
import { desktopBridge } from '../platform/bridge';
import { clampWorkspaceSize } from '../shell/workspaceResize';
import {
	parseWriterSession,
	parseWriterSessionMap,
	reconcileWriterSession,
	workspaceForRailMode,
	type WriterSessionMap,
	type WriterSessionPanelState,
	type WriterSessionState
} from './writerSession';
import {
	createDefaultWriterWorkspaceLayouts,
	updateWriterWorkspaceLayout
} from './writerWorkspace';
import {
	captureAnchorForEditor,
	type QuickCapture,
	type QuickCaptureDraft,
	type QuickCaptureStatus,
	type QuickCaptureType
} from '../features/quick-capture/QuickCaptureModel';
import {
	QuickCaptureStore,
	type LoadedQuickCaptures
} from '../features/quick-capture/QuickCaptureStore';
import {
	QuickCaptureConversionService,
	type QuickCaptureConversionTarget
} from '../features/quick-capture/QuickCaptureConversionService';
import { MentionService } from '../features/story/manuscript/MentionService';

export type ThemeId = 'paper' | 'midnight' | 'fog' | 'focus';
export type RailMode = 'works' | 'planning' | 'search' | 'references' | 'review' | 'versions' | 'ai' | 'settings';
export type StoryViewId =
	| 'characters'
	| 'relationships'
	| 'timeline'
	| 'worldbuilding'
	| 'assets'
	| 'plots'
	| 'information'
	| 'associations'
	| 'continuity'
	| 'extraction';

export type AssistantActionRequest =
	| {
		readonly kind: 'rewrite';
		readonly actionType: SelectionRewriteActionType;
	}
	| {
		readonly kind: 'continuation';
		readonly mode: ManuscriptContinuationMode;
	}
	| {
		readonly kind: 'scene-plan';
		readonly actionType: ScenePlanActionType;
	}
	| {
		readonly kind: 'story-kernel';
		readonly targetType: StoryKernelGenerationResourceType;
		readonly instruction: string;
	};

export type AssistantActionIntent = AssistantActionRequest & {
	readonly id: string;
};

type StructureUndoState = {
	readonly description: string;
	readonly expiresAt: number;
} & ({
	readonly kind: 'project';
	readonly inverseCommand: MoveCommand;
} | {
	readonly kind: 'scene';
	readonly receipt: ProjectSceneMoveUndoReceipt;
});

export type DockTab = 'issues' | 'inbox' | 'diff' | 'tasks' | 'backups';

export interface QuickCaptureSeed {
	readonly type: QuickCaptureType;
	readonly text: string;
	readonly chapterId?: string;
	readonly sceneId?: string;
	readonly anchor?: QuickCaptureDraft['anchor'];
}

interface PersistedWorkspace {
	readonly recentProjectRoot?: string;
	readonly recentProjectRoots: readonly string[];
	readonly activeResourceId?: string;
	readonly openResourceIds: readonly string[];
	readonly theme: ThemeId;
	readonly accent: 'gold' | 'blue' | 'purple';
	readonly inlineLanguageCheckEnabled: boolean;
	readonly inlinePlotExpansionEnabled: boolean;
	readonly activeMode: RailMode;
	readonly storyView: StoryViewId;
	readonly sidebarOpen: boolean;
	readonly sidebarWidth: number;
	readonly assistantWidth: number;
	readonly dockHeight: number;
	readonly documentViews: Readonly<Record<string, CursorState>>;
	readonly expandedTreeNodes: readonly string[];
	readonly writerSessions: WriterSessionMap;
}

interface AppState extends PersistedWorkspace {
	readonly loading: boolean;
	readonly focusMode: boolean;
	readonly error?: string;
	readonly projectOpenError?: PublicProjectOpenError;
	readonly pendingProjectRoot?: string;
	readonly projectOpenBusyAction?: 'retry' | 'read-only' | 'repair' | 'directory';
	readonly snapshot?: ProjectSnapshot;
	readonly activeMode: RailMode;
	readonly tabs: readonly ResourceDescriptor[];
	readonly activeResource?: ResourceDescriptor;
	readonly storyOpenResult?: StoryOpenResult;
	readonly session?: DocumentSession;
	readonly resourceContent?: string;
	readonly resourceHash?: string;
	readonly reviewHash: string;
	readonly issues: readonly ReviewIssue[];
	readonly externalConflict?: {
		readonly disk: TextFile;
		readonly detectedAt: string;
	};
	readonly selection?: { start: number; end: number; text: string };
	readonly cursorOffset: number;
	readonly search: string;
	readonly assistantOpen: boolean;
	readonly assistantIntent?: AssistantActionIntent;
	readonly dockOpen: boolean;
	readonly dockTab: DockTab;
	readonly quickCaptures: readonly QuickCapture[];
	readonly quickCaptureHash: string;
	readonly quickCaptureOpen: boolean;
	readonly quickCaptureBusy: boolean;
	readonly quickCaptureSeed?: QuickCaptureSeed;
	readonly projectWizardOpen: boolean;
	readonly structureMoveBusy: boolean;
	readonly structureMoveAnnouncement?: string;
	readonly structureScenes: readonly StoryScene[];
	readonly structureUndo?: StructureUndoState;
	readonly lastSavedAt?: string;
	readonly sessionRestoreState: 'idle' | 'restoring' | 'ready' | 'fallback';
	readonly sessionRestoreNotice?: string;
	readonly pendingEdit?: {
		readonly id: string;
		readonly resourceId: string;
		readonly start: number;
		readonly end: number;
		readonly text: string;
	};
	readonly pendingReveal?: {
		readonly resourceId: string;
		readonly offset: number;
	};
	readonly bootstrap: () => Promise<void>;
	readonly chooseProject: () => Promise<void>;
	readonly openProjectWizard: () => void;
	readonly closeProjectWizard: () => void;
	readonly moveProjectStructure: (command: MoveCommand) => Promise<boolean>;
	readonly undoProjectStructureMove: () => Promise<void>;
	readonly dismissProjectStructureUndo: () => void;
	readonly syncStructureScenesForChapter: (
		chapterId: string,
		scenes: readonly StoryScene[]
	) => void;
	readonly openProject: (root: string, mode?: ProjectOpenMode) => Promise<void>;
	readonly retryProjectOpen: () => Promise<void>;
	readonly openProjectReadOnly: () => Promise<void>;
	readonly repairProject: () => Promise<void>;
	readonly revealProjectDirectory: () => Promise<void>;
	readonly dismissProjectOpenError: () => void;
	readonly openDashboard: () => void;
	readonly openResource: (resource: ResourceDescriptor) => Promise<void>;
	readonly openStoryResource: (reference: StoryResourceReference) => Promise<void>;
	readonly restoreStoryResource: () => Promise<void>;
	readonly closeResource: (resourceId: string) => void;
	readonly setContent: (content: string, change?: 'edit' | 'undo' | 'redo') => void;
	readonly updateCursor: (cursor: CursorState) => void;
	readonly requestEditorEdit: (edit: NonNullable<AppState['pendingEdit']>) => void;
	readonly clearEditorEdit: (id: string) => void;
	readonly requestEditorReveal: (resourceId: string, offset: number) => void;
	readonly clearEditorReveal: (resourceId: string, offset: number) => void;
	readonly setResourceContent: (content: string) => void;
	readonly save: () => Promise<void>;
	readonly saveAs: () => Promise<void>;
	readonly forceSave: () => Promise<void>;
	readonly reloadExternal: () => void;
	readonly dismissExternalConflict: () => void;
	readonly verifyExternalChange: () => Promise<void>;
	readonly reloadProject: () => Promise<void>;
	readonly setSelection: (selection?: { start: number; end: number; text: string }) => void;
	readonly setCursorOffset: (cursorOffset: number) => void;
	readonly setIssues: (issues: readonly ReviewIssue[]) => void;
	readonly setMode: (mode: RailMode) => void;
	readonly setStoryView: (view: StoryViewId) => void;
	readonly setTheme: (theme: ThemeId) => void;
	readonly setAccent: (accent: 'gold' | 'blue' | 'purple') => void;
	readonly toggleFocus: () => void;
	readonly setInlineLanguageCheckEnabled: (enabled: boolean) => void;
	readonly setInlinePlotExpansionEnabled: (enabled: boolean) => void;
	readonly toggleSidebar: () => void;
	readonly toggleAssistant: () => void;
	readonly openAssistant: () => void;
	readonly requestAssistantAction: (request: AssistantActionRequest) => void;
	readonly toggleDock: () => void;
	readonly setDockTab: (tab: DockTab) => void;
	readonly openQuickCaptureInbox: () => void;
	readonly openQuickCapture: (seed?: Partial<QuickCaptureSeed>) => void;
	readonly closeQuickCapture: () => void;
	readonly saveQuickCapture: (
		type: QuickCaptureType,
		text: string
	) => Promise<boolean>;
	readonly setQuickCaptureStatus: (
		id: string,
		status: QuickCaptureStatus,
		convertedResourceId?: string
	) => Promise<boolean>;
	readonly convertQuickCapture: (
		id: string,
		target: QuickCaptureConversionTarget
	) => Promise<boolean>;
	readonly jumpToQuickCaptureSource: (capture: QuickCapture) => Promise<boolean>;
	readonly setSearch: (search: string) => void;
	readonly setError: (error?: string) => void;
	readonly setSidebarWidth: (width: number) => void;
	readonly setAssistantWidth: (width: number) => void;
	readonly setDockHeight: (height: number) => void;
	readonly setTreeNodeExpanded: (nodeId: string, expanded: boolean) => void;
	readonly resetWorkspaceLayout: () => void;
	readonly flushWriterSession: () => void;
}

const tabs = new ResourceTabManager();
const projectOpenService = new ProjectOpenService(desktopBridge);
const projectStructureMoveService = new ProjectStructureMoveService(desktopBridge);
const projectSceneMoveService = new ProjectSceneMoveService(desktopBridge);
const storyIndexService = new StoryIndexService(desktopBridge);
let storyResourceOpenService: StoryResourceOpenService | undefined;
let quickCaptureStore: QuickCaptureStore | undefined;
let reviewPersistTimer: number | undefined;

const defaultWriterPanelState: WriterSessionPanelState =
	createDefaultWriterWorkspaceLayouts().writing;

function updateCurrentWriterSession(
	state: AppState,
	update: (session: WriterSessionState) => WriterSessionState
): WriterSessionMap {
	const projectId = state.snapshot?.project.projectId;
	const session = projectId ? state.writerSessions[projectId] : undefined;
	if (!projectId || !session) return state.writerSessions;
	return {
		...state.writerSessions,
		[projectId]: update(session)
	};
}

function touchWriterSession(
	session: WriterSessionState,
	patch: Partial<WriterSessionState>
): WriterSessionState {
	return {
		...session,
		...patch,
		updatedAt: new Date().toISOString()
	};
}

function updateSessionResource(
	session: WriterSessionState,
	resource: ResourceDescriptor,
	openResourceIds: readonly string[]
): WriterSessionState {
	const chapterChanged = resource.type === 'chapter'
		&& resource.id !== session.activeChapterId;
	const updated = touchWriterSession(session, {
		activeResourceId: resource.id,
		...(resource.type === 'chapter' ? { activeChapterId: resource.id } : {}),
		openTabs: openResourceIds.map(resourceId => ({ resourceId }))
	});
	if (!chapterChanged) return updated;
	const withoutStaleChapterPosition = { ...updated };
	delete withoutStaleChapterPosition.activeSceneId;
	delete withoutStaleChapterPosition.cursor;
	delete withoutStaleChapterPosition.scroll;
	return withoutStaleChapterPosition;
}

function updateSessionPanel(
	session: WriterSessionState,
	panelState: Partial<WriterSessionPanelState>
): WriterSessionState {
	const updatedPanelState = {
		...session.panelState,
		...panelState
	};
	return touchWriterSession(session, {
		panelState: updatedPanelState,
		workspaceLayouts: updateWriterWorkspaceLayout(
			session.workspaceLayouts,
			session.activeWorkspace,
			panelState
		)
	});
}

const projectMoveErrorCopy: Readonly<Record<string, string>> = {
	projectReadOnly: '当前作品以只读模式打开，不能调整结构。',
	projectRevisionConflict: '作品结构已在磁盘上变化，请重新载入后再移动。',
	projectMoveSourceChanged: '待移动项目的位置已经变化，请重试。',
	projectMoveNoChange: '项目已经在这个位置。',
	projectMoveEntityTypeUnsupported: '当前项目类型暂不支持此移动。',
	projectMoveWriteFailed: '项目结构保存失败，原顺序未改变。',
	projectMoveVerificationFailed: '项目结构验证失败，已恢复原顺序。',
	projectMoveFailed: '暂时无法调整项目结构。'
};

const sceneMoveErrorCopy: Readonly<Record<string, string>> = {
	projectReadOnly: '当前作品以只读模式打开，不能移动场景。',
	sceneMoveUnsavedDocument: '请先保存当前文稿，再移动场景。',
	sceneMoveProjectRevisionConflict: '作品结构已变化，请重新载入后再移动场景。',
	sceneMoveStoryRevisionConflict: '场景或剧情资料已变化，请重新载入后再试。',
	sceneMoveMentionRevisionConflict: '正文引用已变化，请重新载入后再试。',
	sceneMoveTextConflict: '章节正文已在磁盘上变化，场景未移动。',
	sceneMoveAnchorInvalid: '场景锚点与当前正文不一致，请先重新标记场景范围。',
	sceneMoveMentionBoundaryConflict: '有正文引用跨过场景边界，无法安全移动。',
	sceneMoveSourceChanged: '待移动场景的位置已变化，请重试。',
	sceneMoveTargetInvalid: '目标章节或场景位置无效。',
	sceneMoveNoChange: '场景已经位于该位置。',
	sceneMoveStagingFailed: '无法准备场景移动，正文未改变。',
	sceneMoveWriteFailed: '场景移动保存失败，原正文已恢复。',
	sceneMoveRollbackFailed: '场景移动回滚失败，请从备份记录恢复。',
	sceneMoveVerificationFailed: '场景移动验证失败，原正文已恢复。',
	sceneMoveFailed: '暂时无法移动场景，正文未改变。'
};

function toChapterResource(snapshot: ProjectSnapshot, chapterId: string): ResourceDescriptor | undefined {
	const found = findChapter(snapshot.project, chapterId);
	return found ? {
		id: found.chapter.id,
		type: 'chapter',
		title: found.chapter.title,
		path: found.chapter.file,
		projectId: snapshot.project.projectId
	} : undefined;
}

function toResource(snapshot: ProjectSnapshot, resourceId: string): ResourceDescriptor | undefined {
	return toChapterResource(snapshot, resourceId)
		?? snapshot.resources
			.filter(candidate => candidate.id === resourceId)
			.map(candidate => ({ ...candidate, projectId: snapshot.project.projectId }))[0];
}

function isStoryTab(resource: ResourceDescriptor): resource is StoryTabDescriptor {
	return resource.type === 'story' && parseStoryTabKey(resource.id) !== undefined;
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
	loading: false,
	theme: 'paper',
	accent: 'gold',
	focusMode: false,
	inlineLanguageCheckEnabled: false,
	inlinePlotExpansionEnabled: false,
	sidebarOpen: true,
	sidebarWidth: defaultWriterPanelState.projectSidebarWidth,
	assistantWidth: 360,
	dockHeight: 240,
	documentViews: {},
	expandedTreeNodes: [],
	writerSessions: {},
	activeMode: 'works',
	storyView: 'characters',
	recentProjectRoots: [],
	openResourceIds: [],
	tabs: [],
	issues: [],
	reviewHash: '',
	search: '',
	cursorOffset: 0,
	assistantOpen: false,
	dockOpen: false,
	dockTab: 'issues',
	quickCaptures: [],
	quickCaptureHash: '',
	quickCaptureOpen: false,
	quickCaptureBusy: false,
	projectWizardOpen: false,
	structureMoveBusy: false,
	structureScenes: [],
	sessionRestoreState: 'idle',

	async bootstrap() {
		const root = get().recentProjectRoot ?? (get().recentProjectRoots ?? [])[0];
		if (root) {
			await get().openProject(root);
		}
	},

	async chooseProject() {
		const root = await desktopBridge.chooseProject();
		if (root) {
			await get().openProject(root);
		}
	},

	openProjectWizard() {
		set({ projectWizardOpen: true, error: undefined });
	},

	closeProjectWizard() {
		set({ projectWizardOpen: false });
	},

	async moveProjectStructure(command) {
		const snapshot = get().snapshot;
		if (!snapshot || get().structureMoveBusy) {
			return false;
		}
		if (snapshot.readOnly) {
			set({ error: projectMoveErrorCopy.projectReadOnly });
			return false;
		}
		if (command.entityType === 'scene') {
			const session = get().session;
			if (session?.state.dirty) {
				set({ error: sceneMoveErrorCopy.sceneMoveUnsavedDocument });
				return false;
			}
			set({ structureMoveBusy: true, error: undefined });
			try {
				const result = await projectSceneMoveService.execute(snapshot, command);
				const activeResource = get().activeResource;
				let nextSession = session;
				if (
					session
					&& activeResource?.type === 'chapter'
					&& result.wordCountContent[activeResource.id] !== undefined
					&& activeResource.path
				) {
					const disk = await desktopBridge.readText(snapshot.root, activeResource.path);
					session.reload(disk);
					nextSession = session.copy();
				}
				set({
					snapshot: {
						...snapshot,
						wordCounts: {
							...snapshot.wordCounts,
							...Object.fromEntries(Object.entries(result.wordCountContent).map(
								([chapterId, content]) => [chapterId, countWords(content)]
							))
						}
					},
					session: nextSession,
					structureScenes: result.scenes,
					structureMoveBusy: false,
					structureMoveAnnouncement: result.description,
					structureUndo: {
						kind: 'scene',
						receipt: result.undoReceipt,
						description: result.description,
						expiresAt: Date.now() + 6000
					}
				});
				return true;
			} catch (error) {
				const code = error instanceof ProjectSceneMoveGatewayError
					? error.code
					: 'sceneMoveFailed';
				set({
					structureMoveBusy: false,
					error: sceneMoveErrorCopy[code] ?? sceneMoveErrorCopy.sceneMoveFailed
				});
				return false;
			}
		}
		set({ structureMoveBusy: true, error: undefined });
		try {
			const result = await projectStructureMoveService.execute(snapshot.root, command);
			set({
				snapshot: {
					...snapshot,
					project: result.project,
					projectRevision: result.projectRevision
				},
				structureMoveBusy: false,
				structureMoveAnnouncement: result.description,
				structureUndo: {
					kind: 'project',
					inverseCommand: result.inverseCommand,
					description: result.description,
					expiresAt: Date.now() + 6000
				}
			});
			return true;
		} catch (error) {
			const code = error instanceof ProjectStructureMoveGatewayError
				? error.code
				: 'projectMoveFailed';
			set({
				structureMoveBusy: false,
				error: projectMoveErrorCopy[code] ?? projectMoveErrorCopy.projectMoveFailed
			});
			return false;
		}
	},

	async undoProjectStructureMove() {
		const snapshot = get().snapshot;
		const undo = get().structureUndo;
		if (!snapshot || !undo || get().structureMoveBusy) {
			return;
		}
		set({ structureMoveBusy: true, error: undefined });
		if (undo.kind === 'scene') {
			try {
				const result = await projectSceneMoveService.undo(snapshot, undo.receipt);
				const activeResource = get().activeResource;
				const session = get().session;
				let nextSession = session;
				if (
					session
					&& activeResource?.type === 'chapter'
					&& result.wordCountContent[activeResource.id] !== undefined
					&& activeResource.path
				) {
					const disk = await desktopBridge.readText(snapshot.root, activeResource.path);
					session.reload(disk);
					nextSession = session.copy();
				}
				set({
					snapshot: {
						...snapshot,
						wordCounts: {
							...snapshot.wordCounts,
							...Object.fromEntries(Object.entries(result.wordCountContent).map(
								([chapterId, content]) => [chapterId, countWords(content)]
							))
						}
					},
					session: nextSession,
					structureScenes: result.scenes,
					structureMoveBusy: false,
					structureMoveAnnouncement: result.description,
					structureUndo: undefined
				});
			} catch (error) {
				const code = error instanceof ProjectSceneMoveGatewayError
					? error.code
					: 'sceneMoveFailed';
				set({
					structureMoveBusy: false,
					structureUndo: code.endsWith('Conflict') ? undefined : undo,
					error: sceneMoveErrorCopy[code] ?? sceneMoveErrorCopy.sceneMoveFailed
				});
			}
			return;
		}
		try {
			const result = await projectStructureMoveService.execute(
				snapshot.root,
				undo.inverseCommand
			);
			set({
				snapshot: {
					...snapshot,
					project: result.project,
					projectRevision: result.projectRevision
				},
				structureMoveBusy: false,
				structureMoveAnnouncement: `已撤销：${undo.description}`,
				structureUndo: undefined
			});
		} catch (error) {
			const code = error instanceof ProjectStructureMoveGatewayError
				? error.code
				: 'projectMoveFailed';
			set({
				structureMoveBusy: false,
				structureUndo: code === 'projectRevisionConflict' ? undefined : undo,
				error: projectMoveErrorCopy[code] ?? projectMoveErrorCopy.projectMoveFailed
			});
		}
	},

	dismissProjectStructureUndo() {
		set({ structureUndo: undefined });
	},

	syncStructureScenesForChapter(chapterId, scenes) {
		set(state => ({
			structureScenes: [
				...state.structureScenes.filter(scene => scene.chapterId !== chapterId),
				...scenes
			].sort((left, right) => (
				left.chapterId.localeCompare(right.chapterId)
				|| left.narrativeOrder - right.narrativeOrder
				|| left.manuscriptRange.start - right.manuscriptRange.start
			))
		}));
	},

	async openProject(root, mode = 'read-write') {
		set({
			loading: true,
			error: undefined,
			projectOpenError: undefined,
			pendingProjectRoot: root,
			sessionRestoreState: 'restoring',
			sessionRestoreNotice: undefined
		});
		const result = mode === 'read-only'
			? await projectOpenService.openProjectReadOnly(root)
			: await projectOpenService.openProjectReadWrite(root);
		if (!result.ok) {
			set({
				loading: false,
				projectOpenError: result.error,
				projectOpenBusyAction: undefined,
				sessionRestoreState: 'idle'
			});
			return;
		}

		try {
			const snapshot = result.snapshot;
			const recentProjectRoots = [
				snapshot.root,
				...(get().recentProjectRoots ?? []).filter(candidate => (
					candidate.toLocaleLowerCase() !== snapshot.root.toLocaleLowerCase()
				))
			].slice(0, 3);
			let reviewFile: TextFile | undefined;
			let restoredIssues: readonly ReviewIssue[] = [];
			let structureScenes: readonly StoryScene[] = [];
			let quickCaptureCollection: LoadedQuickCaptures = {
				state: { schemaVersion: 1, captures: [] },
				hash: ''
			};
			try {
				reviewFile = await desktopBridge.readReviewState(snapshot.root);
				if (reviewFile) {
					restoredIssues = parseReviewState(reviewFile.content).issues;
				}
			} catch {
				reviewFile = undefined;
				restoredIssues = [];
			}
			try {
				structureScenes = await projectSceneMoveService.listScenes(snapshot.root);
			} catch {
				structureScenes = [];
			}
			quickCaptureStore = new QuickCaptureStore(snapshot.root, desktopBridge);
			try {
				quickCaptureCollection = await quickCaptureStore.load();
			} catch {
				quickCaptureCollection = {
					state: { schemaVersion: 1, captures: [] },
					hash: ''
				};
			}
			const chapterIds = flattenChapters(snapshot.project).map(chapter => chapter.id);
			const expandedTreeNodeIds = [
				...snapshot.project.volumes.map(volume => volume.id),
				'references'
			];
			const current = get();
			const panelDefaults: WriterSessionPanelState = {
				...defaultWriterPanelState
			};
			const legacyActiveResourceId = current.activeResourceId;
			const legacyOpenResourceIds = current.openResourceIds;
			const legacyChapterId = legacyActiveResourceId && chapterIds.includes(legacyActiveResourceId)
				? legacyActiveResourceId
				: legacyOpenResourceIds.find(resourceId => chapterIds.includes(resourceId));
			const legacyCursor = legacyChapterId
				? current.documentViews[`${snapshot.project.projectId}:${legacyChapterId}`]
				: undefined;
			const legacySession: WriterSessionState | undefined = (
				Object.keys(current.writerSessions).length === 0
				&& (legacyActiveResourceId || legacyOpenResourceIds.length)
			) ? {
					schemaVersion: 2,
					projectId: snapshot.project.projectId,
					activeWorkspace: workspaceForRailMode(current.activeMode),
					...(legacyChapterId ? { activeChapterId: legacyChapterId } : {}),
					...(legacyActiveResourceId ? { activeResourceId: legacyActiveResourceId } : {}),
					openTabs: legacyOpenResourceIds.map(resourceId => ({ resourceId })),
					...(legacyChapterId && legacyCursor ? {
						cursor: {
							chapterId: legacyChapterId,
							line: legacyCursor.lineNumber,
							column: legacyCursor.column
						},
						scroll: {
							chapterId: legacyChapterId,
							scrollTop: legacyCursor.scrollTop
						}
					} : {}),
					expandedTreeNodes: current.expandedTreeNodes.length
						? current.expandedTreeNodes
						: expandedTreeNodeIds,
					panelState: {
						...panelDefaults,
						projectSidebarWidth: current.sidebarWidth,
						assistantWidth: current.assistantWidth,
						assistantVisible: current.assistantOpen,
						sidebarVisible: current.sidebarOpen,
						dockHeight: current.dockHeight,
						dockVisible: current.dockOpen
					},
					workspaceLayouts: updateWriterWorkspaceLayout(
						createDefaultWriterWorkspaceLayouts(),
						workspaceForRailMode(current.activeMode),
						{
							projectSidebarWidth: current.sidebarWidth,
							assistantWidth: current.assistantWidth,
							assistantVisible: current.assistantOpen,
							sidebarVisible: current.sidebarOpen,
							dockHeight: current.dockHeight,
							dockVisible: current.dockOpen
						}
					),
					focusMode: false,
					updatedAt: new Date().toISOString()
				} : undefined;
			const storedSession: unknown = current.writerSessions[snapshot.project.projectId]
				?? legacySession;
			const parsedStoredSession = parseWriterSession(storedSession);
			const storedResourceIds = parsedStoredSession?.openTabs.map(tab => tab.resourceId) ?? [];
			const storyTabIds = storedResourceIds.filter(resourceId => parseStoryTabKey(resourceId));
			const resourceIds = [
				...chapterIds,
				...snapshot.resources.map(resource => resource.id),
				...storyTabIds
			];
			const reconciled = reconcileWriterSession(storedSession, {
				projectId: snapshot.project.projectId,
				chapterIds,
				resourceIds,
				sceneIdsByChapter: Object.fromEntries(chapterIds.map(chapterId => [
					chapterId,
					structureScenes
						.filter(scene => (
							scene.chapterId === chapterId
							|| scene.chapterId === toStoryChapterId(chapterId)
						))
						.map(scene => scene.id)
				])),
				expandedTreeNodeIds,
				defaultPanelState: panelDefaults,
				now: new Date().toISOString()
			});
			const persistedResourceIds = reconciled.session.openTabs.map(tab => tab.resourceId);
			const restoredTabs = persistedResourceIds
				.filter(resourceId => !parseStoryTabKey(resourceId))
				.map(resourceId => toResource(snapshot, resourceId))
				.filter((resource): resource is ResourceDescriptor => resource !== undefined);
			tabs.restore({ resources: restoredTabs });
			storyResourceOpenService = new StoryResourceOpenService(
				new DesktopStoryRepository(snapshot.root, desktopBridge),
				tabs,
				snapshot.project.projectId
			);
			const restoredStoryResults = await storyResourceOpenService.restoreStoryResources(
				persistedResourceIds,
				reconciled.session.activeResourceId
			);
			const persistedActiveId = reconciled.session.activeResourceId;
			if (persistedActiveId) {
				tabs.activate(persistedActiveId);
			}
			const active = persistedActiveId
				? tabs.state.resources.find(candidate => candidate.id === tabs.state.activeId)
				: undefined;
			const activeStoryResult = active
				? restoredStoryResults.find(result => result.tab.id === active.id)
				: undefined;
			const restoredView = reconciled.session.cursor && reconciled.session.scroll
				? {
						lineNumber: reconciled.session.cursor.line,
						column: reconciled.session.cursor.column,
						scrollTop: reconciled.session.scroll.scrollTop
					}
				: undefined;
			const writingLayout = reconciled.session.workspaceLayouts.writing;
			const dashboardSession: WriterSessionState = {
				...reconciled.session,
				activeWorkspace: 'writing',
				panelState: writingLayout,
				focusMode: false
			};
			set({
				snapshot,
				recentProjectRoot: snapshot.root,
				recentProjectRoots,
				...(snapshot.appearance ? {
					theme: snapshot.appearance.themeId,
					accent: snapshot.appearance.accentId
				} : {}),
				loading: false,
				activeMode: 'works',
				issues: restoredIssues,
				reviewHash: reviewFile?.hash ?? '',
				tabs: tabs.state.resources,
				openResourceIds: tabs.state.resources.map(candidate => candidate.id),
				activeResource: undefined,
				activeResourceId: undefined,
				storyOpenResult: activeStoryResult,
				session: undefined,
				resourceContent: undefined,
				resourceHash: undefined,
				externalConflict: undefined,
				projectOpenError: undefined,
				pendingProjectRoot: undefined,
				projectOpenBusyAction: undefined,
				structureMoveBusy: false,
				structureScenes,
				structureMoveAnnouncement: undefined,
				structureUndo: undefined,
				focusMode: false,
				sidebarOpen: writingLayout.sidebarVisible,
				sidebarWidth: clampWorkspaceSize(
					'sidebar',
					writingLayout.projectSidebarWidth
				),
				assistantOpen: writingLayout.assistantVisible,
				assistantWidth: clampWorkspaceSize(
					'assistant',
					writingLayout.assistantWidth
				),
				dockOpen: writingLayout.dockVisible,
				dockTab: 'issues',
				dockHeight: clampWorkspaceSize('dock', writingLayout.dockHeight),
				quickCaptures: quickCaptureCollection.state.captures,
				quickCaptureHash: quickCaptureCollection.hash,
				quickCaptureOpen: false,
				quickCaptureBusy: false,
				quickCaptureSeed: undefined,
				expandedTreeNodes: reconciled.session.expandedTreeNodes,
				writerSessions: {
					...current.writerSessions,
					[snapshot.project.projectId]: dashboardSession
				},
				documentViews: restoredView && reconciled.session.activeChapterId
					? {
							...current.documentViews,
							[`${snapshot.project.projectId}:${reconciled.session.activeChapterId}`]: restoredView
						}
					: current.documentViews,
				sessionRestoreState: reconciled.notice ? 'fallback' : 'ready',
				sessionRestoreNotice: reconciled.notice
			});
			void storyIndexService
				.prepare(snapshot.root, !snapshot.readOnly)
				.catch(() => undefined);
		} catch (error) {
			set({
				loading: false,
				projectOpenError: toPublicProjectOpenError(error, root),
				projectOpenBusyAction: undefined,
				sessionRestoreState: 'idle'
			});
		}
	},

	async retryProjectOpen() {
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'retry' });
		await get().openProject(root, 'read-write');
	},

	async openProjectReadOnly() {
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'read-only' });
		await get().openProject(root, 'read-only');
	},

	async repairProject() {
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'repair', error: undefined });
		try {
			await projectOpenService.repairProject(root);
			await get().openProject(root, 'read-write');
		} catch (error) {
			set({
				projectOpenError: toPublicProjectOpenError(error, root),
				projectOpenBusyAction: undefined
			});
		}
	},

	async revealProjectDirectory() {
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'directory', error: undefined });
		try {
			await projectOpenService.revealProjectDirectory(root);
			set({ projectOpenBusyAction: undefined });
		} catch {
			set({ projectOpenBusyAction: undefined, error: '无法打开项目目录。' });
		}
	},

	dismissProjectOpenError() {
		set({ projectOpenError: undefined, projectOpenBusyAction: undefined });
	},

	openDashboard() {
		set({
			activeMode: 'works',
			activeResource: undefined,
			activeResourceId: undefined,
			storyOpenResult: undefined,
			session: undefined,
			resourceContent: undefined,
			resourceHash: undefined,
			externalConflict: undefined,
			error: undefined
		});
	},

	async openResource(resource) {
		const snapshot = get().snapshot;
		if (!snapshot) {
			return;
		}
		if (isStoryTab(resource)) {
			const reference = parseStoryTabKey(resource.id);
			if (reference) {
				await get().openStoryResource(reference);
			}
			return;
		}
		if (!resource.path) {
			return;
		}
		const resourcePath = resource.path;
		tabs.open(resource);
		const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
		set(state => ({
			activeResource: resource,
			activeResourceId: resource.id,
			storyOpenResult: undefined,
			tabs: tabs.state.resources,
			openResourceIds,
			externalConflict: undefined,
			error: undefined,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionResource(session, resource, openResourceIds)
			)
		}));
		try {
			if (resource.type === 'chapter' || resource.type === 'note') {
				const file = await desktopBridge.readText(snapshot.root, resourcePath);
				const viewKey = `${snapshot.project.projectId}:${resource.id}`;
				const documentView = get().documentViews[viewKey];
				set(state => ({
					session: new DocumentSession(resource.id, resourcePath, file, documentView),
					resourceContent: undefined,
					resourceHash: undefined,
					writerSessions: resource.type === 'chapter'
						? updateCurrentWriterSession(state, writerSession => touchWriterSession(
								writerSession,
								{
									cursor: {
										chapterId: resource.id,
										line: documentView?.lineNumber ?? 1,
										column: documentView?.column ?? 1
									},
									scroll: {
										chapterId: resource.id,
										scrollTop: documentView?.scrollTop ?? 0
									}
								}
							))
						: state.writerSessions
				}));
			} else {
				const content = await desktopBridge.readResource(snapshot.root, resourcePath);
				const file = await desktopBridge.readText(snapshot.root, resourcePath);
				set({ session: undefined, resourceContent: content, resourceHash: file.hash });
			}
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '无法打开资源。' });
		}
	},

	async openStoryResource(reference) {
		if (!storyResourceOpenService) {
			set({ error: 'Story Kernel 尚未连接到当前项目。' });
			return;
		}
		try {
			const result = await storyResourceOpenService.openStoryResource(reference);
			const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
			set(state => ({
				activeResource: result.tab,
				activeResourceId: result.tab.id,
				storyOpenResult: result,
				tabs: tabs.state.resources,
				openResourceIds,
				session: undefined,
				resourceContent: undefined,
				resourceHash: undefined,
				externalConflict: undefined,
				error: undefined,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionResource(session, result.tab, openResourceIds)
				)
			}));
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '无法打开 Story 资源。' });
		}
	},

	async restoreStoryResource() {
		const missing = get().storyOpenResult;
		if (!storyResourceOpenService || missing?.status !== 'missing') {
			return;
		}
		try {
			const result = await storyResourceOpenService.restoreFromTrash(missing.reference);
			const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
			set(state => ({
				activeResource: result.tab,
				activeResourceId: result.tab.id,
				storyOpenResult: result,
				tabs: tabs.state.resources,
				openResourceIds,
				error: undefined,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionResource(session, result.tab, openResourceIds)
				)
			}));
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '资源不在可恢复区。' });
		}
	},

	closeResource(resourceId) {
		const session = get().session;
		if (get().activeResource?.id === resourceId && session?.state.dirty) {
			if (!window.confirm('当前内容尚未保存。确定要关闭这个标签并放弃未保存修改吗？')) {
				return;
			}
		}
		tabs.close(resourceId);
		const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
		const next = tabs.state.resources.find(resource => resource.id === tabs.state.activeId);
		set(state => ({
			tabs: tabs.state.resources,
			openResourceIds,
			writerSessions: updateCurrentWriterSession(state, writerSession => {
				const updated = touchWriterSession(writerSession, {
					openTabs: openResourceIds.map(id => ({ resourceId: id })),
					...(next ? { activeResourceId: next.id } : {})
				});
				if (next) return updated;
				const withoutActiveResource = { ...updated };
				delete withoutActiveResource.activeResourceId;
				return withoutActiveResource;
			})
		}));
		if (next) {
			void get().openResource(next);
		} else {
			set({
				activeResource: undefined,
				storyOpenResult: undefined,
				session: undefined,
				resourceContent: undefined
			});
		}
	},

	setContent(content, change = 'edit') {
		const session = get().session;
		if (!session) {
			return;
		}
		session.updateContent(content);
		const issues = change === 'undo'
			? get().issues.map(issue => (
				issue.status === 'accepted' && content.includes(issue.anchor.target)
					? { ...issue, status: 'open' as const, updatedAt: new Date().toISOString() }
					: issue
			))
			: get().issues;
		set(state => ({
			session: session.copy(),
			issues,
			writerSessions: updateCurrentWriterSession(
				state,
				writerSession => touchWriterSession(writerSession, {})
			)
		}));
		if (change === 'undo') {
			get().setIssues(issues);
		}
	},

	updateCursor(cursor) {
		const session = get().session;
		if (!session) {
			return;
		}
		session.updateCursor(cursor);
		const snapshot = get().snapshot;
		const viewKey = snapshot
			? `${snapshot.project.projectId}:${session.state.resourceId}`
			: session.state.resourceId;
		set(state => ({
			session: session.copy(),
			documentViews: {
				...state.documentViews,
				[viewKey]: cursor
			},
			writerSessions: session.state.resourceId === state.writerSessions[
				state.snapshot?.project.projectId ?? ''
			]?.activeChapterId
				? updateCurrentWriterSession(state, writerSession => touchWriterSession(
						writerSession,
						{
							cursor: {
								chapterId: session.state.resourceId,
								line: cursor.lineNumber,
								column: cursor.column
							},
							scroll: {
								chapterId: session.state.resourceId,
								scrollTop: cursor.scrollTop
							}
						}
					))
				: state.writerSessions
		}));
	},

	requestEditorEdit(pendingEdit) { set({ pendingEdit }); },
	clearEditorEdit(id) {
		if (get().pendingEdit?.id === id) {
			set({ pendingEdit: undefined });
		}
	},
	requestEditorReveal(resourceId, offset) {
		set(state => {
			const projectChapterId = state.snapshot
				&& flattenChapters(state.snapshot.project).some(chapter => chapter.id === resourceId)
				? resourceId
				: undefined;
			const scene = projectChapterId
				? state.structureScenes.find(candidate => (
						(candidate.chapterId === projectChapterId
							|| candidate.chapterId === toStoryChapterId(projectChapterId))
						&& candidate.manuscriptRange.start === offset
					))
				: undefined;
			return {
				pendingReveal: { resourceId, offset },
				writerSessions: scene
					? updateCurrentWriterSession(state, session => touchWriterSession(
							session,
							{ activeSceneId: scene.id }
						))
					: state.writerSessions
			};
		});
	},
	clearEditorReveal(resourceId, offset) {
		const pending = get().pendingReveal;
		if (pending?.resourceId === resourceId && pending.offset === offset) {
			set({ pendingReveal: undefined });
		}
	},

	setResourceContent(resourceContent) {
		set({ resourceContent });
	},

	async save() {
		const { snapshot, activeResource, session, resourceContent, resourceHash } = get();
		if (!snapshot || !activeResource?.path) {
			return;
		}
		try {
			if (session) {
				const result = await desktopBridge.writeTextAtomic(session.toWriteRequest(snapshot.root));
				session.markSaved(result);
				set({
					session: session.copy(),
					snapshot: {
						...snapshot,
						wordCounts: {
							...snapshot.wordCounts,
							[session.state.resourceId]: countWords(session.content)
						}
					},
					lastSavedAt: result.modifiedAt,
					error: undefined
				});
			} else if (resourceContent !== undefined && resourceHash) {
				const result = await desktopBridge.writeResource(snapshot.root, activeResource.path, resourceContent, resourceHash);
				set({ resourceHash: result.hash, lastSavedAt: result.modifiedAt, error: undefined });
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : '保存失败。磁盘内容可能已经变化。';
			if (session && message.startsWith('externalChange')) {
				try {
					const disk = await desktopBridge.readText(snapshot.root, session.state.path);
					set({
						externalConflict: { disk, detectedAt: new Date().toISOString() },
						error: undefined
					});
					return;
				} catch {
					// Preserve the original conflict when the disk copy cannot be reread.
				}
			}
			set({ error: message });
		}
	},

	async saveAs() {
		const { activeResource, session } = get();
		if (!activeResource || !session) {
			return;
		}
		const path = await desktopBridge.saveTextAs(
			session.content,
			session.state.originalEol,
			session.state.hasBom,
			`${activeResource.title}.md`
		);
		if (path) {
			set({ error: undefined, lastSavedAt: new Date().toISOString() });
		}
	},

	async forceSave() {
		const { snapshot, session } = get();
		if (!snapshot || !session) {
			return;
		}
		try {
			const result = await desktopBridge.writeTextAtomic(session.toWriteRequest(snapshot.root, true));
			session.markSaved(result);
			set({
				session: session.copy(),
				snapshot: {
					...snapshot,
					wordCounts: {
						...snapshot.wordCounts,
						[session.state.resourceId]: countWords(session.content)
					}
				},
				externalConflict: undefined,
				lastSavedAt: result.modifiedAt,
				error: undefined
			});
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '覆盖保存失败。' });
		}
	},

	reloadExternal() {
		const { session, externalConflict } = get();
		if (!session || !externalConflict) {
			return;
		}
		session.reload(externalConflict.disk);
		const snapshot = get().snapshot;
		set({
			session: session.copy(),
			snapshot: snapshot ? {
				...snapshot,
				wordCounts: {
					...snapshot.wordCounts,
					[session.state.resourceId]: countWords(session.content)
				}
			} : snapshot,
			externalConflict: undefined,
			error: undefined
		});
	},

	dismissExternalConflict() {
		set({ externalConflict: undefined });
	},

	async verifyExternalChange() {
		const { snapshot, session, externalConflict } = get();
		if (!snapshot || !session || externalConflict) {
			return;
		}
		try {
			const disk = await desktopBridge.readText(snapshot.root, session.state.path);
			if (disk.hash === session.state.diskHash) {
				return;
			}
			if (session.state.dirty) {
				set({ externalConflict: { disk, detectedAt: new Date().toISOString() } });
			} else {
				session.reload(disk);
				set({
					session: session.copy(),
					snapshot: {
						...snapshot,
						wordCounts: {
							...snapshot.wordCounts,
							[session.state.resourceId]: countWords(session.content)
						}
					},
					lastSavedAt: new Date().toISOString()
				});
			}
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '无法检查磁盘变化。' });
		}
	},

	async reloadProject() {
		const root = get().snapshot?.root ?? get().recentProjectRoot;
		if (root) {
			await get().openProject(root);
		}
	},

	setSelection(selection) { set({ selection }); },
	setCursorOffset(cursorOffset) { set({ cursorOffset: Math.max(0, cursorOffset) }); },
	setIssues(issues) {
		set(state => ({
			issues,
			dockOpen: true,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { dockVisible: true })
			)
		}));
		window.clearTimeout(reviewPersistTimer);
		reviewPersistTimer = window.setTimeout(() => {
			const { snapshot, reviewHash } = get();
			if (!snapshot || snapshot.readOnly) {
				return;
			}
			void desktopBridge
				.writeReviewState(snapshot.root, serializeReviewState(get().issues), reviewHash)
				.then(result => set({ reviewHash: result.hash }))
				.catch(error => set({
					error: error instanceof Error ? error.message : '审校状态保存失败。'
				}));
		}, 150);
	},
	setMode(activeMode) {
		set(state => {
			const workspace = workspaceForRailMode(activeMode);
			const projectId = state.snapshot?.project.projectId;
			const session = projectId ? state.writerSessions[projectId] : undefined;
			const layout = session?.workspaceLayouts[workspace]
				?? createDefaultWriterWorkspaceLayouts()[workspace];
			return {
				activeMode,
				...(activeMode === 'planning' ? { storyView: 'plots' as const } : {}),
				sidebarOpen: layout.sidebarVisible,
				sidebarWidth: clampWorkspaceSize('sidebar', layout.projectSidebarWidth),
				assistantOpen: layout.assistantVisible,
				assistantWidth: clampWorkspaceSize('assistant', layout.assistantWidth),
				dockOpen: layout.dockVisible,
				dockHeight: clampWorkspaceSize('dock', layout.dockHeight),
				writerSessions: updateCurrentWriterSession(
					state,
					writerSession => touchWriterSession(writerSession, {
						activeWorkspace: workspace,
						panelState: layout
					})
				)
			};
		});
	},
	setStoryView(storyView) {
		const mode = get().activeMode === 'planning' ? 'planning' : 'references';
		get().setMode(mode);
		set({ storyView });
	},
	setTheme(theme) { set({ theme }); },
	setAccent(accent) { set({ accent }); },
	toggleFocus() { set(state => ({ focusMode: !state.focusMode })); },
	setInlineLanguageCheckEnabled(inlineLanguageCheckEnabled) {
		set({ inlineLanguageCheckEnabled });
	},
	setInlinePlotExpansionEnabled(inlinePlotExpansionEnabled) {
		set({ inlinePlotExpansionEnabled });
	},
	toggleSidebar() {
		set(state => {
			const sidebarOpen = !state.sidebarOpen;
			return {
				sidebarOpen,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionPanel(session, { sidebarVisible: sidebarOpen })
				)
			};
		});
	},
	toggleAssistant() {
		set(state => {
			const assistantOpen = !state.assistantOpen;
			return {
				assistantOpen,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionPanel(session, { assistantVisible: assistantOpen })
				)
			};
		});
	},
	openAssistant() {
		set(state => ({
			assistantOpen: true,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { assistantVisible: true })
			)
		}));
	},
	requestAssistantAction(request) {
		set(state => ({
			assistantOpen: true,
			assistantIntent: {
				...request,
				id: crypto.randomUUID()
			},
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { assistantVisible: true })
			)
		}));
	},
	toggleDock() {
		set(state => {
			const dockOpen = !state.dockOpen;
			return {
				dockOpen,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionPanel(session, { dockVisible: dockOpen })
				)
			};
		});
	},
	setDockTab(dockTab) {
		set({ dockTab });
	},
	openQuickCaptureInbox() {
		set(state => ({
			dockOpen: true,
			dockTab: 'inbox',
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { dockVisible: true })
			)
		}));
	},
	openQuickCapture(seed = {}) {
		const state = get();
		const snapshot = state.snapshot;
		const session = state.session;
		const activeResource = state.activeResource;
		if (!snapshot || snapshot.readOnly) {
			set({
				error: snapshot?.readOnly
					? '当前作品以只读模式打开，不能新增快速记录。'
					: '请先打开一个作品。'
			});
			return;
		}
		const chapterId = activeResource?.type === 'chapter'
			? toStoryChapterId(activeResource.id)
			: undefined;
		const sceneId = chapterId
			? state.structureScenes.find(scene => (
					scene.chapterId === chapterId
					&& scene.manuscriptRange.start <= state.cursorOffset
					&& state.cursorOffset < scene.manuscriptRange.end
				))?.id
			: undefined;
		const anchor = session
			? captureAnchorForEditor(
					session.content,
					state.cursorOffset,
					state.selection
						? {
								start: state.selection.start,
								end: state.selection.end
							}
						: undefined
				)
			: undefined;
		set({
			quickCaptureOpen: true,
			quickCaptureSeed: {
				type: seed.type ?? 'idea',
				text: seed.text ?? state.selection?.text ?? '',
				...(seed.chapterId ?? chapterId
					? { chapterId: seed.chapterId ?? chapterId }
					: {}),
				...(seed.sceneId ?? sceneId ? { sceneId: seed.sceneId ?? sceneId } : {}),
				...(seed.anchor ?? anchor ? { anchor: seed.anchor ?? anchor } : {})
			},
			error: undefined
		});
	},
	closeQuickCapture() {
		if (!get().quickCaptureBusy) {
			set({ quickCaptureOpen: false, quickCaptureSeed: undefined });
		}
	},
	async saveQuickCapture(type, text) {
		const state = get();
		const snapshot = state.snapshot;
		const seed = state.quickCaptureSeed;
		if (
			!snapshot
			|| snapshot.readOnly
			|| !quickCaptureStore
			|| !text.trim()
			|| state.quickCaptureBusy
		) {
			return false;
		}
		set({ quickCaptureBusy: true, error: undefined });
		try {
			const saved = await quickCaptureStore.add({
				state: {
					schemaVersion: 1,
					captures: state.quickCaptures
				},
				hash: state.quickCaptureHash
			}, {
				projectId: snapshot.project.projectId,
				type,
				text,
				...(seed?.chapterId ? { chapterId: seed.chapterId } : {}),
				...(seed?.sceneId ? { sceneId: seed.sceneId } : {}),
				...(seed?.anchor ? { anchor: seed.anchor } : {})
			});
			set({
				quickCaptures: saved.state.captures,
				quickCaptureHash: saved.hash,
				quickCaptureBusy: false,
				quickCaptureOpen: false,
				quickCaptureSeed: undefined
			});
			return true;
		} catch (error) {
			if (error instanceof Error && error.message.startsWith('externalChange')) {
				try {
					const reloaded = await quickCaptureStore.load();
					set({
						quickCaptures: reloaded.state.captures,
						quickCaptureHash: reloaded.hash,
						quickCaptureBusy: false,
						error: '待整理箱已被其他窗口更新，已重新载入；请再次保存这条记录。'
					});
				} catch {
					set({ quickCaptureBusy: false, error: '待整理箱已变化，暂时无法重新载入。' });
				}
			} else {
				set({
					quickCaptureBusy: false,
					error: error instanceof Error ? error.message : '快速记录保存失败。'
				});
			}
			return false;
		}
	},
	async setQuickCaptureStatus(id, status, convertedResourceId) {
		const state = get();
		if (!quickCaptureStore || state.quickCaptureBusy) return false;
		set({ quickCaptureBusy: true, error: undefined });
		try {
			const saved = await quickCaptureStore.setStatus({
				state: {
					schemaVersion: 1,
					captures: state.quickCaptures
				},
				hash: state.quickCaptureHash
			}, id, status, convertedResourceId);
			set({
				quickCaptures: saved.state.captures,
				quickCaptureHash: saved.hash,
				quickCaptureBusy: false
			});
			return true;
		} catch (error) {
			set({
				quickCaptureBusy: false,
				error: error instanceof Error ? error.message : '待整理箱更新失败。'
			});
			return false;
		}
	},
	async convertQuickCapture(id, target) {
		const state = get();
		const snapshot = state.snapshot;
		const capture = state.quickCaptures.find(candidate => candidate.id === id);
		if (
			!snapshot
			|| snapshot.readOnly
			|| !capture
			|| !quickCaptureStore
			|| state.quickCaptureBusy
		) {
			return false;
		}
		set({ quickCaptureBusy: true, error: undefined });
		try {
			await desktopBridge.createSnapshot(
				snapshot.root,
				'beforeDestructiveOperation',
				`快速记录转为正式资料：${capture.text.slice(0, 40)}`
			);
			const repository = new DesktopStoryRepository(snapshot.root, desktopBridge);
			const mentionService = new MentionService(snapshot.root, desktopBridge);
			const conversion = new QuickCaptureConversionService(
				repository,
				mentionService
			);
			const converted = await conversion.convert(
				capture,
				target,
				capture.chapterId
					? async chapterId => {
							const chapter = flattenChapters(snapshot.project).find(candidate => (
								toStoryChapterId(candidate.id) === chapterId
							));
							if (!chapter) throw new Error('quickCaptureChapterMissing');
							const current = get();
							if (
								current.activeResource?.id === chapter.id
								&& current.session
							) {
								return {
									content: current.session.content,
									textRevision: current.session.state.version
								};
							}
							const disk = await desktopBridge.readText(snapshot.root, chapter.file);
							return { content: disk.content, textRevision: 0 };
						}
					: undefined
			);
			const saved = await quickCaptureStore.setStatus({
				state: {
					schemaVersion: 1,
					captures: get().quickCaptures
				},
				hash: get().quickCaptureHash
			}, capture.id, 'converted', converted.resource.id);
			set({
				quickCaptures: saved.state.captures,
				quickCaptureHash: saved.hash,
				quickCaptureBusy: false
			});
			if (capture.chapterId) {
				window.dispatchEvent(new CustomEvent('writing-buddy:mentions-changed', {
					detail: { chapterId: capture.chapterId }
				}));
			}
			return true;
		} catch (error) {
			set({
				quickCaptureBusy: false,
				error: error instanceof Error ? error.message : '正式资料转换失败。'
			});
			return false;
		}
	},
	async jumpToQuickCaptureSource(capture) {
		const snapshot = get().snapshot;
		if (!snapshot || !capture.chapterId || !capture.anchor) {
			set({ error: '这条记录没有可跳转的正文位置。' });
			return false;
		}
		const chapter = flattenChapters(snapshot.project).find(candidate => (
			toStoryChapterId(candidate.id) === capture.chapterId
		));
		if (!chapter) {
			set({ error: '关联章节已不存在。' });
			return false;
		}
		try {
			const descriptor = toChapterResource(snapshot, chapter.id);
			if (!descriptor?.path) throw new Error('quickCaptureChapterMissing');
			const current = get();
			const content = current.activeResource?.id === descriptor.id && current.session
				? current.session.content
				: (await desktopBridge.readText(snapshot.root, descriptor.path)).content;
			const range = resolveAnchor(content, capture.anchor);
			if (!range) {
				set({ error: '原文位置已经变化，无法可靠定位。' });
				return false;
			}
			await get().openResource(descriptor);
			get().requestEditorReveal(descriptor.id, range.start);
			return true;
		} catch {
			set({ error: '暂时无法打开关联正文。' });
			return false;
		}
	},
	setSearch(search) { set({ search }); },
	setError(error) { set({ error }); },
	setSidebarWidth(sidebarWidth) {
		const width = clampWorkspaceSize('sidebar', sidebarWidth);
		set(state => ({
			sidebarWidth: width,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { projectSidebarWidth: width })
			)
		}));
	},
	setAssistantWidth(assistantWidth) {
		const width = clampWorkspaceSize('assistant', assistantWidth);
		set(state => ({
			assistantWidth: width,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { assistantWidth: width })
			)
		}));
	},
	setDockHeight(dockHeight) {
		const height = clampWorkspaceSize('dock', dockHeight);
		set(state => ({
			dockHeight: height,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { dockHeight: height })
			)
		}));
	},
	setTreeNodeExpanded(nodeId, expanded) {
		set(state => {
			const expandedTreeNodes = expanded
				? [...new Set([...state.expandedTreeNodes, nodeId])]
				: state.expandedTreeNodes.filter(candidate => candidate !== nodeId);
			return {
				expandedTreeNodes,
				writerSessions: updateCurrentWriterSession(
					state,
					session => touchWriterSession(session, { expandedTreeNodes })
				)
			};
		});
	},
	resetWorkspaceLayout() {
		set(state => {
			const workspace = workspaceForRailMode(state.activeMode);
			const layout = createDefaultWriterWorkspaceLayouts()[workspace];
			return {
				sidebarOpen: layout.sidebarVisible,
				sidebarWidth: layout.projectSidebarWidth,
				assistantOpen: layout.assistantVisible,
				assistantWidth: layout.assistantWidth,
				dockOpen: layout.dockVisible,
				dockHeight: layout.dockHeight,
				writerSessions: updateCurrentWriterSession(
					state,
					session => touchWriterSession(session, {
						panelState: layout,
						workspaceLayouts: updateWriterWorkspaceLayout(
							session.workspaceLayouts,
							workspace,
							layout
						)
					})
				)
			};
		});
	},
	flushWriterSession() {
		set(state => ({ writerSessions: { ...state.writerSessions } }));
	}
}), {
	name: 'writing-buddy-next-workspace',
	partialize: state => ({
		recentProjectRoot: state.recentProjectRoot,
		recentProjectRoots: state.recentProjectRoots,
		activeResourceId: state.activeResourceId,
		openResourceIds: state.openResourceIds,
		theme: state.theme,
		accent: state.accent,
		inlineLanguageCheckEnabled: state.inlineLanguageCheckEnabled,
		inlinePlotExpansionEnabled: state.inlinePlotExpansionEnabled,
		activeMode: state.activeMode,
		storyView: state.storyView,
		sidebarOpen: state.sidebarOpen,
		sidebarWidth: state.sidebarWidth,
		assistantWidth: state.assistantWidth,
		dockHeight: state.dockHeight,
		documentViews: state.documentViews,
		expandedTreeNodes: state.expandedTreeNodes,
		writerSessions: state.writerSessions
	}),
	version: 2,
	merge: (persisted, current) => {
		const workspace = persisted && typeof persisted === 'object'
			? persisted as Partial<PersistedWorkspace>
			: {};
		return {
			...current,
			...workspace,
			focusMode: false,
			expandedTreeNodes: Array.isArray(workspace.expandedTreeNodes)
				? workspace.expandedTreeNodes.filter(
						(nodeId): nodeId is string => typeof nodeId === 'string'
					)
				: [],
			writerSessions: parseWriterSessionMap(workspace.writerSessions)
		};
	}
}));

export function selectChapterWordCount(state: AppState): number {
	return state.session ? countWords(state.session.content) : 0;
}

export function selectNovelWordCount(state: AppState): number {
	if (!state.snapshot) {
		return 0;
	}
	const activeChapter = state.activeResource?.type === 'chapter' ? state.activeResource.id : undefined;
	return flattenChapters(state.snapshot.project).reduce((total, chapter) => {
		if (chapter.id === activeChapter && state.session) {
			return total + countWords(state.session.content);
		}
		return total + (state.snapshot?.wordCounts[chapter.id] ?? 0);
	}, 0);
}

declare global {
	interface Window {
		readonly __WRITING_BUDDY_DEVTOOLS__?: {
			readonly selectManuscriptPrefix: (length?: number) => boolean;
			readonly setManuscriptCursor: (offset?: number) => boolean;
			readonly enableBrowserAiFixture: () => Promise<boolean>;
		};
	}
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
	Object.defineProperty(window, '__WRITING_BUDDY_DEVTOOLS__', {
		configurable: true,
		value: {
			selectManuscriptPrefix(length = 56): boolean {
				const state = useAppStore.getState();
				const text = state.session?.content.slice(0, length);
				if (!text) return false;
				state.setSelection({ start: 0, end: text.length, text });
				state.openAssistant();
				return true;
			},
			setManuscriptCursor(offset = 56): boolean {
				const state = useAppStore.getState();
				if (!state.session?.content) return false;
				state.setSelection(undefined);
				state.setCursorOffset(Math.min(
					Math.max(0, offset),
					state.session.content.length
				));
				state.openAssistant();
				return true;
			},
			async enableBrowserAiFixture(): Promise<boolean> {
				if ('__TAURI_INTERNALS__' in window) return false;
				await desktopBridge.saveDeepSeekKey('browser-fixture');
				return true;
			}
		}
	});
}
