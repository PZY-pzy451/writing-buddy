import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const reportPath = resolve(repositoryRoot, 'artifacts', 'qa', 'cargo-acceptance.json');
const manifestPath = 'apps/desktop/src-tauri/Cargo.toml';
const generatedAt = new Date().toISOString();
const started = performance.now();

async function run(command, args) {
	const chunks = [];
	const child = spawn(command, args, {
		cwd: repositoryRoot,
		env: process.env,
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

const cargoVersion = await run('cargo', ['--version']);
const rustcVersion = await run('rustc', ['--version']);
const format = await run('cargo', ['fmt', '--check', '--manifest-path', manifestPath]);
const tests = format.exitCode === 0
	? await run('cargo', ['test', '--manifest-path', manifestPath])
	: { exitCode: 1, output: '' };
const result = tests.output.match(
	/test result: ok\.\s+(\d+) passed;\s+(\d+) failed;\s+(\d+) ignored;/u
);
const passedTests = Number(result?.[1] ?? 0);
const failedTests = Number(result?.[2] ?? 0);
const ignoredTests = Number(result?.[3] ?? 0);
const collectedTests = passedTests + failedTests + ignoredTests;
const passed = cargoVersion.exitCode === 0
	&& rustcVersion.exitCode === 0
	&& format.exitCode === 0
	&& tests.exitCode === 0
	&& collectedTests > 0
	&& failedTests === 0;
const report = {
	schemaVersion: 1,
	generatedAt,
	completedAt: new Date().toISOString(),
	status: passed ? 'PASS' : 'FAIL',
	durationMs: Math.round(performance.now() - started),
	cargo: cargoVersion.output.trim(),
	rustc: rustcVersion.output.trim(),
	format: format.exitCode === 0 ? 'PASS' : 'FAIL',
	tests: {
		status: tests.exitCode === 0 ? 'PASS' : 'FAIL',
		collected: collectedTests,
		passed: passedTests,
		failed: failedTests,
		ignoredWithReason: ignoredTests
	},
	compilerWarnings: (tests.output.match(/^warning:/gmu) ?? []).length
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
if (!passed) process.exitCode = 1;
