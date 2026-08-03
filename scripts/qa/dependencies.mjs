import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { resolveLedgerStatus } from './dependency-policy.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const qaRoot = resolve(repositoryRoot, 'artifacts', 'qa');
const baselineCommit = '3575c45408f1660bfa29718f6be76d39e8a16f1d';
const currentCommit = git(['rev-parse', 'HEAD']);

function normalizePath(path) {
	return path.replaceAll('\\', '/');
}

function hashParts(parts) {
	const hash = createHash('sha256');
	for (const part of [...parts].sort()) hash.update(part).update('\0');
	return hash.digest('hex').toUpperCase();
}

function git(args) {
	const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true });
	if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
	return result.stdout.trim();
}

async function readJson(name, fallback) {
	try {
		return JSON.parse(await readFile(resolve(qaRoot, name), 'utf8'));
	} catch (error) {
		if (fallback !== undefined && error?.code === 'ENOENT') return fallback;
		throw error;
	}
}

async function fileHash(path) {
	return createHash('sha256').update(await readFile(resolve(repositoryRoot, ...path.split('/')))).digest('hex').toUpperCase();
}

async function existingPath(candidates) {
	for (const candidate of candidates) {
		try {
			await access(resolve(repositoryRoot, ...candidate.split('/')));
			return candidate;
		} catch {
			// Try the next supported source extension.
		}
	}
	return undefined;
}

async function resolveImport(from, specifier) {
	const packageMatch = specifier.match(/^@writing-buddy\/([^/]+)(?:\/(.*))?$/u);
	if (packageMatch) {
		const base = `packages/${packageMatch[1]}/src/${packageMatch[2] ?? 'index'}`;
		return existingPath([base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.tsx`]);
	}
	if (!specifier.startsWith('.')) return undefined;
	const base = normalizePath(relative(repositoryRoot, resolve(repositoryRoot, dirname(from), specifier)));
	return existingPath([base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`]);
}

async function buildGraph(files) {
	const edges = [];
	for (const from of files.filter(file => ['.ts', '.tsx', '.mjs', '.js'].includes(extname(file)))) {
		const content = await readFile(resolve(repositoryRoot, ...from.split('/')), 'utf8');
		const imports = ts.preProcessFile(content, true, true).importedFiles.map(item => item.fileName);
		for (const specifier of imports) {
			const to = await resolveImport(from, specifier);
			if (to && files.includes(to)) edges.push({ from, to, kind: 'static-import' });
		}
	}
	return edges.sort((a, b) => `${a.from}|${a.to}`.localeCompare(`${b.from}|${b.to}`));
}

function transitiveDependencies(source, edgeMap) {
	const visited = new Set();
	const pending = [...(edgeMap.get(source) ?? [])];
	while (pending.length) {
		const next = pending.pop();
		if (!next || visited.has(next)) continue;
		visited.add(next);
		pending.push(...(edgeMap.get(next) ?? []));
	}
	return [...visited].sort();
}

function selectedByGlobalRule(changedFiles) {
	return changedFiles.some(file => /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.[^/]+|eslint\.config\.[^/]+|scripts\/(?:self-test|qa)\/)/u.test(file));
}

const trackedFiles = [
	...git(['ls-files']).split(/\r?\n/u),
	...git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/u)
].filter(Boolean).map(normalizePath).filter((file, index, values) => values.indexOf(file) === index)
	.filter(file => /^(?:apps|packages|scripts|fixtures)\//u.test(file)
		|| /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.[^/]+|eslint\.config\.[^/]+)$/u.test(file))
	.filter(file => !/(?:^|\/)(?:target|dist|coverage|artifacts|node_modules)(?:\/|$)/u.test(file));
const fileHashes = new Map(await Promise.all(trackedFiles.map(async file => [file, await fileHash(file)])));
const edges = await buildGraph(trackedFiles);
const edgeMap = new Map();
for (const edge of edges) edgeMap.set(edge.from, [...(edgeMap.get(edge.from) ?? []), edge.to]);

const [hierarchy, controls, features, traceability, previousLedger] = await Promise.all([
	readJson('test-hierarchy.json'), readJson('control-inventory.json'), readJson('feature-inventory.json'),
	readJson('traceability-summary.json'), readJson('regression-ledger.json', { items: [] })
]);
const tests = hierarchy.discoveredTests;
const changedFiles = [
	...git(['diff', '--name-only', `${baselineCommit}...HEAD`]).split(/\r?\n/u),
	...git(['diff', '--name-only']).split(/\r?\n/u),
	...git(['diff', '--cached', '--name-only']).split(/\r?\n/u),
	...git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/u)
].filter(Boolean).map(normalizePath).filter((file, index, values) => values.indexOf(file) === index).sort();

