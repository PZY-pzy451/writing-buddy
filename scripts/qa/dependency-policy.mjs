export function resolveLedgerStatus(previous, currentFingerprints, forceRun) {
	if (forceRun) return { status: 'STALE', invalidationReason: 'Selected by a mandatory rerun rule.' };
	if (!previous || !['PASS', 'CACHED_PASS'].includes(previous.status)) {
		return { status: 'STALE', invalidationReason: 'No reusable passing ledger entry.' };
	}
	const categories = [
		'sourceFingerprint', 'dependencyFingerprint', 'fixtureVersion', 'mockProviderVersion',
		'schemaVersion', 'environmentFingerprint', 'buildConfigurationFingerprint',
		'testImplementationFingerprint', 'expectedBehaviorFingerprint'
	];
	const changed = categories.filter(category => previous[category] !== currentFingerprints[category]);
	return changed.length
		? { status: 'STALE', invalidationReason: `Fingerprint changed: ${changed.join(', ')}.` }
		: { status: 'CACHED_PASS' };
}

