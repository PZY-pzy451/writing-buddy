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
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, fingerprints, false)).toEqual({ status: 'CACHED_PASS' });
	});

	it('TC-QA-DEPENDENCY-002 makes a pass stale when any fingerprint changes', () => {
		const current = { ...fingerprints, schemaVersion: 'changed' };
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, current, false)).toMatchObject({
			status: 'STALE', invalidationReason: expect.stringContaining('schemaVersion')
		});
	});

	it('TC-QA-DEPENDENCY-003 prevents cache use for mandatory reruns', () => {
		expect(resolveLedgerStatus({ status: 'PASS', ...fingerprints }, fingerprints, true)).toMatchObject({
			status: 'STALE', invalidationReason: expect.stringContaining('mandatory')
		});
	});
});
