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
	type AiStreamEvent,
	type AiUsageSummary,
	type SecretStatus
} from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult,
	BackupInspection,
	BackupResult,
	DesktopBridge,
	ProjectOpenMode,
	ProjectRepairResult,
	ProjectSnapshot,
	VersionSummary,
	VersionText
} from '@writing-buddy/platform-ports';
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

class TauriDesktopBridge implements DesktopBridge {
	chooseProject(): Promise<string | undefined> {
		return invoke<string | null>('choose_project').then(value => value ?? undefined);
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

const browserProject: ProjectSnapshot = {
	root: 'browser-fixture',
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
				},
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

	async openProject(_projectRoot: string, mode: ProjectOpenMode = 'read-write'): Promise<ProjectSnapshot> {
		return { ...browserProject, readOnly: mode === 'read-only' };
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
		const current = browserFiles.get(request.relativePath) ?? '';
		if (!request.force && browserHash(current) !== request.expectedHash) {
			throw new Error('externalChange');
		}
		browserFiles.set(request.relativePath, request.content);
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
		browserCancelledJobs.delete(request.jobId);
		listener({ type: 'job_started', jobId: request.jobId });
		listener({ type: 'connection_opened', jobId: request.jobId });
		const deltas = request.jobType === 'chapter-review'
			? browserReviewDeltas(request)
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

export const desktopBridge: DesktopBridge = isTauriRuntime()
	? new TauriDesktopBridge()
	: new BrowserDesktopBridge();