const schemaFiles = trackedFiles.filter(file => /^(?:packages\/(?:schema|story-kernel\/src\/schema)|apps\/desktop\/src-tauri\/src\/(?:story|commands))\//u.test(file));
const fixtureFiles = trackedFiles.filter(file => file.startsWith('fixtures/')
	|| file === 'packages/test-support/src/fixtures/project-scenarios.json'
	|| file === 'packages/test-support/src/deterministicProjectFixture.ts');
const mockFiles = trackedFiles.filter(file => file === 'apps/desktop/src/platform/bridge.ts' || file.startsWith('packages/test-support/'));
const buildFiles = trackedFiles.filter(file => /(?:^|\/)(?:package\.json|Cargo\.toml|tauri[^/]*\.conf\.json|vite\.config\.ts)$/u.test(file))
	.concat(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'vitest.config.ts', 'eslint.config.mjs'].filter(file => fileHashes.has(file)));
const sharedFingerprints = {
	fixtureVersion: hashParts(fixtureFiles.map(file => `${file}:${fileHashes.get(file)}`)),
	mockProviderVersion: hashParts(mockFiles.map(file => `${file}:${fileHashes.get(file)}`)),
	schemaVersion: hashParts(schemaFiles.map(file => `${file}:${fileHashes.get(file)}`)),
	environmentFingerprint: hashParts([process.platform, process.arch, process.version, 'pnpm:10.32.1', 'rust:1.97.1', 'tauri:2']),
	buildConfigurationFingerprint: hashParts([...new Set(buildFiles)].map(file => `${file}:${fileHashes.get(file)}`))
};
const globalForce = selectedByGlobalRule(changedFiles);
const previousById = new Map(previousLedger.items.map(item => [item.testCaseId, item]));
const testSources = new Map();
for (const test of tests) {
	const direct = edgeMap.get(test.source) ?? [];
	const dependentFiles = transitiveDependencies(test.source, edgeMap);
	const sourceFiles = dependentFiles.filter(file => !/\.(?:test|spec)\./u.test(file));
	const dependencyEdges = edges.filter(edge => edge.from === test.source || dependentFiles.includes(edge.from));
	const sourceFingerprint = hashParts(sourceFiles.map(file => `${file}:${fileHashes.get(file)}`));
	const dependencyFingerprint = hashParts(dependencyEdges.map(edge => `${edge.from}->${edge.to}:${fileHashes.get(edge.to)}`));
	const testImplementationFingerprint = fileHashes.get(test.source) ?? hashParts([test.source]);
	const expectedBehaviorFingerprint = hashParts([test.featureId, test.pageId, test.title]);
	const fingerprints = { sourceFingerprint, dependencyFingerprint, ...sharedFingerprints, testImplementationFingerprint, expectedBehaviorFingerprint };
	const forceRun = globalForce || ['P0', 'P1'].includes(features.features.find(feature => feature.id === test.featureId)?.priority ?? 'P2');
	const previous = previousById.get(test.id);
	const decision = resolveLedgerStatus(previous, fingerprints, forceRun, currentCommit);
	const item = {
		testCaseId: test.id,
		hierarchyPath: [test.domainId, test.featureId, test.pageId, test.controlId ?? 'UNMAPPED_CONTROL', test.stateId ?? 'UNMAPPED_STATE', test.id],
		status: decision.status,
		...fingerprints,
		dependentFiles,
		dependentFeatures: [test.featureId],
		dependentSchemas: dependentFiles.filter(file => schemaFiles.includes(file)),
		dependentFixtures: dependentFiles.filter(file => fixtureFiles.includes(file)),
		evidencePaths: previous?.evidencePaths ?? [],
		...(previous?.lastRunCommit ? { lastRunCommit: previous.lastRunCommit } : {}),
		...(previous?.lastPassedCommit ? { lastPassedCommit: previous.lastPassedCommit } : {}),
		...(previous?.executedAt ? { executedAt: previous.executedAt } : {}),
		...(previous?.durationMs !== undefined ? { durationMs: previous.durationMs } : {}),
		...(decision.skipReason ? { skipReason: decision.skipReason } : {}),
		...(decision.invalidationReason ? { invalidationReason: decision.invalidationReason } : {})
	};
	const sourceEntry = testSources.get(test.source) ?? {
		testSource: test.source, testCaseIds: [], directDependencies: direct, transitiveDependencies: dependentFiles,
		sourceFingerprint, dependencyFingerprint, testImplementationFingerprint
	};
	sourceEntry.testCaseIds.push(test.id);
	testSources.set(test.source, sourceEntry);
	test.ledgerItem = item;
}
const ledgerItems = tests.map(test => test.ledgerItem).sort((a, b) => a.testCaseId.localeCompare(b.testCaseId));
const cached = ledgerItems.filter(item => item.status === 'CACHED_PASS');
const selected = ledgerItems.filter(item => !['CACHED_PASS', 'NOT_APPLICABLE', 'SKIPPED_WITH_REASON'].includes(item.status));

