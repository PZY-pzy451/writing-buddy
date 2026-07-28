import type { TextFile, WritingProject } from '@writing-buddy/domain';
import type {
	AiBalance,
	AiConnectionTestResult,
	AiGenerateRequest,
	AiModel,
	AiProviderPreferences,
	AiProviderStatus,
	AiStreamEvent,
	AiUsageSummary,
	SecretStatus
} from '@writing-buddy/ai';
import type {
	MentionStorageGateway,
	StoryStorageGateway
} from '@writing-buddy/story-kernel';

export interface Disposable {
	dispose(): void;
}

export interface FileEntry {
	readonly name: string;
	readonly path: string;
	readonly kind: 'file' | 'directory';
	readonly byteLength?: number;
}

export interface FileStat {
	readonly kind: 'file' | 'directory';
	readonly byteLength: number;
	readonly modifiedAt: string;
}

export interface AtomicWriteRequest {
	readonly projectRoot: string;
	readonly relativePath: string;
	readonly content: string;
	readonly expectedHash: string;
	readonly eol: 'lf' | 'crlf';
	readonly hasBom: boolean;
	readonly force?: boolean;
}

export interface AtomicWriteResult {
	readonly hash: string;
	readonly byteLength: number;
	readonly modifiedAt: string;
}

export interface FileWatchEvent {
	readonly relativePath: string;
	readonly kind: 'created' | 'modified' | 'removed';
}

export interface FileSystemPort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
	readBytes(projectRoot: string, relativePath: string): Promise<Uint8Array>;
	writeBytesAtomic(projectRoot: string, relativePath: string, data: Uint8Array): Promise<AtomicWriteResult>;
	list(projectRoot: string, relativePath: string): Promise<readonly FileEntry[]>;
	stat(projectRoot: string, relativePath: string): Promise<FileStat | undefined>;
	watch(projectRoot: string, listener: (event: FileWatchEvent) => void): Promise<Disposable>;
}

