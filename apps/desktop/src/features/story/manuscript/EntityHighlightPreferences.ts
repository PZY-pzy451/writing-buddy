export const manuscriptHighlightKinds = [
	'character',
	'location',
	'item',
	'foreshadowing'
] as const;

export type ManuscriptHighlightKind = typeof manuscriptHighlightKinds[number];

const storagePrefix = 'writing-buddy:manuscript-highlights:';

export function mentionHighlightKind(
	resourceId: string
): ManuscriptHighlightKind | undefined {
	const prefix = resourceId.split(':', 1)[0];
	return manuscriptHighlightKinds.find(kind => kind === prefix);
}

export function loadManuscriptHighlightKinds(
	projectRoot: string,
	storage: Pick<Storage, 'getItem'> = window.localStorage
): ReadonlySet<ManuscriptHighlightKind> {
	try {
		const value = JSON.parse(storage.getItem(`${storagePrefix}${projectRoot}`) ?? '[]') as unknown;
		if (!Array.isArray(value)) return new Set();
		return new Set(value.filter((item): item is ManuscriptHighlightKind => (
			typeof item === 'string'
			&& manuscriptHighlightKinds.some(kind => kind === item)
		)));
	} catch {
		return new Set();
	}
}

export function saveManuscriptHighlightKinds(
	projectRoot: string,
	kinds: ReadonlySet<ManuscriptHighlightKind>,
	storage: Pick<Storage, 'setItem'> = window.localStorage
): void {
	try {
		storage.setItem(
			`${storagePrefix}${projectRoot}`,
			JSON.stringify(manuscriptHighlightKinds.filter(kind => kinds.has(kind)))
		);
	} catch {
		// Highlight preferences are optional UI state and must never block editing.
	}
}
