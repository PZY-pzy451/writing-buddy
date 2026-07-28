import type {
	GroundedCandidateEvidence,
	TimelineAnalysisActionType,
	TimelineAnalysisCausalEdgeResponse,
	TimelineAnalysisCandidateResponse,
	TimelineAnalysisEndpointResponse
} from '@writing-buddy/ai';
import {
	createStoryId,
	parseEvidenceRef,
	parseTimelineEvent,
	runTimelineRules,
	type EvidenceRef,
	type RuleIssue,
	type StoryRepository,
	type TimelineEvent,
	type TravelLinkRule
} from '@writing-buddy/story-kernel';

export interface TimelineReviewSource {
	readonly resourceId: string;
	readonly revision: string;
	readonly content: string;
	readonly narrativeOrder: number;
}

export interface TimelineReviewCandidate {
	readonly id: string;
	readonly stagedEventId: string;
	readonly response: TimelineAnalysisCandidateResponse;
	readonly evidence?: EvidenceRef;
	readonly matchedEventId?: string;
	readonly expectedRevision?: number;
	readonly conflicts: readonly string[];
	readonly localIssues: readonly RuleIssue[];
	readonly duplicateCount: number;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface TimelineReviewEdge {
	readonly id: string;
	readonly fromEventId: string;
	readonly toEventId: string;
	readonly fromTitle: string;
	readonly toTitle: string;
	readonly relation: TimelineAnalysisCausalEdgeResponse['relation'];
	readonly confidence: number;
	readonly rationale: string;
	readonly conflict?: string;
	readonly blocking: boolean;
	readonly selectedByDefault: boolean;
}

export interface TimelineReviewBatch {
	readonly id: string;
	readonly actionType: TimelineAnalysisActionType;
	readonly sources: readonly TimelineReviewSource[];
	readonly candidates: readonly TimelineReviewCandidate[];
	readonly edges: readonly TimelineReviewEdge[];
	readonly createdAt: string;
}

function normalizeName(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function namesForEvent(event: TimelineEvent): ReadonlySet<string> {
	return new Set([event.title, ...event.aliases].map(normalizeName).filter(Boolean));
}

function namesForResponse(
	response: TimelineAnalysisCandidateResponse
): ReadonlySet<string> {
	return new Set([response.title, ...response.aliases].map(normalizeName).filter(Boolean));
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

function distinct(values: readonly string[]): readonly string[] {
	return values.filter((value, index) => values.indexOf(value) === index);
}

function candidateEvent(
	candidate: Pick<TimelineReviewCandidate, 'stagedEventId' | 'response' | 'evidence'>,
	existing?: TimelineEvent,
	now = new Date().toISOString()
): TimelineEvent {
	const response = candidate.response;
	return parseTimelineEvent({
		...(existing ?? {
			id: candidate.stagedEventId,
			type: 'timelineEvent' as const,
			tags: [],
			schemaVersion: 1,
			createdAt: now,
			revision: 0
		}),
		title: response.title,
		aliases: response.aliases,
		summary: response.summary,
		updatedAt: now,
		storyTimeKind: response.storyTimeKind,
		storyStart: response.storyStart ?? undefined,
		storyEnd: response.storyEnd ?? undefined,
		relativeTime: undefined,
		uncertainRange: undefined,
		narrativePosition: {
			chapterId: response.sourceResourceId,
			narrativeOrder: response.narrativeOrder
		},
		eventType: response.eventType,
		participantIds: response.participantIds,
		locationIds: response.locationIds,
		itemIds: response.itemIds,
		predecessorIds: response.predecessorIds,
		consequenceIds: response.consequenceIds,
		directResults: response.directResults,
		impacts: response.impacts,
		plotThreadIds: response.plotThreadIds,
		foreshadowingIds: response.foreshadowingIds,
		informationIds: existing?.informationIds ?? [],
		evidenceIds: distinct([
			...(existing?.evidenceIds ?? []),
			...(candidate.evidence ? [candidate.evidence.id] : [])
		])
	});
}

function meaningfulExistingValue(value: unknown): boolean {
	return value !== undefined
		&& value !== null
		&& value !== ''
		&& (!Array.isArray(value) || value.length > 0);
}

function eventConflicts(
	existing: TimelineEvent | undefined,
	response: TimelineAnalysisCandidateResponse
): readonly string[] {
	if (!existing) return [];
	const pairs: readonly [string, unknown, unknown][] = [
		['摘要', existing.summary, response.summary],
		['事件类型', existing.eventType, response.eventType],
		['实际开始', existing.storyStart, response.storyStart],
		['实际结束', existing.storyEnd, response.storyEnd],
		['人物', existing.participantIds, response.participantIds],
		['地点', existing.locationIds, response.locationIds],
		['物品', existing.itemIds, response.itemIds],
		['直接结果', existing.directResults, response.directResults],
		['后续影响', existing.impacts, response.impacts],
		['剧情线', existing.plotThreadIds, response.plotThreadIds],
		['伏笔', existing.foreshadowingIds, response.foreshadowingIds]
	];
	return pairs.flatMap(([label, current, next]) => (
		meaningfulExistingValue(current) && JSON.stringify(current) !== JSON.stringify(next)
			? [`${label}与已有事件不同，选择后将显式合并候选值。`]
			: []
	));
}

function endpointKey(endpoint: TimelineAnalysisEndpointResponse): string {
	return `${endpoint.kind}:${endpoint.id}`;
}

export function stageTimelineReviewBatch(input: {
	readonly actionType: TimelineAnalysisActionType;
	readonly sources: readonly TimelineReviewSource[];
	readonly events: readonly TimelineEvent[];
	readonly travelLinks?: readonly TravelLinkRule[];
	readonly responses: readonly TimelineAnalysisCandidateResponse[];
	readonly causalEdges: readonly TimelineAnalysisCausalEdgeResponse[];
	readonly now?: string;
}): TimelineReviewBatch {
	const sourceById = new Map(input.sources.map(source => [source.resourceId, source]));
	const groups: {
		response: TimelineAnalysisCandidateResponse;
		responses: TimelineAnalysisCandidateResponse[];
	}[] = [];
	for (const response of input.responses) {
		const names = namesForResponse(response);
		const group = groups.find(candidate => (
			candidate.response.sourceResourceId === response.sourceResourceId
			&& candidate.response.narrativeOrder === response.narrativeOrder
			&& intersects(namesForResponse(candidate.response), names)
		));
		if (group) group.responses.push(response);
		else groups.push({ response, responses: [response] });
	}
	const candidateIdToEventId = new Map<string, string>();
	const candidateIdToRepresentative = new Map<string, string>();
	const staged = groups.map(group => {
		const matched = input.events.find(event => (
			intersects(namesForEvent(event), namesForResponse(group.response))
		));
		const stagedEventId = matched?.id ?? createStoryId('timeline-event');
		for (const response of group.responses) {
			candidateIdToEventId.set(response.clientCandidateId, stagedEventId);
			candidateIdToRepresentative.set(
				response.clientCandidateId,
				group.response.clientCandidateId
			);
		}
		const source = sourceById.get(group.response.sourceResourceId);
		const evidence = anchorEvidence(group.response.evidence, source);
		const conflicts = eventConflicts(matched, group.response);
		const preview = candidateEvent({
			stagedEventId,
			response: group.response,
			evidence
		}, matched);
		const localIssues = runTimelineRules({
			events: [
				...input.events.filter(event => event.id !== matched?.id),
				preview
			],
			travelLinks: input.travelLinks ?? []
		}).filter(issue => issue.evidence.some(item => item.eventId === preview.id));
		const evidenceInvalid = group.response.evidence !== null && !evidence;
		const extractionMissing = input.actionType === 'extract-events' && !evidence;
		const blocking = evidenceInvalid
			|| extractionMissing
			|| localIssues.some(issue => issue.severity === 'error');
		return {
			id: group.response.clientCandidateId,
			stagedEventId,
			response: group.response,
			...(evidence ? { evidence } : {}),
			...(matched ? {
				matchedEventId: matched.id,
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
	const eventById = new Map<string, TimelineEvent>(
		input.events.map(event => [event.id, event])
	);
	const titleById = new Map<string, string>([
		...input.events.map(event => [event.id, event.title] as const),
		...staged.map(candidate => [candidate.stagedEventId, candidate.response.title] as const)
	]);
	const seenPairs = new Set<string>();
	const edges = input.causalEdges.map(edge => {
		const resolve = (endpoint: TimelineAnalysisEndpointResponse): string | undefined => (
			endpoint.kind === 'existing'
				? eventById.get(endpoint.id)?.id
				: candidateIdToEventId.get(endpoint.id)
		);
		const fromEventId = resolve(edge.from) ?? endpointKey(edge.from);
		const toEventId = resolve(edge.to) ?? endpointKey(edge.to);
		const pair = [fromEventId, toEventId].sort().join('|');
		const duplicate = seenPairs.has(pair)
			|| eventById.get(fromEventId)?.consequenceIds.some(id => id === toEventId)
			|| eventById.get(toEventId)?.predecessorIds.some(id => id === fromEventId);
		seenPairs.add(pair);
		const missing = !titleById.has(fromEventId) || !titleById.has(toEventId);
		const collapsed = edge.from.kind === 'candidate'
			&& edge.to.kind === 'candidate'
			&& candidateIdToRepresentative.get(edge.from.id)
				=== candidateIdToRepresentative.get(edge.to.id);
		const blocking = missing || fromEventId === toEventId || collapsed;
		const conflict = blocking
			? '因果边端点无效或在去重后指向同一事件。'
			: duplicate
				? '这条因果关系已存在或与本批次另一条边重复。'
				: undefined;
		return {
			id: edge.clientEdgeId,
			fromEventId,
			toEventId,
			fromTitle: titleById.get(fromEventId) ?? edge.from.id,
			toTitle: titleById.get(toEventId) ?? edge.to.id,
			relation: edge.relation,
			confidence: edge.confidence,
			rationale: edge.rationale,
			...(conflict ? { conflict } : {}),
			blocking,
			selectedByDefault: !blocking && !duplicate
		};
	});
	return {
		id: `timeline-batch:${crypto.randomUUID()}`,
		actionType: input.actionType,
		sources: input.sources,
		candidates: staged,
		edges,
		createdAt: input.now ?? new Date().toISOString()
	};
}

function confirmEvidence(evidence: EvidenceRef, now: string): EvidenceRef {
	return parseEvidenceRef({
		...evidence,
		confirmedByAuthor: true,
		confirmedAt: now
	});
}

export class TimelineAiReviewService {
	constructor(
		private readonly repository: StoryRepository,
		private readonly createSnapshot: (label: string) => Promise<unknown>
	) {}

	async applyBatch(input: {
		readonly batch: TimelineReviewBatch;
		readonly selectedCandidateIds: readonly string[];
		readonly selectedEdgeIds: readonly string[];
		readonly currentSources: readonly TimelineReviewSource[];
		readonly travelLinks?: readonly TravelLinkRule[];
		readonly now?: string;
	}): Promise<{
		readonly events: readonly TimelineEvent[];
		readonly acceptedCandidateIds: readonly string[];
		readonly acceptedEdgeIds: readonly string[];
	}> {
		const currentSourceById = new Map(
			input.currentSources.map(source => [source.resourceId, source])
		);
		if (input.batch.sources.some(source => {
			const current = currentSourceById.get(source.resourceId);
			return !current
				|| current.revision !== source.revision
				|| current.content !== source.content;
		})) throw new Error('staleTimelineSource');

		const selectedCandidateIds = new Set(input.selectedCandidateIds);
		const selectedEdgeIds = new Set(input.selectedEdgeIds);
		const candidates = input.batch.candidates.filter(candidate => (
			selectedCandidateIds.has(candidate.id)
		));
		const edges = input.batch.edges.filter(edge => selectedEdgeIds.has(edge.id));
		if (
			candidates.length !== selectedCandidateIds.size
			|| edges.length !== selectedEdgeIds.size
			|| candidates.some(candidate => candidate.blocking || candidate.status !== 'candidate')
			|| edges.some(edge => edge.blocking)
			|| (candidates.length === 0 && edges.length === 0)
		) throw new Error('invalidTimelineSelection');

		const selectedEventIds = new Set(candidates.map(candidate => candidate.stagedEventId));
		const existing = await this.repository.list('timelineEvent') as unknown as readonly TimelineEvent[];
		const existingById = new Map<string, TimelineEvent>(
			existing.map(event => [event.id, event])
		);
		for (const candidate of candidates) {
			if (!candidate.matchedEventId) {
				const names = namesForResponse(candidate.response);
				if (existing.some(event => intersects(namesForEvent(event), names))) {
					throw new Error('timelineNameCollision');
				}
				continue;
			}
			const current = existingById.get(candidate.matchedEventId);
			if (!current || current.revision !== candidate.expectedRevision) {
				throw new Error('staleTimelineEvent');
			}
		}
		for (const edge of edges) {
			const endpointAvailable = (eventId: string) => (
				selectedEventIds.has(eventId) || existingById.has(eventId)
			);
			if (!endpointAvailable(edge.fromEventId) || !endpointAvailable(edge.toEventId)) {
				throw new Error('invalidTimelineEdgeSelection');
			}
			const candidateEndpointMissing = input.batch.candidates.some(candidate => (
				candidate.stagedEventId === edge.fromEventId
					|| candidate.stagedEventId === edge.toEventId
			)) && (
				(input.batch.candidates.some(candidate => candidate.stagedEventId === edge.fromEventId)
					&& !selectedEventIds.has(edge.fromEventId))
				|| (input.batch.candidates.some(candidate => candidate.stagedEventId === edge.toEventId)
					&& !selectedEventIds.has(edge.toEventId))
			);
			if (candidateEndpointMissing) throw new Error('invalidTimelineEdgeSelection');
		}

		const now = input.now ?? new Date().toISOString();
		const nextById = new Map<string, TimelineEvent>(
			existing.map(event => [event.id, event])
		);
		for (const candidate of candidates) {
			const current = candidate.matchedEventId
				? existingById.get(candidate.matchedEventId)
				: undefined;
			const confirmed = candidate.evidence
				? confirmEvidence(candidate.evidence, now)
				: undefined;
			nextById.set(candidate.stagedEventId, candidateEvent({
				...candidate,
				...(confirmed ? { evidence: confirmed } : {})
			}, current, now));
		}
		for (const edge of edges) {
			const from = nextById.get(edge.fromEventId);
			const to = nextById.get(edge.toEventId);
			if (!from || !to) throw new Error('invalidTimelineEdgeSelection');
			nextById.set(from.id, parseTimelineEvent({
				...from,
				consequenceIds: distinct([...from.consequenceIds, to.id]),
				updatedAt: now
			}));
			nextById.set(to.id, parseTimelineEvent({
				...to,
				predecessorIds: distinct([...to.predecessorIds, from.id]),
				updatedAt: now
			}));
		}
		const touchedIds = new Set([
			...selectedEventIds,
			...edges.flatMap(edge => [edge.fromEventId, edge.toEventId])
		]);
		const blockingIssues = runTimelineRules({
			events: [...nextById.values()],
			travelLinks: input.travelLinks ?? []
		}).filter(issue => (
			issue.severity === 'error'
			&& issue.evidence.some(item => touchedIds.has(item.eventId))
		));
		if (blockingIssues.length > 0) throw new Error('timelineDeterministicConflict');

		const entries = [...touchedIds].map(eventId => {
			const resource = nextById.get(eventId);
			const current = existingById.get(eventId);
			if (!resource) throw new Error('invalidTimelineSelection');
			return current
				? { resource, expectedRevision: current.revision }
				: { resource, expectedAbsent: true };
		});
		await this.createSnapshot(`AI 故事进程 · ${candidates.length} 个事件`);
		const saved = await this.repository.commit(entries) as unknown as readonly TimelineEvent[];
		return {
			events: saved,
			acceptedCandidateIds: candidates.map(candidate => candidate.id),
			acceptedEdgeIds: edges.map(edge => edge.id)
		};
	}
}
