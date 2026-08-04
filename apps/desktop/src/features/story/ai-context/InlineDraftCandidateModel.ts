export type DraftInsertionMode = 'insert_at_cursor' | 'replace_selection';

export interface DraftInsertionTarget {
	readonly projectRoot: string;
	readonly projectId: string;
	readonly chapterId: string;
	readonly resourceId: string;
	readonly resourcePath: string;
	readonly modelUri: string;
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

export interface PendingDraftCurrentTarget {
	readonly projectRoot: string;
	readonly projectId: string;
	readonly resourceId: string;
	readonly resourcePath: string;
	readonly modelUri: string;
	readonly revision: number;
	readonly content: string;
}

export type PendingDraftResourceTarget = Omit<
	PendingDraftCurrentTarget,
	'revision' | 'content'
>;

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
	readonly projectRoot: string;
	readonly projectId: string;
	readonly chapterId: string;
	readonly resourceId: string;
	readonly resourcePath: string;
	readonly modelUri: string;
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
	assertNonEmpty(input.projectRoot, 'invalidPendingDraftProjectRoot');
	assertNonEmpty(input.projectId, 'invalidPendingDraftProject');
	assertNonEmpty(input.chapterId, 'invalidPendingDraftChapter');
	assertNonEmpty(input.resourceId, 'invalidPendingDraftResource');
	assertNonEmpty(input.resourcePath, 'invalidPendingDraftResourcePath');
	assertNonEmpty(input.modelUri, 'invalidPendingDraftModel');
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
			projectRoot: input.projectRoot,
			projectId: input.projectId,
			chapterId: input.chapterId,
			resourceId: input.resourceId,
			resourcePath: input.resourcePath,
			modelUri: input.modelUri,
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
	current: PendingDraftCurrentTarget
): boolean;
export function isPendingDraftCandidateStale(
	candidate: PendingDraftCandidate,
	resourceId: string,
	currentRevision: number,
	currentContent: string
): boolean;
export function isPendingDraftCandidateStale(
	candidate: PendingDraftCandidate,
	currentOrResourceId: PendingDraftCurrentTarget | string,
	currentRevision?: number,
	currentContent?: string
): boolean {
	const current = typeof currentOrResourceId === 'string'
		? {
				projectRoot: candidate.target.projectRoot,
				projectId: candidate.target.projectId,
				resourceId: currentOrResourceId,
				resourcePath: candidate.target.resourcePath,
				modelUri: candidate.target.modelUri,
				revision: currentRevision ?? -1,
				content: currentContent ?? ''
			}
		: currentOrResourceId;
	return !isPendingDraftCandidateTargetCurrent(candidate, current)
		|| candidate.target.baseDocumentRevision !== current.revision
		|| !targetContentMatches(candidate, current.content);
}

export function isPendingDraftCandidateTargetCurrent(
	candidate: PendingDraftCandidate,
	current: PendingDraftResourceTarget
): boolean {
	return candidate.target.projectRoot === current.projectRoot
		&& candidate.target.projectId === current.projectId
		&& candidate.target.resourceId === current.resourceId
		&& candidate.target.resourcePath === current.resourcePath
		&& candidate.target.modelUri === current.modelUri;
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
	current: PendingDraftCurrentTarget
): ResolvedPendingDraftEdit;
export function resolvePendingDraftEdit(
	candidate: PendingDraftCandidate,
	resourceId: string,
	currentRevision: number,
	currentContent: string
): ResolvedPendingDraftEdit;
export function resolvePendingDraftEdit(
	candidate: PendingDraftCandidate,
	currentOrResourceId: PendingDraftCurrentTarget | string,
	currentRevision?: number,
	currentContent?: string
): ResolvedPendingDraftEdit {
	if (!['ready', 'edited', 'failed'].includes(candidate.status)) {
		throw new Error('pendingDraftNotApplicable');
	}
	const stale = typeof currentOrResourceId === 'string'
		? isPendingDraftCandidateStale(
				candidate,
				currentOrResourceId,
				currentRevision ?? -1,
				currentContent ?? ''
			)
		: isPendingDraftCandidateStale(candidate, currentOrResourceId);
	if (stale) {
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
