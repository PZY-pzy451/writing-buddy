import {
	countWords,
	findChapter,
	flattenChapters,
	type ChapterStatus,
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
import { create, type StoreApi } from 'zustand';
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
import {
	buildStoryTabKey,
	parseStoryTabKey
} from '../features/story/application/StoryResourceRegistry';
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
	updateWriterWorkspaceLayout,
	type ManuscriptDensity,
	type WriterToolId
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
import {
	classifySaveFailure,
	closeProtectionFor,
	type SaveState
} from '../features/save/SaveStateModel';
import type { CreationStartRoute } from '../features/creation-journey/CreationJourneyModel';
import type {
	PendingDraftCandidate
} from '../features/story/ai-context/InlineDraftCandidateModel';
import {
	buildChapterExportContent,
	buildWorkDocxDocument,
	buildWorkExportContent,
	confirmWholeWorkExportReceipt,
	createWorkSourceFingerprint,
	parseChapterExportReceipts,
	revokeWholeWorkExportReceipt,
	suggestedChapterExportName,
	suggestedWorkExportName,
	type ChapterExportFormat,
	type ChapterExportReceipt,
	type WorkExportFormat
} from '../features/export/ChapterExportModel';
import {
	parseWritingProgressMap,
	recordDailyWritingDelta,
	selectTodayWritingProgress as resolveTodayWritingProgress,
	setProjectDailyWritingGoal,
	type TodayWritingProgress,
	type WritingProgressMap
} from '../features/progress/DailyWritingProgressModel';

export type ThemeId = 'paper' | 'midnight' | 'fog' | 'focus';
export type RailMode = 'works' | 'planning' | 'search' | 'references' | 'review' | 'versions' | 'ai' | 'settings';
export type StoryViewId =
	| 'creation-journey'
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

export type ContextualCreateIntent =
	| 'character'
	| 'worldbuilding'
	| 'asset'
	| 'plot'
	| 'timeline';

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
	readonly entityType: Extract<MoveCommand['entityType'], 'volume' | 'chapter'>;
} | {
	readonly kind: 'scene';
	readonly receipt: ProjectSceneMoveUndoReceipt;
} | {
	readonly kind: 'snapshot';
	readonly snapshotId: string;
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
	readonly writerNavigatorRecentIds: readonly string[];
	readonly chapterExportReceipts: readonly ChapterExportReceipt[];
	readonly writingProgress: WritingProgressMap;
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
	readonly writerTool: WriterToolId;
	readonly writerToolPinned: boolean;
	readonly sceneBarExpanded: boolean;
	readonly manuscriptDensity: ManuscriptDensity;
	readonly assistantIntent?: AssistantActionIntent;
	readonly contextualCreateIntent?: ContextualCreateIntent;
	readonly dockOpen: boolean;
	readonly dockTab: DockTab;
	readonly quickCaptures: readonly QuickCapture[];
	readonly quickCaptureHash: string;
	readonly quickCaptureOpen: boolean;
	readonly quickCaptureBusy: boolean;
	readonly quickCaptureSeed?: QuickCaptureSeed;
	readonly projectWizardOpen: boolean;
	readonly projectWizardStartRoute?: CreationStartRoute;
	readonly creationJourneyStartRoute?: CreationStartRoute;
	readonly chapterCreatorOpen: boolean;
	readonly chapterCreateBusy: boolean;
	readonly chapterStatusBusy: boolean;
	readonly recentlyClosedResources: readonly ResourceDescriptor[];
	readonly structureMoveBusy: boolean;
	readonly structureMoveAnnouncement?: string;
	readonly structureScenes: readonly StoryScene[];
	readonly structureUndo?: StructureUndoState;
	readonly lastSavedAt?: string;
	readonly saveState: SaveState;
	readonly closeProtectionOpen: boolean;
	readonly writerNavigatorOpen: boolean;
	readonly writerNavigatorNotice?: string;
	readonly chapterExportBusy: boolean;
	readonly sessionRestoreState: 'idle' | 'restoring' | 'ready' | 'fallback';
	readonly sessionRestoreNotice?: string;
	readonly pendingEdit?: {
		readonly id: string;
		readonly resourceId: string;
		readonly start: number;
		readonly end: number;
		readonly text: string;
		readonly origin?: 'ai' | 'review';
		readonly highlightDurationMs?: number;
	};
	readonly pendingDraftCandidate?: PendingDraftCandidate;
	readonly pendingReveal?: {
		readonly resourceId: string;
		readonly offset: number;
		readonly preserveSelection?: boolean;
	};
	readonly bootstrap: () => Promise<void>;
	readonly chooseProject: () => Promise<void>;
	readonly openProjectWizard: (startRoute?: CreationStartRoute) => void;
	readonly closeProjectWizard: () => void;
	readonly openChapterCreator: () => void;
	readonly closeChapterCreator: () => void;
	readonly createChapter: (title: string, volumeId?: string) => Promise<boolean>;
	readonly updateChapterStatus: (chapterId: string, status: ChapterStatus) => Promise<boolean>;
	readonly moveProjectStructure: (command: MoveCommand) => Promise<boolean>;
	readonly undoProjectStructureMove: () => Promise<void>;
	readonly dismissProjectStructureUndo: () => void;
	readonly syncStructureScenesForChapter: (
		chapterId: string,
		scenes: readonly StoryScene[]
	) => void;
	readonly openProject: (
		root: string,
		mode?: ProjectOpenMode,
		confirmedDiscardDirty?: boolean
	) => Promise<void>;
	readonly retryProjectOpen: () => Promise<void>;
	readonly openProjectReadOnly: () => Promise<void>;
	readonly repairProject: () => Promise<void>;
	readonly revealProjectDirectory: () => Promise<void>;
	readonly dismissProjectOpenError: () => void;
	readonly openDashboard: () => void;
	readonly openCreationJourney: (startRoute?: CreationStartRoute) => void;
	readonly materializeCreationJourney: (
		journeyContent: string,
		expectedJourneyHash: string
	) => Promise<boolean>;
	readonly materializeOutlineHierarchy: (
		journeyContent: string,
		expectedJourneyHash: string
	) => Promise<boolean>;
	readonly openResource: (resource: ResourceDescriptor) => Promise<void>;
	readonly openStoryResource: (reference: StoryResourceReference) => Promise<void>;
	readonly restoreStoryResource: () => Promise<void>;
	readonly closeResource: (resourceId: string) => void;
	readonly restoreLastClosedResource: () => Promise<boolean>;
	readonly activateNextResource: () => Promise<boolean>;
	readonly setContent: (content: string, change?: 'edit' | 'undo' | 'redo') => void;
	readonly setDailyWritingGoal: (goal: number) => boolean;
	readonly updateCursor: (cursor: CursorState) => void;
	readonly requestEditorEdit: (edit: NonNullable<AppState['pendingEdit']>) => void;
	readonly clearEditorEdit: (id: string) => void;
	readonly setPendingDraftCandidate: (candidate?: PendingDraftCandidate) => void;
	readonly clearPendingDraftCandidate: (id: string) => void;
	readonly requestEditorReveal: (
		resourceId: string,
		offset: number,
		preserveSelection?: boolean
	) => void;
	readonly clearEditorReveal: (resourceId: string, offset: number) => void;
	readonly setResourceContent: (content: string) => void;
	readonly save: () => Promise<void>;
	readonly saveAs: () => Promise<boolean>;
	readonly exportActiveChapter: (format?: ChapterExportFormat) => Promise<boolean>;
	readonly exportWholeWork: (format?: WorkExportFormat) => Promise<boolean>;
	readonly confirmWholeWorkDelivery: (receiptId: string) => boolean;
	readonly revokeWholeWorkDelivery: (receiptId: string) => boolean;
	readonly forceSave: () => Promise<boolean>;
	readonly reloadExternal: () => void;
	readonly dismissExternalConflict: () => void;
	readonly verifyExternalChange: () => Promise<void>;
	readonly requestCloseProtection: () => boolean;
	readonly dismissCloseProtection: () => void;
	readonly openWriterNavigator: () => void;
	readonly closeWriterNavigator: () => void;
	readonly rememberWriterNavigatorResult: (resultId: string) => void;
	readonly setWriterNavigatorNotice: (notice?: string) => void;
	readonly reloadProject: () => Promise<void>;
	readonly setSelection: (selection?: { start: number; end: number; text: string }) => void;
	readonly setCursorOffset: (cursorOffset: number) => void;
	readonly setIssues: (issues: readonly ReviewIssue[]) => void;
	readonly setMode: (mode: RailMode) => void;
	readonly setStoryView: (view: StoryViewId) => void;
	readonly requestContextualCreate: (intent: ContextualCreateIntent) => void;
	readonly consumeContextualCreate: (intent: ContextualCreateIntent) => void;
	readonly setTheme: (theme: ThemeId) => void;
	readonly setAccent: (accent: 'gold' | 'blue' | 'purple') => void;
	readonly toggleFocus: () => void;
	readonly setInlineLanguageCheckEnabled: (enabled: boolean) => void;
	readonly setInlinePlotExpansionEnabled: (enabled: boolean) => void;
	readonly toggleSidebar: () => void;
	readonly toggleAssistant: () => void;
	readonly openAssistant: () => void;
	readonly openWriterTool: (tool: WriterToolId) => void;
	readonly closeWriterTool: () => void;
	readonly toggleWriterToolPinned: () => void;
	readonly setSceneBarExpanded: (expanded: boolean) => void;
	readonly setManuscriptDensity: (density: ManuscriptDensity) => void;
	readonly setActiveSceneId: (sceneId?: string) => void;
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
let activeManuscriptSave: Promise<void> | undefined;
let activeForceSave: Promise<boolean> | undefined;
let activeSaveAs: Promise<boolean> | undefined;
let activeExternalVerification: {
	readonly key: string;
	readonly operation: Promise<void>;
} | undefined;
let queuedExternalVerificationKey: string | undefined;
let activeProjectChooser: Promise<void> | undefined;
let activeProjectOpen: Promise<void> | undefined;
let activeProjectOpenKey: string | undefined;
let activeProjectDiscardConfirmed = false;
let projectOpenIntentVersion = 0;
let queuedProjectOpen: {
	readonly key: string;
	readonly root: string;
	readonly mode: ProjectOpenMode;
	readonly confirmedDiscardDirty: boolean;
} | undefined;
let activeResourceOpen: Promise<void> | undefined;
let queuedResourceOpen: ResourceDescriptor | undefined;
let activeStoryRestore: Promise<void> | undefined;
let resourceOpenIntentVersion = 0;
const closingResourceIds = new Set<string>();

function releaseResourceCloseAfterCurrentBurst(resourceId: string): void {
	queueMicrotask(() => closingResourceIds.delete(resourceId));
}

function hasSupersedingProjectOpen(projectOpenKey: string): boolean {
	return queuedProjectOpen !== undefined
		&& queuedProjectOpen.key !== projectOpenKey;
}

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

type AppStoreGet = StoreApi<AppState>['getState'];
type AppStoreSet = StoreApi<AppState>['setState'];

function isSameResourceOpen(
	left: ResourceDescriptor,
	right: ResourceDescriptor
): boolean {
	return left.id === right.id
		&& left.type === right.type
		&& left.path === right.path
		&& left.projectId === right.projectId;
}

function hasSupersedingResourceOpen(resource: ResourceDescriptor): boolean {
	if (!queuedResourceOpen) return false;
	if (isSameResourceOpen(queuedResourceOpen, resource)) {
		queuedResourceOpen = undefined;
		return false;
	}
	return true;
}

function isResourceOpenProjectCurrent(
	snapshot: ProjectSnapshot,
	get: AppStoreGet
): boolean {
	const current = get().snapshot;
	return current?.root === snapshot.root
		&& current.project.projectId === snapshot.project.projectId;
}

async function saveBeforeResourceOpen(
	get: AppStoreGet,
	set: AppStoreSet
): Promise<boolean> {
	if (!get().session?.state.dirty) return true;
	await get().save();
	const saved = get();
	if (!saved.session?.state.dirty && saved.saveState.type === 'clean') return true;
	set({ error: '当前正文尚未安全保存，未切换资源。' });
	return false;
}

async function performResourceOpen(
	resource: ResourceDescriptor,
	get: AppStoreGet,
	set: AppStoreSet
): Promise<void> {
	const current = get();
	const reloadCurrentStory = Boolean(
		current.activeResource
		&& isSameResourceOpen(current.activeResource, resource)
		&& isStoryTab(resource)
		&& current.storyOpenResult
		&& current.storyOpenResult.status !== 'ready'
	);
	if (
		current.activeResource
		&& isSameResourceOpen(current.activeResource, resource)
		&& !reloadCurrentStory
	) return;
	if (!await saveBeforeResourceOpen(get, set)) {
		hasSupersedingResourceOpen(resource);
		return;
	}
	if (hasSupersedingResourceOpen(resource)) return;
	const snapshot = get().snapshot;
	if (!snapshot) return;
	if (isStoryTab(resource)) {
		const reference = parseStoryTabKey(resource.id);
		if (!reference || !storyResourceOpenService) {
			set({ error: 'Story Kernel 尚未连接到当前项目。' });
			return;
		}
		try {
			const result = await storyResourceOpenService.loadStoryResource(reference);
			if (
				hasSupersedingResourceOpen(resource)
				|| !isResourceOpenProjectCurrent(snapshot, get)
				|| !await saveBeforeResourceOpen(get, set)
			) return;
			tabs.open(result.tab);
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
				saveState: { type: 'clean', savedAt: new Date().toISOString() },
				error: undefined,
				recentlyClosedResources: state.recentlyClosedResources.filter(
					candidate => candidate.id !== result.tab.id
				),
				writerSessions: updateCurrentWriterSession(
					state,
					writerSession => updateSessionResource(
						writerSession,
						result.tab,
						openResourceIds
					)
				)
			}));
		} catch {
			if (!hasSupersedingResourceOpen(resource)) {
				set({ error: '无法打开 Story 资料，请重试。' });
			}
		}
		return;
	}
	if (!resource.path) return;
	const resourcePath = resource.path;
	try {
		if (resource.type === 'chapter' || resource.type === 'note') {
			const file = await desktopBridge.readText(snapshot.root, resourcePath);
			if (
				hasSupersedingResourceOpen(resource)
				|| !isResourceOpenProjectCurrent(snapshot, get)
				|| !await saveBeforeResourceOpen(get, set)
			) return;
			const viewKey = `${snapshot.project.projectId}:${resource.id}`;
			const documentView = get().documentViews[viewKey];
			tabs.open(resource);
			const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
			set(state => ({
				activeResource: resource,
				activeResourceId: resource.id,
				storyOpenResult: undefined,
				tabs: tabs.state.resources,
				openResourceIds,
				externalConflict: undefined,
				session: new DocumentSession(resource.id, resourcePath, file, documentView),
				resourceContent: undefined,
				resourceHash: undefined,
				saveState: { type: 'clean', savedAt: new Date().toISOString() },
				error: undefined,
				recentlyClosedResources: state.recentlyClosedResources.filter(
					candidate => candidate.id !== resource.id
				),
				writerSessions: updateCurrentWriterSession(
					state,
					writerSession => {
						const updated = updateSessionResource(
							writerSession,
							resource,
							openResourceIds
						);
						return resource.type === 'chapter'
							? touchWriterSession(updated, {
								cursor: {
									chapterId: resource.id,
									line: documentView?.lineNumber ?? 1,
									column: documentView?.column ?? 1
								},
								scroll: {
									chapterId: resource.id,
									scrollTop: documentView?.scrollTop ?? 0
								}
							})
							: updated;
					}
				)
			}));
			return;
		}
		const content = await desktopBridge.readResource(snapshot.root, resourcePath);
		if (hasSupersedingResourceOpen(resource)) return;
		const file = await desktopBridge.readText(snapshot.root, resourcePath);
		if (
			hasSupersedingResourceOpen(resource)
			|| !isResourceOpenProjectCurrent(snapshot, get)
			|| !await saveBeforeResourceOpen(get, set)
		) return;
		tabs.open(resource);
		const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
		set(state => ({
			activeResource: resource,
			activeResourceId: resource.id,
			storyOpenResult: undefined,
			tabs: tabs.state.resources,
			openResourceIds,
			externalConflict: undefined,
			session: undefined,
			resourceContent: content,
			resourceHash: file.hash,
			saveState: { type: 'clean', savedAt: new Date().toISOString() },
			error: undefined,
			recentlyClosedResources: state.recentlyClosedResources.filter(
				candidate => candidate.id !== resource.id
			),
			writerSessions: updateCurrentWriterSession(
				state,
				writerSession => updateSessionResource(
					writerSession,
					resource,
					openResourceIds
				)
			)
		}));
	} catch {
		if (!hasSupersedingResourceOpen(resource)) {
			set({ error: '无法打开该资源，请重试。' });
		}
	}
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
	writerNavigatorRecentIds: [],
	writingProgress: {},
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
	writerTool: 'outline',
	writerToolPinned: false,
	sceneBarExpanded: true,
	manuscriptDensity: 'comfortable',
	contextualCreateIntent: undefined,
	dockOpen: false,
	dockTab: 'issues',
	quickCaptures: [],
	quickCaptureHash: '',
	quickCaptureOpen: false,
	quickCaptureBusy: false,
	projectWizardOpen: false,
	projectWizardStartRoute: undefined,
	creationJourneyStartRoute: undefined,
	chapterCreatorOpen: false,
	chapterCreateBusy: false,
	chapterStatusBusy: false,
	recentlyClosedResources: [],
	structureMoveBusy: false,
	structureScenes: [],
	sessionRestoreState: 'idle',
	saveState: { type: 'clean', savedAt: new Date().toISOString() },
	closeProtectionOpen: false,
	writerNavigatorOpen: false,
	chapterExportBusy: false,
	chapterExportReceipts: [],

	async bootstrap() {
		const root = get().recentProjectRoot ?? (get().recentProjectRoots ?? [])[0];
		if (root) {
			await get().openProject(root);
		}
	},

	chooseProject() {
		if (activeProjectChooser) return activeProjectChooser;
		const operation = (async () => {
			try {
				const root = await desktopBridge.chooseProject();
				if (root) {
					await get().openProject(root);
				}
			} catch {
				set({ error: '无法打开项目选择器，请重试。' });
			}
		})();
		const tracked = operation.finally(() => {
			if (activeProjectChooser === tracked) activeProjectChooser = undefined;
		});
		activeProjectChooser = tracked;
		return tracked;
	},

	openProjectWizard(startRoute) {
		set({
			projectWizardOpen: true,
			projectWizardStartRoute: startRoute,
			error: undefined
		});
	},

	closeProjectWizard() {
		set({ projectWizardOpen: false, projectWizardStartRoute: undefined });
	},

	openChapterCreator() {
		const snapshot = get().snapshot;
		if (!snapshot) {
			set({ error: '请先打开作品，再新建章节。' });
			return;
		}
		if (snapshot.readOnly) {
			set({ error: '当前作品以只读模式打开，不能新建章节。' });
			return;
		}
		set({ chapterCreatorOpen: true, error: undefined });
	},

	closeChapterCreator() {
		if (!get().chapterCreateBusy) {
			set({ chapterCreatorOpen: false });
		}
	},

	async createChapter(title, volumeId) {
		const snapshot = get().snapshot;
		if (!snapshot || snapshot.readOnly || get().chapterCreateBusy) return false;
		const normalizedTitle = title.trim();
		if (!normalizedTitle || normalizedTitle.length > 120 || /[\r\n]/.test(normalizedTitle)) {
			set({ error: '章节标题需要为 1–120 个字符，且不能换行。' });
			return false;
		}
		set({ chapterCreateBusy: true, error: undefined });
		try {
			if (get().session?.state.dirty) {
				await get().save();
				if (get().session?.state.dirty) {
					set({
						chapterCreateBusy: false,
						error: '当前正文尚未保存，未创建新章节。'
					});
					return false;
				}
			}
			const currentSnapshot = get().snapshot;
			if (
				!currentSnapshot
				|| currentSnapshot.root !== snapshot.root
				|| currentSnapshot.project.projectId !== snapshot.project.projectId
				|| currentSnapshot.projectRevision !== snapshot.projectRevision
			) {
				set({
					chapterCreateBusy: false,
					error: '作品已切换或结构已更新，未创建新章节。'
				});
				return false;
			}
			const result = await desktopBridge.createChapter({
				projectRoot: currentSnapshot.root,
				expectedProjectRevision: currentSnapshot.projectRevision,
				title: normalizedTitle,
				...(volumeId ? { volumeId } : {})
			});
			const activeSnapshot = get().snapshot;
			if (
				!activeSnapshot
				|| activeSnapshot.root !== currentSnapshot.root
				|| activeSnapshot.project.projectId !== currentSnapshot.project.projectId
				|| activeSnapshot.projectRevision !== currentSnapshot.projectRevision
			) {
				set({
					chapterCreateBusy: false,
					error: '作品已切换或结构已更新，新章节未在当前作品中打开。'
				});
				return false;
			}
			const nextSnapshot: ProjectSnapshot = {
				...currentSnapshot,
				project: result.project,
				projectRevision: result.projectRevision,
				wordCounts: {
					...snapshot.wordCounts,
					[result.chapter.id]: 0
				}
			};
			const resource: ResourceDescriptor = {
				id: result.chapter.id,
				type: 'chapter',
				title: result.chapter.title,
				path: result.chapter.file,
				projectId: result.project.projectId
			};
			set({
				snapshot: nextSnapshot,
				chapterCreatorOpen: false,
				chapterCreateBusy: false,
				structureMoveAnnouncement: result.description
			});
			await get().openResource(resource);
			return true;
		} catch (error) {
			const code = error instanceof Error
				? error.message.split(':')[0]
				: 'chapterCreateFailed';
			const copy: Readonly<Record<string, string>> = {
				projectReadOnly: '当前作品以只读模式打开，不能新建章节。',
				projectRevisionConflict: '作品结构已变化，请重新载入后再新建章节。',
				chapterTitleInvalid: '章节标题需要为 1–120 个字符，且不能换行。',
				chapterVolumeMissing: '目标卷已不存在，请重新选择。',
				chapterFileLimitReached: '章节文件数量已达到当前项目上限。',
				chapterFileWriteFailed: '无法写入新章节正文，项目结构未改变。',
				chapterManifestWriteFailed: '无法保存新章节结构，正文文件已回滚。',
				chapterCreateVerificationFailed: '新章节验证失败，已恢复创建前状态。',
				chapterCreateFailed: '暂时无法创建章节。'
			};
			set({
				chapterCreateBusy: false,
				error: copy[code] ?? copy.chapterCreateFailed
			});
			return false;
		}
	},

	async updateChapterStatus(chapterId, status) {
		const snapshot = get().snapshot;
		if (!snapshot || get().chapterStatusBusy) return false;
		if (snapshot.readOnly) {
			set({ error: '当前作品以只读模式打开，不能修改章节状态。' });
			return false;
		}
		const chapter = flattenChapters(snapshot.project).find(candidate => candidate.id === chapterId);
		if (!chapter) {
			set({ error: '目标章节已不存在，请重新载入作品。' });
			return false;
		}
		if ((chapter.status ?? 'draft') === status) return true;
		set({ chapterStatusBusy: true, error: undefined });
		if (get().session?.state.dirty) {
			await get().save();
			const saved = get();
			if (saved.session?.state.dirty || saved.saveState.type !== 'clean') {
				set({
					chapterStatusBusy: false,
					error: '当前正文尚未安全保存，未修改章节状态。'
				});
				return false;
			}
		}
		try {
			const result = await desktopBridge.updateChapterStatus({
				projectRoot: snapshot.root,
				expectedProjectRevision: snapshot.projectRevision,
				chapterId,
				status
			});
			set({
				snapshot: {
					...snapshot,
					project: result.project,
					projectRevision: result.projectRevision
				},
				chapterStatusBusy: false,
				structureMoveAnnouncement: result.description
			});
			return true;
		} catch (error) {
			const code = error instanceof Error
				? error.message.split(':')[0]
				: 'chapterStatusUpdateFailed';
			const copy: Readonly<Record<string, string>> = {
				projectReadOnly: '当前作品以只读模式打开，不能修改章节状态。',
				projectRevisionConflict: '作品结构已变化，请重新载入后再修改章节状态。',
				chapterStatusInvalid: '章节状态无效，未写入作品。',
				chapterStatusChapterMissing: '目标章节已不存在，请重新载入作品。',
				chapterStatusWriteFailed: '无法保存章节状态，作品保持不变。',
				chapterStatusVerificationFailed: '章节状态验证失败，已恢复修改前状态。',
				chapterStatusUpdateFailed: '暂时无法修改章节状态。'
			};
			set({
				chapterStatusBusy: false,
				error: copy[code] ?? copy.chapterStatusUpdateFailed
			});
			return false;
		}
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
						entityType: command.entityType,
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
		if (undo.kind === 'snapshot') {
			try {
				await desktopBridge.restoreVersion(snapshot.root, undo.snapshotId);
				set({
					structureMoveBusy: false,
					structureMoveAnnouncement: `已撤销：${undo.description}`,
					structureUndo: undefined
				});
				await get().reloadProject();
			} catch {
				set({
					structureMoveBusy: false,
					structureUndo: undefined,
					error: '无法恢复拆分前快照，请前往“版本”页面重试。'
				});
			}
			return;
		}
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

	openProject(root, mode = 'read-write', confirmedDiscardDirty = false) {
		projectOpenIntentVersion += 1;
		const request = {
			key: `${root.toLocaleLowerCase()}\u0000${mode}`,
			root,
			mode,
			confirmedDiscardDirty
		};
		if (activeProjectOpen) {
			queuedProjectOpen = request.key === activeProjectOpenKey
				? undefined
				: {
						...request,
						confirmedDiscardDirty: request.confirmedDiscardDirty
							|| activeProjectDiscardConfirmed
					};
			return activeProjectOpen;
		}
		activeProjectDiscardConfirmed = confirmedDiscardDirty;
		const operation = (async () => {
			let nextRequest: typeof queuedProjectOpen = request;
			while (nextRequest) {
				activeProjectOpenKey = nextRequest.key;
				const { root, mode, confirmedDiscardDirty } = nextRequest;
				await (async () => {
			const currentBeforeOpen = get();
			if (currentBeforeOpen.session?.state.dirty && !confirmedDiscardDirty) {
				const confirmed = window.confirm(
					`“${currentBeforeOpen.snapshot?.project.title ?? '当前项目'}”有尚未保存的正文。切换作品会放弃这些修改，是否继续？`
				);
				if (!confirmed) {
					set({ error: '已取消切换；当前项目和未保存正文保持不变。' });
					return;
				}
				activeProjectDiscardConfirmed = true;
			}
		set({
			loading: true,
			error: undefined,
			projectOpenError: undefined,
			pendingProjectRoot: root,
			sessionRestoreState: 'restoring',
			sessionRestoreNotice: undefined,
			recentlyClosedResources: [],
			chapterCreatorOpen: false,
			chapterCreateBusy: false,
			chapterStatusBusy: false
		});
		const result = mode === 'read-only'
			? await projectOpenService.openProjectReadOnly(root)
			: await projectOpenService.openProjectReadWrite(root);
		if (!result.ok) {
			if (hasSupersedingProjectOpen(nextRequest.key)) return;
			set({
				loading: false,
				projectOpenError: result.error,
				projectOpenBusyAction: undefined,
				sessionRestoreState: 'idle'
			});
			return;
		}
		if (hasSupersedingProjectOpen(nextRequest.key)) return;

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
			const nextQuickCaptureStore = new QuickCaptureStore(snapshot.root, desktopBridge);
			try {
				quickCaptureCollection = await nextQuickCaptureStore.load();
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
			if (hasSupersedingProjectOpen(nextRequest.key)) return;
			tabs.restore({ resources: restoredTabs });
			const nextStoryResourceOpenService = new StoryResourceOpenService(
				new DesktopStoryRepository(snapshot.root, desktopBridge),
				tabs,
				snapshot.project.projectId
			);
			const restoredStoryResults = await nextStoryResourceOpenService.restoreStoryResources(
				persistedResourceIds,
				reconciled.session.activeResourceId
			);
			if (hasSupersedingProjectOpen(nextRequest.key)) return;
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
			quickCaptureStore = nextQuickCaptureStore;
			storyResourceOpenService = nextStoryResourceOpenService;
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
				writerTool: writingLayout.assistantTool ?? 'outline',
				writerToolPinned: writingLayout.assistantPinned ?? false,
				sceneBarExpanded: writingLayout.sceneBarExpanded ?? true,
				manuscriptDensity: writingLayout.manuscriptDensity ?? 'comfortable',
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
				saveState: { type: 'clean', savedAt: new Date().toISOString() },
				closeProtectionOpen: false,
				writerNavigatorOpen: false,
				writerNavigatorNotice: undefined,
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
			if (hasSupersedingProjectOpen(nextRequest.key)) return;
			set({
				loading: false,
				projectOpenError: toPublicProjectOpenError(error, root),
				projectOpenBusyAction: undefined,
				sessionRestoreState: 'idle'
			});
		}
				})();
				nextRequest = queuedProjectOpen;
				queuedProjectOpen = undefined;
			}
		})();
		const tracked = operation.finally(() => {
			if (activeProjectOpen === tracked) {
				activeProjectOpen = undefined;
				activeProjectOpenKey = undefined;
				activeProjectDiscardConfirmed = false;
			}
		});
		activeProjectOpen = tracked;
		return tracked;
	},

	async retryProjectOpen() {
		if (get().projectOpenBusyAction) return;
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'retry' });
		await get().openProject(root, 'read-write');
	},

	async openProjectReadOnly() {
		if (get().projectOpenBusyAction) return;
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		set({ projectOpenBusyAction: 'read-only' });
		await get().openProject(root, 'read-only');
	},

	async repairProject() {
		if (get().projectOpenBusyAction) return;
		const root = get().pendingProjectRoot ?? get().recentProjectRoot;
		if (!root) {
			return;
		}
		const repairIntentVersion = ++projectOpenIntentVersion;
		const clearSupersededRepair = () => {
			set(state => state.projectOpenBusyAction === 'repair'
				? { projectOpenBusyAction: undefined }
				: {});
		};
		set({ projectOpenBusyAction: 'repair', error: undefined });
		try {
			await projectOpenService.repairProject(root);
		} catch (error) {
			if (repairIntentVersion !== projectOpenIntentVersion) {
				clearSupersededRepair();
				return;
			}
			set({
				projectOpenError: toPublicProjectOpenError(error, root),
				projectOpenBusyAction: undefined
			});
			return;
		}
		if (repairIntentVersion !== projectOpenIntentVersion) {
			clearSupersededRepair();
			return;
		}
		await get().openProject(root, 'read-write');
	},

	async revealProjectDirectory() {
		if (get().projectOpenBusyAction) return;
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
			saveState: { type: 'clean', savedAt: new Date().toISOString() },
			error: undefined
		});
	},

	openCreationJourney(startRoute) {
		get().setMode('planning');
		get().setStoryView('creation-journey');
		set({
			creationJourneyStartRoute: startRoute,
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

	async materializeCreationJourney(journeyContent, expectedJourneyHash) {
		const snapshot = get().snapshot;
		if (!snapshot || snapshot.readOnly) {
			set({ error: '当前作品以只读模式打开，不能创建章节。' });
			return false;
		}
		try {
			const result = await desktopBridge.materializeCreationJourney({
				projectRoot: snapshot.root,
				expectedProjectRevision: snapshot.projectRevision,
				journeyContent,
				expectedJourneyHash
			});
			const nextSnapshot: ProjectSnapshot = {
				...snapshot,
				project: result.project,
				projectRevision: result.projectRevision,
				wordCounts: {
					...snapshot.wordCounts,
					...Object.fromEntries(result.chapters.map(chapter => [chapter.id, 0]))
				}
			};
			const first = result.chapters[0];
			if (!first) {
				throw new Error('creationJourneyMaterializationInvalid');
			}
			set({
				snapshot: nextSnapshot,
				structureMoveAnnouncement: result.description,
				error: undefined
			});
			get().setMode('works');
			await get().openResource({
				id: first.id,
				type: 'chapter',
				title: first.title,
				path: first.file,
				projectId: result.project.projectId
			});
			return true;
		} catch (error) {
			const code = error instanceof Error
				? error.message.split(':')[0]
				: 'creationJourneyMaterializationFailed';
			const copy: Readonly<Record<string, string>> = {
				projectRevisionConflict: '作品结构已变化，请重新载入后再创建章节。',
				externalChange: '创作旅程已在其他窗口修改，请重新载入后再确认。',
				creationJourneyProjectMismatch: '创作旅程不属于当前作品，未写入章节。',
				creationJourneyMaterializationInvalid: '章节方案尚未满足确认条件。',
				creationJourneyStateInvalid: '创作旅程结构无效，未写入章节。',
				chapterFileWriteFailed: '章节文件写入失败，项目已恢复到创建前。',
				chapterManifestWriteFailed: '章节结构保存失败，项目已恢复到创建前。',
				creationJourneyWriteFailed: '旅程状态保存失败，项目已恢复到创建前。',
				creationJourneyMaterializationVerificationFailed: '创建后验证失败，项目已恢复到创建前。',
				creationJourneyMaterializationFailed: '暂时无法创建章节，项目未改变。'
			};
			set({ error: copy[code] ?? copy.creationJourneyMaterializationFailed });
			return false;
		}
	},

	async materializeOutlineHierarchy(journeyContent, expectedJourneyHash) {
		const snapshot = get().snapshot;
		if (!snapshot || snapshot.readOnly) {
			set({ error: '当前作品以只读模式打开，不能创建卷、章节和场景。' });
			return false;
		}
		try {
			const snapshotId = await desktopBridge.createSnapshot(
				snapshot.root,
				'beforeDestructiveOperation',
				'大纲拆分为可写场景前'
			);
			const result = await desktopBridge.materializeOutlineHierarchy({
				projectRoot: snapshot.root,
				expectedProjectRevision: snapshot.projectRevision,
				journeyContent,
				expectedJourneyHash
			});
			const nextSnapshot: ProjectSnapshot = {
				...snapshot,
				project: result.project,
				projectRevision: result.projectRevision,
				wordCounts: {
					...snapshot.wordCounts,
					...Object.fromEntries(result.chapters.map(chapter => [chapter.id, 0]))
				}
			};
			const first = result.chapters[0];
			if (!first) throw new Error('outlineHierarchyMaterializationInvalid');
			set({
				snapshot: nextSnapshot,
				structureMoveAnnouncement: result.description,
				structureUndo: {
					kind: 'snapshot',
					snapshotId,
					description: result.description,
					expiresAt: Date.now() + 12_000
				},
				error: undefined
			});
			get().setMode('works');
			await get().openResource({
				id: first.id,
				type: 'chapter',
				title: first.title,
				path: first.file,
				projectId: result.project.projectId
			});
			return true;
		} catch (error) {
			const code = error instanceof Error
				? error.message.split(':')[0]
				: 'outlineHierarchyMaterializationFailed';
			const copy: Readonly<Record<string, string>> = {
				projectRevisionConflict: '作品结构已变化，请重新载入后再创建。',
				externalChange: '大纲已在其他窗口修改，请重新载入后再确认。',
				outlineHierarchyMaterializationInvalid: '卷、章或场景结构尚未满足创建条件。',
				outlineHierarchyLocked: '仍有锁定的卷、章或场景，请解锁后再创建。',
				outlineHierarchyWriteFailed: '写入失败，项目已恢复到创建前。',
				outlineHierarchyVerificationFailed: '创建后验证失败，项目已恢复到创建前。',
				outlineHierarchyMaterializationFailed: '暂时无法创建卷、章节和场景。'
			};
			set({ error: copy[code] ?? copy.outlineHierarchyMaterializationFailed });
			return false;
		}
	},

	openResource(resource) {
		resourceOpenIntentVersion += 1;
		queuedResourceOpen = resource;
		if (activeResourceOpen) return activeResourceOpen;
		const operation = (async () => {
			while (queuedResourceOpen) {
				const next = queuedResourceOpen;
				queuedResourceOpen = undefined;
				await performResourceOpen(next, get, set);
			}
		})();
		const tracked = operation.finally(() => {
			if (activeResourceOpen === tracked) activeResourceOpen = undefined;
		});
		activeResourceOpen = tracked;
		return tracked;
	},

	async openStoryResource(reference) {
		const snapshot = get().snapshot;
		if (!snapshot || !storyResourceOpenService) {
			set({ error: 'Story Kernel 尚未连接到当前项目。' });
			return;
		}
		await get().openResource({
			id: buildStoryTabKey(reference.type, reference.id),
			type: 'story',
			title: reference.id,
			projectId: snapshot.project.projectId
		});
	},

	async restoreStoryResource() {
		if (activeStoryRestore) return activeStoryRestore;
		const current = get();
		const missing = current.storyOpenResult;
		const snapshot = current.snapshot;
		const restoreService = storyResourceOpenService;
		if (
			!restoreService
			|| !snapshot
			|| missing?.status !== 'missing'
			|| current.activeResource?.id !== missing.tab.id
		) {
			return;
		}
		const intentVersion = resourceOpenIntentVersion;
		const operation = (async () => {
			try {
				const result = await restoreService.restoreFromTrash(missing.reference);
				if (
					resourceOpenIntentVersion !== intentVersion
					|| !isResourceOpenProjectCurrent(snapshot, get)
					|| get().activeResource?.id !== missing.tab.id
					|| get().storyOpenResult?.status !== 'missing'
				) return;
				tabs.open(result.tab);
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
			} catch {
				if (
					resourceOpenIntentVersion === intentVersion
					&& isResourceOpenProjectCurrent(snapshot, get)
					&& get().activeResource?.id === missing.tab.id
				) {
					set({ error: '资料不在可恢复区，请重新检查或稍后重试。' });
				}
			}
		})();
		activeStoryRestore = operation;
		try {
			await operation;
		} finally {
			if (activeStoryRestore === operation) activeStoryRestore = undefined;
		}
	},

	closeResource(resourceId) {
		if (closingResourceIds.has(resourceId)) return;
		const current = get();
		const closing = current.tabs.find(resource => resource.id === resourceId);
		if (!closing) return;
		const closingActiveResource = current.activeResource?.id === resourceId;
		closingResourceIds.add(resourceId);
		if (closingActiveResource && current.session?.state.dirty) {
			if (!window.confirm('当前内容尚未保存。确定要关闭这个标签并放弃未保存修改吗？')) {
				releaseResourceCloseAfterCurrentBurst(resourceId);
				return;
			}
		}
		tabs.close(resourceId);
		const openResourceIds = tabs.state.resources.map(candidate => candidate.id);
		const next = tabs.state.resources.find(resource => resource.id === tabs.state.activeId);
		set(state => ({
			tabs: tabs.state.resources,
			openResourceIds,
			...(closingActiveResource ? {
				activeResource: undefined,
				activeResourceId: undefined,
				storyOpenResult: undefined,
				session: undefined,
				resourceContent: undefined,
				resourceHash: undefined,
				externalConflict: undefined,
				saveState: { type: 'clean' as const, savedAt: new Date().toISOString() },
				error: undefined
			} : {}),
			recentlyClosedResources: closing
				? [
					closing,
					...state.recentlyClosedResources.filter(
						candidate => candidate.id !== closing.id
					)
				].slice(0, 12)
				: state.recentlyClosedResources,
			writerSessions: updateCurrentWriterSession(state, writerSession => {
				const updated = touchWriterSession(writerSession, {
					openTabs: openResourceIds.map(id => ({ resourceId: id }))
				});
				if (!closingActiveResource) return updated;
				const withoutActiveResource = { ...updated };
				delete withoutActiveResource.activeResourceId;
				return withoutActiveResource;
			})
		}));
		if (!closingActiveResource) {
			releaseResourceCloseAfterCurrentBurst(resourceId);
			return;
		}
		if (next) {
			void get().openResource(next).finally(() => closingResourceIds.delete(resourceId));
		} else {
			releaseResourceCloseAfterCurrentBurst(resourceId);
		}
	},

	setContent(content, change = 'edit') {
		const session = get().session;
		if (!session) {
			return;
		}
		const beforeWords = countWords(session.content);
		const manuscriptProjectId = get().activeResource?.type === 'chapter'
			? get().snapshot?.project.projectId
			: undefined;
		session.updateContent(content);
		const wordDelta = countWords(session.content) - beforeWords;
		const issues = change === 'undo'
			? get().issues.map(issue => (
				issue.status === 'accepted' && content.includes(issue.anchor.target)
					? { ...issue, status: 'open' as const, updatedAt: new Date().toISOString() }
					: issue
			))
			: get().issues;
		set(state => ({
			session: session.copy(),
			saveState: session.state.dirty
				? { type: 'dirty' }
				: { type: 'clean', savedAt: state.lastSavedAt ?? new Date().toISOString() },
			issues,
			writingProgress: manuscriptProjectId
				? recordDailyWritingDelta(
					state.writingProgress,
					manuscriptProjectId,
					wordDelta
				)
				: state.writingProgress,
			writerSessions: updateCurrentWriterSession(
				state,
				writerSession => touchWriterSession(writerSession, {})
			)
		}));
		if (change === 'undo') {
			get().setIssues(issues);
		}
	},

	setDailyWritingGoal(goal) {
		const projectId = get().snapshot?.project.projectId;
		if (!projectId) return false;
		try {
			set(state => ({
				writingProgress: setProjectDailyWritingGoal(
					state.writingProgress,
					projectId,
					goal
				)
			}));
			return true;
		} catch {
			return false;
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
	setPendingDraftCandidate(pendingDraftCandidate) { set({ pendingDraftCandidate }); },
	clearPendingDraftCandidate(id) {
		if (get().pendingDraftCandidate?.id === id) {
			set({ pendingDraftCandidate: undefined });
		}
	},
	requestEditorReveal(resourceId, offset, preserveSelection = false) {
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
				pendingReveal: { resourceId, offset, preserveSelection },
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
		if (activeForceSave) {
			await activeForceSave;
			const current = get();
			if (current.saveState.type === 'dirty' && current.session?.state.dirty) {
				await current.save();
			}
			return;
		}
		if (activeManuscriptSave) {
			await activeManuscriptSave;
			const current = get();
			if (current.saveState.type === 'dirty' && current.session?.state.dirty) {
				await current.save();
			}
			return;
		}
		const task = (async () => {
			const { snapshot, activeResource, session, resourceContent, resourceHash } = get();
			if (!snapshot || !activeResource?.path) {
				return;
			}
			const stillTargetsCurrentResource = () => {
				const current = get();
				if (current.snapshot?.root !== snapshot.root
					|| current.snapshot.project.projectId !== snapshot.project.projectId
					|| current.activeResource?.id !== activeResource.id
					|| current.activeResource.path !== activeResource.path) {
					return false;
				}
				return session
					? current.session?.state.resourceId === session.state.resourceId
						&& current.session.state.path === session.state.path
					: !current.session;
			};
			set({
				saveState: { type: 'saving', startedAt: new Date().toISOString() },
				error: undefined
			});
			try {
				if (session) {
					const request = session.toWriteRequest(snapshot.root);
					const result = await desktopBridge.writeTextAtomic(request);
					if (!stillTargetsCurrentResource()) return;
					const currentSession = get().session;
					if (!currentSession) return;
					currentSession.markSaved(result, request.content);
					const dirty = currentSession.state.dirty;
					set(current => ({
						session: currentSession.copy(),
						snapshot: current.snapshot ? {
							...current.snapshot,
							wordCounts: {
								...current.snapshot.wordCounts,
								[currentSession.state.resourceId]: countWords(currentSession.content)
							}
						} : current.snapshot,
						lastSavedAt: result.modifiedAt,
						saveState: dirty
							? { type: 'dirty' }
							: { type: 'clean', savedAt: result.modifiedAt },
						error: undefined
					}));
				} else if (resourceContent !== undefined && resourceHash) {
					const result = await desktopBridge.writeResource(
						snapshot.root,
						activeResource.path,
						resourceContent,
						resourceHash
					);
					if (!stillTargetsCurrentResource()) return;
					set({
						resourceHash: result.hash,
						lastSavedAt: result.modifiedAt,
						saveState: { type: 'clean', savedAt: result.modifiedAt },
						error: undefined
					});
				}
			} catch (error) {
				if (!stillTargetsCurrentResource()) return;
				const failure = classifySaveFailure(error);
				if (session && failure.type === 'external_conflict') {
					try {
						const disk = await desktopBridge.readText(snapshot.root, session.state.path);
						if (!stillTargetsCurrentResource()) return;
						const detectedAt = new Date().toISOString();
						set({
							externalConflict: { disk, detectedAt },
							saveState: { type: 'external_conflict', detectedAt },
							error: undefined
						});
						return;
					} catch {
						// Keep the safe public save failure if the disk copy cannot be read.
					}
				}
				set({
					saveState: failure.type === 'offline'
						? { type: 'offline', pendingChanges: 1 }
						: failure.type === 'failed'
							? failure
							: { type: 'failed', errorCode: 'saveFailed', retryable: true },
					error: undefined
				});
			}
		})();
		activeManuscriptSave = task;
		try {
			await task;
		} finally {
			if (activeManuscriptSave === task) activeManuscriptSave = undefined;
		}
	},

	async restoreLastClosedResource() {
		const resource = get().recentlyClosedResources[0];
		if (!resource) {
			set({ writerNavigatorNotice: '没有可恢复的标签。' });
			return false;
		}
		await get().openResource(resource);
		return get().activeResource?.id === resource.id;
	},

	async activateNextResource() {
		const resources = get().tabs;
		if (resources.length < 2) return false;
		const activeIndex = resources.findIndex(
			resource => resource.id === get().activeResource?.id
		);
		const next = resources[(activeIndex + 1 + resources.length) % resources.length];
		if (!next) return false;
		await get().openResource(next);
		return get().activeResource?.id === next.id;
	},

	async saveAs() {
		if (activeSaveAs) return activeSaveAs;
		const task = (async () => {
			const { activeResource, session } = get();
			if (!activeResource || !session) {
				return false;
			}
			try {
				const path = await desktopBridge.saveTextAs(
					session.content,
					session.state.originalEol,
					session.state.hasBom,
					`${activeResource.title}.md`
				);
				if (path) {
					set({ error: undefined });
					return true;
				}
			} catch (error) {
				const failure = classifySaveFailure(error);
				set({
					saveState: failure.type === 'offline'
						? { type: 'offline', pendingChanges: 1 }
						: failure.type === 'failed'
							? failure
							: { type: 'failed', errorCode: 'saveCopyFailed', retryable: true }
				});
			}
			return false;
		})();
		activeSaveAs = task;
		try {
			return await task;
		} finally {
			if (activeSaveAs === task) activeSaveAs = undefined;
		}
	},

	async exportActiveChapter(format = 'markdown') {
		const initial = get();
		if (initial.chapterExportBusy) return false;
		if (
			!initial.snapshot
			|| initial.activeResource?.type !== 'chapter'
			|| !initial.session
		) {
			set({ error: '请先打开一个章节，再进行导出。' });
			return false;
		}
		set({ chapterExportBusy: true, error: undefined });
		try {
			if (initial.session.state.dirty) {
				await get().save();
			}
			const current = get();
			if (
				!current.snapshot
				|| current.activeResource?.type !== 'chapter'
				|| !current.session
			) {
				set({ error: '当前章节已经关闭，未执行导出。' });
				return false;
			}
			if (current.session.state.dirty) {
				set({ error: '正文尚未安全保存，未执行导出。' });
				return false;
			}
			const destination = await desktopBridge.saveTextAs(
				buildChapterExportContent(current.session.content, format),
				current.session.state.originalEol,
				current.session.state.hasBom,
				suggestedChapterExportName(current.activeResource.title, format),
				format
			);
			if (!destination) return false;
			const receipt: ChapterExportReceipt = {
				id: `export:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`,
				projectId: current.snapshot.project.projectId,
				scope: 'chapter',
				title: current.activeResource.title,
				chapterId: current.activeResource.id,
				chapterTitle: current.activeResource.title,
				chapterCount: 1,
				format,
				destination,
				exportedAt: new Date().toISOString(),
				wordCount: countWords(current.session.content)
			};
			set(state => ({
				chapterExportReceipts: [receipt, ...state.chapterExportReceipts].slice(0, 100),
				writerNavigatorNotice: `已导出《${receipt.title}》，可在“历史”查看路径。`
			}));
			return true;
		} catch {
			set({ error: '章节导出失败，原稿未受影响。请检查目标位置后重试。' });
			return false;
		} finally {
			set({ chapterExportBusy: false });
		}
	},

	async exportWholeWork(format: WorkExportFormat = 'docx') {
		const initial = get();
		if (initial.chapterExportBusy) return false;
		if (!initial.snapshot) {
			set({ error: '请先打开一个作品，再进行导出。' });
			return false;
		}
		const initialChapters = flattenChapters(initial.snapshot.project);
		if (initialChapters.length === 0) {
			set({ error: '当前作品还没有章节，未执行导出。' });
			return false;
		}
		set({ chapterExportBusy: true, error: undefined });
		try {
			if (
				initial.activeResource?.type === 'chapter'
				&& initial.session?.state.dirty
			) {
				await get().save();
			}
			const current = get();
			if (!current.snapshot) {
				set({ error: '当前作品已经关闭，未执行导出。' });
				return false;
			}
			if (
				current.activeResource?.type === 'chapter'
				&& current.session?.state.dirty
			) {
				set({ error: '正文尚未安全保存，未执行导出。' });
				return false;
			}
			const project = current.snapshot.project;
			const projectRoot = current.snapshot.root;
			const sourceVolumes = await Promise.all(project.volumes.map(async volume => ({
				title: volume.title,
				chapters: await Promise.all(volume.chapters.map(async chapter => {
					const file = await desktopBridge.readText(projectRoot, chapter.file);
					return {
						id: chapter.id,
						path: chapter.file,
						hash: file.hash,
						title: chapter.title,
						content: file.content
					};
				}))
			})));
			const volumes = sourceVolumes.map(volume => ({
				title: volume.title,
				chapters: volume.chapters.map(chapter => ({
					title: chapter.title,
					content: chapter.content
				}))
			}));
			const sourceFingerprint = await createWorkSourceFingerprint(
				current.snapshot.projectRevision,
				sourceVolumes.flatMap(volume => volume.chapters.map(chapter => ({
					id: chapter.id,
					path: chapter.path,
					hash: chapter.hash
				})))
			);
			const wordCount = volumes.reduce((volumeTotal, volume) => (
				volumeTotal + volume.chapters.reduce((chapterTotal, chapter) => (
					chapterTotal + countWords(chapter.content)
				), 0)
			), 0);
			const chapterCount = volumes.reduce((total, volume) => (
				total + volume.chapters.length
			), 0);
			const suggestedName = suggestedWorkExportName(project.title, format);
			const destination = format === 'docx'
				? await desktopBridge.saveDocxAs(
					buildWorkDocxDocument(project.title, volumes),
					suggestedName
				)
				: await desktopBridge.saveTextAs(
					buildWorkExportContent(project.title, volumes, format),
					'lf',
					false,
					suggestedName,
					format
				);
			if (!destination) return false;
			const receipt: ChapterExportReceipt = {
				id: `export:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`,
				projectId: project.projectId,
				scope: 'work',
				title: project.title,
				chapterCount,
				format,
				destination,
				exportedAt: new Date().toISOString(),
				wordCount,
				sourceFingerprint
			};
			set(state => ({
				chapterExportReceipts: [receipt, ...state.chapterExportReceipts].slice(0, 100),
				writerNavigatorNotice: `已导出整部《${receipt.title}》，共 ${receipt.chapterCount} 章。`
			}));
			return true;
		} catch {
			set({ error: '作品导出失败，原稿未受影响。请检查章节文件和目标位置后重试。' });
			return false;
		} finally {
			set({ chapterExportBusy: false });
		}
	},

	confirmWholeWorkDelivery(receiptId) {
		let confirmed = false;
		set(state => {
			const receipts = confirmWholeWorkExportReceipt(
				state.chapterExportReceipts,
				receiptId,
				new Date().toISOString()
			);
			confirmed = receipts !== state.chapterExportReceipts;
			return confirmed ? { chapterExportReceipts: receipts } : {};
		});
		return confirmed;
	},

	revokeWholeWorkDelivery(receiptId) {
		let revoked = false;
		set(state => {
			const receipts = revokeWholeWorkExportReceipt(
				state.chapterExportReceipts,
				receiptId
			);
			revoked = receipts !== state.chapterExportReceipts;
			return revoked ? { chapterExportReceipts: receipts } : {};
		});
		return revoked;
	},

	async forceSave() {
		if (activeForceSave) {
			const saved = await activeForceSave;
			if (saved && get().session?.state.dirty) {
				return get().forceSave();
			}
			return saved;
		}
		if (activeManuscriptSave) {
			await activeManuscriptSave;
			const current = get();
			if (!current.session?.state.dirty) return true;
			if (current.saveState.type !== 'dirty') return false;
			return current.forceSave();
		}
		const { snapshot, session } = get();
		if (!snapshot || !session) {
			return false;
		}
		const task = (async () => {
			set({ saveState: { type: 'saving', startedAt: new Date().toISOString() } });
			const request = session.toWriteRequest(snapshot.root, true);
			const stillTargetsCurrentSession = () => {
				const current = get();
				return current.snapshot?.root === snapshot.root
					&& current.snapshot.project.projectId === snapshot.project.projectId
					&& current.activeResource?.id === session.state.resourceId
					&& current.session?.state.resourceId === session.state.resourceId
					&& current.session.state.path === session.state.path;
			};
			try {
				const result = await desktopBridge.writeTextAtomic(request);
				if (!stillTargetsCurrentSession()) return true;
				const current = get();
				const currentSession = current.session;
				if (!currentSession) return true;
				currentSession.markSaved(result, request.content);
				set({
					session: currentSession.copy(),
					snapshot: current.snapshot ? {
						...current.snapshot,
						wordCounts: {
							...current.snapshot.wordCounts,
							[currentSession.state.resourceId]: countWords(currentSession.content)
						}
					} : current.snapshot,
					externalConflict: undefined,
					lastSavedAt: result.modifiedAt,
					saveState: currentSession.state.dirty
						? { type: 'dirty' }
						: { type: 'clean', savedAt: result.modifiedAt },
					error: undefined
				});
				return true;
			} catch (error) {
				if (!stillTargetsCurrentSession()) return false;
				const failure = classifySaveFailure(error);
				set({
					saveState: failure.type === 'offline'
						? { type: 'offline', pendingChanges: 1 }
						: failure.type === 'failed'
							? failure
							: { type: 'failed', errorCode: 'forceSaveFailed', retryable: true },
					error: undefined
				});
				return false;
			}
		})();
		activeForceSave = task;
		try {
			return await task;
		} finally {
			if (activeForceSave === task) activeForceSave = undefined;
		}
	},

	reloadExternal() {
		if (activeForceSave || activeSaveAs) return;
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
			saveState: { type: 'clean', savedAt: new Date().toISOString() },
			error: undefined
		});
	},

	dismissExternalConflict() {
		if (activeForceSave || activeSaveAs) return;
		set({
			externalConflict: undefined,
			saveState: get().session?.state.dirty
				? { type: 'dirty' }
				: { type: 'clean', savedAt: get().lastSavedAt ?? new Date().toISOString() }
		});
	},

	async verifyExternalChange() {
		const { snapshot, activeResource, session, externalConflict, saveState } = get();
		if (!snapshot || !session || externalConflict || saveState.type === 'saving') {
			return;
		}
		const resourceId = session.state.resourceId;
		const path = session.state.path;
		const baselineDiskHash = session.state.diskHash;
		const key = [
			snapshot.root,
			snapshot.project.projectId,
			resourceId,
			path
		].join('\u0000');
		if (activeExternalVerification) {
			if (activeExternalVerification.key !== key) {
				queuedExternalVerificationKey = key;
			}
			await activeExternalVerification.operation;
			return;
		}
		const operation = (async () => {
			const currentStillMatches = () => {
				const current = get();
				return current.snapshot?.root === snapshot.root
					&& current.snapshot.project.projectId === snapshot.project.projectId
					&& current.activeResource?.id === activeResource?.id
					&& current.activeResource?.id === resourceId
					&& current.session?.state.resourceId === resourceId
					&& current.session.state.path === path
					&& current.session.state.diskHash === baselineDiskHash
					&& !current.externalConflict
					&& current.saveState.type !== 'saving';
			};
			try {
				const disk = await desktopBridge.readText(snapshot.root, path);
				if (!currentStillMatches()) return;
				const current = get();
				const currentSession = current.session;
				if (!currentSession || disk.hash === currentSession.state.diskHash) return;
				const detectedAt = new Date().toISOString();
				if (currentSession.state.dirty) {
					set({
						externalConflict: { disk, detectedAt },
						saveState: { type: 'external_conflict', detectedAt }
					});
				} else {
					currentSession.reload(disk);
					set({
						session: currentSession.copy(),
						snapshot: current.snapshot ? {
							...current.snapshot,
							wordCounts: {
								...current.snapshot.wordCounts,
								[resourceId]: countWords(currentSession.content)
							}
						} : current.snapshot,
						lastSavedAt: detectedAt,
						saveState: { type: 'clean', savedAt: detectedAt }
					});
				}
			} catch (error) {
				if (!currentStillMatches()) return;
				const failure = classifySaveFailure(error);
				if (failure.type === 'offline') {
					set({
						saveState: {
							type: 'offline',
							pendingChanges: get().session?.state.dirty ? 1 : 0
						}
					});
				}
			}
		})();
		activeExternalVerification = { key, operation };
		try {
			await operation;
		} finally {
			if (activeExternalVerification?.operation === operation) {
				activeExternalVerification = undefined;
			}
			const queuedKey = queuedExternalVerificationKey;
			queuedExternalVerificationKey = undefined;
			const current = get();
			const currentSession = current.session;
			const currentKey = current.snapshot && currentSession
				? [
					current.snapshot.root,
					current.snapshot.project.projectId,
					currentSession.state.resourceId,
					currentSession.state.path
				].join('\u0000')
				: undefined;
			if (queuedKey && queuedKey === currentKey) {
				void get().verifyExternalChange();
			}
		}
	},

	requestCloseProtection() {
		const protection = closeProtectionFor(get().saveState);
		if (protection.action === 'allow' && !get().session?.state.dirty) {
			get().flushWriterSession();
			return true;
		}
		set({ closeProtectionOpen: true });
		return false;
	},

	dismissCloseProtection() {
		set({ closeProtectionOpen: false });
	},

	openWriterNavigator() {
		set({ writerNavigatorOpen: true, writerNavigatorNotice: undefined });
	},

	closeWriterNavigator() {
		set({ writerNavigatorOpen: false });
	},

	rememberWriterNavigatorResult(resultId) {
		set(state => ({
			writerNavigatorRecentIds: [
				resultId,
				...state.writerNavigatorRecentIds.filter(id => id !== resultId)
			].slice(0, 12)
		}));
	},

	setWriterNavigatorNotice(writerNavigatorNotice) {
		set({ writerNavigatorNotice });
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
				writerNavigatorNotice: undefined,
				...(activeMode === 'planning'
					? { storyView: 'creation-journey' as const }
					: activeMode === 'references'
						? { storyView: 'characters' as const }
						: {}),
				sidebarOpen: layout.sidebarVisible,
				sidebarWidth: clampWorkspaceSize('sidebar', layout.projectSidebarWidth),
				assistantOpen: layout.assistantVisible,
				writerTool: layout.assistantTool ?? 'outline',
				writerToolPinned: layout.assistantPinned ?? false,
				sceneBarExpanded: layout.sceneBarExpanded ?? true,
				manuscriptDensity: layout.manuscriptDensity ?? 'comfortable',
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
	requestContextualCreate(contextualCreateIntent) {
		const target: Readonly<Record<ContextualCreateIntent, {
			readonly mode: Extract<RailMode, 'planning' | 'references'>;
			readonly storyView: StoryViewId;
		}>> = {
			character: { mode: 'references', storyView: 'characters' },
			worldbuilding: { mode: 'references', storyView: 'worldbuilding' },
			asset: { mode: 'references', storyView: 'assets' },
			plot: { mode: 'planning', storyView: 'plots' },
			timeline: { mode: 'references', storyView: 'timeline' }
		};
		const destination = target[contextualCreateIntent];
		get().setMode(destination.mode);
		set({
			storyView: destination.storyView,
			contextualCreateIntent
		});
	},
	consumeContextualCreate(intent) {
		set(state => state.contextualCreateIntent === intent
			? { contextualCreateIntent: undefined }
			: {});
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
	openWriterTool(writerTool) {
		set(state => ({
			assistantOpen: true,
			writerTool,
			assistantIntent: undefined,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, {
					assistantVisible: true,
					assistantTool: writerTool
				})
			)
		}));
	},
	closeWriterTool() {
		set(state => ({
			assistantOpen: false,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { assistantVisible: false })
			)
		}));
	},
	toggleWriterToolPinned() {
		set(state => {
			const writerToolPinned = !state.writerToolPinned;
			return {
				writerToolPinned,
				writerSessions: updateCurrentWriterSession(
					state,
					session => updateSessionPanel(session, {
						assistantPinned: writerToolPinned
					})
				)
			};
		});
	},
	setSceneBarExpanded(sceneBarExpanded) {
		set(state => ({
			sceneBarExpanded,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { sceneBarExpanded })
			)
		}));
	},
	setManuscriptDensity(manuscriptDensity) {
		set(state => ({
			manuscriptDensity,
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, { manuscriptDensity })
			)
		}));
	},
	setActiveSceneId(activeSceneId) {
		set(state => ({
			writerSessions: updateCurrentWriterSession(
				state,
				session => {
					if (activeSceneId) {
						return touchWriterSession(session, { activeSceneId });
					}
					const withoutScene = touchWriterSession(session, {});
					delete (withoutScene as { activeSceneId?: string }).activeSceneId;
					return withoutScene;
				}
			)
		}));
	},
	requestAssistantAction(request) {
		const writerTool: WriterToolId = request.kind === 'scene-plan'
			? 'outline'
			: request.kind === 'story-kernel'
				? 'references'
				: 'ai';
		set(state => ({
			assistantOpen: true,
			writerTool,
			assistantIntent: {
				...request,
				id: crypto.randomUUID()
			},
			writerSessions: updateCurrentWriterSession(
				state,
				session => updateSessionPanel(session, {
					assistantVisible: true,
					assistantTool: writerTool
				})
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
		if (
			!state.snapshot
			|| state.snapshot.readOnly
			|| !quickCaptureStore
			|| state.quickCaptureBusy
		) return false;
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
				writerTool: layout.assistantTool ?? 'outline',
				writerToolPinned: layout.assistantPinned ?? false,
				sceneBarExpanded: layout.sceneBarExpanded ?? true,
				manuscriptDensity: layout.manuscriptDensity ?? 'comfortable',
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
		writerSessions: state.writerSessions,
		writerNavigatorRecentIds: state.writerNavigatorRecentIds,
		chapterExportReceipts: state.chapterExportReceipts,
		writingProgress: state.writingProgress
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
			writerSessions: parseWriterSessionMap(workspace.writerSessions),
			writerNavigatorRecentIds: Array.isArray(workspace.writerNavigatorRecentIds)
				? workspace.writerNavigatorRecentIds.filter(
						(resultId): resultId is string => typeof resultId === 'string'
					).slice(0, 12)
				: [],
			chapterExportReceipts: parseChapterExportReceipts(
				workspace.chapterExportReceipts
			),
			writingProgress: parseWritingProgressMap(workspace.writingProgress)
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

export function selectTodayWritingProgress(state: AppState): TodayWritingProgress {
	return resolveTodayWritingProgress(
		state.writingProgress,
		state.snapshot?.project.projectId
	);
}

declare global {
	interface Window {
		readonly __WRITING_BUDDY_DEVTOOLS__?: {
			readonly selectManuscriptPrefix: (length?: number) => boolean;
			readonly setManuscriptCursor: (offset?: number) => boolean;
			readonly appendManuscriptText: (text: string) => boolean;
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
			appendManuscriptText(text: string): boolean {
				const state = useAppStore.getState();
				if (
					state.activeResource?.type !== 'chapter'
					|| !state.session
					|| !text
				) return false;
				state.setContent(`${state.session.content}${text}`, 'edit');
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
