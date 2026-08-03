import { describe, expect, it } from 'vitest';
import { resolveLedgerStatus } from './dependency-policy.mjs';

const fingerprints = {
	sourceFingerprint: 'source', dependencyFingerprint: 'dependency', fixtureVersion: 'fixture',
	mockProviderVersion: 'mock', schemaVersion: 'schema', environmentFingerprint: 'environment',
	buildConfigurationFingerprint: 'build', testImplementationFingerprint: 'test',
	expectedBehaviorFingerprint: 'behavior'
};

describe('regression dependency invalidation', () => {
	it('TC-QA-DEPENDENCY-001 reuses a pass only when every fingerprint is identical', () => {
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, fingerprints, false, 'commit')).toEqual({ status: 'CACHED_PASS' });
	});

	it('TC-QA-DEPENDENCY-002 makes a pass stale when any fingerprint changes', () => {
		const current = { ...fingerprints, schemaVersion: 'changed' };
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, current, false, 'commit')).toMatchObject({
			status: 'STALE', invalidationReason: expect.stringContaining('schemaVersion')
		});
	});

	it('TC-QA-DEPENDENCY-003 prevents cache use for mandatory reruns', () => {
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, fingerprints, true, 'current')).toMatchObject({
			status: 'STALE', invalidationReason: expect.stringContaining('mandatory')
		});
	});

	it('TC-QA-DEPENDENCY-004 reuses a mandatory pass already run on the current commit', () => {
		expect(resolveLedgerStatus({ status: 'PASS', lastRunCommit: 'current', ...fingerprints }, fingerprints, true, 'current')).toEqual({
			status: 'CACHED_PASS'
		});
	});

	it('TC-QA-DEPENDENCY-005 preserves a reasoned external skip while fingerprints match', () => {
		expect(resolveLedgerStatus({ status: 'SKIPPED_WITH_REASON', skipReason: 'outside scope', ...fingerprints }, fingerprints, true, 'current')).toEqual({
			status: 'SKIPPED_WITH_REASON', skipReason: 'outside scope'
		});
	});
});
