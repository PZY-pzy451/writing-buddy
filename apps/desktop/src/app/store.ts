import {
	countWords,
	findChapter,
	flattenChapters,
	type CursorState,
	type ResourceDescriptor,
	type TextFile
} from '@writing-buddy/domain';
import { DocumentSession, ResourceTabManager } from '@writing-buddy/project';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { parseReviewState, serializeReviewState, type ReviewIssue } from '@writing-buddy/review';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	ProjectOpenService,
	toPublicProjectOpenError,
	type ProjectOpenMode,
	type PublicProjectOpenError
} from '../features/projects/application/ProjectOpenService';
import { desktopBridge } from '../platform/bridge';

export type ThemeId = 'paper' | 'midnight' | 'fog' | 'focus';
export type RailMode = 'works' | 'search' | 'references' | 'review' | 'versions' | 'ai' | 'settings';

interface PersistedWorkspace {
	readonly recentProjectRoot?: string;
	readonly activeResourceId?: string;
	readonly openResourceIds: readonly string[];
	readonly theme: ThemeId;
	readonly accent: 'gold' | 'blue' | 'purple';
	readonly focusMode: boolean;
	readonly activeMode: RailMode;
	readonly sidebarWidth: number;
	readonly assistantWidth: number;
	readonly dockHeight: number;
	readonly documentViews: Readonly<Record<string, CursorState>>;
}

interface AppState extends PersistedWorkspace {
	readonly loading: boolean;
	readonly error?: string;
	readonly projectOpenError?: PublicProjectOpenError;
	readonly pendingProjectRoot?: string;
	readonly projectOpenBusyAction?: 'retry' | 'read-only' | 'repair' | 'directory';
	readonly snapshot?: ProjectSnapshot;
	readonly activeMode: RailMode;
	readonly tabs: readonly ResourceDescriptor[];
	readonly activeResource?: ResourceDescriptor;
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
	readonly search: string;
	readonly assistantOpen: boolean;
	readonly dockOpen: boolean;
	readonly lastSavedAt?: string;
	readonly pendingEdit?: {
		readonly id: string;
		readonly resourceId: string;
		readonly start: number;
		readonly end: number;
		readonly text: string;
	};
	readonly bootstrap: () => Promise<void>;
	readonly chooseProject: () => Promise<void>;
	readonly openProject: (root: string, mode?: ProjectOpenMode) => Promise<void>;
	readonly retryProjectOpen: () => Promise<void>;
	readonly openProjectReadOnly: () => Promise<void>;
	readonly repairProject: () => Promise<void>;
	readonly revealProjectDirectory: () => Promise<void>;
	readonly dismissProjectOpenError: () => void;
	readonly openResource: (resource: ResourceDescriptor) => Promise<void>;
	readonly closeResource: (resourceId: string) => void;
	readonly setContent: (content: string, change?: 'edit' | 'undo' | 'redo') => void;
	readonly updateCursor: (cursor: CursorState) => void;
	readonly requestEditorEdit: (edit: NonNullable<AppState['pendingEdit']>) => void;
	readonly clearEditorEdit: (id: string) => void;
	readonly setResourceContent: (content: string) => void;
	readonly save: () => Promise<void>;
	readonly saveAs: () => Promise<void>;
	readonly forceSave: () => Promise<void>;
	readonly reloadExternal: () => void;
	readonly dismissExternalConflict: () => void;
	readonly verifyExternalChange: () => Promise<void>;
	readonly reloadProject: () => Promise<void>;
	readonly setSelection: (selection?: { start: number; end: number; text: string }) => void;
	readonly setIssues: (issues: readonly ReviewIssue[]) => void;
	readonly setMode: (mode: RailMode) => void;
	readonly setTheme: (theme: ThemeId) => void;
	readonly setAccent: (accent: 'gold' | 'blue' | 'purple') => void;
	readonly toggleFocus: () => void;
	readonly toggleAssistant: () => void;
	readonly toggleDock: () => void;
	readonly setSearch: (search: string) => void;
	readonly setError: (error?: string) => void;
	readonly setSidebarWidth: (width: number) => void;
	readonly setAssistantWidth: (width: number) => void;
	readonly setDockHeight: (height: number) => void;
}

const tabs = new ResourceTabManager();
const projectOpenService = new ProjectOpenService(desktopBridge);
let reviewPersistTimer: number | undefined;

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

