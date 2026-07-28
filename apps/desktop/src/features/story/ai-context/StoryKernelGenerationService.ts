import {
	parseStoryKernelGenerationResponse,
	storyKernelGenerationResourceTypes,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import type { TextFile } from '@writing-buddy/domain';
import { ZodError } from 'zod';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	StorySchemaRegistry,
	StoryTransaction,
	createStoryId,
	parseEvidenceRef,
	parseStoryId,
	type EvidenceRef,
	type StoryId,
	type StoryRepository,
	type StoryResource
} from '@writing-buddy/story-kernel';

export const STORY_KERNEL_GENERATIONS_PATH =
	'.writing-buddy/ai/story-kernel-generation/index.json';

export type StoryKernelGenerationCandidateStatus =
	| 'pending'
	| 'accepted'
	| 'rejected';

export type StoryKernelGenerationConflictCode =
	| 'target-type-not-selected'
	| 'duplicate-resource-id'
	| 'create-collision'
	| 'update-target-missing'
	| 'invalid-evidence'
	| 'invalid-schema'
	| 'missing-reference'
	| 'blocked-dependency'
	| 'revision-conflict';

export interface StoryKernelGenerationConflict {
	readonly code: StoryKernelGenerationConflictCode;
	readonly message: string;
	readonly blocking: true;
	readonly details?: readonly StoryKernelGenerationConflictDetail[];
}

export interface StoryKernelGenerationConflictDetail {
	readonly path: string;
	readonly message: string;
	readonly expected?: string;
	readonly actual?: string;
}

export interface StoryKernelGenerationCandidate {
	readonly id: StoryId;
	readonly operation: 'create' | 'update';
	readonly resourceType: StoryKernelGenerationResourceType;
	readonly resourceId: StoryId;
	readonly title: string;
	readonly rawResource: Readonly<Record<string, unknown>>;
	readonly normalizedResource?: StoryResource;
	readonly expectedRevision?: number;
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence?: EvidenceRef;
	readonly conflicts: readonly StoryKernelGenerationConflict[];
	readonly status: StoryKernelGenerationCandidateStatus;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface StoryKernelGenerationBatch {
	readonly id: StoryId;
	readonly schemaVersion: 1;
	readonly sourceResourceId: StoryId;
	readonly sourceRevision: string;
	readonly baseOffset: number;
	readonly instruction: string;
	readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	readonly candidates: readonly StoryKernelGenerationCandidate[];
	readonly createdAt: string;
	readonly updatedAt: string;
}

interface StoryKernelGenerationFile {
	readonly schemaVersion: 1;
	readonly updatedAt: string;
	readonly batches: readonly StoryKernelGenerationBatch[];
}

export interface StoryKernelGenerationStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, code: string): string {
	if (typeof value !== 'string') throw new Error(code);
	return value;
}

function canonicalTimestamp(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function generationType(value: unknown): StoryKernelGenerationResourceType {
	if (
		typeof value !== 'string'
		|| !storyKernelGenerationResourceTypes.includes(
			value as StoryKernelGenerationResourceType
		)
	) {
		throw new Error('invalidStoryKernelGenerationType');
	}
	return value as StoryKernelGenerationResourceType;
}

function parseConflict(value: unknown): StoryKernelGenerationConflict {
	if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
		throw new Error('invalidStoryKernelGenerationConflict');
	}
	const codes: readonly StoryKernelGenerationConflictCode[] = [
		'target-type-not-selected',
		'duplicate-resource-id',
		'create-collision',
		'update-target-missing',
		'invalid-evidence',
		'invalid-schema',
		'missing-reference',
		'blocked-dependency',
		'revision-conflict'
	];
	if (!codes.includes(value.code as StoryKernelGenerationConflictCode)) {
		throw new Error('invalidStoryKernelGenerationConflict');
	}
	const details = value.details;
	if (details !== undefined && !Array.isArray(details)) {
		throw new Error('invalidStoryKernelGenerationConflict');
	}
	const parsedDetails = details?.map(detail => {
		if (
			!isRecord(detail)
			|| typeof detail.path !== 'string'
			|| typeof detail.message !== 'string'
			|| (detail.expected !== undefined && typeof detail.expected !== 'string')
			|| (detail.actual !== undefined && typeof detail.actual !== 'string')
		) {
			throw new Error('invalidStoryKernelGenerationConflict');
		}
		return {
			path: detail.path,
			message: detail.message,
			...(detail.expected === undefined ? {} : { expected: detail.expected }),
			...(detail.actual === undefined ? {} : { actual: detail.actual })
		};
	});
	return {
		code: value.code as StoryKernelGenerationConflictCode,
		message: value.message,
		blocking: true,
		...(parsedDetails?.length ? { details: parsedDetails } : {})
	};
}

