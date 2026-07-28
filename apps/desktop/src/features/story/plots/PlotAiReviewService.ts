import type {
	GroundedCandidateEvidence,
	PlotAnalysisActionType,
	PlotAnalysisCandidateResponse
} from '@writing-buddy/ai';
import {
	createStoryId,
	parseEvidenceRef,
	parseForeshadowing,
	parsePlotThread,
	runPlotRules,
	type EvidenceRef,
	type Foreshadowing,
	type PlotThread,
	type RuleIssue,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type { TimelineReviewSource } from '../timeline/TimelineAiReviewService';

export type PlotReviewResource = PlotThread | Foreshadowing;

export interface PlotReviewCandidate {
	readonly id: string;
	readonly stagedResourceId: string;
	readonly response: PlotAnalysisCandidateResponse;
	readonly evidence?: EvidenceRef;
	readonly matchedResourceId?: string;
	readonly expectedRevision?: number;
	readonly conflicts: readonly string[];
	readonly localIssues: readonly RuleIssue[];
	readonly duplicateCount: number;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface PlotReviewBatch {
	readonly id: string;
	readonly actionType: PlotAnalysisActionType;
	readonly includeAuthorSecrets: boolean;
	readonly sources: readonly TimelineReviewSource[];
	readonly candidates: readonly PlotReviewCandidate[];
	readonly currentNarrativeOrder: number;
	readonly createdAt: string;
}

function normalizeName(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function candidateNames(response: PlotAnalysisCandidateResponse): ReadonlySet<string> {
	return new Set([response.title, ...response.aliases].map(normalizeName).filter(Boolean));
}

function resourceNames(resource: PlotReviewResource): ReadonlySet<string> {
	return new Set([resource.title, ...resource.aliases].map(normalizeName).filter(Boolean));
}

function intersects(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
	return [...left].some(value => right.has(value));
}

function anchorEvidence(
	evidence: GroundedCandidateEvidence | null,
	source?: TimelineReviewSource
): EvidenceRef | undefined {
	if (
		!evidence
		|| !source
		|| evidence.end <= evidence.start
		|| evidence.end > source.content.length
		|| source.content.slice(evidence.start, evidence.end) !== evidence.quote
	) return undefined;
	return parseEvidenceRef({
		id: createStoryId('evidence'),
		origin: 'ai-extracted',
		resourceId: source.resourceId,
		range: { start: evidence.start, end: evidence.end },
		revisionId: source.revision,
		quotePreview: evidence.quote,
		confirmedByAuthor: false
	});
}

function meaningful(value: unknown): boolean {
	return value !== undefined
		&& value !== null
		&& value !== ''
		&& (!Array.isArray(value) || value.length > 0);
}

function conflictsFor(
	current: PlotReviewResource | undefined,
	response: PlotAnalysisCandidateResponse
): readonly string[] {
	if (!current || current.type !== response.kind) return [];
	const pairs: readonly [string, unknown, unknown][] = response.kind === 'plotThread'
		? (() => {
			const thread = current as PlotThread;
			return [
				['摘要', thread.summary, response.summary],
				['生命周期', thread.status, response.status],
				['前提', thread.premise, response.premise],
				['赌注', thread.stakes, response.stakes],
				['戏剧问题', thread.dramaticQuestion, response.dramaticQuestion],
				['计划解决位置', thread.targetResolution, response.targetResolution],
				['人物', thread.participantIds, response.participantIds],
				['场景', thread.sceneIds, response.sceneIds]
			];
		})()
		: (() => {
			const clue = current as Foreshadowing;
			return [
				['摘要', clue.summary, response.summary],
				['生命周期', clue.status, response.status],
				['表面含义', clue.surfaceMeaning, response.surfaceMeaning],
				['真实含义', clue.trueMeaning, response.trueMeaning],
				['提醒位置', clue.reminderPositions, response.reminderPositions],
				['计划回收', clue.plannedPayoffAt, response.plannedPayoffAt],
				['实际回收', clue.actualPayoffAt, response.actualPayoffAt],
				['剧情线', clue.plotThreadIds, response.plotThreadIds]
			];
		})();
	return pairs.flatMap(([label, existing, next]) => (
		meaningful(existing) && JSON.stringify(existing) !== JSON.stringify(next)
			? [`${label}与已有资料不同，选择后将显式合并候选值。`]
			: []
	));
}

function resourceFromCandidate(
	candidate: Pick<PlotReviewCandidate, 'stagedResourceId' | 'response' | 'evidence'>,
	current?: PlotReviewResource,
	now = new Date().toISOString()
): PlotReviewResource {
	const response = candidate.response;
	const evidenceIds = [
		...(current?.evidenceIds ?? []),
		...(candidate.evidence ? [candidate.evidence.id] : [])
	].filter((id, index, values) => values.indexOf(id) === index);
	const base = {
		...(current ?? {
			id: candidate.stagedResourceId,
			type: response.kind,
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			revision: 0
		}),
		title: response.title,
		aliases: response.aliases,
		summary: response.summary,
		updatedAt: now,
		evidenceIds
	};
	if (response.kind === 'plotThread') {
		return parsePlotThread({
			...base,
			type: 'plotThread',
			status: response.status,
			premise: response.premise,
			stakes: response.stakes,
			dramaticQuestion: response.dramaticQuestion,
			startPosition: response.startPosition ?? undefined,
			targetResolution: response.targetResolution ?? undefined,
			actualResolution: response.actualResolution ?? undefined,
			participantIds: response.participantIds,
			sceneIds: response.sceneIds
		} as never);
	}
	return parseForeshadowing({
		...base,
		type: 'foreshadowing',
		status: response.status,
		plantedAt: response.plantedAt ?? undefined,
		surfaceMeaning: response.surfaceMeaning,
		trueMeaning: response.trueMeaning ?? undefined,
		reminderPositions: response.reminderPositions,
		plannedPayoffAt: response.plannedPayoffAt ?? undefined,
		actualPayoffAt: response.actualPayoffAt ?? undefined,
		readerVisibility: response.readerVisibility,
		plotThreadIds: response.plotThreadIds
	} as never);
}

function relatedIssues(
	resource: PlotReviewResource,
	threads: readonly PlotThread[],
	foreshadowing: readonly Foreshadowing[],
	currentOrder: number
): readonly RuleIssue[] {
	return runPlotRules(threads, foreshadowing, currentOrder)
		.filter(issue => issue.evidence.some(item => item.eventId === resource.id));
}

export function stagePlotReviewBatch(input: {
	readonly actionType: PlotAnalysisActionType;
	readonly includeAuthorSecrets: boolean;
	readonly sources: readonly TimelineReviewSource[];
	readonly threads: readonly PlotThread[];
	readonly foreshadowing: readonly Foreshadowing[];
	readonly responses: readonly PlotAnalysisCandidateResponse[];
	readonly currentNarrativeOrder: number;
	readonly now?: string;
}): PlotReviewBatch {
	const sources = new Map(input.sources.map(source => [source.resourceId, source]));
	const groups: {
		response: PlotAnalysisCandidateResponse;
		responses: PlotAnalysisCandidateResponse[];
	}[] = [];
	for (const response of input.responses) {
		const group = groups.find(candidate => (
			candidate.response.kind === response.kind
			&& intersects(candidateNames(candidate.response), candidateNames(response))
		));
		if (group) group.responses.push(response);
		else groups.push({ response, responses: [response] });
	}
	const candidates = groups.map(group => {
		const resources: readonly PlotReviewResource[] = group.response.kind === 'plotThread'
			? input.threads
			: input.foreshadowing;
		const matched = resources.find(resource => (
			intersects(resourceNames(resource), candidateNames(group.response))
		));
		const stagedResourceId = matched?.id ?? createStoryId(
			group.response.kind === 'plotThread' ? 'plot-thread' : 'foreshadowing'
		);
		const evidence = anchorEvidence(
			group.response.evidence,
			sources.get(group.response.sourceResourceId)
		);
		const conflicts = conflictsFor(matched, group.response);
		const preview = resourceFromCandidate({
			stagedResourceId,
			response: group.response,
			evidence
		}, matched);
		const threads = preview.type === 'plotThread'
			? [...input.threads.filter(thread => thread.id !== matched?.id), preview]
			: input.threads;
		const clues = preview.type === 'foreshadowing'
			? [...input.foreshadowing.filter(clue => clue.id !== matched?.id), preview]
			: input.foreshadowing;
		const localIssues = relatedIssues(
			preview,
			threads,
			clues,
			input.currentNarrativeOrder
		);
		const extraction = input.actionType === 'extract-plot-progress'
			|| input.actionType === 'extract-foreshadowing';
		const blocking = (group.response.evidence !== null && !evidence)
			|| (extraction && !evidence);
		return {
			id: `plot-candidate:${crypto.randomUUID()}`,
			stagedResourceId,
			response: group.response,
			...(evidence ? { evidence } : {}),
			...(matched ? {
				matchedResourceId: matched.id,
				expectedRevision: matched.revision
			} : {}),
			conflicts,
			localIssues,
			duplicateCount: group.responses.length - 1,
			blocking,
			selectedByDefault: !blocking && conflicts.length === 0,
			status: 'candidate' as const
		};
	});
	return {
		id: `plot-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		includeAuthorSecrets: input.includeAuthorSecrets,
		sources: input.sources,
		candidates,
		currentNarrativeOrder: input.currentNarrativeOrder,
		createdAt: input.now ?? new Date().toISOString()
	};
}

function confirmedEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

export class PlotAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async applyBatch(input: {
		readonly batch: PlotReviewBatch;
		readonly selectedCandidateIds: readonly string[];
		readonly currentSources: readonly TimelineReviewSource[];
		readonly now?: string;
	}): Promise<{
		readonly resources: readonly PlotReviewResource[];
		readonly acceptedCandidateIds: readonly string[];
	}> {
		const sourceById = new Map(
			input.currentSources.map(source => [source.resourceId, source])
		);
		if (input.batch.sources.some(source => {
			const current = sourceById.get(source.resourceId);
			return !current
				|| current.revision !== source.revision
				|| current.content !== source.content;
		})) throw new Error('stalePlotSource');
		const selectedIds = new Set(input.selectedCandidateIds);
		const candidates = input.batch.candidates.filter(candidate => selectedIds.has(candidate.id));
		if (
			candidates.length === 0
			|| candidates.length !== selectedIds.size
			|| candidates.some(candidate => candidate.blocking || candidate.status !== 'candidate')
		) throw new Error('invalidPlotSelection');

		const [threads, clues] = await Promise.all([
			this.repository.list('plotThread') as Promise<unknown>,
			this.repository.list('foreshadowing') as Promise<unknown>
		]) as [readonly PlotThread[], readonly Foreshadowing[]];
		const all: readonly PlotReviewResource[] = [...threads, ...clues];
		const currentById = new Map<string, PlotReviewResource>(
			all.map(resource => [resource.id, resource])
		);
		for (const candidate of candidates) {
			if (candidate.matchedResourceId) {
				const current = currentById.get(candidate.matchedResourceId);
				if (!current || current.revision !== candidate.expectedRevision) {
					throw new Error('stalePlotResource');
				}
			} else if (all.some(resource => (
				resource.type === candidate.response.kind
				&& intersects(resourceNames(resource), candidateNames(candidate.response))
			))) {
				throw new Error('plotNameCollision');
			}
		}
		const now = input.now ?? new Date().toISOString();
		const resources = candidates.map(candidate => {
			const current = candidate.matchedResourceId
				? currentById.get(candidate.matchedResourceId)
				: undefined;
			const evidence = candidate.evidence
				? confirmedEvidence(candidate.evidence, now)
				: undefined;
			return resourceFromCandidate({
				...candidate,
				...(evidence ? { evidence } : {})
			}, current, now);
		});
		const nextThreads = [
			...threads.filter(thread => !resources.some(resource => resource.id === thread.id)),
			...resources.filter((resource): resource is PlotThread => resource.type === 'plotThread')
		];
		const nextClues = [
			...clues.filter(clue => !resources.some(resource => resource.id === clue.id)),
			...resources.filter((resource): resource is Foreshadowing => (
				resource.type === 'foreshadowing'
			))
		];
		runPlotRules(nextThreads, nextClues, input.batch.currentNarrativeOrder);
		await this.createSnapshot(`AI 剧情资料 · ${resources.length} 条候选`);
		const saved = await this.repository.commit(resources.map(resource => {
			const current = currentById.get(resource.id);
			return current
				? { resource, expectedRevision: current.revision }
				: { resource, expectedAbsent: true };
		})) as unknown as readonly PlotReviewResource[];
		return {
			resources: saved,
			acceptedCandidateIds: candidates.map(candidate => candidate.id)
		};
	}
}
