import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	access,
	copyFile,
	mkdir,
	readdir,
	readFile,
	writeFile
} from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const acceptanceUrl = 'http://127.0.0.1:1420';
const reportPath = join(repositoryRoot, 'docs', 'acceptance', 'full-regression-latest.json');
const releaseRoot = join(
	repositoryRoot,
	'artifacts',
	'release',
	'full-regression-2026-08-02'
);
const executablePath = join(
	repositoryRoot,
	'apps',
	'desktop',
	'src-tauri',
	'target',
	'release',
	'writing-buddy-next.exe'
);
const nsisRoot = join(
	repositoryRoot,
	'apps',
	'desktop',
	'src-tauri',
	'target',
	'release',
	'bundle',
	'nsis'
);
const viteEntry = join(
	repositoryRoot,
	'apps',
	'desktop',
	'node_modules',
	'vite',
	'bin',
	'vite.js'
);

const browserSteps = [
	['gate-g', 'scripts/acceptance/capture-phase-1.2a-gate-g.mjs'],
	['gate-h', 'scripts/acceptance/validate-phase-1.2a-gate-h.mjs'],
	['phase-1.2b', 'scripts/acceptance/validate-phase-1.2b-creation-journey.mjs'],
	[
		'phase-1.2c',
		'scripts/acceptance/validate-phase-1.2b-creation-journey.mjs',
		'--phase-1.2c'
	],
	['phase-1.2e', 'scripts/acceptance/validate-phase-1.2e-market-hierarchy.mjs'],
	['phase-1.2f', 'scripts/acceptance/validate-phase-1.2f-task-closure.mjs'],
	['phase-1.2g', 'scripts/acceptance/validate-phase-1.2g-export-trust.mjs'],
	['phase-1.2h', 'scripts/acceptance/validate-phase-1.2h-work-export-backup.mjs'],
	['phase-1.2i', 'scripts/acceptance/validate-phase-1.2i-draft-import.mjs'],
	['phase-1.2j', 'scripts/acceptance/validate-phase-1.2j-word-interoperability.mjs'],
	['phase-1.2k', 'scripts/acceptance/validate-phase-1.2k-daily-writing-progress.mjs'],
	['phase-1.2l', 'scripts/acceptance/validate-phase-1.2l-whole-work-consistency.mjs'],
	['phase-1.2m', 'scripts/acceptance/validate-phase-1.2m-scene-plot-grid.mjs'],
	['phase-1.2n', 'scripts/acceptance/validate-phase-1.2n-publish-readiness.mjs'],
	['phase-1.2o', 'scripts/acceptance/validate-phase-1.2o-chapter-lifecycle.mjs'],
	['phase-1.2p', 'scripts/acceptance/validate-phase-1.2p-delivery-freshness.mjs'],
	['phase-1.2q', 'scripts/acceptance/validate-phase-1.2q-author-confirmed-release.mjs'],
	['phase-1.2s-user-detail', 'scripts/acceptance/validate-user-detail-soak.mjs'],
	[
		'storyforge-gate-c',
		'scripts/acceptance/capture-storyforge-gate-c.mjs',
		acceptanceUrl,
		'gate-c-full-regression'
	]
];