function parseCandidate(value: unknown): StoryKernelGenerationCandidate {
	if (!isRecord(value) || !isRecord(value.rawResource)) {
		throw new Error('invalidStoryKernelGenerationCandidate');
	}
	const resourceType = generationType(value.resourceType);
	const status = value.status;
	if (
		!['create', 'update'].includes(String(value.operation))
		|| !['pending', 'accepted', 'rejected'].includes(String(status))
		|| typeof value.title !== 'string'
		|| typeof value.rationale !== 'string'
		|| typeof value.confidence !== 'number'
		|| value.confidence < 0
		|| value.confidence > 1
		|| !Array.isArray(value.conflicts)
		|| !canonicalTimestamp(value.createdAt)
		|| !canonicalTimestamp(value.updatedAt)
	) {
		throw new Error('invalidStoryKernelGenerationCandidate');
	}
	const expectedRevision = value.expectedRevision;
	if (
		expectedRevision !== undefined
		&& (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0)
	) {
		throw new Error('invalidStoryKernelGenerationCandidate');
	}
	const normalizedResource = value.normalizedResource === undefined
		? undefined
		: StorySchemaRegistry.parse(resourceType, value.normalizedResource);
	const evidence = value.evidence === undefined
		? undefined
		: parseEvidenceRef(value.evidence as Parameters<typeof parseEvidenceRef>[0]);
	return {
		id: parseStoryId(requiredString(value.id, 'invalidStoryKernelGenerationCandidate')),
		operation: value.operation as 'create' | 'update',
		resourceType,
		resourceId: parseStoryId(requiredString(
			value.resourceId,
			'invalidStoryKernelGenerationCandidate'
		)),
		title: value.title,
		rawResource: value.rawResource,
		...(normalizedResource ? { normalizedResource } : {}),
		...(expectedRevision === undefined
			? {}
			: { expectedRevision: Number(expectedRevision) }),
		confidence: value.confidence,
		rationale: value.rationale,
		...(evidence ? { evidence } : {}),
		conflicts: value.conflicts.map(parseConflict),
		status: status as StoryKernelGenerationCandidateStatus,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt
	};
}

function parseBatch(value: unknown): StoryKernelGenerationBatch {
	if (
		!isRecord(value)
		|| value.schemaVersion !== 1
		|| !Array.isArray(value.targetTypes)
		|| !Array.isArray(value.candidates)
		|| typeof value.sourceRevision !== 'string'
		|| typeof value.instruction !== 'string'
		|| !Number.isSafeInteger(value.baseOffset)
		|| Number(value.baseOffset) < 0
		|| !canonicalTimestamp(value.createdAt)
		|| !canonicalTimestamp(value.updatedAt)
	) {
		throw new Error('invalidStoryKernelGenerationBatch');
	}
	return {
		id: parseStoryId(requiredString(value.id, 'invalidStoryKernelGenerationBatch')),
		schemaVersion: 1,
		sourceResourceId: parseStoryId(requiredString(
			value.sourceResourceId,
			'invalidStoryKernelGenerationBatch'
		)),
		sourceRevision: value.sourceRevision,
		baseOffset: Number(value.baseOffset),
		instruction: value.instruction,
		targetTypes: value.targetTypes.map(generationType),
		candidates: value.candidates.map(parseCandidate),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt
	};
}

function parseGenerationFile(content: string): StoryKernelGenerationFile {
	const value = JSON.parse(content) as unknown;
	if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.batches)) {
		throw new Error('invalidStoryKernelGenerationFile');
	}
	return {
		schemaVersion: 1,
		updatedAt: canonicalTimestamp(value.updatedAt)
			? value.updatedAt
			: new Date(0).toISOString(),
		batches: value.batches.map(parseBatch)
	};
}

