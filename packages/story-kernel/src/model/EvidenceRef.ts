import { parseStoryId, type StoryId } from '../ids/StoryId';

export type EvidenceOrigin =
	| 'author-entry'
	| 'manuscript'
	| 'resource'
	| 'ai-extracted';

export interface EvidenceRange {
	readonly start: number;
	readonly end: number;
}

export interface EvidenceRef {
	readonly id: StoryId;
	readonly origin: EvidenceOrigin;
	readonly resourceId: StoryId;
	readonly sceneId?: StoryId;
	readonly range?: EvidenceRange;
	readonly revisionId?: string;
	readonly quotePreview?: string;
	readonly confirmedByAuthor: boolean;
	readonly confirmedAt?: string;
}

const evidenceOrigins = new Set<EvidenceOrigin>([
	'author-entry',
	'manuscript',
	'resource',
	'ai-extracted'
]);

function isCanonicalUtcTimestamp(value: string): boolean {
	try {
		return value.endsWith('Z') && new Date(value).toISOString() === value;
	} catch {
		return false;
	}
}

export function parseEvidenceRef(value: {
	readonly id: string;
	readonly origin: EvidenceOrigin;
	readonly resourceId: string;
	readonly sceneId?: string;
	readonly range?: EvidenceRange;
	readonly revisionId?: string;
	readonly quotePreview?: string;
	readonly confirmedByAuthor: boolean;
	readonly confirmedAt?: string;
}): EvidenceRef {
	if (!evidenceOrigins.has(value.origin)) {
		throw new Error('invalidEvidenceOrigin');
	}
	if (value.range && (
		!Number.isSafeInteger(value.range.start)
		|| !Number.isSafeInteger(value.range.end)
		|| value.range.start < 0
		|| value.range.end <= value.range.start
	)) {
		throw new Error('invalidEvidenceRange');
	}
	if (value.confirmedByAuthor && !value.confirmedAt) {
		throw new Error('missingConfirmationTime');
	}
	if (value.confirmedAt && !isCanonicalUtcTimestamp(value.confirmedAt)) {
		throw new Error('invalidUtcTimestamp');
	}
	return {
		id: parseStoryId(value.id),
		origin: value.origin,
		resourceId: parseStoryId(value.resourceId),
		...(value.sceneId ? { sceneId: parseStoryId(value.sceneId) } : {}),
		...(value.range ? { range: { ...value.range } } : {}),
		...(value.revisionId ? { revisionId: value.revisionId } : {}),
		...(value.quotePreview ? { quotePreview: value.quotePreview } : {}),
		confirmedByAuthor: value.confirmedByAuthor,
		...(value.confirmedAt ? { confirmedAt: value.confirmedAt } : {})
	};
}