function firstResource(snapshot: ProjectSnapshot, preferredId?: string): ResourceDescriptor | undefined {
	if (preferredId) {
		const resource = toResource(snapshot, preferredId);
		if (resource) {
			return resource;
		}
	}
	const first = flattenChapters(snapshot.project)[0];
	return first ? toChapterResource(snapshot, first.id) : undefined;
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
	loading: false,
	theme: 'paper',
	accent: 'gold',
	focusMode: false,
	sidebarWidth: 320,
	assistantWidth: 360,
	dockHeight: 240,
	documentViews: {},
	activeMode: 'works',
	openResourceIds: [],
	tabs: [],
	issues: [],
	reviewHash: '',
	search: '',
	assistantOpen: true,
	dockOpen: true,

	async bootstrap() {
		const root = get().recentProjectRoot;
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

	async openProject(root, mode = 'read-write') {
		set({
			loading: true,
			error: undefined,
			projectOpenError: undefined,
			pendingProjectRoot: root
		});
		const result = mode === 'read-only'
			? await projectOpenService.openProjectReadOnly(root)
			: await projectOpenService.openProjectReadWrite(root);
		if (!result.ok) {
			set({
				loading: false,
				projectOpenError: result.error,
				projectOpenBusyAction: undefined
			});
			return;
		}

		try {
			const snapshot = result.snapshot;
			let reviewFile: TextFile | undefined;
			let restoredIssues: readonly ReviewIssue[] = [];
			try {
				reviewFile = await desktopBridge.readReviewState(snapshot.root);
				if (reviewFile) {
					restoredIssues = parseReviewState(reviewFile.content).issues;
				}
			} catch {
				reviewFile = undefined;
				restoredIssues = [];
			}
			const restoredTabs = get().openResourceIds
				.map(resourceId => toResource(snapshot, resourceId))
				.filter((resource): resource is ResourceDescriptor => resource !== undefined);
			const resource = firstResource(snapshot, get().activeResourceId);
			if (restoredTabs.length === 0 && resource) {
				restoredTabs.push(resource);
			}
			tabs.restore({ resources: restoredTabs, activeId: resource?.id });
			set({
				snapshot,
				recentProjectRoot: snapshot.root,
				loading: false,
				issues: restoredIssues,
				reviewHash: reviewFile?.hash ?? '',
				tabs: tabs.state.resources,
				openResourceIds: tabs.state.resources.map(candidate => candidate.id),
				activeResource: undefined,
				session: undefined,
				resourceContent: undefined,
				resourceHash: undefined,
				externalConflict: undefined,
				projectOpenError: undefined,
				pendingProjectRoot: undefined,
				projectOpenBusyAction: undefined
			});
			const active = tabs.state.resources.find(candidate => candidate.id === tabs.state.activeId);
			if (active) {
				await get().openResource(active);
			}
		} catch (error) {
			set({
				loading: false,
				projectOpenError: toPublicProjectOpenError(error, root),
				projectOpenBusyAction: undefined
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

	async openResource(resource) {
		const snapshot = get().snapshot;
		if (!snapshot || !resource.path) {
			return;
		}
		tabs.open(resource);
		set({
			activeResource: resource,
			activeResourceId: resource.id,
			tabs: tabs.state.resources,
			openResourceIds: tabs.state.resources.map(candidate => candidate.id),
			externalConflict: undefined,
			error: undefined
		});
		try {
			if (resource.type === 'chapter' || resource.type === 'note') {
				const file = await desktopBridge.readText(snapshot.root, resource.path);
				const viewKey = `${snapshot.project.projectId}:${resource.id}`;
				set({
					session: new DocumentSession(resource.id, resource.path, file, get().documentViews[viewKey]),
					resourceContent: undefined,
					resourceHash: undefined
				});
			} else {
				const content = await desktopBridge.readResource(snapshot.root, resource.path);
				const file = await desktopBridge.readText(snapshot.root, resource.path);
				set({ session: undefined, resourceContent: content, resourceHash: file.hash });
			}
		} catch (error) {
			set({ error: error instanceof Error ? error.message : '无法打开资源。' });
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
		set({
			tabs: tabs.state.resources,
			openResourceIds: tabs.state.resources.map(candidate => candidate.id)
		});
		const next = tabs.state.resources.find(resource => resource.id === tabs.state.activeId);
		if (next) {
			void get().openResource(next);
		} else {
			set({ activeResource: undefined, session: undefined, resourceContent: undefined });
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
		set({ session: session.copy(), issues });
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
			}
		}));
	},

	requestEditorEdit(pendingEdit) { set({ pendingEdit }); },
	clearEditorEdit(id) {
		if (get().pendingEdit?.id === id) {
			set({ pendingEdit: undefined });
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
	setIssues(issues) {
		set({ issues, dockOpen: true });
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
	setMode(activeMode) { set({ activeMode }); },
	setTheme(theme) { set({ theme }); },
	setAccent(accent) { set({ accent }); },
	toggleFocus() { set(state => ({ focusMode: !state.focusMode })); },
	toggleAssistant() { set(state => ({ assistantOpen: !state.assistantOpen })); },
	toggleDock() { set(state => ({ dockOpen: !state.dockOpen })); },
	setSearch(search) { set({ search }); },
	setError(error) { set({ error }); },
	setSidebarWidth(sidebarWidth) { set({ sidebarWidth: Math.min(420, Math.max(240, sidebarWidth)) }); },
	setAssistantWidth(assistantWidth) { set({ assistantWidth: Math.min(480, Math.max(280, assistantWidth)) }); },
	setDockHeight(dockHeight) { set({ dockHeight: Math.min(420, Math.max(160, dockHeight)) }); }
}), {
	name: 'writing-buddy-next-workspace',
	partialize: state => ({
		recentProjectRoot: state.recentProjectRoot,
		activeResourceId: state.activeResourceId,
		openResourceIds: state.openResourceIds,
		theme: state.theme,
		accent: state.accent,
		focusMode: state.focusMode,
		activeMode: state.activeMode,
		sidebarWidth: state.sidebarWidth,
		assistantWidth: state.assistantWidth,
		dockHeight: state.dockHeight,
		documentViews: state.documentViews
	})
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