function serializeGenerationFile(
	batches: readonly StoryKernelGenerationBatch[]
): string {
	return `${JSON.stringify({
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		batches
	}, null, 2)}\n`;
}

export class StoryKernelGenerationStore {
	private hash: string | undefined;
	private batches: readonly StoryKernelGenerationBatch[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: StoryKernelGenerationStoragePort
	) {}

	async load(): Promise<readonly StoryKernelGenerationBatch[]> {
		try {
			const file = await this.storage.readText(
				this.projectRoot,
				STORY_KERNEL_GENERATIONS_PATH
			);
			const parsed = parseGenerationFile(file.content);
			this.hash = file.hash;
			this.batches = parsed.batches;
		} catch (reason) {
			if (
				reason instanceof SyntaxError
				|| (reason instanceof Error
					&& reason.message.startsWith('invalidStoryKernelGeneration'))
			) {
				throw reason;
			}
			this.hash = '';
			this.batches = [];
		}
		return this.batches;
	}

	async save(
		batches: readonly StoryKernelGenerationBatch[]
	): Promise<readonly StoryKernelGenerationBatch[]> {
		if (this.hash === undefined) await this.load();
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: STORY_KERNEL_GENERATIONS_PATH,
			content: serializeGenerationFile(batches),
			expectedHash: this.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
		this.hash = result.hash;
		this.batches = batches;
		return batches;
	}

	async append(batch: StoryKernelGenerationBatch): Promise<StoryKernelGenerationBatch> {
		const current = this.hash === undefined ? await this.load() : this.batches;
		await this.save([...current.slice(-49), batch]);
		return batch;
	}
}

function conflict(
	code: StoryKernelGenerationConflictCode,
	message: string,
	details?: readonly StoryKernelGenerationConflictDetail[]
): StoryKernelGenerationConflict {
	return {
		code,
		message,
		blocking: true,
		...(details?.length ? { details } : {})
	};
}

const schemaFieldLabels: Readonly<Record<string, string>> = {
	readerVisibility: '读者可见度',
	status: '状态',
	plantedAt: '埋设位置',
	reminderPositions: '提醒位置',
	plannedPayoffAt: '计划回收位置',
	actualPayoffAt: '实际回收位置',
	plotThreadIds: '剧情线引用',
	aliases: '别名',
	tags: '标签',
	evidenceIds: '证据引用'
};

function valueAtPath(
	value: unknown,
	path: readonly PropertyKey[]
): unknown {
	let current = value;
	for (const segment of path) {
		if (
			current === null
			|| typeof current !== 'object'
			|| !(segment in current)
		) {
			return undefined;
		}
		current = (current as Record<PropertyKey, unknown>)[segment];
	}
	return current;
}

function safeValuePreview(value: unknown): string | undefined {
	if (value === undefined) return '未提供';
	if (typeof value === 'bigint') return `${value.toString()}n`;
	if (typeof value === 'symbol') return value.description ? `Symbol(${value.description})` : 'Symbol';
	if (typeof value === 'function') return '[函数]';
	try {
		const serialized = JSON.stringify(value);
		if (serialized === undefined) return '[无法显示的值]';
		return serialized.length > 120 ? `${serialized.slice(0, 117)}…` : serialized;
	} catch {
		return '[无法序列化的值]';
	}
}

