import {
	AI_CHAPTER_REVIEW_MAX_CHARS,
	storyKernelGenerationResourceTypes,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import { estimateContextTokens } from '@writing-buddy/story-kernel';

export const MANUSCRIPT_EXTRACTION_RUNS_PATH =
	'.writing-buddy/ai/extraction-center/index.json';

export type ManuscriptExtractionRunStatus =
	| 'planned'
	| 'running'
	| 'stopped'
	| 'completed'
	| 'completed-with-errors';

export type ManuscriptExtractionChapterStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'interrupted'
	| 'stale';

export type ManuscriptExtractionErrorCode =
	| 'authentication_failed'
	| 'insufficient_balance'
	| 'network_unavailable'
	| 'connection_timeout'
	| 'first_content_timeout'
	| 'stream_idle_timeout'
	| 'stream_parse_failed'
	| 'stream_incomplete'
	| 'empty_response'
	| 'cancelled'
	| 'invalid-response'
	| 'stale-source'
	| 'unknown';

export interface ManuscriptExtractionSource {
	readonly resourceId: string;
	readonly title: string;
	readonly sourceRevision: string;
	readonly content: string;
}

export interface ManuscriptExtractionSourceDescriptor {
	readonly resourceId: string;
	readonly title: string;
}

export interface ManuscriptExtractionChapter {
	readonly resourceId: string;
	readonly title: string;
	readonly sourceRevision: string;
	readonly tokenEstimate: number;
	readonly status: ManuscriptExtractionChapterStatus;
	readonly candidateBatchId?: string;
	readonly candidateCount?: number;
	readonly conflictCount?: number;
	readonly errorCode?: ManuscriptExtractionErrorCode;
	readonly startedAt?: string;
	readonly completedAt?: string;
}

export interface ManuscriptExtractionRun {
	readonly id: string;
	readonly schemaVersion: 1;
	readonly instruction: string;
	readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	readonly status: ManuscriptExtractionRunStatus;
	readonly tokenEstimate: number;
	readonly chapters: readonly ManuscriptExtractionChapter[];
	readonly createdAt: string;
	readonly updatedAt: string;
}

interface ManuscriptExtractionRunsFile {
	readonly schemaVersion: 1;
	readonly updatedAt: string;
	readonly runs: readonly ManuscriptExtractionRun[];
}

export interface ManuscriptExtractionStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

export interface ManuscriptExtractionProcessResult {
	readonly candidateBatchId: string;
	readonly candidateCount: number;
	readonly conflictCount: number;
}

export interface ManuscriptExtractionProcessorInput {
	readonly run: ManuscriptExtractionRun;
	readonly chapter: ManuscriptExtractionChapter;
	readonly source: ManuscriptExtractionSource;
	readonly onActiveCancel: (cancel: (() => Promise<void>) | undefined) => void;
	readonly onStreamProgress: (outputLength: number) => void;
}

export type ManuscriptExtractionProcessor = (
	input: ManuscriptExtractionProcessorInput
) => Promise<ManuscriptExtractionProcessResult>;

const runStatuses: readonly ManuscriptExtractionRunStatus[] = [
	'planned',
	'running',
	'stopped',
	'completed',
	'completed-with-errors'
];
const chapterStatuses: readonly ManuscriptExtractionChapterStatus[] = [
	'queued',
	'running',
	'completed',
	'failed',
	'cancelled',
	'interrupted',
	'stale'
];
const errorCodes: readonly ManuscriptExtractionErrorCode[] = [
	'authentication_failed',
	'insufficient_balance',
	'network_unavailable',
	'connection_timeout',
	'first_content_timeout',
	'stream_idle_timeout',
	'stream_parse_failed',
	'stream_incomplete',
	'empty_response',
	'cancelled',
	'invalid-response',
	'stale-source',
	'unknown'
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function chapterResourceId(value: unknown): value is string {
	return typeof value === 'string'
		&& /^chapter:[a-z0-9][a-z0-9-]*$/u.test(value);
}

function targetType(value: unknown): value is StoryKernelGenerationResourceType {
	return typeof value === 'string'
		&& storyKernelGenerationResourceTypes.includes(
			value as StoryKernelGenerationResourceType
		);
}

function parseChapter(value: unknown): ManuscriptExtractionChapter {
	if (!isRecord(value)
		|| !chapterResourceId(value.resourceId)
		|| typeof value.title !== 'string'
		|| !value.title.trim()
		|| value.title.length > 160
		|| typeof value.sourceRevision !== 'string'
		|| !value.sourceRevision
		|| value.sourceRevision.length > 128
		|| !Number.isSafeInteger(value.tokenEstimate)
		|| Number(value.tokenEstimate) < 1
		|| !chapterStatuses.includes(value.status as ManuscriptExtractionChapterStatus)
		|| (value.errorCode !== undefined
			&& !errorCodes.includes(value.errorCode as ManuscriptExtractionErrorCode))
		|| (value.startedAt !== undefined && !timestamp(value.startedAt))
		|| (value.completedAt !== undefined && !timestamp(value.completedAt))
		|| (value.candidateBatchId !== undefined
			&& (typeof value.candidateBatchId !== 'string' || !value.candidateBatchId))
		|| (value.candidateCount !== undefined
			&& (!Number.isSafeInteger(value.candidateCount) || Number(value.candidateCount) < 0))
		|| (value.conflictCount !== undefined
			&& (!Number.isSafeInteger(value.conflictCount) || Number(value.conflictCount) < 0))
	) {
		throw new Error('invalidManuscriptExtractionChapter');
	}
	return {
		resourceId: value.resourceId,
		title: value.title,
		sourceRevision: value.sourceRevision,
		tokenEstimate: Number(value.tokenEstimate),
		status: value.status as ManuscriptExtractionChapterStatus,
		...(typeof value.candidateBatchId === 'string'
			? { candidateBatchId: value.candidateBatchId }
			: {}),
		...(value.candidateCount === undefined
			? {}
			: { candidateCount: Number(value.candidateCount) }),
		...(value.conflictCount === undefined
			? {}
			: { conflictCount: Number(value.conflictCount) }),
		...(value.errorCode
			? { errorCode: value.errorCode as ManuscriptExtractionErrorCode }
			: {}),
		...(typeof value.startedAt === 'string' ? { startedAt: value.startedAt } : {}),
		...(typeof value.completedAt === 'string' ? { completedAt: value.completedAt } : {})
	};
}

function parseRun(value: unknown, now: string): ManuscriptExtractionRun {
	if (!isRecord(value)
		|| value.schemaVersion !== 1
		|| typeof value.id !== 'string'
		|| !/^extraction-run:[a-z0-9][a-z0-9-]*$/u.test(value.id)
		|| typeof value.instruction !== 'string'
		|| !value.instruction.trim()
		|| value.instruction.length > 2_000
		|| !Array.isArray(value.targetTypes)
		|| value.targetTypes.length === 0
		|| value.targetTypes.length > storyKernelGenerationResourceTypes.length
		|| !value.targetTypes.every(targetType)
		|| new Set(value.targetTypes).size !== value.targetTypes.length
		|| !runStatuses.includes(value.status as ManuscriptExtractionRunStatus)
		|| !Number.isSafeInteger(value.tokenEstimate)
		|| Number(value.tokenEstimate) < 1
		|| !Array.isArray(value.chapters)
		|| value.chapters.length === 0
		|| value.chapters.length > 1_000
		|| !timestamp(value.createdAt)
		|| !timestamp(value.updatedAt)
	) {
		throw new Error('invalidManuscriptExtractionRun');
	}
	const chapters = value.chapters.map(parseChapter);
	if (new Set(chapters.map(chapter => chapter.resourceId)).size !== chapters.length) {
		throw new Error('invalidManuscriptExtractionRun');
	}
	const interrupted = value.status === 'running'
		|| chapters.some(chapter => chapter.status === 'running');
	return {
		id: value.id,
		schemaVersion: 1,
		instruction: value.instruction,
		targetTypes: value.targetTypes,
		status: interrupted
			? 'stopped'
			: value.status as ManuscriptExtractionRunStatus,
		tokenEstimate: Number(value.tokenEstimate),
		chapters: chapters.map(chapter => chapter.status === 'running'
			? {
				...chapter,
				status: 'interrupted',
				errorCode: 'cancelled',
				completedAt: now
			}
			: chapter),
		createdAt: value.createdAt,
		updatedAt: interrupted ? now : value.updatedAt
	};
}

function parseFile(content: string, now: string): ManuscriptExtractionRunsFile {
	const value = JSON.parse(content) as unknown;
	if (!isRecord(value)
		|| value.schemaVersion !== 1
		|| !Array.isArray(value.runs)
		|| value.runs.length > 20
	) {
		throw new Error('invalidManuscriptExtractionRunsFile');
	}
	return {
		schemaVersion: 1,
		updatedAt: timestamp(value.updatedAt) ? value.updatedAt : new Date(0).toISOString(),
		runs: value.runs.map(run => parseRun(run, now))
	};
}

function serializeFile(runs: readonly ManuscriptExtractionRun[]): string {
	return `${JSON.stringify({
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		runs
	}, undefined, 2)}\n`;
}

export function extractionErrorCode(reason: unknown): ManuscriptExtractionErrorCode {
	const value = reason instanceof Error ? reason.message : String(reason);
	if (errorCodes.includes(value as ManuscriptExtractionErrorCode)) {
		return value as ManuscriptExtractionErrorCode;
	}
	if (value === '生成已取消。' || value === 'AI 生成已取消。') return 'cancelled';
	if (
		value.startsWith('invalidStoryKernelGeneration')
		|| value.startsWith('invalid_type')
		|| value.includes('JSON')
	) {
		return 'invalid-response';
	}
	return 'unknown';
}

export function createManuscriptExtractionRun(input: {
	readonly instruction: string;
	readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	readonly sources: readonly ManuscriptExtractionSource[];
	readonly now?: string;
	readonly id?: string;
}): ManuscriptExtractionRun {
	const instruction = input.instruction.trim();
	const targetTypes = [...new Set(input.targetTypes)];
	const now = input.now ?? new Date().toISOString();
	if (!instruction
		|| instruction.length > 2_000
		|| targetTypes.length === 0
		|| targetTypes.length !== input.targetTypes.length
		|| targetTypes.some(type => !storyKernelGenerationResourceTypes.includes(type))
		|| input.sources.length === 0
		|| input.sources.length > 1_000
		|| new Set(input.sources.map(source => source.resourceId)).size !== input.sources.length
	) {
		throw new Error('invalidManuscriptExtractionPlan');
	}
	const chapters = input.sources.map(source => {
		if (!chapterResourceId(source.resourceId)
			|| !source.title.trim()
			|| source.title.length > 160
			|| !source.sourceRevision
			|| source.sourceRevision.length > 128
			|| !source.content.trim()
			|| source.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		) {
			throw new Error('invalidManuscriptExtractionSource');
		}
		return {
			resourceId: source.resourceId,
			title: source.title,
			sourceRevision: source.sourceRevision,
			tokenEstimate: estimateContextTokens(`${instruction}\n${source.content}`),
			status: 'queued' as const
		};
	});
	return {
		id: input.id ?? `extraction-run:${crypto.randomUUID()}`,
		schemaVersion: 1,
		instruction,
		targetTypes,
		status: 'planned',
		tokenEstimate: chapters.reduce((total, chapter) => total + chapter.tokenEstimate, 0),
		chapters,
		createdAt: now,
		updatedAt: now
	};
}

export async function planManuscriptExtractionRun(input: {
	readonly instruction: string;
	readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	readonly chapters: readonly ManuscriptExtractionSourceDescriptor[];
	readonly loadSource: (resourceId: string) => Promise<ManuscriptExtractionSource>;
	readonly onChapterPlanned?: (completed: number, total: number) => void;
	readonly now?: string;
	readonly id?: string;
}): Promise<ManuscriptExtractionRun> {
	const instruction = input.instruction.trim();
	const targetTypes = [...new Set(input.targetTypes)];
	if (!instruction
		|| instruction.length > 2_000
		|| targetTypes.length === 0
		|| targetTypes.length !== input.targetTypes.length
		|| input.chapters.length === 0
		|| input.chapters.length > 1_000
		|| new Set(input.chapters.map(chapter => chapter.resourceId)).size
			!== input.chapters.length
	) {
		throw new Error('invalidManuscriptExtractionPlan');
	}
	const planned: ManuscriptExtractionChapter[] = [];
	for (const [index, descriptor] of input.chapters.entries()) {
		const source = await input.loadSource(descriptor.resourceId);
		const [validated] = createManuscriptExtractionRun({
			instruction,
			targetTypes,
			sources: [source],
			now: input.now,
			id: input.id ?? 'extraction-run:planning'
		}).chapters;
		if (!validated
			|| validated.resourceId !== descriptor.resourceId
			|| source.title !== descriptor.title
		) {
			throw new Error('invalidManuscriptExtractionSource');
		}
		planned.push(validated);
		input.onChapterPlanned?.(index + 1, input.chapters.length);
	}
	const now = input.now ?? new Date().toISOString();
	return {
		id: input.id ?? `extraction-run:${crypto.randomUUID()}`,
		schemaVersion: 1,
		instruction,
		targetTypes,
		status: 'planned',
		tokenEstimate: planned.reduce((total, chapter) => total + chapter.tokenEstimate, 0),
		chapters: planned,
		createdAt: now,
		updatedAt: now
	};
}

export class ManuscriptExtractionRunStore {
	private hash: string | undefined;
	private runs: readonly ManuscriptExtractionRun[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: ManuscriptExtractionStoragePort
	) {}

	async load(now = new Date().toISOString()): Promise<readonly ManuscriptExtractionRun[]> {
		try {
			const file = await this.storage.readText(
				this.projectRoot,
				MANUSCRIPT_EXTRACTION_RUNS_PATH
			);
			const parsed = parseFile(file.content, now);
			this.hash = file.hash;
			this.runs = parsed.runs;
		} catch (reason) {
			if (reason instanceof SyntaxError
				|| (reason instanceof Error
					&& reason.message.startsWith('invalidManuscriptExtraction'))
			) {
				throw reason;
			}
			this.hash = '';
			this.runs = [];
		}
		return this.runs;
	}

	async save(
		runs: readonly ManuscriptExtractionRun[]
	): Promise<readonly ManuscriptExtractionRun[]> {
		if (this.hash === undefined) await this.load();
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: MANUSCRIPT_EXTRACTION_RUNS_PATH,
			content: serializeFile(runs.slice(-20)),
			expectedHash: this.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
		this.hash = result.hash;
		this.runs = runs.slice(-20);
		return this.runs;
	}

	async append(run: ManuscriptExtractionRun): Promise<ManuscriptExtractionRun> {
		const current = this.hash === undefined ? await this.load() : this.runs;
		await this.save([...current, run]);
		return run;
	}

	async replace(run: ManuscriptExtractionRun): Promise<ManuscriptExtractionRun> {
		const current = this.hash === undefined ? await this.load() : this.runs;
		if (!current.some(candidate => candidate.id === run.id)) {
			throw new Error('manuscriptExtractionRunNotFound');
		}
		await this.save(current.map(candidate => candidate.id === run.id ? run : candidate));
		return run;
	}
}

function replaceChapter(
	run: ManuscriptExtractionRun,
	resourceId: string,
	update: (chapter: ManuscriptExtractionChapter) => ManuscriptExtractionChapter,
	now: string
): ManuscriptExtractionRun {
	return {
		...run,
		chapters: run.chapters.map(chapter => (
			chapter.resourceId === resourceId ? update(chapter) : chapter
		)),
		updatedAt: now
	};
}

function finishStatus(
	run: ManuscriptExtractionRun,
	stopped: boolean
): ManuscriptExtractionRunStatus {
	if (stopped) return 'stopped';
	if (run.chapters.every(chapter => chapter.status === 'completed')) return 'completed';
	return run.chapters.some(chapter => ['failed', 'cancelled', 'stale'].includes(chapter.status))
		? 'completed-with-errors'
		: 'stopped';
}

export class ManuscriptExtractionRunner {
	private stopRequested = false;
	private activeCancel?: () => Promise<void>;

	constructor(private readonly store: ManuscriptExtractionRunStore) {}

	async stop(): Promise<void> {
		this.stopRequested = true;
		await this.activeCancel?.();
	}

	async run(input: {
		readonly runId: string;
		readonly loadSource: (resourceId: string) => Promise<ManuscriptExtractionSource>;
		readonly processChapter: ManuscriptExtractionProcessor;
		readonly onUpdate?: (run: ManuscriptExtractionRun) => void;
		readonly now?: () => string;
	}): Promise<ManuscriptExtractionRun> {
		const now = input.now ?? (() => new Date().toISOString());
		const runs = await this.store.load();
		let run = runs.find(candidate => candidate.id === input.runId);
		if (!run) throw new Error('manuscriptExtractionRunNotFound');
		if (run.status === 'completed') return run;
		this.stopRequested = false;
		run = { ...run, status: 'running', updatedAt: now() };
		await this.store.replace(run);
		input.onUpdate?.(run);

		for (const chapter of run.chapters) {
			if (this.stopRequested) break;
			if (chapter.status === 'completed' || chapter.status === 'stale') continue;
			const startedAt = now();
			run = replaceChapter(run, chapter.resourceId, current => ({
				...current,
				status: 'running',
				startedAt,
				completedAt: undefined,
				errorCode: undefined
			}), startedAt);
			await this.store.replace(run);
			input.onUpdate?.(run);
			try {
				const source = await input.loadSource(chapter.resourceId);
				if (source.sourceRevision !== chapter.sourceRevision) {
					throw new Error('stale-source');
				}
				const result = await input.processChapter({
					run,
					chapter,
					source,
					onActiveCancel: cancel => {
						this.activeCancel = cancel;
					},
					onStreamProgress: () => {
						// Stream deltas deliberately stay out of the persisted ledger.
					}
				});
				const completedAt = now();
				run = replaceChapter(run, chapter.resourceId, current => ({
					...current,
					status: 'completed',
					candidateBatchId: result.candidateBatchId,
					candidateCount: result.candidateCount,
					conflictCount: result.conflictCount,
					errorCode: undefined,
					completedAt
				}), completedAt);
			} catch (reason) {
				const completedAt = now();
				const code = this.stopRequested ? 'cancelled' : extractionErrorCode(reason);
				run = replaceChapter(run, chapter.resourceId, current => ({
					...current,
					status: code === 'stale-source'
						? 'stale'
						: code === 'cancelled'
							? 'cancelled'
							: 'failed',
					errorCode: code,
					completedAt
				}), completedAt);
			} finally {
				this.activeCancel = undefined;
			}
			await this.store.replace(run);
			input.onUpdate?.(run);
		}
		const completedAt = now();
		run = {
			...run,
			status: finishStatus(run, this.stopRequested),
			updatedAt: completedAt
		};
		await this.store.replace(run);
		input.onUpdate?.(run);
		return run;
	}

	async refreshChapterSource(
		runId: string,
		source: ManuscriptExtractionSource,
		now = new Date().toISOString()
	): Promise<ManuscriptExtractionRun> {
		const runs = await this.store.load();
		const run = runs.find(candidate => candidate.id === runId);
		if (!run) throw new Error('manuscriptExtractionRunNotFound');
		if (!run.chapters.some(chapter => chapter.resourceId === source.resourceId)) {
			throw new Error('manuscriptExtractionChapterNotFound');
		}
		if (!source.content.trim() || source.content.length > AI_CHAPTER_REVIEW_MAX_CHARS) {
			throw new Error('invalidManuscriptExtractionSource');
		}
		const refreshed = replaceChapter(run, source.resourceId, chapter => ({
			...chapter,
			title: source.title,
			sourceRevision: source.sourceRevision,
			tokenEstimate: estimateContextTokens(`${run.instruction}\n${source.content}`),
			status: 'queued',
			errorCode: undefined,
			candidateBatchId: undefined,
			candidateCount: undefined,
			conflictCount: undefined,
			startedAt: undefined,
			completedAt: undefined
		}), now);
		const next = {
			...refreshed,
			status: 'stopped' as const,
			tokenEstimate: refreshed.chapters.reduce(
				(total, chapter) => total + chapter.tokenEstimate,
				0
			)
		};
		return this.store.replace(next);
	}
}
