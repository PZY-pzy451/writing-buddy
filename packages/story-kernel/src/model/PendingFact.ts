import { createStoryId, parseStoryId, type StoryId } from '../ids/StoryId';
import { parseEvidenceRef, type EvidenceRef } from './EvidenceRef';
import { parseStoryPosition, type StoryPosition } from './StoryPosition';

export const pendingFactTypes = [
	'character-state',
	'item-state',
	'location-state',
	'relationship',
	'timeline-event',
	'world-rule',
	'story-information',
	'plot-thread',
	'foreshadowing'
] as const;

export type PendingFactType = typeof pendingFactTypes[number];
export type PendingFactStatus = 'pending' | 'accepted' | 'rejected';

export interface PendingFact {
	readonly id: StoryId;
	readonly schemaVersion: 1;
	readonly factType: PendingFactType;
	readonly title: string;
	readonly statement: string;
	readonly confidence: number;
	readonly status: PendingFactStatus;
	readonly sourceResourceId: StoryId;
	readonly sourceRevision: string;
	readonly suggestedRange?: { readonly start: number; readonly end: number };
	readonly suggestedQuote?: string;
	readonly evidence?: EvidenceRef;
	readonly storyPosition?: StoryPosition;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly revision: number;
}

export interface PendingFactDraft {
	readonly factType: PendingFactType;
	readonly title: string;
	readonly statement: string;
	readonly confidence: number;
	readonly sourceResourceId: string;
	readonly sourceRevision: string;
	readonly suggestedRange?: { readonly start: number; readonly end: number };
	readonly suggestedQuote?: string;
}

function canonicalTimestamp(value: string): boolean {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

function parseRange(value: unknown): { readonly start: number; readonly end: number } | undefined {
	if (value === undefined) return undefined;
	if (
		!value
		|| typeof value !== 'object'
		|| !Number.isSafeInteger((value as { start?: number }).start)
		|| !Number.isSafeInteger((value as { end?: number }).end)
	) {
		throw new Error('invalidPendingFactRange');
	}
	const { start, end } = value as { start: number; end: number };
	if (start < 0 || end <= start) throw new Error('invalidPendingFactRange');
	return { start, end };
}

export function parsePendingFact(value: unknown): PendingFact {
	if (!value || typeof value !== 'object') throw new Error('invalidPendingFact');
	const input = value as Partial<PendingFact> & {
		readonly id?: string;
		readonly sourceResourceId?: string;
		readonly evidence?: Parameters<typeof parseEvidenceRef>[0];
		readonly storyPosition?: Parameters<typeof parseStoryPosition>[0];
	};
	if (
		input.schemaVersion !== 1
		|| !input.factType
		|| !pendingFactTypes.includes(input.factType)
		|| !input.title?.trim()
		|| input.title.length > 120
		|| !input.statement?.trim()
		|| input.statement.length > 4_000
		|| typeof input.confidence !== 'number'
		|| input.confidence < 0
		|| input.confidence > 1
		|| !input.status
		|| !['pending', 'accepted', 'rejected'].includes(input.status)
		|| !input.sourceRevision?.trim()
		|| !input.createdAt
		|| !canonicalTimestamp(input.createdAt)
		|| !input.updatedAt
		|| !canonicalTimestamp(input.updatedAt)
		|| !Number.isSafeInteger(input.revision)
		|| (input.revision ?? -1) < 0
	) {
		throw new Error('invalidPendingFact');
	}
	const range = parseRange(input.suggestedRange);
	const evidence = input.evidence ? parseEvidenceRef(input.evidence) : undefined;
	const storyPosition = input.storyPosition
		? parseStoryPosition(input.storyPosition)
		: undefined;
	if (input.status === 'accepted' && (!evidence?.confirmedByAuthor || !storyPosition)) {
		throw new Error('acceptedFactRequiresConfirmedEvidenceAndStoryPosition');
	}
	return {
		id: parseStoryId(input.id ?? ''),
		schemaVersion: 1,
		factType: input.factType,
		title: input.title.trim(),
		statement: input.statement.trim(),
		confidence: input.confidence,
		status: input.status,
		sourceResourceId: parseStoryId(input.sourceResourceId ?? ''),
		sourceRevision: input.sourceRevision,
		...(range ? { suggestedRange: range } : {}),
		...(input.suggestedQuote?.trim() ? { suggestedQuote: input.suggestedQuote.trim() } : {}),
		...(evidence ? { evidence } : {}),
		...(storyPosition ? { storyPosition } : {}),
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		revision: input.revision ?? 0
	};
}

export function createPendingFact(
	draft: PendingFactDraft,
	now = new Date().toISOString()
): PendingFact {
	return parsePendingFact({
		...draft,
		id: createStoryId('pending-fact'),
		schemaVersion: 1,
		status: 'pending',
		createdAt: now,
		updatedAt: now,
		revision: 0
	});
}

export function updatePendingFact(
	fact: PendingFact,
	changes: Pick<PendingFact, 'title' | 'statement'>,
	now = new Date().toISOString()
): PendingFact {
	if (fact.status !== 'pending') throw new Error('pendingFactAlreadyResolved');
	return parsePendingFact({
		...fact,
		...changes,
		updatedAt: now,
		revision: fact.revision + 1
	});
}

export function acceptPendingFact(input: {
	readonly fact: PendingFact;
	readonly title: string;
	readonly statement: string;
	readonly evidence: EvidenceRef;
	readonly storyPosition: StoryPosition;
	readonly now?: string;
}): PendingFact {
	if (input.fact.status !== 'pending') throw new Error('pendingFactAlreadyResolved');
	return parsePendingFact({
		...input.fact,
		title: input.title,
		statement: input.statement,
		status: 'accepted',
		evidence: input.evidence,
		storyPosition: input.storyPosition,
		updatedAt: input.now ?? new Date().toISOString(),
		revision: input.fact.revision + 1
	});
}

export function rejectPendingFact(
	fact: PendingFact,
	now = new Date().toISOString()
): PendingFact {
	if (fact.status !== 'pending') throw new Error('pendingFactAlreadyResolved');
	return parsePendingFact({
		...fact,
		status: 'rejected',
		updatedAt: now,
		revision: fact.revision + 1
	});
}