export interface SecretStorePort {
	get(key: string): Promise<string | undefined>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface BackupCreateRequest {
	readonly projectRoot: string;
	readonly destination: string;
	readonly reason: string;
	readonly label?: string;
}

export interface BackupResult {
	readonly path: string;
	readonly hash: string;
	readonly byteLength: number;
	readonly entryCount: number;
}

export interface BackupInspection {
	readonly valid: boolean;
	readonly formatVersion?: number;
	readonly projectId?: string;
	readonly createdAt?: string;
	readonly entryCount: number;
	readonly issues: readonly string[];
}

export interface VersionSummary {
	readonly id: string;
	readonly createdAt: string;
	readonly label?: string;
}

export interface VersionText {
	readonly snapshotId: string;
	readonly relativePath: string;
	readonly content: string;
	readonly hash: string;
}

export interface ArchivePort {
	createBackup(request: BackupCreateRequest): Promise<BackupResult>;
	inspect(path: string): Promise<BackupInspection>;
	extractVerified(path: string, destination: string): Promise<void>;
}

export interface ProjectLock {
	readonly projectRoot: string;
	readonly mode: 'read-only' | 'read-write';
	readonly pid: number;
	readonly startedAt: string;
	release(): Promise<void>;
}

export interface ProjectLockState {
	readonly held: boolean;
	readonly stale: boolean;
	readonly application?: string;
	readonly pid?: number;
	readonly startedAt?: string;
}

export interface ProcessLockPort {
	acquire(projectRoot: string, mode: 'read-only' | 'read-write'): Promise<ProjectLock>;
	inspect(projectRoot: string): Promise<ProjectLockState>;
}

export interface DialogPort {
	chooseProject(): Promise<string | undefined>;
	chooseSavePath(suggestedName: string): Promise<string | undefined>;
	confirm(message: string, detail?: string): Promise<boolean>;
}

export interface LoggerPort {
	debug(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
	info(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
	warn(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
	error(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface ProjectSnapshot {
	readonly root: string;
	readonly project: WritingProject;
	readonly projectRevision: string;
	readonly appearance?: ProjectAppearance;
	readonly resources: readonly {
		readonly id: string;
		readonly type: 'note' | 'character' | 'worldbuilding' | 'timeline' | 'item';
		readonly title: string;
		readonly path: string;
	}[];
	readonly wordCounts: Readonly<Record<string, number>>;
	readonly integrityIssues: readonly {
		readonly severity: 'info' | 'warning' | 'error';
		readonly code: string;
		readonly message: string;
		readonly path?: string;
	}[];
	readonly readOnly: boolean;
}

export type ProjectOpenMode = 'read-write' | 'read-only';

export type ProjectThemeId = 'paper' | 'midnight' | 'fog' | 'focus';
export type ProjectAccentId = 'gold' | 'blue' | 'purple';
export type ProjectWritingMode = 'manuscriptFirst' | 'planningFirst';

export interface ProjectAppearance {
	readonly themeId: ProjectThemeId;
	readonly accentId: ProjectAccentId;
	readonly writingMode: ProjectWritingMode;
	readonly aiQuickActionsEnabled: boolean;
}

export interface CreateProjectRequest {
	readonly name: string;
	readonly description?: string;
	readonly rootDirectory: string;
	readonly projectType: 'longform' | 'novella' | 'short' | 'series';
	readonly language: string;
	readonly templateId: string;
	readonly selectedInitialResources: readonly string[];
	readonly themeId: ProjectThemeId;
	readonly accentId: ProjectAccentId;
	readonly writingMode: ProjectWritingMode;
}

export type ProjectCreationField =
	| 'name'
	| 'rootDirectory'
	| 'templateId'
	| 'selectedInitialResources'
	| 'themeId'
	| 'request';

export interface ProjectCreationIssue {
	readonly field: ProjectCreationField;
	readonly code: string;
	readonly message: string;
}

export interface ProjectCreationPreflight {
	readonly valid: boolean;
	readonly targetRoot?: string;
	readonly createdFileCount: number;
	readonly createdDirectoryCount: number;
	readonly issues: readonly ProjectCreationIssue[];
}

export interface CreatedProject {
	readonly root: string;
	readonly projectId: string;
	readonly firstChapterId?: string;
	readonly createdFileCount: number;
	readonly createdDirectoryCount: number;
}

export type DragEntityType =
	| 'volume'
	| 'chapter'
	| 'scene'
	| 'character'
	| 'worldEntry'
	| 'timelineEvent'
	| 'item'
	| 'plotThread'
	| 'foreshadowing';

export interface DragPayload {
	readonly entityType: DragEntityType;
	readonly entityIds: readonly string[];
	readonly sourceContainerId: string;
	readonly sourceIndex: number;
	readonly projectRevision: string;
}

export interface DropTarget {
	readonly targetType: 'before' | 'after' | 'inside' | 'associate';
	readonly containerId: string;
	readonly targetEntityId?: string;
	readonly associationKind?: string;
}

export interface OrderedLocation {
	readonly containerId: string;
	readonly index: number;
}

export interface MoveCommand {
	readonly commandId: string;
	readonly entityType: Extract<DragEntityType, 'volume' | 'chapter'>;
	readonly entityIds: readonly string[];
	readonly from: OrderedLocation;
	readonly to: OrderedLocation;
	readonly expectedProjectRevision: string;
}

export interface ProjectStructureMoveRequest {
	readonly projectRoot: string;
	readonly command: MoveCommand;
}

export interface ProjectStructureMoveResult {
	readonly project: WritingProject;
	readonly projectRevision: string;
	readonly inverseCommand: MoveCommand;
	readonly description: string;
}

export type ProjectOpenStage =
	| 'select-path'
	| 'read-manifest'
	| 'validate-schema'
	| 'acquire-lock'
	| 'integrity-scan'
	| 'load-index';

export interface PublicProjectOpenError {
	readonly code: string;
	readonly stage: ProjectOpenStage;
	readonly safePath?: string;
	readonly canOpenReadOnly: boolean;
	readonly canRepair: boolean;
	readonly diagnosticId: string;
}

export interface ProjectRepairResult {
	readonly repaired: boolean;
	readonly diagnosticId: string;
}

export interface StoryIndexStatus {
	readonly schemaVersion: number;
	readonly ready: boolean;
	readonly sourceFingerprint: string;
	readonly recordCount: number;
	readonly kindCounts: Readonly<Record<string, number>>;
}

export interface StoryIndexQuery {
	readonly kind?: string;
	readonly chapterId?: string;
	readonly participantId?: string;
	readonly relatedResourceId?: string;
	readonly offset?: number;
	readonly limit?: number;
}

export interface StoryIndexQueryResult {
	readonly ids: readonly string[];
	readonly total: number;
	readonly offset: number;
	readonly limit: number;
	readonly sourceFingerprint: string;
}

export interface StoryIndexGateway {
	getStoryIndexStatus(projectRoot: string): Promise<StoryIndexStatus>;
	rebuildStoryIndex(projectRoot: string): Promise<StoryIndexStatus>;
	queryStoryIndex(projectRoot: string, query: StoryIndexQuery): Promise<StoryIndexQueryResult>;
}

export interface DesktopBridge extends StoryStorageGateway, MentionStorageGateway, StoryIndexGateway {
	chooseProject(): Promise<string | undefined>;
	chooseProjectParentDirectory(): Promise<string | undefined>;
	preflightProjectCreation(request: CreateProjectRequest): Promise<ProjectCreationPreflight>;
	createProject(request: CreateProjectRequest): Promise<CreatedProject>;
	moveProjectStructure(request: ProjectStructureMoveRequest): Promise<ProjectStructureMoveResult>;
	openProject(projectRoot: string, mode?: ProjectOpenMode): Promise<ProjectSnapshot>;
	repairProject(projectRoot: string): Promise<ProjectRepairResult>;
	revealProjectDirectory(projectRoot: string): Promise<void>;
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
	saveTextAs(content: string, eol: 'lf' | 'crlf', hasBom: boolean, suggestedName: string): Promise<string | undefined>;
	readResource(projectRoot: string, relativePath: string): Promise<string>;
	writeResource(projectRoot: string, relativePath: string, content: string, expectedHash: string): Promise<AtomicWriteResult>;
	readReviewState(projectRoot: string): Promise<TextFile | undefined>;
	writeReviewState(projectRoot: string, content: string, expectedHash: string): Promise<AtomicWriteResult>;
	createSnapshot(projectRoot: string, reason: string, label?: string): Promise<string>;
	createBackup(projectRoot: string, destination?: string): Promise<BackupResult>;
	chooseBackup(): Promise<string | undefined>;
	inspectBackup(path: string): Promise<BackupInspection>;
	restoreBackup(path: string, projectRoot: string, overwrite: boolean): Promise<number>;
	listVersions(projectRoot: string): Promise<readonly VersionSummary[]>;
	readVersionText(projectRoot: string, snapshotId: string, relativePath: string): Promise<VersionText>;
	restoreVersion(projectRoot: string, snapshotId: string): Promise<number>;
	getAiProviderStatus(): Promise<AiProviderStatus>;
	saveDeepSeekKey(key: string): Promise<SecretStatus>;
	deleteDeepSeekKey(): Promise<SecretStatus>;
	testDeepSeekConnection(): Promise<AiConnectionTestResult>;
	listDeepSeekModels(forceRefresh?: boolean): Promise<readonly AiModel[]>;
	getDeepSeekBalance(): Promise<AiBalance>;
	getAiPreferences(): Promise<AiProviderPreferences>;
	saveAiPreferences(preferences: AiProviderPreferences): Promise<AiProviderPreferences>;
	startAiGeneration(request: AiGenerateRequest, listener: (event: AiStreamEvent) => void): Promise<void>;
	cancelAiJob(jobId: string): Promise<boolean>;
	getAiUsageSummary(): Promise<AiUsageSummary>;
}