function printable(command, args) {
	return [command, ...args].map(value =>
		/[\s"]/u.test(value) ? JSON.stringify(value) : value
	).join(' ');
}

function pnpmCommand(args) {
	const pnpmEntry = process.env.npm_execpath;
	if (pnpmEntry) {
		return { command: process.execPath, args: [pnpmEntry, ...args] };
	}
	return {
		command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
		args,
		shell: process.platform === 'win32'
	};
}

function git(args) {
	const result = spawnSync('git', args, {
		cwd: repositoryRoot,
		encoding: 'utf8',
		windowsHide: true
	});
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed.`);
	}
	return result.stdout.trim();
}

async function writeReport(report) {
	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
}

async function runStep(report, id, label, command, args, options = {}) {
	const startedAt = new Date();
	const started = performance.now();
	console.log(`\n[FULL REGRESSION] ${label}`);
	console.log(`$ ${printable(command, args)}`);
	const result = await new Promise(resolveResult => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? repositoryRoot,
			env: { ...process.env, ...options.env },
			stdio: 'inherit',
			shell: options.shell ?? false,
			windowsHide: true
		});
		child.once('error', error => resolveResult({ exitCode: 1, error: error.message }));
		child.once('exit', code => resolveResult({ exitCode: code ?? 1 }));
	});
	const entry = {
		id,
		label,
		command: printable(command, args),
		startedAt: startedAt.toISOString(),
		durationMs: Math.round(performance.now() - started),
		status: result.exitCode === 0 ? 'passed' : 'failed',
		exitCode: result.exitCode,
		...(result.error ? { error: result.error } : {})
	};
	report.results.push(entry);
	await writeReport(report);
	if (entry.status === 'failed') throw new Error(`${label} failed.`);
	return entry;
}

async function waitForServer(processHandle) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (processHandle.exitCode !== null) {
			throw new Error(`Vite exited before becoming ready (${processHandle.exitCode}).`);
		}
		try {
			const response = await fetch(acceptanceUrl);
			if (response.ok) return;
		} catch {
			// The server may still be binding the port.
		}
		await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
	}
	throw new Error(`Timed out waiting for ${acceptanceUrl}.`);
}

function stopProcessTree(processHandle) {
	if (!processHandle || processHandle.exitCode !== null) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill.exe', ['/pid', String(processHandle.pid), '/t', '/f'], {
			stdio: 'ignore',
			windowsHide: true
		});
	} else {
		processHandle.kill('SIGTERM');
	}
}

async function sha256(path) {
	const bytes = await readFile(path);
	return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

async function archiveRelease(report) {
	await access(executablePath);
	const installers = (await readdir(nsisRoot))
		.filter(name => name.toLowerCase().endsWith('.exe'))
		.sort();
	if (installers.length !== 1) {
		throw new Error(`Expected one NSIS installer, found ${installers.length}.`);
	}
	const sourceBoundReleaseRoot = join(releaseRoot, report.source.commit.slice(0, 8));
	await mkdir(sourceBoundReleaseRoot, { recursive: true });
	const portableTarget = join(sourceBoundReleaseRoot, 'Writing-Buddy-Portable.exe');
	const installerTarget = join(sourceBoundReleaseRoot, installers[0]);
	await copyFile(executablePath, portableTarget);
	await copyFile(join(nsisRoot, installers[0]), installerTarget);
	const artifacts = [];
	for (const path of [portableTarget, installerTarget]) {
		artifacts.push({
			path: relative(repositoryRoot, path).replaceAll('\\', '/'),
			sha256: await sha256(path)
		});
	}
	report.release = {
		directory: relative(repositoryRoot, sourceBoundReleaseRoot).replaceAll('\\', '/'),
		artifacts
	};
	await writeFile(
		join(sourceBoundReleaseRoot, 'SHA256.json'),
		`${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), artifacts }, undefined, 2)}\n`,
		'utf8'
	);
	await writeReport(report);
	return portableTarget;
}

async function smokeExecutable(report, path) {
	const startedAt = new Date();
	const started = performance.now();
	console.log(`\n[FULL REGRESSION] Portable executable smoke`);
	console.log(`$ ${path}`);
	const child = spawn(path, [], {
		cwd: dirname(path),
		stdio: 'ignore',
		windowsHide: false
	});
	try {
		await new Promise((resolveDelay, reject) => {
			const timeout = setTimeout(resolveDelay, 7_000);
			child.once('error', error => {
				clearTimeout(timeout);
				reject(error);
			});
			child.once('exit', code => {
				clearTimeout(timeout);
				reject(new Error(`Portable executable exited early (${code ?? 1}).`));
			});
		});
		report.results.push({
			id: 'portable-smoke',
			label: 'Portable executable seven-second smoke',
			command: path,
			startedAt: startedAt.toISOString(),
			durationMs: Math.round(performance.now() - started),
			status: 'passed',
			exitCode: 0,
			pid: child.pid
		});
	} finally {
		stopProcessTree(child);
		await writeReport(report);
	}
}

const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	status: 'running',
	source: {
		commit: git(['rev-parse', 'HEAD']),
		branch: git(['branch', '--show-current']),
		worktreeDirty: Boolean(git(['status', '--porcelain']))
	},
	environment: {
		platform: process.platform,
		node: process.version,
		acceptanceUrl
	},
	results: []
};

let viteProcess;
let productionPortable;
try {
	await runStep(
		report,
		'self-test-release',
		'Release self-test: source, frontend, Rust, Tauri and NSIS',
		process.execPath,
		[
			'scripts/self-test/run.mjs',
			'--release',
		'--report',
		'artifacts/self-test/full-regression-release.json'
		]
	);
	await runStep(
		report,
		'storyforge-performance',
		'StoryForge performance ignored gate',
		'powershell.exe',
		['-NoProfile', '-File', 'scripts/perf/measure-storyforge.ps1']
	);

	await access(viteEntry);
	console.log(`\n[FULL REGRESSION] Starting isolated Vite server at ${acceptanceUrl}`);
	viteProcess = spawn(
		process.execPath,
		[viteEntry, '--host', '127.0.0.1', '--port', '1420', '--strictPort'],
		{
			cwd: join(repositoryRoot, 'apps', 'desktop'),
			env: process.env,
			stdio: 'inherit',
			windowsHide: true
		}
	);
	await waitForServer(viteProcess);
	for (const [id, script, ...args] of browserSteps) {
		await runStep(
			report,
			`browser-${id}`,
			`Browser journey ${id}`,
			process.execPath,
			[script, ...args],
			{ env: { WRITING_BUDDY_ACCEPTANCE_URL: acceptanceUrl } }
		);
	}
	stopProcessTree(viteProcess);
	viteProcess = undefined;

	productionPortable = await archiveRelease(report);
	const acceptanceBuild = pnpmCommand([
		'--filter',
		'@writing-buddy/desktop',
		'tauri',
		'build',
		'--config',
		'src-tauri/tauri.acceptance.conf.json'
	]);
	await runStep(
		report,
		'native-acceptance-build',
		'Isolated Tauri acceptance executable build',
		acceptanceBuild.command,
		acceptanceBuild.args,
		{ shell: acceptanceBuild.shell }
	);
	await runStep(
		report,
		'native-genre-gates-a-d',
		'Native genre-to-draft Gates A-D',
		process.execPath,
		['scripts/acceptance/validate-genre-to-draft-gates-a-c.mjs']
	);
	await runStep(
		report,
		'complete-novel',
		'Complete novel static and native journey',
		process.execPath,
		['scripts/acceptance/validate-complete-novel.mjs'],
		{ env: { WRITING_BUDDY_NATIVE_CDP_PORT: '9751' } }
	);
	await copyFile(productionPortable, executablePath);
	await runStep(
		report,
		'storyforge-recovery',
		'StoryForge sanitized complete-novel recovery ignored gate',
		'powershell.exe',
		[
			'-NoProfile',
			'-File',
			'scripts/acceptance/verify-storyforge-recovery.ps1',
			'-ProjectRoot',
			'artifacts/novels/zero-hour-echo/Writing Buddy Project',
			'-OutputPath',
			'docs/acceptance/storyforge-data-recovery.json'
		]
	);

	await smokeExecutable(report, productionPortable);
	report.status = 'passed';
} catch (error) {
	report.status = 'failed';
	report.error = error instanceof Error ? error.message : String(error);
	process.exitCode = 1;
} finally {
	stopProcessTree(viteProcess);
	if (productionPortable) {
		try {
			await copyFile(productionPortable, executablePath);
		} catch (restoreError) {
			report.status = 'failed';
			report.error = `Production executable restore failed: ${
				restoreError instanceof Error ? restoreError.message : String(restoreError)
			}`;
			process.exitCode = 1;
		}
	}
	report.completedAt = new Date().toISOString();
	report.durationMs = new Date(report.completedAt).getTime() - new Date(report.generatedAt).getTime();
	await writeReport(report);
}

console.log(`\nFull regression ${report.status}.`);
console.log(`Report: ${relative(repositoryRoot, reportPath).replaceAll('\\', '/')}`);
