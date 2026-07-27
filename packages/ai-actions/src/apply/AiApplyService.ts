import {
	type AiPreviewSelection,
	type AiPreviewTransaction
} from './AiPreviewTransaction';

export interface AiApplyPorts<T, R> {
	readonly getCurrentRevision: (resourceId: string) => Promise<string | number>;
	readonly createSnapshot: (reason: string, label: string) => Promise<string>;
	readonly applyCandidate: (
		candidate: T,
		selection: AiPreviewSelection,
		snapshotId: string
	) => Promise<R>;
	readonly restoreSnapshot: (snapshotId: string) => Promise<void>;
}

export interface AiApplyResult<T, R> {
	readonly transaction: AiPreviewTransaction<T>;
	readonly result?: R;
}

export class AiApplyService {
	async apply<T, R>(
		transaction: AiPreviewTransaction<T>,
		selection: AiPreviewSelection,
		ports: AiApplyPorts<T, R>
	): Promise<AiApplyResult<T, R>> {
		if (transaction.status !== 'preview') {
			throw new Error('aiPreviewNotApplicable');
		}
		const currentRevision = String(
			await ports.getCurrentRevision(transaction.resourceId)
		);
		if (currentRevision !== transaction.baseRevision) {
			return {
				transaction: {
					...transaction,
					status: 'stale',
					selection,
					errorCode: 'revisionChanged'
				}
			};
		}
		const snapshotId = await ports.createSnapshot(
			'ai-preview-apply',
			`AI 候选：${transaction.actionId}`
		);
		const applying: AiPreviewTransaction<T> = {
			...transaction,
			status: 'applying',
			selection,
			snapshotId
		};
		try {
			const result = await ports.applyCandidate(
				transaction.candidate,
				selection,
				snapshotId
			);
			return {
				result,
				transaction: {
					...applying,
					status: 'completed',
					completedAt: new Date().toISOString()
				}
			};
		} catch (cause) {
			await ports.restoreSnapshot(snapshotId);
			const error = cause instanceof Error ? cause : new Error(String(cause));
			Object.assign(error, {
				transaction: {
					...applying,
					status: 'failed',
					errorCode: 'applyFailed'
				}
			});
			throw error;
		}
	}
}
