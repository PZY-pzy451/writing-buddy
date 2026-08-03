const fingerprintCategories = [
	'sourceFingerprint', 'dependencyFingerprint', 'fixtureVersion', 'mockProviderVersion',
	'schemaVersion', 'environmentFingerprint', 'buildConfigurationFingerprint',
	'testImplementationFingerprint', 'expectedBehaviorFingerprint'
];

export function resolveLedgerStatus(previous, currentFingerprints, forceRun, currentCommit) {
	if (!previous) {
		return { status: 'STALE', invalidationReason: 'No reusable passing ledger entry.' };
	}
	const changed = fingerprintCategories.filter(category => previous[category] !== currentFingerprints[category]);
	if (changed.length) return { status: 'STALE', invalidationReason: `Fingerprint changed: ${changed.join(', ')}.` };
	if (['NOT_APPLICABLE', 'SKIPPED_WITH_REASON'].includes(previous.status)) {
		return { status: previous.status, ...(previous.skipReason ? { skipReason: previous.skipReason } : {}) };
	}
	if (forceRun && previous.lastRunCommit !== currentCommit) {
		return { status: 'STALE', invalidationReason: 'Selected by a mandatory rerun rule.' };
	}
	if (!['PASS', 'CACHED_PASS'].includes(previous.status)) {
		return { status: 'STALE', invalidationReason: 'No reusable passing ledger entry.' };
	}
	return { status: 'CACHED_PASS' };
}
