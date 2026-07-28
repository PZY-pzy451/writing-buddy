import type { RuleIssue } from './RuleIssue';

export type ContinuityLayer = 'text-rule' | 'story-kernel' | 'ai';
export type ContinuitySeverity = 'info' | 'suggestion' | 'warning' | 'error';
export type ContinuityStatus = 'open' | 'resolved' | 'ignored' | 'stale';

export interface ContinuityEvidence {
	readonly id: string;
	readonly resourceId: string;
	readonly chapterId?: string;
	readonly sceneId?: string;
	readonly start?: number;
	readonly end?: number;
	readonly quote?: string;
	readonly storyTime?: string;
	readonly expectedRevision?: string;
	readonly kind?: 'manuscript' | 'story-fact';
	readonly label: string;
}

export interface ContinuityCandidate {
	readonly sourceId: string;
	readonly layer: ContinuityLayer;
	readonly ruleId: string;
	readonly severity: ContinuitySeverity;
	readonly title: string;
	readonly message: string;
	readonly evidence: readonly ContinuityEvidence[];
	readonly dedupeKey?: string;
}

export interface ContinuityIssue {
	readonly id: string;
	readonly ruleId: string;
	readonly severity: ContinuitySeverity;
	readonly status: ContinuityStatus;
	readonly title: string;
	readonly message: string;
	readonly layers: readonly ContinuityLayer[];
	readonly sourceIds: readonly string[];
	readonly evidence: readonly ContinuityEvidence[];
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ContinuityAggregationInput {
	readonly candidates: readonly ContinuityCandidate[];
	readonly previous?: readonly ContinuityIssue[];
	readonly currentRevisions?: Readonly<Record<string, string>>;
	readonly now?: string;
}

const severityRank: Readonly<Record<ContinuitySeverity, number>> = {
	info: 0,
	suggestion: 1,
	warning: 2,
	error: 3
};

function hash(value: string): string {
	let result = 2166136261;
	for (const character of value) {
		result ^= character.codePointAt(0) ?? 0;
		result = Math.imul(result, 16777619);
	}
	return (result >>> 0).toString(16).padStart(8, '0');
}

function evidenceIdentity(evidence: ContinuityEvidence): string {
	return [
		evidence.resourceId,
		evidence.chapterId ?? '',
		evidence.sceneId ?? '',
		evidence.start ?? '',
		evidence.end ?? '',
		evidence.quote ?? '',
		evidence.kind ?? 'manuscript'
	].join(':');
}

function issueKey(candidate: ContinuityCandidate): string {
	return candidate.dedupeKey ?? [
		candidate.ruleId,
		...candidate.evidence.map(evidenceIdentity).sort()
	].join('|');
}

function capAiSeverity(candidate: ContinuityCandidate): ContinuitySeverity {
	return candidate.layer === 'ai' && severityRank[candidate.severity] > severityRank.warning
		? 'warning'
		: candidate.severity;
}

function staleEvidence(
	evidence: readonly ContinuityEvidence[],
	revisions: Readonly<Record<string, string>>
): boolean {
	return evidence.some(item => (
		item.expectedRevision !== undefined
		&& revisions[item.resourceId] !== undefined
		&& revisions[item.resourceId] !== item.expectedRevision
	));
}

function uniqueBy<T>(values: readonly T[], identity: (value: T) => string): readonly T[] {
	const seen = new Set<string>();
	return values.filter(value => {
		const key = identity(value);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function aggregateContinuityIssues(input: ContinuityAggregationInput): readonly ContinuityIssue[] {
	const now = input.now ?? new Date().toISOString();
	const previousById = new Map((input.previous ?? []).map(issue => [issue.id, issue]));
	const groups = new Map<string, ContinuityCandidate[]>();
	for (const candidate of input.candidates) {
		const key = issueKey(candidate);
		groups.set(key, [...(groups.get(key) ?? []), candidate]);
	}
	const issues = [...groups.entries()].map(([key, candidates]): ContinuityIssue => {
		const first = candidates[0];
		if (!first) throw new Error('emptyContinuityGroup');
		const id = `continuity:${hash(key)}`;
		const previous = previousById.get(id);
		const evidence = uniqueBy(
			candidates.flatMap(candidate => candidate.evidence),
			evidenceIdentity
		);
		const severity = candidates
			.map(capAiSeverity)
			.reduce((highest, current) => (
				severityRank[current] > severityRank[highest] ? current : highest
			), 'info');
		const stale = staleEvidence(evidence, input.currentRevisions ?? {});
		return {
			id,
			ruleId: first.ruleId,
			severity,
			status: stale ? 'stale' : previous?.status ?? 'open',
			title: first.title,
			message: first.message,
			layers: uniqueBy(candidates.map(candidate => candidate.layer), value => value),
			sourceIds: uniqueBy(candidates.map(candidate => candidate.sourceId), value => value),
			evidence,
			createdAt: previous?.createdAt ?? now,
			updatedAt: stale ? now : previous?.updatedAt ?? now
		};
	});
	return issues.sort((left, right) => (
		severityRank[right.severity] - severityRank[left.severity]
		|| left.status.localeCompare(right.status)
		|| left.id.localeCompare(right.id)
	));
}

export function ruleIssueToContinuityCandidate(issue: RuleIssue): ContinuityCandidate {
	return {
		sourceId: issue.id,
		layer: 'story-kernel',
		ruleId: issue.ruleId,
		severity: issue.severity,
		title: issue.title,
		message: issue.message,
		evidence: issue.evidence.map((evidence, index) => ({
			id: `${issue.id}:evidence-${index + 1}`,
			resourceId: evidence.chapterId,
			chapterId: evidence.chapterId,
			...(evidence.sceneId ? { sceneId: evidence.sceneId } : {}),
			...(evidence.storyTime ? { storyTime: evidence.storyTime } : {}),
			label: `证据 ${index + 1} · ${evidence.eventId}`
		}))
	};
}

export function resolveContinuityIssue(
	issue: ContinuityIssue,
	status: Extract<ContinuityStatus, 'open' | 'resolved' | 'ignored'>,
	now = new Date().toISOString()
): ContinuityIssue {
	if (issue.status === 'stale' && status !== 'open') {
		throw new Error('staleContinuityIssue');
	}
	return { ...issue, status, updatedAt: now };
}