function schemaConflictDetails(
	reason: unknown,
	raw: Readonly<Record<string, unknown>>
): readonly StoryKernelGenerationConflictDetail[] {
	if (!(reason instanceof ZodError)) {
		return [];
	}
	return reason.issues.slice(0, 12).map(issue => {
		const path = issue.path.map(String).join('.') || '资源';
		const leaf = String(issue.path.at(-1) ?? '资源');
		const field = schemaFieldLabels[leaf] ?? path;
		const issueRecord = issue as unknown as {
			readonly code: string;
			readonly expected?: unknown;
			readonly values?: readonly unknown[];
			readonly minimum?: unknown;
			readonly maximum?: unknown;
		};
		const expected = leaf === 'readerVisibility'
			? '0–1 之间的数字'
			: issueRecord.code === 'invalid_value' && issueRecord.values?.length
				? issueRecord.values.map(String).join(' / ')
				: issueRecord.expected === 'string'
					? '文本'
					: issueRecord.expected === 'number'
						? '数字'
						: issueRecord.expected === 'array'
							? '列表'
							: issueRecord.expected === 'object'
								? '对象'
								: undefined;
		const message = leaf === 'readerVisibility'
			? '读者可见度不能使用“hidden”等文字；请改为 0（完全隐藏）到 1（完全可见）之间的数字。'
			: expected
				? `${field}需要使用${expected}。`
				: `${field}不符合 Story Kernel 约束：${issue.message}`;
		return {
			path,
			message,
			...(expected ? { expected } : {}),
			actual: safeValuePreview(valueAtPath(raw, issue.path)) ?? '未提供'
		};
	});
}

function anchorEvidence(input: {
	readonly content: string;
	readonly baseOffset: number;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly value: { readonly start: number; readonly end: number; readonly quote: string };
}): EvidenceRef | undefined {
	if (
		input.value.end <= input.value.start
		|| input.content.slice(input.value.start, input.value.end) !== input.value.quote
	) {
		return undefined;
	}
	return parseEvidenceRef({
		id: createStoryId('evidence'),
		origin: 'ai-extracted',
		resourceId: input.sourceResourceId,
		range: {
			start: input.baseOffset + input.value.start,
			end: input.baseOffset + input.value.end
		},
		revisionId: input.sourceRevision,
		quotePreview: input.value.quote,
		confirmedByAuthor: false
	});
}

function collectStoryReferences(
	value: unknown,
	key = '',
	output = new Set<string>()
): ReadonlySet<string> {
	if (Array.isArray(value)) {
		for (const item of value) collectStoryReferences(item, key, output);
		return output;
	}
	if (isRecord(value)) {
		for (const [childKey, child] of Object.entries(value)) {
			if (childKey === 'id' || childKey === 'evidenceIds' || childKey === 'revisionId') {
				continue;
			}
			collectStoryReferences(child, childKey, output);
		}
		return output;
	}
	if (
		typeof value === 'string'
		&& (key.endsWith('Id') || key.endsWith('Ids'))
		&& /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(value)
		&& !value.startsWith('evidence:')
	) {
		output.add(value);
	}
	return output;
}

function hydrateResource(input: {
	readonly raw: Readonly<Record<string, unknown>>;
	readonly resourceType: StoryKernelGenerationResourceType;
	readonly existing?: StoryResource;
	readonly evidence?: EvidenceRef;
	readonly now: string;
}): StoryResource {
	const evidenceIds = [
		...(input.existing?.evidenceIds ?? []),
		...(input.evidence ? [input.evidence.id] : [])
	].filter((id, index, values) => values.indexOf(id) === index);
	const payload: Record<string, unknown> = {
		...input.raw,
		schemaVersion: 1,
		createdAt: input.existing?.createdAt ?? input.now,
		updatedAt: input.now,
		revision: input.existing?.revision ?? 0,
		evidenceIds
	};
	if (input.resourceType === 'information' && payload.authorSecret === true) {
		payload.excludeFromAiByDefault = true;
	}
	return StorySchemaRegistry.parse(input.resourceType, payload);
}

async function loadCurrentResources(
	repository: StoryRepository
): Promise<readonly StoryResource[]> {
	const groups = await Promise.all(
		storyKernelGenerationResourceTypes.map(type => repository.list(type))
	);
	return groups.flat();
}

export async function loadStoryKernelGenerationIdentities(
	repository: StoryRepository
): Promise<readonly {
	readonly id: string;
	readonly type: StoryKernelGenerationResourceType;
	readonly title: string;
	readonly revision: number;
}[]> {
	const resources = await loadCurrentResources(repository);
	return resources
		.filter(resource => (
			resource.type !== 'information'
			|| !(resource.authorSecret || resource.excludeFromAiByDefault)
		))
		.map(resource => ({
			id: resource.id,
			type: resource.type as StoryKernelGenerationResourceType,
			title: resource.title,
			revision: resource.revision
		}));
}

