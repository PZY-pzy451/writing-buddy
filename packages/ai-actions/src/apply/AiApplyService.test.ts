import { createAiPreviewTransaction } from './AiPreviewTransaction';
import { AiApplyService, type AiApplyPorts } from './AiApplyService';

function transaction() {
	return createAiPreviewTransaction({
		id: 'preview-1',
		now: '2026-07-27T00:00:00.000Z',
		actionId: 'character.generateProfile',
		resourceId: 'character:shen-mo',
		baseRevision: 2,
		applyPolicy: { type: 'field_patch', selectableFields: true },
		candidate: { name: '沈默', occupation: '调查员' }
	});
}

function ports(
	revision: number,
	apply: () => Promise<string> = () => Promise.resolve('saved')
): {
	readonly calls: string[];
	readonly value: AiApplyPorts<{ name: string; occupation: string }, string>;
} {
	const calls: string[] = [];
	return {
		calls,
		value: {
			getCurrentRevision: () => {
				calls.push('revision');
				return Promise.resolve(revision);
			},
			createSnapshot: () => {
				calls.push('snapshot');
				return Promise.resolve('snapshot-1');
			},
			applyCandidate: (_candidate, selection) => {
				calls.push(`apply:${selection.acceptedKeys.join(',')}`);
				return apply();
			},
			restoreSnapshot: () => {
				calls.push('restore');
				return Promise.resolve();
			}
		}
	};
}

describe('AiApplyService', () => {
	it('checks revision, snapshots and applies selected fields in order', async () => {
		const adapter = ports(2);
		const result = await new AiApplyService().apply(transaction(), {
			type: 'partial',
			acceptedKeys: ['occupation']
		}, adapter.value);

		expect(adapter.calls).toEqual(['revision', 'snapshot', 'apply:occupation']);
		expect(result).toMatchObject({
			result: 'saved',
			transaction: {
				status: 'completed',
				snapshotId: 'snapshot-1',
				selection: { type: 'partial', acceptedKeys: ['occupation'] }
			}
		});
	});

	it('marks a changed resource stale without snapshot or write', async () => {
		const adapter = ports(3);
		const result = await new AiApplyService().apply(transaction(), {
			type: 'all',
			acceptedKeys: []
		}, adapter.value);

		expect(result.transaction.status).toBe('stale');
		expect(adapter.calls).toEqual(['revision']);
	});

	it('restores the snapshot after an apply failure', async () => {
		const adapter = ports(2, () => Promise.reject(new Error('writeFailed')));
		await expect(new AiApplyService().apply(transaction(), {
			type: 'all',
			acceptedKeys: []
		}, adapter.value)).rejects.toThrow('writeFailed');
		expect(adapter.calls).toEqual(['revision', 'snapshot', 'apply:', 'restore']);
	});
});
