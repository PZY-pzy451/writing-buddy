import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (process.versions.node.split('.')[0] !== '24') throw new Error('Supported acceptance requires Node 24.');
const generatedAt = new Date().toISOString();
const started = performance.now();

async function run(command, args, options = {}) {
	const chunks = [];
	const child = spawn(command, args, {
		cwd: repositoryRoot,
		env: { ...process.env, Path: `${dirname(process.execPath)}${delimiter}${process.env.Path ?? ''}` },
		shell: options.shell ?? false,
		windowsHide: true
	});
	for (const stream of [child.stdout, child.stderr]) {
		stream.on('data', chunk => {
			chunks.push(Buffer.from(chunk));
			process.stdout.write(chunk);
		});
	}
	const exitCode = await new Promise((resolveExit, reject) => {
		child.once('error', reject);
		child.once('exit', code => resolveExit(code ?? 1));
	});
	return { exitCode, output: Buffer.concat(chunks).toString('utf8') };
}

async function resolvePnpmEntry() {
	const explicit = process.env.npm_execpath;
	const candidates = [
		...(explicit ? [explicit] : []),
		...(process.env.Path ?? '').split(delimiter).filter(Boolean).map(directory => (
			join(directory, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
		))
	];
	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch {
			// Continue to the next PATH-owned pnpm installation.
		}
	}
	throw new Error('Supported acceptance could not resolve the pnpm JavaScript entry point.');
}

const inventoryRun = await run(process.execPath, ['scripts/qa/inventory.mjs']);
const pnpmEntry = await resolvePnpmEntry();
const acceptanceRun = inventoryRun.exitCode === 0
	? await run(process.execPath, [pnpmEntry, 'acceptance'])
	: { exitCode: 1, output: '' };
const output = acceptanceRun.output;
const vitestFiles = Number(output.match(/Test Files\s+(\d+) passed/u)?.[1] ?? 0);
const vitestPassed = Number(output.match(/Tests\s+(\d+) passed/u)?.[1] ?? 0);
const inventorySummary = JSON.parse(await readFile(
	resolve(repositoryRoot, 'artifacts', 'qa', 'inventory-summary.json'),
	'utf8'
));
const inventoryFrontendTests = Number(inventorySummary.counts?.frontendDiscoveredTests ?? 0);
const unresolvedParameterizedDeclarations = Number(
	inventorySummary.counts?.unresolvedParameterizedDeclarations ?? 0
);
const runtimeInventoryDelta = vitestPassed - inventoryFrontendTests;
const unsafeShellDeprecationWarnings = (output.match(/\[DEP0190\]/gu) ?? []).length;
const passed = inventoryRun.exitCode === 0
	&& acceptanceRun.exitCode === 0
	&& vitestFiles > 0
	&& vitestPassed > 0
	&& runtimeInventoryDelta === 0
	&& unresolvedParameterizedDeclarations === 0
	&& unsafeShellDeprecationWarnings === 0;
const report = {
	schemaVersion: 1,
	generatedAt,
	completedAt: new Date().toISOString(),
	status: passed ? 'PASS' : 'FAIL',
	exitCode: acceptanceRun.exitCode,
	inventoryExitCode: inventoryRun.exitCode,
	node: process.version.slice(1),
	durationMs: Math.round(performance.now() - started),
	vitestFiles,
	vitestPassed,
	inventoryFrontendTests,
	runtimeInventoryDelta,
	unresolvedParameterizedDeclarations,
	productionBuild: acceptanceRun.exitCode === 0 && output.includes('built in') ? 'PASS' : 'FAIL',
	engineWarnings: (output.match(/Unsupported engine/gu) ?? []).length,
	unsafeShellDeprecationWarnings
};
await writeFile(resolve(repositoryRoot, 'artifacts', 'qa', 'node24-acceptance.json'), `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
if (!passed || report.engineWarnings > 0) process.exitCode = 1;
