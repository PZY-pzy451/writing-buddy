export type DraftInsertionMode = 'insert_at_cursor' | 'replace_selection';

export interface DraftInsertionTarget {
	readonly projectId: string;
	readonly chapterId: string;
	readonly resourceId: string;
	readonly mode: DraftInsertionMode;
	readonly range: {
		readonly start: number;
		readonly end: number;
	};
	readonly baseDocumentRevision: number;
	readonly baseDocumentLength: number;
	readonly anchorBefore: string;
	readonly anchorTarget: string;
	readonly anchorAfter: string;
}

export type PendingDraftCandidateStatus =
	| 'ready'
	| 'edited'
	| 'applying'
	| 'applied'
	| 'discarded'
	| 'failed';

export interface PendingDraftCandidate {
	readonly id: string;
	readonly actionId: string;
	readonly target: DraftInsertionTarget;
	readonly generatedContent: string;
	readonly content: string;
	readonly targetSummary: string;
	readonly contextSummary: string;
	readonly status: PendingDraftCandidateStatus;
	readonly createdAt: string;
	readonly error?: string;
}

export interface ResolvedPendingDraftEdit {
	readonly start: number;
	readonly end: number;
	readonly text: string;
}

const ANCHOR_LENGTH = 64;

function assertNonEmpty(value: string, errorCode: string): void {
	if (!value.trim()) throw new Error(errorCode);
}

function targetContentMatches(
	candidate: PendingDraftCandidate,
	currentContent: string
): boolean {
	const { target } = candidate;
	const { start, end } = target.range;
	if (
		currentContent.length !== target.baseDocumentLength
		|| start < 0
		|| end < start
		|| end > currentContent.length
	) {
		return false;
	}
	const beforeStart = Math.max(0, start - target.anchorBefore.length);
	return currentContent.slice(beforeStart, start) === target.anchorBefore
		&& currentContent.slice(start, end) === target.anchorTarget
		&& currentContent.slice(end, end + target.anchorAfter.length) === target.anchorAfter;
}

export function createPendingDraftCandidate(input: {
	readonly id?: string;
	readonly actionId: string;
	readonly projectId: string;
	readonly chapterId: string;
	readonly resourceId: string;
	readonly mode: DraftInsertionMode;
	readonly start: number;
	readonly end: number;
	readonly baseDocumentRevision: number;
	readonly currentContent: string;
	readonly content: string;
	readonly targetSummary: string;
	readonly contextSummary: string;
}): PendingDraftCandidate {
	assertNonEmpty(input.actionId, 'invalidPendingDraftAction');
	assertNonEmpty(input.projectId, 'invalidPendingDraftProject');
	assertNonEmpty(input.chapterId, 'invalidPendingDraftChapter');
	assertNonEmpty(input.resourceId, 'invalidPendingDraftResource');
	assertNonEmpty(input.content, 'emptyPendingDraftCandidate');
	assertNonEmpty(input.targetSummary, 'invalidPendingDraftTargetSummary');
	assertNonEmpty(input.contextSummary, 'invalidPendingDraftContextSummary');
	if (!Number.isInteger(input.baseDocumentRevision) || input.baseDocumentRevision < 0) {
		throw new Error('invalidPendingDraftRevision');
	}
	if (
		!Number.isInteger(input.start)
		|| !Number.isInteger(input.end)
		|| input.start < 0
		|| input.end < input.start
		|| input.end > input.currentContent.length
		|| (input.mode === 'insert_at_cursor' && input.start !== input.end)
		|| (input.mode === 'replace_selection' && input.start === input.end)
	) {
		throw new Error('invalidPendingDraftRange');
	}

	return {
		id: input.id ?? `pending-draft:${crypto.randomUUID()}`,
		actionId: input.actionId,
		target: {
			projectId: input.projectId,
			chapterId: input.chapterId,
			resourceId: input.resourceId,
			mode: input.mode,
			range: { start: input.start, end: input.end },
			baseDocumentRevision: input.baseDocumentRevision,
			baseDocumentLength: input.currentContent.length,
			anchorBefore: input.currentContent.slice(
				Math.max(0, input.start - ANCHOR_LENGTH),
				input.start
			),
			anchorTarget: input.currentContent.slice(input.start, input.end),
			anchorAfter: input.currentContent.slice(input.end, input.end + ANCHOR_LENGTH)
		},
		generatedContent: input.content,
		content: input.content,
		targetSummary: input.targetSummary,
		contextSummary: input.contextSummary,
		status: 'ready',
		createdAt: new Date().toISOString()
	};
}

export function editPendingDraftCandidate(
	candidate: PendingDraftCandidate,
	content: string
): PendingDraftCandidate {
	if (!['ready', 'edited', 'failed'].includes(candidate.status)) {
		return candidate;
	}
	return {
		...candidate,
		content,
		status: content === candidate.generatedContent ? 'ready' : 'edited',
		error: undefined
	};
}

export function discardPendingDraftCandidate(
	candidate: PendingDraftCandidate
): PendingDraftCandidate {
	return {
		...candidate,
		status: 'discarded',
		error: undefined
	};
}

export function isPendingDraftCandidateStale(
	candidate: PendingDraftCandidate,
	resourceId: string,
	currentRevision: number,
	currentContent: string
): boolean {
	return candidate.target.resourceId !== resourceId
		|| candidate.target.baseDocumentRevision !== currentRevision
		|| !targetContentMatches(candidate, currentContent);
}

export function rebasePendingDraftCandidateRevision(
	candidate: PendingDraftCandidate,
	currentRevision: number,
	currentContent: string
): PendingDraftCandidate {
	if (
		!Number.isInteger(currentRevision)
		|| currentRevision < 0
		|| !targetContentMatches(candidate, currentContent)
	) {
		throw new Error('pendingDraftTargetChanged');
	}
	return {
		...candidate,
		target: {
			...candidate.target,
			baseDocumentRevision: currentRevision
		}
	};
}

export function resolvePendingDraftEdit(
	candidate: PendingDraftCandidate,
	resourceId: string,
	currentRevision: number,
	currentContent: string
): ResolvedPendingDraftEdit {
	if (!['ready', 'edited', 'failed'].includes(candidate.status)) {
		throw new Error('pendingDraftNotApplicable');
	}
	if (isPendingDraftCandidateStale(
		candidate,
		resourceId,
		currentRevision,
		currentContent
	)) {
		throw new Error('stalePendingDraftCandidate');
	}
	if (!candidate.content.trim()) {
		throw new Error('emptyPendingDraftCandidate');
	}
	return {
		start: candidate.target.range.start,
		end: candidate.target.range.end,
		text: candidate.content
	};
}