export class StoryKernelGenerationService {
	constructor(
		private readonly store: StoryKernelGenerationStore,
		private readonly repository: StoryRepository
	) {}

	async stageFromResponse(input: {
		readonly instruction: string;
		readonly sourceResourceId: string;
		readonly sourceRevision: string;
		readonly content: string;
		readonly baseOffset?: number;
		readonly targetTypes: readonly StoryKernelGenerationResourceType[];
		readonly response: string;
		readonly now?: string;
	}): Promise<StoryKernelGenerationBatch> {
		const responses = parseStoryKernelGenerationResponse(input.response);
		const now = input.now ?? new Date().toISOString();
		const baseOffset = input.baseOffset ?? 0;
		const currentResources = await loadCurrentResources(this.repository);
		const currentById = new Map(currentResources.map(resource => [resource.id, resource]));
		const responseIds = responses.map(response => String(response.resource.id));
		const duplicateIds = new Set(
			responseIds.filter((id, index) => responseIds.indexOf(id) !== index)
		);
		const knownIds = new Set<string>([
			input.sourceResourceId,
			...currentResources.map(resource => resource.id),
			...responseIds
		]);

		const staged = responses.map(response => {
			const rawResource = response.resource;
			const resourceType = generationType(rawResource.type);
			const resourceId = parseStoryId(String(rawResource.id));
			const existing = currentById.get(resourceId);
			const conflicts: StoryKernelGenerationConflict[] = [];
			if (!input.targetTypes.includes(resourceType)) {
				conflicts.push(conflict(
					'target-type-not-selected',
					`AI 返回了未勾选的 ${resourceType} 类型。`
				));
			}
			if (duplicateIds.has(resourceId)) {
				conflicts.push(conflict(
					'duplicate-resource-id',
					`同一批次重复生成了 ${resourceId}。`
				));
			}
			if (response.operation === 'create' && existing) {
				conflicts.push(conflict(
					'create-collision',
					`${resourceId} 已存在，不能作为新资源创建。`
				));
			}
			if (response.operation === 'update' && !existing) {
				conflicts.push(conflict(
					'update-target-missing',
					`${resourceId} 不存在，不能执行更新。`
				));
			}
			const evidence = response.evidence
				? anchorEvidence({
					content: input.content,
					baseOffset,
					sourceResourceId: input.sourceResourceId,
					sourceRevision: input.sourceRevision,
					value: response.evidence
				})
				: undefined;
			if (response.evidence && !evidence) {
				conflicts.push(conflict(
					'invalid-evidence',
					'AI 返回的正文范围与引文不一致。'
				));
			}
			let normalizedResource: StoryResource | undefined;
			try {
				normalizedResource = hydrateResource({
					raw: rawResource,
					resourceType,
					...(existing ? { existing } : {}),
					...(evidence ? { evidence } : {}),
					now
				});
			} catch (reason) {
				conflicts.push(conflict(
					'invalid-schema',
					'字段结构不符合 Story Kernel，修正前无法确认写入。',
					schemaConflictDetails(reason, rawResource)
				));
			}
			for (const reference of collectStoryReferences(rawResource)) {
				if (!knownIds.has(reference)) {
					conflicts.push(conflict(
						'missing-reference',
						`引用的资源 ${reference} 不存在于项目或本批次。`
					));
				}
			}
			return {
				id: createStoryId('generation-candidate'),
				operation: response.operation,
				resourceType,
				resourceId,
				title: String(rawResource.title),
				rawResource,
				...(normalizedResource ? { normalizedResource } : {}),
				...(response.operation === 'update' && existing
					? { expectedRevision: existing.revision }
					: {}),
				confidence: response.confidence,
				rationale: response.rationale,
				...(evidence ? { evidence } : {}),
				conflicts,
				status: 'pending' as const,
				createdAt: now,
				updatedAt: now
			};
		});

		const candidateByResourceId = new Map(
			staged.map(candidate => [candidate.resourceId, candidate])
		);
		const candidates = staged.map(candidate => {
			const dependencyBlocked = [...collectStoryReferences(candidate.rawResource)]
				.some(reference => {
					const dependency = candidateByResourceId.get(reference as StoryId);
					return dependency && dependency.conflicts.length > 0;
				});
			if (!dependencyBlocked) return candidate;
			return {
				...candidate,
				conflicts: [
					...candidate.conflicts,
					conflict(
						'blocked-dependency',
						'该资源依赖本批次中另一个被阻止的候选。'
					)
				]
			};
		});
		const batch: StoryKernelGenerationBatch = {
			id: createStoryId('generation-batch'),
			schemaVersion: 1,
			sourceResourceId: parseStoryId(input.sourceResourceId),
			sourceRevision: input.sourceRevision,
			baseOffset,
			instruction: input.instruction.trim(),
			targetTypes: [...input.targetTypes],
			candidates,
			createdAt: now,
			updatedAt: now
		};
		return this.store.append(batch);
	}

