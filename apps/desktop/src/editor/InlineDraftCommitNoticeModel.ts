export interface InlineDraftCommitNotice {
	readonly projectId: string;
	readonly resourceId: string;
	readonly modelUri: string;
	readonly contentAfterCommit: string;
	readonly message: string;
}

export interface InlineDraftCommitTarget {
	readonly projectId: string;
	readonly resourceId: string;
	readonly modelUri: string;
	readonly content: string;
}

export function canUndoCommittedDraft(
	notice: InlineDraftCommitNotice | undefined,
	target: InlineDraftCommitTarget
): boolean {
	return Boolean(
		notice
		&& noticeBelongsToTarget(notice, target)
		&& target.content === notice.contentAfterCommit
	);
}

export function noticeBelongsToTarget(
	notice: InlineDraftCommitNotice,
	target: Pick<InlineDraftCommitTarget, 'projectId' | 'resourceId' | 'modelUri'>
): boolean {
	return notice.projectId === target.projectId
		&& notice.resourceId === target.resourceId
		&& notice.modelUri === target.modelUri;
}
