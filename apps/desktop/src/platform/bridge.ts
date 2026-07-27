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
import type {
	StoryResourceType,
	StorySaveEntry
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