	async confirm(
		batchId: string,
		candidateIds: readonly string[],
		now = new Date().toISOString()
	): Promise<StoryKernelGenerationBatch> {
		if (candidateIds.length === 0 || new Set(candidateIds).size !== candidateIds.length) {
			throw new Error('invalidStoryKernelGenerationSelection');
		}
		const batches = await this.store.load();
		const batch = batches.find(candidate => candidate.id === batchId);
		if (!batch) throw new Error('storyKernelGenerationBatchNotFound');
		const selectedIds = new Set(candidateIds);
		const selected = batch.candidates.filter(candidate => selectedIds.has(candidate.id));
		if (selected.length !== selectedIds.size) {
			throw new Error('storyKernelGenerationCandidateNotFound');
		}
		if (selected.some(candidate => (
			candidate.status !== 'pending'
			|| candidate.conflicts.length > 0
			|| !candidate.normalizedResource
		))) {
			throw new Error('storyKernelGenerationCandidateBlocked');
		}
		const transaction = new StoryTransaction(this.repository);
		for (const candidate of selected) {
			const current = await this.repository.get(
				candidate.resourceType,
				candidate.resourceId
			);
			if (candidate.operation === 'create' && current) {
				throw new Error('storyKernelGenerationCreateCollision');
			}
			if (
				candidate.operation === 'update'
				&& (!current || current.revision !== candidate.expectedRevision)
			) {
				throw new Error('storyKernelGenerationRevisionConflict');
			}
			transaction.stage(
				candidate.normalizedResource,
				candidate.expectedRevision,
				candidate.operation === 'create'
			);
		}
		const committed = await transaction.commit();
		const committedById = new Map(committed.map(resource => [resource.id, resource]));
		const updatedBatch: StoryKernelGenerationBatch = {
			...batch,
			candidates: batch.candidates.map(candidate => {
				if (!selectedIds.has(candidate.id)) return candidate;
				const committedResource = committedById.get(candidate.resourceId);
				const evidence = candidate.evidence
					? parseEvidenceRef({
						...candidate.evidence,
						confirmedByAuthor: true,
						confirmedAt: now
					})
					: undefined;
				return {
					...candidate,
					...(committedResource ? { normalizedResource: committedResource } : {}),
					...(evidence ? { evidence } : {}),
					status: 'accepted' as const,
					updatedAt: now
				};
			}),
			updatedAt: now
		};
		await this.store.save(
			batches.map(candidate => candidate.id === batch.id ? updatedBatch : candidate)
		);
		return updatedBatch;
	}

	async reject(
		batchId: string,
		candidateId: string,
		now = new Date().toISOString()
	): Promise<StoryKernelGenerationBatch> {
		const batches = await this.store.load();
		const batch = batches.find(candidate => candidate.id === batchId);
		if (!batch) throw new Error('storyKernelGenerationBatchNotFound');
		const candidate = batch.candidates.find(item => item.id === candidateId);
		if (!candidate) throw new Error('storyKernelGenerationCandidateNotFound');
		if (candidate.status !== 'pending') {
			throw new Error('storyKernelGenerationCandidateResolved');
		}
		const updated: StoryKernelGenerationBatch = {
			...batch,
			candidates: batch.candidates.map(item => item.id === candidateId
				? { ...item, status: 'rejected' as const, updatedAt: now }
				: item),
			updatedAt: now
		};
		await this.store.save(
			batches.map(item => item.id === batchId ? updated : item)
		);
		return updated;
	}
}