const controlImpact = [...new Map(controls.controls.map(control => [control.source, control.source])).keys()].sort().map(source => {
	const sourceControls = controls.controls.filter(control => control.source === source);
	const featureIds = [...new Set(sourceControls.map(control => control.featureId))].sort();
	return {
		source,
		controlIds: sourceControls.map(control => control.id),
		stateIds: sourceControls.flatMap(control => control.stateIds),
		featureIds,
		candidateTestCaseIds: tests.filter(test => featureIds.includes(test.featureId)).map(test => test.id)
	};
});

const schemaGroups = [
	{ id: 'SCHEMA-STORY-KERNEL', patterns: [/^packages\/story-kernel\/src\/schema\//u, /^packages\/schema\//u], domains: ['01', '02', '03', '04', '05', '06', '07', '11'] },
	{ id: 'SCHEMA-PROJECT', patterns: [/^packages\/(?:domain|project)\//u, /^apps\/desktop\/src-tauri\/src\/commands\//u], domains: ['01', '02', '05', '06', '11'] },
	{ id: 'SCHEMA-NATIVE-STORY', patterns: [/^apps\/desktop\/src-tauri\/src\/story\//u], domains: ['02', '03', '04', '05', '06', '10'] }
].map(group => {
	const files = trackedFiles.filter(file => group.patterns.some(pattern => pattern.test(file)));
	const featureIds = features.features.filter(feature => group.domains.some(domain => feature.domainId === `DOMAIN-${domain}`)).map(feature => feature.id);
	return {
		id: group.id, files, fingerprint: hashParts(files.map(file => `${file}:${fileHashes.get(file)}`)),
		affectedFeatureIds: featureIds,
		affectedTestCaseIds: tests.filter(test => featureIds.includes(test.featureId)).map(test => test.id)
	};
});

const dependencyMap = {
	schemaVersion: 1,
	graph: { nodeCount: trackedFiles.length, edgeCount: edges.length, nodes: trackedFiles, edges },
	testSources: [...testSources.values()].sort((a, b) => a.testSource.localeCompare(b.testSource)),
	sharedInputs: { schemaFiles, fixtureFiles, mockFiles, buildFiles: [...new Set(buildFiles)].sort() }
};
const ledger = {
	schemaVersion: 1,
	baselineCommit,
	status: 'STALE',
	items: ledgerItems
};
const plan = {
	schemaVersion: 1,
	mode: 'FAST_INCREMENTAL',
	status: traceability.status === 'PASS' ? 'READY' : 'READY_WITH_TRACEABILITY_GAPS',
	changedFiles,
	globalForce,
	selectedTestCaseIds: selected.map(item => item.testCaseId),
	cachedPassTestCaseIds: cached.map(item => item.testCaseId),
	counts: {
		graphNodes: trackedFiles.length,
		graphEdges: edges.length,
		testCases: ledgerItems.length,
		cacheEligible: cached.length,
		forcedReruns: selected.length,
		stale: ledgerItems.filter(item => item.status === 'STALE').length,
		skippedWithReason: ledgerItems.filter(item => item.status === 'SKIPPED_WITH_REASON').length
	},
	traceabilityStatus: traceability.status,
	releasePolicy: {
		cacheForbiddenFor: ['P0', 'P1', 'mock-ai', 'save-recovery', 'migration-compatibility', 'core-journeys', 'release-native', 'real-ai-smoke', 'final-build'],
		realAiSmokeInScope: false
	}
};

await Promise.all([
	writeFile(resolve(qaRoot, 'control-impact-map.json'), `${JSON.stringify({ schemaVersion: 1, sources: controlImpact }, undefined, 2)}\n`, 'utf8'),
	writeFile(resolve(qaRoot, 'test-dependency-map.json'), `${JSON.stringify(dependencyMap, undefined, 2)}\n`, 'utf8'),
	writeFile(resolve(qaRoot, 'schema-impact-map.json'), `${JSON.stringify({ schemaVersion: 1, groups: schemaGroups }, undefined, 2)}\n`, 'utf8'),
	writeFile(resolve(qaRoot, 'regression-ledger.json'), `${JSON.stringify(ledger, undefined, 2)}\n`, 'utf8'),
	writeFile(resolve(qaRoot, 'incremental-test-plan.json'), `${JSON.stringify(plan, undefined, 2)}\n`, 'utf8')
]);

console.log(JSON.stringify(plan, undefined, 2));
