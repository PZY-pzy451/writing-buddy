import { Channel, invoke } from '@tauri-apps/api/core';
import {
	DEFAULT_AI_PREFERENCES,
	createDeepSeekProviderDefinition,
	type AiBalance,
	type AiConnectionTestResult,
	type AiGenerateRequest,
	type AiModel,
	type AiProviderPreferences,
	type AiProviderStatus,
	type PublicAiError,
	type AiStreamEvent,
	type AiUsageSummary,
	type SecretStatus
} from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult,
	BackupInspection,
	BackupResult,
	CreateProjectRequest,
	CreatedProject,
	DesktopBridge,
	ProjectCreationPreflight,
	ProjectOpenMode,
	ProjectRepairResult,
	ProjectSnapshot,
	ProjectStructureMoveRequest,
	ProjectStructureMoveResult,
	StoryIndexQuery,
	StoryIndexQueryResult,
	StoryIndexStatus,
	VersionSummary,
	VersionText
} from '@writing-buddy/platform-ports';
import { applyProjectStructureMove } from '@writing-buddy/project';
import type { TextFile } from '@writing-buddy/domain';
import {
	parseMentionLink,
	type MentionSaveEntry,
	type StoryResourceType,
	type StorySaveEntry
} from '@writing-buddy/story-kernel';

function isTauriRuntime(): boolean {
	return '__TAURI_INTERNALS__' in window;
}

function browserAiFixtureError(error: PublicAiError): Error & PublicAiError {
	return Object.assign(new Error(error.message), error);
}

class TauriDesktopBridge implements DesktopBridge {
	chooseProject(): Promise<string | undefined> {
		return invoke<string | null>('choose_project').then(value => value ?? undefined);
	}

	chooseProjectParentDirectory(): Promise<string | undefined> {
		return invoke<string | null>('choose_project_parent_directory').then(value => value ?? undefined);
	}

	preflightProjectCreation(request: CreateProjectRequest): Promise<ProjectCreationPreflight> {
		return invoke<ProjectCreationPreflight>('preflight_project_creation', { request });
	}

	createProject(request: CreateProjectRequest): Promise<CreatedProject> {
		return invoke<CreatedProject>('create_project', { request });
	}

	moveProjectStructure(request: ProjectStructureMoveRequest): Promise<ProjectStructureMoveResult> {
		return invoke<ProjectStructureMoveResult>('move_project_structure', { request });
	}

	openProject(projectRoot: string, mode: ProjectOpenMode = 'read-write'): Promise<ProjectSnapshot> {
		return invoke<ProjectSnapshot>('open_project', { projectRoot, mode });
	}

	repairProject(projectRoot: string): Promise<ProjectRepairResult> {
		return invoke<ProjectRepairResult>('repair_project', { projectRoot });
	}

	revealProjectDirectory(projectRoot: string): Promise<void> {
		return invoke('reveal_project_directory', { projectRoot });
	}

	readText(projectRoot: string, relativePath: string): Promise<TextFile> {
		return invoke<TextFile>('read_text', { projectRoot, relativePath });
	}

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		return invoke<AtomicWriteResult>('write_text_atomic', { request });
	}

	saveTextAs(content: string, eol: 'lf' | 'crlf', hasBom: boolean, suggestedName: string): Promise<string | undefined> {
		return invoke<string | null>('save_text_as', { content, eol, hasBom, suggestedName })
			.then(value => value ?? undefined);
	}

	readResource(projectRoot: string, relativePath: string): Promise<string> {
		return invoke<string>('read_resource', { projectRoot, relativePath });
	}

	writeResource(projectRoot: string, relativePath: string, content: string, expectedHash: string): Promise<AtomicWriteResult> {
		return invoke<AtomicWriteResult>('write_resource', { projectRoot, relativePath, content, expectedHash });
	}

	readReviewState(projectRoot: string): Promise<TextFile | undefined> {
		return invoke<TextFile | null>('read_review_state', { projectRoot }).then(value => value ?? undefined);
	}

	writeReviewState(projectRoot: string, content: string, expectedHash: string): Promise<AtomicWriteResult> {
		return invoke<AtomicWriteResult>('write_review_state', { projectRoot, content, expectedHash });
	}

	createSnapshot(projectRoot: string, reason: string, label?: string): Promise<string> {
		return invoke<string>('create_snapshot', { projectRoot, reason, label });
	}

	createBackup(projectRoot: string, destination?: string): Promise<BackupResult> {
		return invoke<BackupResult>('create_backup', { projectRoot, destination });
	}

	chooseBackup(): Promise<string | undefined> {
		return invoke<string | null>('choose_backup').then(value => value ?? undefined);
	}

	inspectBackup(path: string): Promise<BackupInspection> {
		return invoke<BackupInspection>('inspect_backup', { path });
	}

	restoreBackup(path: string, projectRoot: string, overwrite: boolean): Promise<number> {
		return invoke<number>('restore_backup', { path, projectRoot, overwrite });
	}

	listVersions(projectRoot: string): Promise<readonly VersionSummary[]> {
		return invoke<VersionSummary[]>('list_versions', { projectRoot });
	}

	readVersionText(projectRoot: string, snapshotId: string, relativePath: string): Promise<VersionText> {
		return invoke<VersionText>('read_version_text', { projectRoot, snapshotId, relativePath });
	}

	restoreVersion(projectRoot: string, snapshotId: string): Promise<number> {
		return invoke<number>('restore_version', { projectRoot, snapshotId });
	}

	getStoryResource(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		return invoke<unknown>('story_get_resource', {
			projectRoot,
			resourceType: type,
			id
		}).then(value => value ?? undefined);
	}

	listStoryResources(projectRoot: string, type: StoryResourceType): Promise<readonly unknown[]> {
		return invoke<unknown[]>('story_list_resources', {
			projectRoot,
			resourceType: type
		});
	}

	saveStoryResources(
		projectRoot: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]> {
		return invoke<unknown[]>('story_save_resources', { projectRoot, entries });
	}

	moveStoryResourceToTrash(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<void> {
		return invoke('story_move_to_trash', {
			projectRoot,
			resourceType: type,
			id
		});
	}

	restoreStoryResourceFromTrash(
		projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		return invoke('story_restore_from_trash', {
			projectRoot,
			resourceType: type,
			id
		});
	}

	getStoryIndexStatus(projectRoot: string): Promise<StoryIndexStatus> {
		return invoke('story_index_status', { projectRoot });
	}

	rebuildStoryIndex(projectRoot: string): Promise<StoryIndexStatus> {
		return invoke('story_rebuild_index', { projectRoot });
	}

	queryStoryIndex(projectRoot: string, query: StoryIndexQuery): Promise<StoryIndexQueryResult> {
		return invoke('story_query_index', { projectRoot, query });
	}

	listMentionLinks(projectRoot: string): Promise<readonly unknown[]> {
		return invoke<unknown[]>('mention_list_links', { projectRoot });
	}

	saveMentionLinks(
		projectRoot: string,
		entries: readonly MentionSaveEntry[]
	): Promise<readonly unknown[]> {
		return invoke<unknown[]>('mention_save_links', { projectRoot, entries });
	}

	getAiProviderStatus(): Promise<AiProviderStatus> {
		return invoke('ai_get_provider_status');
	}

	saveDeepSeekKey(key: string): Promise<SecretStatus> {
		return invoke('ai_save_deepseek_key', { key });
	}

	deleteDeepSeekKey(): Promise<SecretStatus> {
		return invoke('ai_delete_deepseek_key');
	}

	testDeepSeekConnection(): Promise<AiConnectionTestResult> {
		return invoke('ai_test_deepseek_connection');
	}

	listDeepSeekModels(forceRefresh = false): Promise<readonly AiModel[]> {
		return invoke<AiModel[]>('ai_list_deepseek_models', { forceRefresh });
	}

	getDeepSeekBalance(): Promise<AiBalance> {
		return invoke('ai_get_deepseek_balance');
	}

	getAiPreferences(): Promise<AiProviderPreferences> {
		return invoke('ai_get_preferences');
	}

	saveAiPreferences(preferences: AiProviderPreferences): Promise<AiProviderPreferences> {
		return invoke('ai_save_preferences', { preferences });
	}

	startAiGeneration(request: AiGenerateRequest, listener: (event: AiStreamEvent) => void): Promise<void> {
		const onEvent = new Channel<AiStreamEvent>();
		onEvent.onmessage = listener;
		return invoke('ai_start_generation', { request, onEvent });
	}

	cancelAiJob(jobId: string): Promise<boolean> {
		return invoke('ai_cancel_job', { jobId });
	}

	getAiUsageSummary(): Promise<AiUsageSummary> {
		return invoke('ai_get_usage_summary');
	}
}

let browserProject: ProjectSnapshot = {
	root: 'browser-fixture',
	projectRevision: 'browser-project-revision-1',
	project: {
		schemaVersion: 1,
		projectId: 'project-a11ce001',
		title: '我的小说',
		volumes: [{
			id: 'volume-a11ce001',
			title: '第一卷 灰城之下',
			chapters: [
				{
					id: 'chapter-a11ce001',
					title: '第一章 停摆的时钟',
					file: 'chapters/chapter-001.md',
					status: 'draft',
					targetWords: 3000,
					scene: {
						location: '旧火车站',
						time: '23:40',
						pov: '林墨',
						characters: ['林墨', '徐青'],
						goal: '找到遗失的笔记',
						note: '车站时钟停在 23:17'
					}
				},
				{
					id: 'chapter-a11ce002',
					title: '第二章 迷路的旅人',
					file: 'chapters/chapter-002.md',
					status: 'revision',
					targetWords: 3000,
					scene: {
						location: '第三站台',
						time: '23:52',
						pov: '徐青',
						characters: ['徐青', '林墨'],
						goal: '追踪拿走笔记的人',
						note: '午夜前有一班货运列车'
					}
				}
			]
		},
		{
			id: 'volume-a11ce002',
			title: '第二卷 雾中来客',
			chapters: [
				{
					id: 'chapter-a11ce003',
					title: '第三章 深夜的访客',
					file: 'chapters/chapter-003.md',
					status: 'draft',
					targetWords: 3000,
					scene: {
						location: '信号塔',
						time: '00:06',
						pov: '林墨',
						characters: ['林墨', '徐青'],
						goal: '找回车站日志',
						note: '塔灯以三下一组闪烁'
					}
				}
			]
		}]
	},
	appearance: {
		themeId: 'paper',
		accentId: 'gold',
		writingMode: 'manuscriptFirst',
		aiQuickActionsEnabled: true
	},
	resources: [
		{ id: 'lin-mo', type: 'character', title: '林墨', path: 'references/characters/lin-mo.json' },
		{ id: 'old-station', type: 'worldbuilding', title: '旧火车站', path: 'references/worldbuilding/old-station/metadata.json' },
		{ id: 'timeline', type: 'timeline', title: '故事时间线', path: 'references/timeline.json' },
		{ id: 'missing-notebook', type: 'item', title: '遗失的笔记', path: 'references/items/missing-notebook.json' },
		{ id: 'draft-note', type: 'note', title: '创作笔记', path: 'references/notes/创作笔记.md' }
	],
	wordCounts: {
		'chapter-a11ce001': 94,
		'chapter-a11ce002': 61,
		'chapter-a11ce003': 54
	},
	integrityIssues: [],
	readOnly: false
};

