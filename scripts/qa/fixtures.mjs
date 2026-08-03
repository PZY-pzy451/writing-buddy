import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = async path => JSON.parse(await readFile(resolve(repositoryRoot, ...path.split('/')), 'utf8'));
const aiScenarios = await readJson('packages/test-support/src/fixtures/ai-scenarios.json');
const projectScenarios = await readJson('packages/test-support/src/fixtures/project-scenarios.json');
const requiredAiScenarios = [
	'success_text', 'success_stream', 'success_structured', 'success_usage', 'slow_stream', 'stop_success',
	'timeout', 'connection_reset', 'rate_limit', 'unauthorized', 'forbidden', 'server_error', 'empty_response',
	'invalid_json', 'schema_repair_success', 'schema_repair_failure', 'partial_stream_then_error',
	'duplicate_delta', 'out_of_order_event', 'stale_candidate', 'anchor_not_found', 'revision_conflict',
	'save_after_apply_failure', 'privacy_redaction',
	'story_kernel_unselected_malformed_relationship', 'story_kernel_schema_mutation_matrix'
];
const actual = aiScenarios.map(scenario => scenario.id);
if (new Set(actual).size !== actual.length || requiredAiScenarios.some(id => !actual.includes(id))) {
	throw new Error('Deterministic AI scenario manifest is incomplete or contains duplicate IDs.');
}
const report = {
	schemaVersion: 1,
	status: 'PASS',
	mockProviderVersion: 'qa-ai-mock-v1',
	projectFixtureVersion: 'qa-project-fixture-v1',
	counts: { mockScenarios: aiScenarios.length, projectScenarios: projectScenarios.length },
	aiScenarios,
	projectScenarios,
	isolation: {
		realProviderCalls: false,
		requestContentRetained: false,
		manualStreamClock: true,
		resettable: true,
		cleanupRequired: true,
		absoluteProjectPaths: false
	}
};
await writeFile(resolve(repositoryRoot, 'artifacts', 'qa', 'fixture-mock-inventory.json'), `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
console.log(JSON.stringify(report.counts));
