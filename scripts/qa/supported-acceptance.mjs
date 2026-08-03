import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (process.versions.node.split('.')[0] !== '24') throw new Error('Supported acceptance requires Node 24.');
const started = performance.now();
const chunks = [];
const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['acceptance'], {
	cwd: repositoryRoot,
	env: { ...process.env, Path: `${dirname(process.execPath)}${delimiter}${process.env.Path ?? ''}` },
	shell: process.platform === 'win32',
	windowsHide: true
});
for (const stream of [child.stdout, child.stderr]) {
	stream.on('data', chunk => {
		chunks.push(Buffer.from(chunk));
		(process.stdout).write(chunk);
	});
}
const exitCode = await new Promise((resolveExit, reject) => {
	child.once('error', reject);
	child.once('exit', code => resolveExit(code ?? 1));
});
const output = Buffer.concat(chunks).toString('utf8');
const vitestFiles = Number(output.match(/Test Files\s+(\d+) passed/u)?.[1] ?? 0);
const vitestPassed = Number(output.match(/Tests\s+(\d+) passed/u)?.[1] ?? 0);
const report = {
	schemaVersion: 1,
	status: exitCode === 0 ? 'PASS' : 'FAIL',
	exitCode,
	node: process.version.slice(1),
	durationMs: Math.round(performance.now() - started),
	vitestFiles,
	vitestPassed,
	productionBuild: exitCode === 0 && output.includes('built in') ? 'PASS' : 'FAIL',
	engineWarnings: (output.match(/Unsupported engine/gu) ?? []).length
};
await writeFile(resolve(repositoryRoot, 'artifacts', 'qa', 'node24-acceptance.json'), `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
if (exitCode !== 0 || report.engineWarnings > 0 || vitestFiles === 0 || vitestPassed === 0) process.exitCode = 1;