const browserCreatedProjects = new Map<string, ProjectSnapshot>();
let browserProjectRevisionSequence = 1;

const browserFiles = new Map<string, string>([
	['chapters/chapter-001.md', '夜雨落在旧火车站的玻璃穹顶上，细密的声响像一封迟迟没有拆开的信。\\n\\n林墨推开候车室的木门，看见墙上的时钟停在二十三点十七分。\\n\\n徐青已经等在长椅旁。她把一张褪色的行李票放到灯下，票面背后写着同一个时间。'],
	['chapters/chapter-002.md', '第三站台没有旅客，只有一只遗落的皮箱摆在黄线外。\\n\\n午夜的广播突然响起，却没有播报任何列车信息。徐青听见自己的名字被重复了两次。'],
	['chapters/chapter-003.md', '信号塔的铁梯被雨水浸得发亮。\\n\\n林墨数着塔灯：三下，停顿，又是三下。这个节奏与笔记最后一页的划痕完全相同。'],
	['references/notes/创作笔记.md', '下一章需要交代旧车站停运的真正原因。'],
	['references/characters/lin-mo.json', JSON.stringify({ schemaVersion: 1, id: 'lin-mo', name: '林墨', age: 28, gender: '男', personality: '沉静、谨慎', background: '旧火车站值守人的后代', notes: '说话简短，习惯先观察出口。', updatedAt: new Date().toISOString() }, undefined, 2)],
	['references/worldbuilding/old-station/metadata.json', JSON.stringify({ schemaVersion: 1, id: 'old-station', name: '旧火车站', region: '灰城北部', faction: '灰城铁路局', era: '停运后的第七年', rules: '所有机械钟都停在 23:17。', updatedAt: new Date().toISOString() }, undefined, 2)],
	['references/timeline.json', JSON.stringify({ schemaVersion: 1, projectId: 'project-a11ce001', events: [{ id: 'event-001', when: '23:17', label: '全站时钟停止', description: '未知原因导致机械钟同时停摆', chapterId: 'chapter-a11ce001' }], updatedAt: new Date().toISOString() }, undefined, 2)],
	['references/items/missing-notebook.json', JSON.stringify({ schemaVersion: 1, id: 'missing-notebook', name: '遗失的笔记', type: '线索物品', status: '下落不明', owner: '徐青', location: '旧火车站', description: '封面有被水泡过的痕迹。', notes: '最后一页记录了 23:17。', updatedAt: new Date().toISOString() }, undefined, 2)]
]);
let browserReviewFile: TextFile | undefined;
const browserVersionContent = new Map<string, Map<string, string>>();
const browserVersions: VersionSummary[] = [];
const browserStoryResources = new Map<string, unknown>();
const browserStoryTrash = new Map<string, unknown>();
const browserMentionLinks = new Map<string, unknown>();
const browserStoryTimestamp = '2026-07-27T00:00:00.000Z';
function browserStoryBase(id: string, type: StoryResourceType, title: string, tags: readonly string[] = []) {
	return {
		id, type, title, aliases: [], tags, schemaVersion: 1,
		createdAt: browserStoryTimestamp, updatedAt: browserStoryTimestamp, revision: 1
	};
}
const browserStoryFixtures: readonly Record<string, unknown>[] = [
	{
		...browserStoryBase('scene:station-rain', 'scene', '雨夜旧车站', ['开场场景']),
		chapterId: 'chapter:chapter-a11ce001',
		manuscriptRange: {
			start: 0,
			end: browserFiles.get('chapters/chapter-001.md')?.length ?? 1,
			revision: 1,
			quote: browserFiles.get('chapters/chapter-001.md')?.slice(0, 120) ?? '雨夜旧车站'
		},
		narrativeOrder: 1,
		locationIds: ['location:old-station'],
		participantIds: ['character:lin-mo', 'character:shen-qing'],
		plotThreadIds: ['plot-thread:missing-notebook'],
		revealInformationIds: ['information:notebook-owner'],
		foreshadowingIds: ['foreshadowing:clock-2317'],
		evidenceIds: ['evidence:station-meeting']
	},
	{
		id: 'character:lin-mo',
		type: 'character',
		title: '林墨',
		aliases: [],
		tags: ['主角', '调查者'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		role: 'protagonist',
		pronouns: '他',
		occupation: '自由撰稿人',
		factionIds: [],
		goals: ['找回遗失的笔记'],
		desires: ['确认父亲失踪的真相'],
		fears: ['自己的记忆并不可靠'],
		values: ['证据优先'],
		secrets: [],
		speechStyle: '句子简短，追问时会重复对方的关键词。',
		evidenceIds: ['evidence:lin-intro']
	},
	{
		id: 'character:shen-qing',
		type: 'character',
		title: '沈青',
		aliases: [],
		tags: ['关键人物', '守护者'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		role: 'supporting',
		pronouns: '她',
		occupation: '旧站档案管理员',
		factionIds: [],
		goals: ['阻止林墨接近封存站台'],
		desires: ['保护仍在站内的人'],
		fears: ['秘密提前暴露'],
		values: ['承诺'],
		secrets: ['知道 23:17 的真正含义'],
		speechStyle: '克制，避免直接回答涉及站台的问题。',
		evidenceIds: ['evidence:shen-intro']
	},
	{
		id: 'character:xu-qing',
		type: 'character',
		title: '徐青',
		aliases: [],
		tags: ['失踪者'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		role: 'supporting',
		pronouns: '他',
		occupation: '铁路信号员',
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: ['evidence:notebook-owner']
	},
	{
		id: 'relationship:lin-doubts-shen',
		type: 'relationship',
		title: '林墨怀疑沈青',
		aliases: [],
		tags: ['紧张'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		sourceCharacterId: 'character:lin-mo',
		targetCharacterId: 'character:shen-qing',
		relationshipType: '怀疑',
		strength: 0.72,
		visibility: 'private',
		description: '林墨认为沈青隐瞒了封存站台的信息。',
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a1',
			sceneId: 'scene:station-rain',
			narrativeOrder: 1
		},
		evidenceIds: ['evidence:rain-dialogue'],
		history: []
	},
	{
		id: 'relationship:shen-protects-lin',
		type: 'relationship',
		title: '沈青保护林墨',
		aliases: [],
		tags: ['秘密'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		sourceCharacterId: 'character:shen-qing',
		targetCharacterId: 'character:lin-mo',
		relationshipType: '保护',
		strength: 0.88,
		visibility: 'secret',
		description: '沈青没有向林墨说明保护他的真正理由。',
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a1',
			sceneId: 'scene:station-rain',
			narrativeOrder: 2
		},
		evidenceIds: ['evidence:station-rescue'],
		history: []
	},
	{
		id: 'relationship:xu-trusts-lin',
		type: 'relationship',
		title: '徐青信任林墨',
		aliases: [],
		tags: ['过去'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		sourceCharacterId: 'character:xu-qing',
		targetCharacterId: 'character:lin-mo',
		relationshipType: '信任',
		strength: 0.8,
		visibility: 'public',
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a2',
			narrativeOrder: 0
		},
		effectiveUntil: {
			chapterId: 'chapter:chapter-000000a4',
			narrativeOrder: 4
		},
		evidenceIds: ['evidence:old-letter'],
		history: []
	},
	{
		id: 'timeline-event:childhood-clock',
		type: 'timelineEvent',
		title: '童年时钟停摆',
		aliases: [],
		tags: ['回忆'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		storyStart: '2012-04-03T08:00:00.000Z',
		storyTimeKind: 'exact',
		narrativePosition: {
			chapterId: 'chapter:chapter-000000a5',
			narrativeOrder: 5
		},
		eventType: '背景',
		participantIds: ['character:lin-mo'],
		locationIds: ['location:old-station'],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: ['timeline-event:station-meeting'],
		plotThreadIds: ['plot-thread:missing-notebook'],
		informationIds: [],
		evidenceIds: ['evidence:childhood-memory']
	},
	{
		id: 'timeline-event:letter-arrives',
		type: 'timelineEvent',
		title: '匿名来信抵达',
		aliases: [],
		tags: ['线索'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		storyStart: '2026-07-26T10:00:00.000Z',
		storyTimeKind: 'exact',
		narrativePosition: {
			chapterId: 'chapter:chapter-000000a3',
			narrativeOrder: 3
		},
		eventType: '线索',
		participantIds: ['character:lin-mo'],
		locationIds: [],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: ['timeline-event:station-meeting'],
		plotThreadIds: ['plot-thread:missing-notebook'],
		informationIds: [],
		evidenceIds: ['evidence:anonymous-letter']
	},
	{
		id: 'timeline-event:station-meeting',
		type: 'timelineEvent',
		title: '雨夜车站相遇',
		aliases: [],
		tags: ['主线'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		storyStart: '2026-07-27T23:17:00.000Z',
		storyEnd: '2026-07-27T23:32:00.000Z',
		storyTimeKind: 'exact',
		narrativePosition: {
			chapterId: 'chapter:chapter-000000a1',
			sceneId: 'scene:station-rain',
			narrativeOrder: 1
		},
		eventType: '会面',
		participantIds: ['character:lin-mo', 'character:shen-qing'],
		locationIds: ['location:old-station'],
		itemIds: [],
		predecessorIds: ['timeline-event:letter-arrives'],
		consequenceIds: [],
		plotThreadIds: ['plot-thread:missing-notebook'],
		informationIds: ['information:clock-stopped'],
		evidenceIds: ['evidence:station-meeting']
	},
	{
		id: 'timeline-event:signal-tower-call',
		type: 'timelineEvent',
		title: '信号塔紧急呼叫',
		aliases: [],
		tags: ['验收冲突'],
		schemaVersion: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp,
		revision: 1,
		storyStart: '2026-07-27T23:20:00.000Z',
		storyEnd: '2026-07-27T23:28:00.000Z',
		storyTimeKind: 'exact',
		narrativePosition: {
			chapterId: 'chapter:chapter-000000a1',
			narrativeOrder: 2
		},
		eventType: '紧急行动',
		participantIds: ['character:lin-mo'],
		locationIds: ['location:signal-tower'],
		itemIds: [],
		predecessorIds: [],
		consequenceIds: [],
		plotThreadIds: ['plot-thread:missing-notebook'],
		informationIds: [],
		evidenceIds: ['evidence:signal-call']
	},
	{
		...browserStoryBase('location:gray-city', 'location', '灰城', ['城市']),
		locationType: '城市', mapPoint: { x: 48, y: 44 }, travelLinks: [],
		factionIds: ['faction:railway-bureau'], rules: ['午夜后禁止进入封存铁路区。'], evidenceIds: []
	},
	{
		...browserStoryBase('location:old-station', 'location', '旧火车站', ['核心场景']),
		parentLocationId: 'location:gray-city', locationType: '车站', mapPoint: { x: 63, y: 58 },
		travelLinks: [{ targetLocationId: 'location:signal-tower', minimumMinutes: 12, mode: '步行' }],
		factionIds: ['faction:railway-bureau'], rules: ['所有机械钟停在 23:17。'], evidenceIds: ['evidence:station-map']
	},
	{
		...browserStoryBase('location:signal-tower', 'location', '信号塔', ['禁区']),
		parentLocationId: 'location:old-station', locationType: '设施', mapPoint: { x: 78, y: 31 },
		travelLinks: [{ targetLocationId: 'location:old-station', minimumMinutes: 12, mode: '步行' }],
		factionIds: [], rules: ['塔灯遵循三短三长信号。'], evidenceIds: ['evidence:tower']
	},
	{
		...browserStoryBase('faction:railway-bureau', 'faction', '灰城铁路局', ['官方']),
		ideology: '秩序高于个人知情权。', goals: ['封存旧站事故档案'], allyFactionIds: [],
		enemyFactionIds: [], territoryLocationIds: ['location:old-station'], evidenceIds: ['evidence:seal']
	},
	{
		...browserStoryBase('world-rule:stopped-clocks', 'worldRule', '停摆时钟法则', ['异常']),
		category: 'other', statement: '旧站范围内的机械钟会在 23:17 停止。',
		exceptions: ['离开旧站十二小时后恢复。'], consequences: ['无法依赖机械钟判断时间。'],
		effectiveFrom: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 }, evidenceIds: ['evidence:clock-wall']
	},
	{
		...browserStoryBase('item:missing-notebook', 'item', '遗失的笔记', ['线索']),
		itemType: '文书', unique: true, quantityUnit: '本', description: '封面被雨水浸泡，最后一页写着 23:17。',
		restrictions: ['不可复制'], plotFunction: '连接徐青失踪与旧站事故。', evidenceIds: ['evidence:notebook-owner']
	},
	{
		...browserStoryBase('item:luggage-ticket', 'item', '褪色的行李票', ['线索']),
		itemType: '票据', unique: true, quantityUnit: '张', description: '票面背后写着 23:17。',
		restrictions: [], plotFunction: '把候车室与停摆时钟联系起来。', evidenceIds: ['evidence:clock-wall']
	},
	{
		...browserStoryBase('item:brass-key', 'item', '黄铜钥匙', ['通行']),
		itemType: '钥匙', unique: true, quantityUnit: '枚', description: '可以打开信号塔底层铁门。',
		restrictions: [], plotFunction: '开启封存区域。', evidenceIds: ['evidence:key']
	},
	{
		...browserStoryBase('plot-thread:missing-notebook', 'plotThread', '遗失笔记', ['主线']),
		status: 'active', premise: '林墨追查徐青留下的最后一本笔记。', stakes: '笔记可能证明旧站事故并非意外。',
		dramaticQuestion: '谁拿走了笔记？', startPosition: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 },
		targetResolution: { chapterId: 'chapter:chapter-000000a5', narrativeOrder: 12 },
		participantIds: ['character:lin-mo', 'character:shen-qing'], sceneIds: ['scene:station-rain'], evidenceIds: ['evidence:anonymous-letter']
	},
	{
		...browserStoryBase('plot-thread:station-secret', 'plotThread', '封存站台', ['秘密']),
		status: 'at-risk', premise: '被封存的第三站台仍在运行。', stakes: '秘密可能威胁灰城。',
		dramaticQuestion: '午夜广播在呼叫谁？', startPosition: { chapterId: 'chapter:chapter-000000a2', narrativeOrder: 3 },
		targetResolution: { chapterId: 'chapter:chapter-000000a4', narrativeOrder: 7 },
		participantIds: ['character:shen-qing'], sceneIds: [], evidenceIds: ['evidence:broadcast']
	},
	{
		...browserStoryBase('foreshadowing:clock-2317', 'foreshadowing', '23:17 的停摆时钟', ['核心伏笔']),
		status: 'reminded', plantedAt: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 },
		surfaceMeaning: '车站设备老化。', trueMeaning: '事故时间被人为固定。',
		reminderPositions: [{ chapterId: 'chapter:chapter-000000a3', narrativeOrder: 5 }],
		plannedPayoffAt: { chapterId: 'chapter:chapter-000000a5', narrativeOrder: 12 },
		readerVisibility: 0.45, plotThreadIds: ['plot-thread:missing-notebook'], evidenceIds: ['evidence:clock-wall']
	},
	{
		...browserStoryBase('information:clock-stopped', 'information', '时钟停摆真相', ['作者秘密']),
		truthStatement: '23:17 是徐青切断主信号的时刻。', truthStatus: 'confirmed',
		authorSecret: true, excludeFromAiByDefault: true,
		truthEffectiveFrom: { chapterId: 'chapter:chapter-000000a3', narrativeOrder: 6 },
		readerRevealAt: { chapterId: 'chapter:chapter-000000a5', narrativeOrder: 12 },
		evidenceIds: ['evidence:clock-note']
	},
	{
		...browserStoryBase('information:notebook-owner', 'information', '笔记原持有人', ['已揭示']),
		truthStatement: '遗失笔记属于徐青。', truthStatus: 'confirmed',
		authorSecret: false, excludeFromAiByDefault: false,
		truthEffectiveFrom: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 },
		readerRevealAt: { chapterId: 'chapter:chapter-000000a2', narrativeOrder: 3 },
		evidenceIds: ['evidence:notebook-owner']
	}
];
for (const resource of browserStoryFixtures) {
	browserStoryResources.set(
		browserStoryKey(resource.type as StoryResourceType, resource.id as string),
		resource
	);
}
const browserMentionFixtureContent = browserFiles.get('chapters/chapter-001.md') ?? '';
for (const [id, resourceId, quote] of [
	['mention:browser-lin-mo', 'character:lin-mo', '林墨'],
	['mention:browser-old-station', 'location:old-station', '旧火车站'],
	['mention:browser-luggage-ticket', 'item:luggage-ticket', '行李票'],
	['mention:browser-clock-2317', 'foreshadowing:clock-2317', '二十三点十七分']
] as const) {
	const start = browserMentionFixtureContent.indexOf(quote);
	if (start < 0) continue;
	const end = start + quote.length;
	browserMentionLinks.set(id, {
		id,
		resourceId,
		chapterId: 'chapter:chapter-a11ce001',
		anchor: {
			start,
			end,
			revision: 0,
			quote,
			before: browserMentionFixtureContent.slice(Math.max(0, start - 24), start),
			after: browserMentionFixtureContent.slice(end, end + 24)
		},
		displayText: quote,
		status: 'active',
		revision: 1,
		createdAt: browserStoryTimestamp,
		updatedAt: browserStoryTimestamp
	});
}
browserFiles.set('story/states/character-states.json', JSON.stringify([
	{
		id: 'state:lin-location-station',
		characterId: 'character:lin-mo',
		kind: 'location',
		value: '旧车站',
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a1',
			sceneId: 'scene:station-rain',
			narrativeOrder: 1
		},
		evidenceIds: ['evidence:station-arrival'],
		confirmation: 'confirmed',
		revision: 0
	},
	{
		id: 'state:lin-location-conflict',
		characterId: 'character:lin-mo',
		kind: 'location',
		value: '临江旅社',
		effectiveFrom: {
			chapterId: 'chapter:chapter-000000a1',
			narrativeOrder: 1
		},
		evidenceIds: ['evidence:hotel-register'],
		confirmation: 'pending',
		revision: 0
	}
]));
browserFiles.set('story/states/item-states.json', JSON.stringify([
	{
		id: 'item-state:notebook-xu', itemId: 'item:missing-notebook', action: 'acquired', quantity: 1,
		holderCharacterId: 'character:xu-qing', condition: '受潮',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 0 },
		effectiveUntil: { chapterId: 'chapter:chapter-000000a2', narrativeOrder: 3 },
		evidenceIds: ['evidence:notebook-owner'], confirmation: 'confirmed', revision: 0
	},
	{
		id: 'item-state:notebook-lost', itemId: 'item:missing-notebook', action: 'lost', quantity: 1,
		locationId: 'location:old-station', condition: '下落不明',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a2', narrativeOrder: 3 },
		evidenceIds: ['evidence:anonymous-letter'], confirmation: 'confirmed', revision: 0
	},
	{
		id: 'item-state:key-shen', itemId: 'item:brass-key', action: 'acquired', quantity: 1,
		holderCharacterId: 'character:shen-qing', condition: '完好',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 },
		evidenceIds: ['evidence:key'], confirmation: 'confirmed', revision: 0
	}
]));
browserFiles.set('story/states/knowledge-states.json', JSON.stringify([
	{
		id: 'knowledge-state:reader-owner', informationId: 'information:notebook-owner', subject: 'reader', status: 'knows',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a2', narrativeOrder: 3 },
		evidenceIds: ['evidence:notebook-owner'], confirmation: 'confirmed', revision: 0
	},
	{
		id: 'knowledge-state:lin-clock', informationId: 'information:clock-stopped', subject: 'character:lin-mo', status: 'believes-false',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a3', narrativeOrder: 5 },
		evidenceIds: ['evidence:clock-wall'], confirmation: 'pending', revision: 0
	},
	{
		id: 'knowledge-state:shen-clock', informationId: 'information:clock-stopped', subject: 'character:shen-qing', status: 'knows',
		effectiveFrom: { chapterId: 'chapter:chapter-000000a1', narrativeOrder: 1 },
		evidenceIds: ['evidence:clock-note'], confirmation: 'confirmed', revision: 0
	}
]));
const browserAiModels: readonly AiModel[] = [
	{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' },
	{ id: 'deepseek-v4-pro', ownedBy: 'deepseek' }
];
const browserAiBalance: AiBalance = {
	available: true,
	balances: [{
		currency: 'CNY',
		totalBalance: '88.00',
		grantedBalance: '8.00',
		toppedUpBalance: '80.00'
	}]
};
let browserAiPreferences: AiProviderPreferences = DEFAULT_AI_PREFERENCES;
let browserAiSecretStatus: SecretStatus = {
	configured: false,
	providerId: 'deepseek'
};
let browserAiUsageSummary: AiUsageSummary = {
	inputTokens: 0,
	outputTokens: 0,
	totalTokens: 0,
	requests: 0
};
const browserCancelledJobs = new Set<string>();
let browserRateLimitFailuresRemaining = 1;
let browserStoryIndexStatus: StoryIndexStatus = {
	schemaVersion: 1,
	ready: false,
	sourceFingerprint: '',
	recordCount: 0,
	kindCounts: {}
};

function browserHash(value: string): string {
	let result = 2166136261;
	for (const character of value) {
		result ^= character.codePointAt(0) ?? 0;
		result = Math.imul(result, 16777619);
	}
	return (result >>> 0).toString(16).padStart(64, '0');
}

function browserStoryKey(type: StoryResourceType, id: string): string {
	return `${type}:${id}`;
}

function browserStoryEnvelope(resource: unknown): {
	readonly type: StoryResourceType;
	readonly id: string;
	readonly revision: number;
} {
	if (!resource || typeof resource !== 'object') {
		throw new Error('storySchemaInvalid');
	}
	const envelope = resource as {
		readonly type?: StoryResourceType;
		readonly id?: string;
		readonly revision?: number;
	};
	if (!envelope.type || !envelope.id || !Number.isSafeInteger(envelope.revision)) {
		throw new Error('storySchemaInvalid');
	}
	return envelope as {
		readonly type: StoryResourceType;
		readonly id: string;
		readonly revision: number;
	};
}

class BrowserDesktopBridge implements DesktopBridge {
	async chooseProject(): Promise<string> {
		return browserProject.root;
	}

	async chooseProjectParentDirectory(): Promise<string> {
		return 'D:\\WritingBuddy\\Projects';
	}

	async preflightProjectCreation(request: CreateProjectRequest): Promise<ProjectCreationPreflight> {
		const issues: ProjectCreationPreflight['issues'][number][] = [];
		const name = request.name.trim();
		if (!name || name.length > 80) {
			issues.push({ field: 'name', code: 'invalidProjectNameLength', message: '作品名称需要为 1–80 个字符。' });
		}
		if (/[<>:"/\\|?*]/.test(name) || /[ .]$/.test(name)) {
			issues.push({ field: 'name', code: 'invalidProjectNameCharacters', message: '作品名称包含 Windows 不允许的字符或结尾。' });
		}
		if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
			issues.push({ field: 'name', code: 'reservedProjectName', message: '该名称是 Windows 保留名称，请更换作品名称。' });
		}
		if (!request.rootDirectory.trim()) {
			issues.push({ field: 'rootDirectory', code: 'projectParentUnavailable', message: '请选择作品保存位置。' });
		}
		if (request.selectedInitialResources.includes('first-chapter')
			&& !request.selectedInitialResources.includes('first-volume')) {
			issues.push({
				field: 'selectedInitialResources',
				code: 'firstChapterRequiresVolume',
				message: '创建第一章草稿时必须同时创建第一卷。'
			});
		}
		const targetRoot = request.rootDirectory && name
			? `${request.rootDirectory.replace(/[\\/]+$/, '')}\\${name}`
			: undefined;
		if (targetRoot && browserCreatedProjects.has(targetRoot)) {
			issues.push({ field: 'rootDirectory', code: 'projectTargetExists', message: '同名作品目录已经存在，不会自动覆盖。' });
		}
		const selected = new Set(request.selectedInitialResources);
		const directories = new Set(['', '.writing-buddy']);
		if (selected.has('first-chapter')) directories.add('chapters');
		if (selected.has('character-category')) {
			directories.add('references');
			directories.add('references/characters');
		}
		if (selected.has('worldbuilding-category')) {
			directories.add('references');
			directories.add('references/worldbuilding');
		}
		if (selected.has('timeline')) {
			directories.add('story');
			directories.add('story/events');
		}
		if (selected.has('plot-and-foreshadowing')) {
			directories.add('story');
			directories.add('story/plot-threads');
			directories.add('story/foreshadowing');
		}
		if (selected.has('sample-content')) {
			directories.add('references');
			directories.add('references/notes');
		}
		if (selected.has('ai-quick-actions')) directories.add('.writing-buddy/ai');
		return {
			valid: issues.length === 0,
			...(targetRoot ? { targetRoot } : {}),
			createdFileCount: 2 + Number(selected.has('first-chapter')) + Number(selected.has('sample-content')),
			createdDirectoryCount: directories.size,
			issues
		};
	}

	async createProject(request: CreateProjectRequest): Promise<CreatedProject> {
		const preflight = await this.preflightProjectCreation(request);
		if (!preflight.valid || !preflight.targetRoot) {
			throw new Error(preflight.issues[0]?.code ?? 'projectCreationPreflightFailed');
		}
		const suffix = Math.abs([...request.name].reduce((total, character) => (
			(total * 31 + (character.codePointAt(0) ?? 0)) | 0
		), 17)).toString(16).padStart(8, '0').slice(-8);
		const projectId = `project-${suffix}`;
		const firstChapter = request.selectedInitialResources.includes('first-chapter')
			? {
				id: `chapter-${suffix}`,
				title: '第一章',
				file: 'chapters/chapter-001.md',
				status: 'draft' as const,
				scene: {
					location: '',
					time: '',
					pov: '',
					characters: [],
					goal: '',
					note: ''
				}
			}
			: undefined;
		const snapshot: ProjectSnapshot = {
			root: preflight.targetRoot,
			projectRevision: `browser-created-revision-${++browserProjectRevisionSequence}`,
			project: {
				schemaVersion: 1,
				projectId,
				title: request.name.trim(),
				volumes: request.selectedInitialResources.includes('first-volume')
					? [{
						id: `volume-${suffix}`,
						title: '第一卷',
						chapters: firstChapter ? [firstChapter] : []
					}]
					: []
			},
			appearance: {
				themeId: request.themeId,
				accentId: request.accentId,
				writingMode: request.writingMode,
				aiQuickActionsEnabled: request.selectedInitialResources.includes('ai-quick-actions')
			},
			resources: [],
			wordCounts: firstChapter ? { [firstChapter.id]: 0 } : {},
			integrityIssues: [],
			readOnly: false
		};
		browserCreatedProjects.set(preflight.targetRoot, snapshot);
		if (firstChapter) {
			browserFiles.set(firstChapter.file, '# 第一章\n\n');
		}
		return {
			root: preflight.targetRoot,
			projectId,
			...(firstChapter ? { firstChapterId: firstChapter.id } : {}),
			createdFileCount: preflight.createdFileCount,
			createdDirectoryCount: preflight.createdDirectoryCount
		};
	}

	async moveProjectStructure(request: ProjectStructureMoveRequest): Promise<ProjectStructureMoveResult> {
		const current = browserCreatedProjects.get(request.projectRoot)
			?? (request.projectRoot === browserProject.root ? browserProject : undefined);
		if (!current) {
			throw new Error('projectRootUnavailable');
		}
		if (current.readOnly) {
			throw new Error('projectReadOnly');
		}
		if (request.command.expectedProjectRevision !== current.projectRevision) {
			throw new Error('projectRevisionConflict');
		}
		const moved = applyProjectStructureMove(current.project, request.command);
		const projectRevision = `browser-project-revision-${++browserProjectRevisionSequence}`;
		const inverseCommand = {
			...moved.inverseCommand,
			expectedProjectRevision: projectRevision
		};
		const next: ProjectSnapshot = {
			...current,
			project: moved.project,
			projectRevision
		};
		if (request.projectRoot === browserProject.root) {
			browserProject = next;
		} else {
			browserCreatedProjects.set(request.projectRoot, next);
		}
		return {
			project: moved.project,
			projectRevision,
			inverseCommand,
			description: moved.description
		};
	}

	async openProject(projectRoot: string, mode: ProjectOpenMode = 'read-write'): Promise<ProjectSnapshot> {
		return { ...(browserCreatedProjects.get(projectRoot) ?? browserProject), readOnly: mode === 'read-only' };
	}

	async repairProject(): Promise<ProjectRepairResult> {
		return { repaired: true, diagnosticId: 'browser-repair' };
	}

	async revealProjectDirectory(): Promise<void> {
		return undefined;
	}

	async readText(_projectRoot: string, relativePath: string): Promise<TextFile> {
		const content = browserFiles.get(relativePath);
		if (content === undefined) {
			throw new Error(`Fixture not found: ${relativePath}`);
		}
		return { content, encoding: 'utf-8', eol: 'lf', hasBom: false, hash: browserHash(content) };
	}

	async writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		const current = browserFiles.get(request.relativePath);
		if (!request.force) {
			if (current === undefined && request.expectedHash !== '') {
				throw new Error('externalChange:missing');
			}
			if (current !== undefined && browserHash(current) !== request.expectedHash) {
				throw new Error('externalChange');
			}
		}
		browserFiles.set(request.relativePath, request.content);
		if (request.relativePath.startsWith('story/')) {
			browserStoryIndexStatus = {
				schemaVersion: 1,
				ready: false,
				sourceFingerprint: '',
				recordCount: 0,
				kindCounts: {}
			};
		}
		return {
			hash: browserHash(request.content),
			byteLength: new TextEncoder().encode(request.content).byteLength,
			modifiedAt: new Date().toISOString()
		};
	}

	async saveTextAs(_content: string, _eol: 'lf' | 'crlf', _hasBom: boolean, suggestedName: string): Promise<string> {
		return `browser-downloads/${suggestedName}`;
	}

	async readResource(_projectRoot: string, relativePath: string): Promise<string> {
		return browserFiles.get(relativePath) ?? '';
	}

	async writeResource(projectRoot: string, relativePath: string, content: string, expectedHash: string): Promise<AtomicWriteResult> {
		return this.writeTextAtomic({ projectRoot, relativePath, content, expectedHash, eol: 'lf', hasBom: false });
	}

	async readReviewState(): Promise<TextFile | undefined> {
		return browserReviewFile;
	}

	async writeReviewState(_projectRoot: string, content: string, expectedHash: string): Promise<AtomicWriteResult> {
		if (browserReviewFile && browserReviewFile.hash !== expectedHash) {
			throw new Error('externalChange');
		}
		const hash = browserHash(content);
		browserReviewFile = { content, encoding: 'utf-8', eol: 'lf', hasBom: false, hash };
		return { hash, byteLength: new TextEncoder().encode(content).byteLength, modifiedAt: new Date().toISOString() };
	}

	async createSnapshot(_projectRoot: string, _reason: string, label?: string): Promise<string> {
		const id = `snapshot-${Date.now()}`;
		browserVersions.unshift({ id, createdAt: new Date().toISOString(), label });
		browserVersionContent.set(id, new Map(browserFiles));
		return id;
	}

	async createBackup(): Promise<BackupResult> {
		return { path: 'browser-fixture.wbbackup', hash: browserHash('backup'), byteLength: 1024, entryCount: browserFiles.size };
	}

	async chooseBackup(): Promise<string> {
		return 'browser-fixture.wbbackup';
	}

	async inspectBackup(): Promise<BackupInspection> {
		return { valid: true, formatVersion: 1, projectId: browserProject.project.projectId, createdAt: new Date().toISOString(), entryCount: browserFiles.size, issues: [] };
	}

	async restoreBackup(): Promise<number> {
		return browserFiles.size;
	}

	async listVersions(): Promise<readonly VersionSummary[]> {
		return browserVersions;
	}

	async readVersionText(_projectRoot: string, snapshotId: string, relativePath: string): Promise<VersionText> {
		const content = browserVersionContent.get(snapshotId)?.get(relativePath);
		if (content === undefined) {
			throw new Error('snapshotResourceNotFound');
		}
		return { snapshotId, relativePath, content, hash: browserHash(content) };
	}

	async restoreVersion(_projectRoot: string, snapshotId: string): Promise<number> {
		const version = browserVersionContent.get(snapshotId);
		if (!version) {
			throw new Error('snapshotNotFound');
		}
		for (const [path, content] of version) {
			browserFiles.set(path, content);
		}
		return version.size;
	}

	async getStoryResource(
		_projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		return browserStoryResources.get(browserStoryKey(type, id));
	}

	async listStoryResources(
		_projectRoot: string,
		type: StoryResourceType
	): Promise<readonly unknown[]> {
		const prefix = `${type}:`;
		return [...browserStoryResources.entries()]
			.filter(([key]) => key.startsWith(prefix))
			.map(([, value]) => value);
	}

	async saveStoryResources(
		_projectRoot: string,
		entries: readonly StorySaveEntry[]
	): Promise<readonly unknown[]> {
		const staged = entries.map(entry => {
			const envelope = browserStoryEnvelope(entry.resource);
			const key = browserStoryKey(envelope.type, envelope.id);
			const current = browserStoryResources.get(key);
			if (entry.expectedAbsent && current) {
				throw new Error(`storyRevisionConflict:${browserStoryEnvelope(current).revision}`);
			}
			const actualRevision = current
				? browserStoryEnvelope(current).revision
				: 0;
			const expectedRevision = entry.expectedRevision ?? envelope.revision;
			if (expectedRevision !== actualRevision) {
				throw new Error(`storyRevisionConflict:${actualRevision}`);
			}
			const saved = {
				...entry.resource as object,
				revision: actualRevision + 1,
				updatedAt: new Date().toISOString()
			};
			return { key, saved };
		});
		for (const { key, saved } of staged) {
			browserStoryResources.set(key, saved);
		}
		return staged.map(({ saved }) => saved);
	}

	async moveStoryResourceToTrash(
		_projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<void> {
		const key = browserStoryKey(type, id);
		const resource = browserStoryResources.get(key);
		if (!resource) {
			throw new Error('storyResourceNotFound');
		}
		browserStoryTrash.set(key, resource);
		browserStoryResources.delete(key);
	}

	async restoreStoryResourceFromTrash(
		_projectRoot: string,
		type: StoryResourceType,
		id: string
	): Promise<unknown> {
		const key = browserStoryKey(type, id);
		const resource = browserStoryTrash.get(key);
		if (!resource) {
			throw new Error('storyTrashNotFound');
		}
		browserStoryResources.set(key, resource);
		browserStoryTrash.delete(key);
		return resource;
	}

	async getStoryIndexStatus(): Promise<StoryIndexStatus> {
		return browserStoryIndexStatus;
	}

	async rebuildStoryIndex(): Promise<StoryIndexStatus> {
		const kindCounts: Record<string, number> = {};
		const ids: string[] = [];
		for (const value of browserStoryResources.values()) {
			const envelope = browserStoryEnvelope(value);
			kindCounts[envelope.type] = (kindCounts[envelope.type] ?? 0) + 1;
			ids.push(envelope.id);
		}
		kindCounts.mention = browserMentionLinks.size;
		for (const value of browserMentionLinks.values()) {
			ids.push(parseMentionLink(value).id);
		}
		const chapterCount = browserProject.project.volumes.reduce(
			(total, volume) => total + volume.chapters.length,
			0
		);
		kindCounts.chapter = chapterCount;
		browserStoryIndexStatus = {
			schemaVersion: 1,
			ready: true,
			sourceFingerprint: browserHash(ids.sort().join('\n')).slice(0, 16),
			recordCount: ids.length + chapterCount,
			kindCounts
		};
		return browserStoryIndexStatus;
	}

	async queryStoryIndex(
		_projectRoot: string,
		query: StoryIndexQuery
	): Promise<StoryIndexQueryResult> {
		if (!browserStoryIndexStatus.ready) await this.rebuildStoryIndex();
		const ids = [...browserStoryResources.values()]
			.filter(value => {
				const resource = value as {
					readonly id?: string;
					readonly type?: string;
					readonly chapterId?: string;
					readonly participantIds?: readonly string[];
				};
				return (!query.kind || resource.type === query.kind)
					&& (!query.chapterId || resource.chapterId === query.chapterId)
					&& (!query.participantId || resource.participantIds?.includes(query.participantId));
			})
			.map(value => browserStoryEnvelope(value).id)
			.sort();
		const offset = Math.min(query.offset ?? 0, ids.length);
		const limit = Math.min(query.limit ?? 200, 5_000);
		return {
			ids: ids.slice(offset, offset + limit),
			total: ids.length,
			offset,
			limit,
			sourceFingerprint: browserStoryIndexStatus.sourceFingerprint
		};
	}

	async listMentionLinks(): Promise<readonly unknown[]> {
		return [...browserMentionLinks.values()];
	}

	async saveMentionLinks(
		_projectRoot: string,
		entries: readonly MentionSaveEntry[]
	): Promise<readonly unknown[]> {
		const staged = entries.map(entry => {
			const mention = parseMentionLink(entry.mention);
			const current = browserMentionLinks.get(mention.id);
			const actualRevision = current ? parseMentionLink(current).revision : 0;
			const expectedRevision = entry.expectedRevision ?? mention.revision;
			if (actualRevision !== expectedRevision) {
				throw new Error(`mentionRevisionConflict:${actualRevision}`);
			}
			return {
				...mention,
				revision: actualRevision + 1,
				updatedAt: new Date().toISOString()
			};
		});
		for (const mention of staged) {
			browserMentionLinks.set(mention.id, mention);
		}
		return staged;
	}

	async getAiProviderStatus(): Promise<AiProviderStatus> {
		return {
			provider: createDeepSeekProviderDefinition(),
			secret: browserAiSecretStatus,
			preferences: browserAiPreferences
		};
	}

	async saveDeepSeekKey(key: string): Promise<SecretStatus> {
		if (!key.trim()) {
			throw new Error('invalid_configuration');
		}
		browserAiSecretStatus = {
			configured: true,
			providerId: 'deepseek',
			updatedAt: new Date().toISOString(),
			fingerprint: 'A4F9…'
		};
		return browserAiSecretStatus;
	}

	async deleteDeepSeekKey(): Promise<SecretStatus> {
		browserAiSecretStatus = {
			configured: false,
			providerId: 'deepseek'
		};
		return browserAiSecretStatus;
	}

	async testDeepSeekConnection(): Promise<AiConnectionTestResult> {
		if (!browserAiSecretStatus.configured) {
			throw new Error('authentication_failed');
		}
		return {
			status: {
				provider: createDeepSeekProviderDefinition(),
				secret: browserAiSecretStatus,
				preferences: browserAiPreferences,
				lastValidatedAt: new Date().toISOString()
			},
			models: browserAiModels,
			balance: browserAiBalance
		};
	}

	async listDeepSeekModels(): Promise<readonly AiModel[]> {
		if (!browserAiSecretStatus.configured) {
			throw new Error('authentication_failed');
		}
		return browserAiModels;
	}

	async getDeepSeekBalance(): Promise<AiBalance> {
		if (!browserAiSecretStatus.configured) {
			throw new Error('authentication_failed');
		}
		return browserAiBalance;
	}

	async getAiPreferences(): Promise<AiProviderPreferences> {
		return browserAiPreferences;
	}

	async saveAiPreferences(preferences: AiProviderPreferences): Promise<AiProviderPreferences> {
		browserAiPreferences = preferences;
		return browserAiPreferences;
	}

	async startAiGeneration(
		request: AiGenerateRequest,
		listener: (event: AiStreamEvent) => void
	): Promise<void> {
		if (!browserAiSecretStatus.configured) {
			throw new Error('authentication_failed');
		}
		const qaInstruction = request.messages.map(message => message.content).join('\n');
		if (qaInstruction.includes('[QA_AUTH_ERROR]')) {
			throw browserAiFixtureError({
				code: 'authentication_failed',
				message: 'API Key 无效或已经失效。',
				retryable: false,
				httpStatus: 401
			});
		}
		if (qaInstruction.includes('[QA_RATE_LIMIT]')) {
			if (browserRateLimitFailuresRemaining > 0) {
				browserRateLimitFailuresRemaining -= 1;
				throw browserAiFixtureError({
					code: 'rate_limited',
					message: '请求过多，请稍后再试。',
					retryable: true,
					httpStatus: 429
				});
			}
		}
		if (qaInstruction.includes('[QA_UNKNOWN_ERROR]')) {
			throw browserAiFixtureError({
				code: 'unknown',
				message: 'AI 请求未能启动。',
				retryable: false
			});
		}
		browserCancelledJobs.delete(request.jobId);
		listener({ type: 'job_started', jobId: request.jobId });
		listener({ type: 'connection_opened', jobId: request.jobId });
		const deltas = request.jobType === 'chapter-review'
			? browserReviewDeltas(request)
			: request.jobType === 'selection-rewrite'
				? browserRewriteDeltas(request)
				: request.jobType === 'manuscript-continuation'
					? browserContinuationDeltas(request)
					: request.jobType === 'scene-plan-generation'
						? browserScenePlanDeltas(request)
						: request.jobType === 'character-analysis'
							? browserCharacterAnalysisDeltas(request)
							: request.jobType === 'relationship-analysis'
								? browserRelationshipAnalysisDeltas(request)
								: request.jobType === 'world-analysis'
									? browserWorldAnalysisDeltas(request)
									: request.jobType === 'item-analysis'
										? browserItemAnalysisDeltas(request)
										: request.jobType === 'timeline-analysis'
											? browserTimelineAnalysisDeltas(request)
											: request.jobType === 'plot-analysis'
												? browserPlotAnalysisDeltas(request)
												: request.jobType === 'story-extraction'
													? browserStoryExtractionDeltas(request)
													: request.jobType === 'story-kernel-generation'
														? browserStoryKernelGenerationDeltas(request)
														: request.jobType === 'story-consistency-analysis'
															? browserStoryConsistencyAnalysisDeltas(request)
															: ['雨水沿着锈蚀的站牌缓慢滑落，', '远处的信号灯把雾切成暗红色的薄片，', '空荡站台只剩钟摆般反复的滴水声。'];
		for (const text of deltas) {
			await new Promise(resolve => window.setTimeout(resolve, 45));
			if (browserCancelledJobs.has(request.jobId)) {
				listener({ type: 'cancelled', jobId: request.jobId });
				return;
			}
			listener({ type: 'content_delta', jobId: request.jobId, text });
		}
		const usage = { inputTokens: 38, outputTokens: 82, totalTokens: 120, cachedInputTokens: 0 };
		browserAiUsageSummary = {
			inputTokens: browserAiUsageSummary.inputTokens + 38,
			outputTokens: browserAiUsageSummary.outputTokens + 82,
			totalTokens: browserAiUsageSummary.totalTokens + 120,
			requests: browserAiUsageSummary.requests + 1
		};
		listener({ type: 'usage', jobId: request.jobId, usage });
		listener({ type: 'completed', jobId: request.jobId, finishReason: 'stop' });
	}

	async cancelAiJob(jobId: string): Promise<boolean> {
		browserCancelledJobs.add(jobId);
		return true;
	}

	async getAiUsageSummary(): Promise<AiUsageSummary> {
		return browserAiUsageSummary;
	}
}

function browserReviewDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as { content?: string };
	const content = decoded.content ?? '';
	const sentenceEnd = content.search(/[。！？]/u);
	const end = sentenceEnd >= 0 ? sentenceEnd + 1 : Math.min(content.length, 24);
	const target = content.slice(0, end);
	const response = JSON.stringify({
		issues: target ? [{
			start: 0,
			end,
			target,
			severity: 'suggestion',
			title: 'AI 表达建议',
			message: '开篇意象较集中，可以适当压缩修饰语，让动作更快进入。',
			replacement: target.replace('细密的声响像一封迟迟没有拆开的信', '雨声敲打着沉默的穹顶')
		}] : []
	});
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserRewriteDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly context?: readonly { readonly priority?: string; readonly content?: string }[];
	};
	const original = decoded.context?.find(item => item.priority === 'P1')?.content ?? '';
	const response = JSON.stringify({
		suggestion: original
			.replace(/非常非常/gu, '格外')
			.replace(/然后然后/gu, '随后')
			.replace(/[ \t]{2,}/gu, ' '),
		rationale: '根据作者勾选的场景、人物和故事规则，压缩重复表达并保持原有事实。',
		potentialImpact: '只影响当前选区，不改变人物知识或剧情线状态。'
	});
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserContinuationDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly context?: readonly { readonly priority?: string; readonly content?: string }[];
	};
	const source = decoded.context?.find(item => item.priority === 'P1')?.content ?? '';
	const tail = source.slice(-32);
	const directions = [{
		title: '沿声音追出去',
		content: `${tail ? '钟声越过雨幕，' : ''}林越抬起头，循着雾里忽明忽暗的信号灯走向站台尽头。`,
		rationale: '延续当前感官线索并推进人物行动。'
	}, {
		title: '留在原地观察',
		content: '林越没有立刻追上去。他关掉手电，让黑暗替自己听清铁轨下方第二种脚步声。',
		rationale: '降低动作速度，以观察和悬念积累压力。'
	}, {
		title: '转向隐藏入口',
		content: '停摆的旧钟忽然响了十三下，售票窗后那扇没有把手的门随之弹开一道缝。',
		rationale: '利用现有车站意象开启新的空间选择。'
	}];
	const response = JSON.stringify({
		candidates: decoded.actionType === 'three-directions' ? directions : [directions[0]]
	});
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserScenePlanDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as { readonly actionType?: string };
	const full = {
		goal: '确认旧车站钟声的来源，并找到失踪者留下的线索。',
		conflict: '封闭站房与逼近的脚步让林越无法同时追踪两条线索。',
		turn: '停摆多年的旧钟突然响起，隐藏入口随之出现。',
		outcome: '林越进入地下通道，但暴露了自己的位置。',
		emotionBeats: [
			{ label: '迟疑', emotion: '不安', intensity: 0.36 },
			{ label: '逼近', emotion: '警觉', intensity: 0.72 },
			{ label: '越界', emotion: '决绝', intensity: 0.9 }
		],
		rationale: '字段只基于当前场景的车站、钟声与追踪冲突组织，供作者逐项确认。'
	};
	const response = JSON.stringify(decoded.actionType === 'generate-goal'
		? { goal: full.goal, rationale: full.rationale }
		: decoded.actionType === 'generate-emotion-beats'
			? { emotionBeats: full.emotionBeats, rationale: full.rationale }
			: full);
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserJsonDeltas(value: unknown): readonly string[] {
	const response = JSON.stringify(value);
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserEvidence(content: string, quote: string): {
	readonly start: number;
	readonly end: number;
	readonly quote: string;
} | null {
	const start = content.indexOf(quote);
	return start < 0 ? null : { start, end: start + quote.length, quote };
}

function browserCharacterAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly selectedCharacterId?: string;
		readonly source?: { readonly content?: string };
		readonly existingCharacters?: readonly {
			readonly id?: string;
			readonly title?: string;
		}[];
	};
	const content = decoded.source?.content ?? '';
	const selected = decoded.existingCharacters?.find(
		character => character.id === decoded.selectedCharacterId
	);
	const generated = [{
		title: '顾遥',
		role: 'supporting',
		confidence: 0.91,
		rationale: '以冷静观察者补足旧站调查线。',
		fields: [
			{ key: 'occupation', value: '铁路档案修复师', evidence: null },
			{ key: 'goals', value: ['找回被删去的事故记录'], evidence: null },
			{ key: 'speechStyle', value: '先陈述可验证事实，再用短句提出质疑。', evidence: null }
		]
	}, {
		title: '唐砚',
		role: 'antagonist',
		confidence: 0.88,
		rationale: '制造制度性阻力，同时保留动机反转空间。',
		fields: [
			{ key: 'occupation', value: '夜班调度长', evidence: null },
			{ key: 'values', value: ['秩序高于真相'], evidence: null },
			{ key: 'fears', value: ['封存事故再次发生'], evidence: null }
		]
	}, {
		title: '温禾',
		role: 'minor',
		confidence: 0.84,
		rationale: '用目击者视角连接车站日常与异常。',
		fields: [
			{ key: 'occupation', value: '站前花店店主', evidence: null },
			{ key: 'desires', value: ['让失踪者被人记住'], evidence: null },
			{ key: 'state.knowledge', value: ['午夜广播只在雨夜出现'], evidence: null }
		]
	}];
	if (decoded.actionType === 'generate-character') {
		return browserJsonDeltas({ candidates: generated });
	}
	if (decoded.actionType === 'extract-from-chapter') {
		const linEvidence = browserEvidence(content, '林墨');
		const xuEvidence = browserEvidence(content, '徐青');
		const stationEvidence = browserEvidence(content, '旧火车站');
		return browserJsonDeltas({
			candidates: [
				...(linEvidence ? [{
					title: '林墨',
					role: 'protagonist',
					confidence: 0.97,
					rationale: '正文明确点名并描写其行动。',
					fields: [
						{ key: 'aliases', value: ['林墨'], evidence: linEvidence },
						...(stationEvidence
							? [{ key: 'state.location', value: '旧火车站', evidence: stationEvidence }]
							: [])
					]
				}] : []),
				...(xuEvidence ? [{
					title: '徐青',
					role: 'supporting',
					confidence: 0.96,
					rationale: '正文明确点名并写出其持有物。',
					fields: [
						{ key: 'aliases', value: ['徐青'], evidence: xuEvidence },
						{ key: 'state.inventory', value: ['褪色的行李票'], evidence: browserEvidence(content, '褪色的行李票') }
					]
				}] : [])
			]
		});
	}
	const title = selected?.title ?? '当前人物';
	const field = decoded.actionType === 'generate-speech-style'
		? { key: 'speechStyle', value: '先观察，再用克制的短句追问关键细节。', evidence: null }
		: decoded.actionType === 'generate-arc'
			? { key: 'goals', value: ['查明旧站事故与失踪者的联系'], evidence: null }
			: { key: 'summary', value: '成长于铁路家属区，对封存档案保持本能警惕。', evidence: null };
	return browserJsonDeltas({
		candidates: [{
			title,
			confidence: 0.87,
			rationale: '结合所选章节与当前人物身份形成字段候选。',
			fields: [field]
		}]
	});
}

function browserRelationshipAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly sourceCharacterId?: string;
		readonly targetCharacterId?: string;
		readonly source?: { readonly content?: string };
		readonly characters?: readonly { readonly id?: string; readonly title?: string }[];
	};
	const content = decoded.source?.content ?? '';
	const characters = decoded.characters ?? [];
	const sourceId = decoded.sourceCharacterId ?? characters[0]?.id ?? '';
	const targetId = decoded.targetCharacterId ?? characters[1]?.id ?? '';
	if (decoded.actionType === 'generate-relationship') {
		return browserJsonDeltas({
			candidates: [{
				sourceCharacterId: sourceId,
				targetCharacterId: targetId,
				relationshipType: '谨慎结盟',
				strength: 0.64,
				visibility: 'private',
				description: '愿意交换线索，但仍保留关键秘密。',
				confidence: 0.88,
				rationale: '为当前冲突提供可变化的合作基础。',
				evidence: null
			}, {
				sourceCharacterId: targetId,
				targetCharacterId: sourceId,
				relationshipType: '暗中保护',
				strength: 0.78,
				visibility: 'secret',
				description: '保护动机尚未向对方公开。',
				confidence: 0.85,
				rationale: '保留双向认知差异与后续揭示空间。',
				evidence: null
			}]
		});
	}
	const lin = characters.find(character => character.title === '林墨')?.id;
	const xu = characters.find(character => character.title === '徐青')?.id;
	const sentenceStart = content.indexOf('徐青已经等在长椅旁');
	const sentenceEnd = sentenceStart >= 0 ? content.indexOf('。', sentenceStart) + 1 : 0;
	const evidence = sentenceStart >= 0 && sentenceEnd > sentenceStart
		? {
			start: sentenceStart,
			end: sentenceEnd,
			quote: content.slice(sentenceStart, sentenceEnd)
		}
		: null;
	return browserJsonDeltas({
		candidates: lin && xu && evidence ? [{
			sourceCharacterId: xu,
			targetCharacterId: lin,
			relationshipType: '主动提供线索',
			strength: 0.72,
			visibility: 'private',
			description: '徐青把关键票据放到林墨面前。',
			confidence: 0.94,
			rationale: '正文动作明确改变双方的信息关系。',
			evidence
		}] : []
	});
}

function browserWorldAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly targetType?: string;
		readonly source?: { readonly content?: string };
		readonly existingResources?: readonly {
			readonly id?: string;
			readonly type?: string;
		}[];
	};
	const content = decoded.source?.content ?? '';
	const existing = decoded.existingResources ?? [];
	const oldStationId = existing.find(resource => (
		resource.type === 'location' && resource.id === 'location:old-station'
	))?.id ?? null;
	if (decoded.actionType === 'generate-world-entry') {
		if (decoded.targetType === 'location') {
			return browserJsonDeltas({
				candidates: [{
					kind: 'location',
					title: '雾钟广场',
					aliases: ['北站前广场'],
					summary: '旧站外终年积雾的圆形广场，失踪者常在午夜留下湿脚印。',
					locationType: '公共广场',
					parentLocationId: oldStationId,
					rules: ['午夜后不能沿同一条石径连续绕行三圈'],
					confidence: 0.91,
					rationale: '延展旧站空间，并提供可执行的场景限制。',
					evidence: null
				}, {
					kind: 'location',
					title: '封闭月台',
					aliases: ['零号月台'],
					summary: '不在公开站图上的短月台，只在暴雨时出现信号灯。',
					locationType: '禁入设施',
					parentLocationId: oldStationId,
					rules: ['未经值守人许可不得点亮信号灯'],
					confidence: 0.87,
					rationale: '为悬疑线提供受规则约束的新调查空间。',
					evidence: null
				}]
			});
		}
		if (decoded.targetType === 'faction') {
			return browserJsonDeltas({
				candidates: [{
					kind: 'faction',
					title: '夜巡档案处',
					aliases: ['夜档处'],
					summary: '负责封存停运线路事故记录的隐秘小组。',
					ideology: '秩序必须建立在可验证的记录上。',
					goals: ['找回被删去的午夜列车日志', '阻止未授权人员进入零号月台'],
					territoryLocationIds: oldStationId ? [oldStationId] : [],
					confidence: 0.89,
					rationale: '为旧站秘密提供制度性维护者。',
					evidence: null
				}]
			});
		}
		const category = ['culture', 'religion', 'technology', 'magic', 'law']
			.includes(decoded.targetType ?? '')
			? decoded.targetType
			: 'other';
		return browserJsonDeltas({
			candidates: [{
				kind: 'worldRule',
				title: '雨夜停钟规则',
				aliases: ['二十三点十七分法则'],
				category,
				statement: '旧车站内未被人持续注视的机械钟会在雨夜停在二十三点十七分。',
				scope: '旧火车站范围内的雨夜',
				exceptions: ['有人持续注视表盘时，秒针仍会移动'],
				consequences: ['依赖钟表的行动会产生错误时间判断'],
				conflicts: [],
				confidence: 0.93,
				rationale: '把现有异常收束为可验证、带例外的规则。',
				evidence: null
			}]
		});
	}
	const stationEvidence = browserEvidence(content, '旧火车站');
	const clockEvidence = browserEvidence(content, '墙上的时钟停在二十三点十七分');
	return browserJsonDeltas({
		candidates: [
			...(stationEvidence ? [{
				kind: 'location',
				title: '旧火车站',
				aliases: [],
				summary: '雨夜仍保留候车室与玻璃穹顶的停运车站。',
				locationType: '废弃车站',
				parentLocationId: null,
				rules: [],
				confidence: 0.97,
				rationale: '正文明确点名并描写空间。',
				evidence: stationEvidence
			}] : []),
			...(clockEvidence ? [{
				kind: 'worldRule',
				title: '时钟停摆',
				aliases: [],
				category: 'technology',
				statement: '候车室墙上的时钟停在二十三点十七分。',
				scope: '旧火车站候车室',
				exceptions: [],
				consequences: ['现场时间无法通过墙钟确认'],
				conflicts: existing
					.filter(resource => resource.type === 'worldRule' && resource.id)
					.slice(0, 1)
					.map(resource => ({
						resourceId: resource.id!,
						reason: '与已有停摆规则适用范围可能重叠。'
					})),
				confidence: 0.96,
				rationale: '正文直接描述停摆状态。',
				evidence: clockEvidence
			}] : [])
		]
	});
}

function browserItemAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly selectedItemId?: string;
		readonly source?: { readonly content?: string };
		readonly existingItems?: readonly { readonly id?: string; readonly title?: string }[];
		readonly characters?: readonly { readonly id?: string; readonly title?: string }[];
		readonly locations?: readonly { readonly id?: string; readonly title?: string }[];
	};
	const content = decoded.source?.content ?? '';
	const characters = decoded.characters ?? [];
	const locations = decoded.locations ?? [];
	const holder = characters.find(character => character.title === '徐青') ?? characters[0];
	const location = locations.find(candidate => candidate.title === '旧火车站') ?? locations[0];
	if (decoded.actionType === 'generate-item') {
		return browserJsonDeltas({
			candidates: [{
				title: '无字站牌',
				aliases: ['零号站牌'],
				itemType: '线索物品',
				unique: true,
				quantityUnit: '块',
				description: '锈蚀铁牌上没有站名，雨水会短暂显出被刮去的字。',
				restrictions: ['离开旧站后显出的文字会消失'],
				plotFunction: '证明零号月台曾经存在，并指向被删去的线路。',
				confidence: 0.9,
				rationale: '生成可被追踪、受限制且能推动调查的核心物品。',
				evidence: null,
				states: []
			}]
		});
	}
	if (decoded.actionType === 'generate-item-history') {
		const selected = decoded.existingItems?.find(item => item.id === decoded.selectedItemId);
		return browserJsonDeltas({
			candidates: [{
				title: selected?.title ?? '当前物品',
				aliases: [],
				itemType: '线索物品',
				unique: true,
				quantityUnit: '件',
				description: '与旧站事故相关、表面留有受潮痕迹。',
				restrictions: ['关键标记在强光下会褪色'],
				plotFunction: '在人物之间流转并逐步揭示事故时间。',
				confidence: 0.86,
				rationale: '为当前物品补充可分别确认的使用记录。',
				evidence: null,
				states: [{
					action: 'used',
					quantity: 1,
					holderCharacterId: holder?.id ?? null,
					locationId: location?.id ?? null,
					condition: '受潮但可辨认',
					evidence: null
				}]
			}]
		});
	}
	const itemEvidence = browserEvidence(content, '褪色的行李票');
	return browserJsonDeltas({
		candidates: itemEvidence ? [{
			title: '褪色的行李票',
			aliases: ['旧行李票'],
			itemType: '线索票据',
			unique: true,
			quantityUnit: '张',
			description: '票面褪色，背后写着二十三点十七分。',
			restrictions: ['票面字迹不可再次复写'],
			plotFunction: '把徐青与停摆时钟指向同一个时间。',
			confidence: 0.97,
			rationale: '正文明确出现物品、持有人和票面信息。',
			evidence: itemEvidence,
			states: [{
				action: 'acquired',
				quantity: 1,
				holderCharacterId: holder?.id ?? null,
				locationId: location?.id ?? null,
				condition: '褪色',
				evidence: itemEvidence
			}]
		}] : []
	});
}

function browserTimelineAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly sources?: readonly {
			readonly resourceId?: string;
			readonly narrativeOrder?: number;
			readonly content?: string;
		}[];
		readonly existingEvents?: readonly { readonly id?: string; readonly title?: string }[];
		readonly characters?: readonly { readonly id?: string; readonly title?: string }[];
		readonly locations?: readonly { readonly id?: string; readonly title?: string }[];
		readonly items?: readonly { readonly id?: string; readonly title?: string }[];
		readonly plotThreads?: readonly { readonly id?: string; readonly title?: string }[];
		readonly foreshadowing?: readonly { readonly id?: string; readonly title?: string }[];
	};
	const source = decoded.sources?.[0];
	const content = source?.content ?? '';
	const sourceResourceId = source?.resourceId ?? 'chapter:browser-fixture';
	const narrativeOrder = source?.narrativeOrder ?? 0;
	const characterId = decoded.characters?.find(item => item.title === '林墨')?.id
		?? decoded.characters?.[0]?.id;
	const locationId = decoded.locations?.find(item => item.title === '旧火车站')?.id
		?? decoded.locations?.[0]?.id;
	const itemId = decoded.items?.find(item => item.title?.includes('行李票'))?.id
		?? decoded.items?.[0]?.id;
	const plotId = decoded.plotThreads?.[0]?.id;
	const clueId = decoded.foreshadowing?.[0]?.id;
	const existingEventId = decoded.existingEvents?.[0]?.id;
	const clockEvidence = browserEvidence(content, '墙上的时钟停在二十三点十七分');
	const ticketEvidence = browserEvidence(content, '徐青已经等在长椅旁');
	const base = {
		sourceResourceId,
		aliases: [] as string[],
		storyTimeKind: 'unknown',
		storyStart: null,
		storyEnd: null,
		narrativeOrder,
		participantIds: characterId ? [characterId] : [],
		locationIds: locationId ? [locationId] : [],
		itemIds: itemId ? [itemId] : [],
		predecessorIds: [] as string[],
		consequenceIds: [] as string[],
		plotThreadIds: plotId ? [plotId] : [],
		foreshadowingIds: clueId ? [clueId] : []
	};
	const clockCandidate = {
		...base,
		clientCandidateId: 'candidate:clock-stops',
		title: '雨夜时钟停摆',
		summary: '林墨发现候车室时钟停在二十三点十七分。',
		eventType: '异常发现',
		directResults: ['确认现场时间参照失效'],
		impacts: ['调查开始围绕二十三点十七分展开'],
		confidence: 0.97,
		rationale: '正文明确描述了可独立追踪的异常事件。',
		evidence: decoded.actionType === 'extract-events' ? clockEvidence : null
	};
	const ticketCandidate = {
		...base,
		clientCandidateId: 'candidate:ticket-revealed',
		title: '褪色票据揭示时间',
		summary: '徐青展示票据背面与停摆时钟相同的时间。',
		eventType: '线索揭示',
		directResults: ['票据与时钟形成交叉证据'],
		impacts: ['林墨开始怀疑两起异常来自同一事件'],
		confidence: 0.94,
		rationale: '人物行动直接推进调查并形成可见结果。',
		evidence: decoded.actionType === 'extract-events' ? ticketEvidence : null
	};
	if (decoded.actionType === 'generate-directions') {
		return browserJsonDeltas({
			candidates: [
				{
					...clockCandidate,
					clientCandidateId: 'candidate:direction-platform',
					title: '追查封闭月台',
					summary: '林墨根据停摆时间前往不在站图上的月台。',
					directResults: ['找到零号月台入口'],
					impacts: ['调查进入受限制区域'],
					confidence: 0.88
				},
				{
					...clockCandidate,
					clientCandidateId: 'candidate:direction-archive',
					title: '核对事故档案',
					summary: '徐青带林墨比对同一时刻的封存日志。',
					directResults: ['发现一页日志被替换'],
					impacts: ['怀疑转向档案管理者'],
					confidence: 0.86
				},
				{
					...clockCandidate,
					clientCandidateId: 'candidate:direction-broadcast',
					title: '监听午夜广播',
					summary: '两人等待广播再次出现并记录隐藏频率。',
					directResults: ['截获失踪者姓名'],
					impacts: ['调查目标从地点转向失踪名单'],
					confidence: 0.84
				}
			],
			causalEdges: []
		});
	}
	const candidates = decoded.actionType === 'suggest-causality'
		? [ticketCandidate]
		: [clockCandidate, ticketCandidate].filter(candidate => (
			decoded.actionType !== 'extract-events' || candidate.evidence
		));
	const causalEdges = [
		...(existingEventId ? [{
			clientEdgeId: 'edge:existing-clock',
			from: { kind: 'existing', id: existingEventId },
			to: { kind: 'candidate', id: candidates[0]?.clientCandidateId ?? 'candidate:ticket-revealed' },
			relation: 'enables',
			confidence: 0.89,
			rationale: '先抵达旧站，才有条件发现并核对异常。'
		}] : []),
		...(candidates.length > 1 ? [{
			clientEdgeId: 'edge:clock-ticket',
			from: { kind: 'candidate', id: 'candidate:clock-stops' },
			to: { kind: 'candidate', id: 'candidate:ticket-revealed' },
			relation: 'causes',
			confidence: 0.91,
			rationale: '停摆时刻使票据背面的相同时间成为关键线索。'
		}] : [])
	];
	return browserJsonDeltas({ candidates, causalEdges });
}

function browserPlotAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly actionType?: string;
		readonly sources?: readonly {
			readonly resourceId?: string;
			readonly narrativeOrder?: number;
			readonly content?: string;
		}[];
		readonly selectedPlotThreadId?: string;
		readonly selectedForeshadowingId?: string;
		readonly plotThreads?: readonly {
			readonly id?: string;
			readonly title?: string;
		}[];
		readonly foreshadowing?: readonly {
			readonly id?: string;
			readonly title?: string;
			readonly trueMeaning?: string;
		}[];
		readonly characters?: readonly { readonly id?: string; readonly title?: string }[];
		readonly scenes?: readonly { readonly id?: string; readonly title?: string }[];
	};
	const source = decoded.sources?.[0];
	const sourceResourceId = source?.resourceId ?? 'chapter:browser-fixture';
	const narrativeOrder = source?.narrativeOrder ?? 0;
	const content = source?.content ?? '';
	const evidence = browserEvidence(content, '墙上的时钟停在二十三点十七分');
	const characterId = decoded.characters?.find(item => item.title === '林墨')?.id
		?? decoded.characters?.[0]?.id;
	const sceneId = decoded.scenes?.[0]?.id;
	const selectedThread = decoded.plotThreads?.find(thread => (
		thread.id === decoded.selectedPlotThreadId
	));
	const selectedClue = decoded.foreshadowing?.find(clue => (
		clue.id === decoded.selectedForeshadowingId
	));
	const plotThread = {
		kind: 'plotThread',
		sourceResourceId,
		title: selectedThread?.title ?? '零号月台调查',
		aliases: ['被删除的月台'],
		summary: '沿二十三点十七分的交叉线索追查从站图中消失的零号月台。',
		status: decoded.actionType === 'generate-plot-consequences' ? 'at-risk' : 'active',
		premise: '林墨得到一张显示不存在月台的雨夜照片。',
		stakes: '若错过下一场雨，入口与证据都可能再次消失。',
		dramaticQuestion: '谁从站图和档案中删除了零号月台？',
		startPosition: { chapterId: sourceResourceId, narrativeOrder },
		targetResolution: { chapterId: sourceResourceId, narrativeOrder: narrativeOrder + 6 },
		actualResolution: null,
		participantIds: characterId ? [characterId] : [],
		sceneIds: sceneId ? [sceneId] : [],
		confidence: 0.91,
		rationale: decoded.actionType === 'generate-plot-consequences'
			? '以档案被替换制造阻碍，同时保留继续调查的路径。'
			: '把时钟、票据和封闭空间收束为可追踪剧情线。',
		evidence: decoded.actionType === 'extract-plot-progress' ? evidence : null
	};
	const foreshadowing = {
		kind: 'foreshadowing',
		sourceResourceId,
		title: selectedClue?.title ?? '二十三点十七分',
		aliases: ['停摆时刻'],
		summary: '时钟与票据反复出现同一时刻，形成可逐步提醒的时间伏笔。',
		status: decoded.actionType === 'generate-foreshadowing-payoff' ? 'reminded' : 'planted',
		plantedAt: { chapterId: sourceResourceId, narrativeOrder },
		surfaceMeaning: '旧站设备与票据都记录了同一时刻。',
		trueMeaning: selectedClue?.trueMeaning ?? null,
		reminderPositions: decoded.actionType === 'generate-foreshadowing-payoff'
			? [{ chapterId: sourceResourceId, narrativeOrder: narrativeOrder + 2 }]
			: [],
		plannedPayoffAt: { chapterId: sourceResourceId, narrativeOrder: narrativeOrder + 6 },
		actualPayoffAt: null,
		readerVisibility: 0.42,
		plotThreadIds: decoded.plotThreads?.[0]?.id ? [decoded.plotThreads[0].id] : [],
		confidence: 0.93,
		rationale: '相同时间在不同载体上重复出现，适合作为受控提醒。',
		evidence: decoded.actionType === 'extract-foreshadowing' ? evidence : null
	};
	return browserJsonDeltas({
		candidates: decoded.actionType?.includes('foreshadowing')
			? [foreshadowing]
			: [plotThread]
	});
}

function browserStoryExtractionDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as { readonly content?: string };
	const content = decoded.content ?? '';
	const sentenceEnd = content.search(/[。！？]/u);
	const end = sentenceEnd >= 0 ? sentenceEnd + 1 : content.length;
	const quote = content.slice(0, end);
	const response = JSON.stringify({
		facts: quote ? [{
			factType: 'story-information',
			title: '正文明确事实',
			statement: quote,
			confidence: 0.82,
			start: 0,
			end,
			quote
		}] : []
	});
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

function browserStoryConsistencyAnalysisDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly sources?: readonly {
			readonly resourceId?: string;
			readonly content?: string;
		}[];
		readonly storyFacts?: readonly {
			readonly resourceId?: string;
			readonly title?: string;
			readonly statement?: string;
		}[];
	};
	const sources = (decoded.sources ?? []).slice(0, 2);
	if (sources.length < 2) return browserJsonDeltas({ issues: [] });
	const evidence = sources.map((source, index) => {
		const content = source.content ?? '';
		const sentenceEnd = content.search(/[。！？]/u);
		const end = sentenceEnd >= 0 ? sentenceEnd + 1 : Math.min(content.length, 28);
		return {
			resourceId: source.resourceId,
			start: 0,
			end,
			quote: content.slice(0, end),
			label: `证据 ${String.fromCharCode(65 + index)}`
		};
	});
	if (evidence.some(item => !item.resourceId || !item.quote)) {
		return browserJsonDeltas({ issues: [] });
	}
	const fact = decoded.storyFacts?.[0];
	return browserJsonDeltas({
		issues: [{
			ruleId: 'ai-cross-chapter-consistency',
			severity: 'warning',
			title: '章节叙述可能存在状态差异',
			message: '两处正文对同一状态的描述需要作者复核；AI 只提出建议，不会自动修改。',
			evidence,
			storyFact: fact?.resourceId && fact.title && fact.statement
				? {
					resourceId: fact.resourceId,
					title: fact.title,
					statement: fact.statement
				}
				: null
		}]
	});
}

function browserStoryKernelGenerationDeltas(request: AiGenerateRequest): readonly string[] {
	const userMessage = request.messages.find(message => message.role === 'user')?.content ?? '{}';
	const decoded = JSON.parse(userMessage) as {
		readonly instruction?: string;
		readonly source?: {
			readonly resourceId?: string;
			readonly sourceRevision?: string;
			readonly content?: string;
		};
		readonly targetTypes?: readonly string[];
		readonly existingResources?: readonly {
			readonly id?: string;
			readonly type?: string;
		}[];
	};
	const source = decoded.source;
	const invalidVisibilityFixture = decoded.instruction?.includes('[QA_INVALID_SCHEMA]') ?? false;
	const content = source?.content ?? '';
	const quote = content.slice(0, Math.min(24, content.length));
	const evidence = quote ? { start: 0, end: quote.length, quote } : null;
	const suffix = request.jobId.toLowerCase().replace(/[^a-z0-9-]+/gu, '-').slice(0, 18);
	const base = {
		aliases: [] as string[],
		tags: ['AI 候选'],
		evidenceIds: [] as string[]
	};
	const chapterId = source?.resourceId ?? 'chapter:browser-fixture';
	const sourceRevision = Number(source?.sourceRevision ?? 0);
	const existingCharacterIds = (decoded.existingResources ?? [])
		.filter(item => item.type === 'character' && typeof item.id === 'string')
		.map(item => item.id as string);
	const generatedCharacterId = `character:ai-${suffix}`;
	const characterIds = [
		...existingCharacterIds,
		...((decoded.targetTypes ?? []).includes('character') ? [generatedCharacterId] : [])
	];
	const candidates = (decoded.targetTypes ?? []).flatMap(type => {
		let resource: Record<string, unknown> | undefined;
		switch (type) {
			case 'character':
				resource = {
					...base,
					id: generatedCharacterId,
					type,
					title: 'AI 识别人物',
					role: 'supporting',
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: []
				};
				break;
			case 'scene':
				resource = {
					...base,
					id: `scene:ai-${suffix}`,
					type,
					title: 'AI 识别场景',
					chapterId,
					manuscriptRange: {
						start: 0,
						end: Math.max(1, quote.length),
						revision: Number.isSafeInteger(sourceRevision) ? sourceRevision : 0,
						quote: quote || '正文'
					},
					narrativeOrder: 0,
					locationIds: [],
					participantIds: [],
					plotThreadIds: [],
					revealInformationIds: [],
					foreshadowingIds: []
				};
				break;
			case 'location':
				resource = {
					...base,
					id: `location:ai-${suffix}`,
					type,
					title: 'AI 识别地点',
					locationType: '正文场景',
					travelLinks: [],
					factionIds: [],
					rules: []
				};
				break;
			case 'faction':
				resource = {
					...base,
					id: `faction:ai-${suffix}`,
					type,
					title: 'AI 识别势力',
					goals: [],
					allyFactionIds: [],
					enemyFactionIds: [],
					territoryLocationIds: []
				};
				break;
			case 'item':
				resource = {
					...base,
					id: `item:ai-${suffix}`,
					type,
					title: 'AI 识别物品',
					unique: true,
					restrictions: []
				};
				break;
			case 'worldRule':
				resource = {
					...base,
					id: `world-rule:ai-${suffix}`,
					type,
					title: 'AI 识别世界规则',
					category: 'other',
					statement: quote || '待作者确认的世界规则。',
					exceptions: [],
					consequences: []
				};
				break;
			case 'timelineEvent':
				resource = {
					...base,
					id: `timeline-event:ai-${suffix}`,
					type,
					title: 'AI 识别事件',
					narrativePosition: { chapterId, narrativeOrder: 0 },
					eventType: '正文事件',
					participantIds: [],
					locationIds: [],
					itemIds: [],
					predecessorIds: [],
					consequenceIds: [],
					plotThreadIds: [],
					informationIds: []
				};
				break;
			case 'relationship':
				if (characterIds.length >= 2 && characterIds[0] !== characterIds[1]) {
					resource = {
						...base,
						id: `relationship:ai-${suffix}`,
						type,
						title: 'AI 识别关系',
						sourceCharacterId: characterIds[0],
						targetCharacterId: characterIds[1],
						relationshipType: '正文关联',
						visibility: 'private',
						effectiveFrom: { chapterId, narrativeOrder: 0 },
						history: []
					};
				}
				break;
			case 'plotThread':
				resource = {
					...base,
					id: `plot-thread:ai-${suffix}`,
					type,
					title: 'AI 识别剧情线',
					status: 'active',
					premise: quote || '待作者确认的剧情线。',
					participantIds: [],
					sceneIds: []
				};
				break;
			case 'foreshadowing':
				resource = {
					...base,
					id: `foreshadowing:ai-${suffix}`,
					type,
					title: invalidVisibilityFixture ? '信号塔的无声警告' : 'AI 识别伏笔',
					status: 'planted',
					surfaceMeaning: quote || '待作者确认的伏笔。',
					reminderPositions: [],
					readerVisibility: invalidVisibilityFixture ? 'hidden' : 0,
					plotThreadIds: []
				};
				break;
			case 'information':
				resource = {
					...base,
					id: `information:ai-${suffix}`,
					type,
					title: 'AI 识别信息',
					truthStatement: quote || '待作者确认的故事信息。',
					truthStatus: 'unknown',
					authorSecret: false,
					excludeFromAiByDefault: false
				};
				break;
		}
		return resource ? [{
			operation: 'create',
			resource,
			confidence: 0.84,
			rationale: '浏览器演示：根据当前正文构建完整 Story Kernel 候选。',
			evidence
		}] : [];
	});
	const response = JSON.stringify({ candidates });
	const first = Math.ceil(response.length / 3);
	const second = Math.ceil(response.length * 2 / 3);
	return [response.slice(0, first), response.slice(first, second), response.slice(second)];
}

export const desktopBridge: DesktopBridge = isTauriRuntime()
	? new TauriDesktopBridge()
	: new BrowserDesktopBridge();
