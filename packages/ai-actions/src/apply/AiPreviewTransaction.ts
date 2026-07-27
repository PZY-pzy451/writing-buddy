import type { AiActionId, AiApplyPolicy } from '../action/AiActionDefinition';

export type AiPreviewStatus =
	| 'draft'
	| 'preview'
	| 'applying'
	| 'completed'
	| 'cancelled'
	| 'rejected'
	| 'stale'
	| 'failed';

export interface AiPreviewSelection {
	readonly type: 'all' | 'partial';
	readonly acceptedKeys: readonly string[];
}

export interface AiPreviewTransaction<T = unknown> {
	readonly id: string;
	readonly actionId: AiActionId;
	readonly resourceId: string;
	readonly baseRevision: string;
	readonly applyPolicy: AiApplyPolicy;
	readonly candidate: T;
	readonly status: AiPreviewStatus;
	readonly selection?: AiPreviewSelection;
	readonly snapshotId?: string;
	readonly createdAt: string;
	readonly completedAt?: string;
	readonly errorCode?: string;
}

export function createAiPreviewTransaction<T>(input: {
	readonly actionId: AiActionId;
	readonly resourceId: string;
	readonly baseRevision: string | number;
	readonly applyPolicy: AiApplyPolicy;
	readonly candidate: T;
	readonly id?: string;
	readonly now?: string;
}): AiPreviewTransaction<T> {
	return {
		id: input.id ?? crypto.randomUUID(),
		actionId: input.actionId,
		resourceId: input.resourceId,
		baseRevision: String(input.baseRevision),
		applyPolicy: input.applyPolicy,
		candidate: input.candidate,
		status: 'preview',
		createdAt: input.now ?? new Date().toISOString()
	};
}

export function rejectAiPreview<T>(
	transaction: AiPreviewTransaction<T>
): AiPreviewTransaction<T> {
	if (transaction.status !== 'preview') {
		throw new Error('aiPreviewNotRejectable');
	}
	return {
		...transaction,
		status: 'rejected',
		completedAt: new Date().toISOString()
	};
}
