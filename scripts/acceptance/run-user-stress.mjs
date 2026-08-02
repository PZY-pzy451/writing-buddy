import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = join(repositoryRoot, 'artifacts', 'phase-1.2s', 'stress');
const reportPath = join(repositoryRoot, 'docs', 'acceptance', 'phase-1.2s-user-stress.json');
const browserReportPath = join(repositoryRoot, 'docs', 'acceptance', 'phase-1.2s-user-detail-soak.json');

function argument(name, fallback) {
	const prefix = `--${name}=`;
	const value = process.argv.find(item => item.startsWith(prefix))?.slice(prefix.length);
	return value ?? fallback;
}

function integerArgument(name, fallback) {
	const value = Number(argument(name, String(fallback)));
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`--${name} must be a non-negative integer.`);
	}
	return value;
}

function percentile(values, percentage) {
	if (values.length === 0) return undefined;
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.max(0, Math.ceil(sorted.length * percentage) - 1)];
}

function summarize(values) {
	if (values.length === 0) return { samples: 0 };
	return {
		samples: values.length,
		minimum: Math.min(...values),
		median: percentile(values, 0.5),
		p95: percentile(values, 0.95),
		maximum: Math.max(...values)
	};
}

function run(command, args, label) {
	console.log(`\n[STRESS] ${label}`);
	console.log(`$ ${command} ${args.join(' ')}`);
	return new Promise((resolveRun, reject) => {
		const child = spawn(command, args, {
			cwd: repositoryRoot,
			env: process.env,
			stdio: 'inherit',
			windowsHide: true,
			shell: false
		});
		child.once('error', reject);
		child.once('exit', code => {
			if (code === 0) resolveRun();
			else reject(new Error(`${label} failed with exit code ${code ?? 1}.`));
		});
	});
}

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

function stopProcessTree(child) {
	if (!child || child.exitCode !== null) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
			stdio: 'ignore',
			windowsHide: true
		});
		return;
	}
	child.kill('SIGTERM');
}

async function smokeRelease(path, index) {
	const started = performance.now();
	const child = spawn(path, [], {
		cwd: dirname(path),
		stdio: 'ignore',
		windowsHide: true
	});
	try {
		await new Promise((resolveDelay, reject) => {
			const timeout = setTimeout(resolveDelay, 4_000);
			child.once('error', error => {
				clearTimeout(timeout);
				reject(error);
			});
			child.once('exit', code => {
				clearTimeout(timeout);
				reject(new Error(`Release soak ${index} exited early (${code ?? 1}).`));
			});
		});
		return {
			index,
			pid: child.pid,
			aliveMilliseconds: Math.round(performance.now() - started),
			status: 'passed'
		};
	} finally {
		stopProcessTree(child);
	}
}

const browserRuns = integerArgument('browser-runs', 2);
const performanceRuns = integerArgument('performance-runs', 5);
const recoveryRuns = integerArgument('recovery-runs', 10);
const releasePathValue = argument('release-exe', '');
const releasePath = releasePathValue ? resolve(repositoryRoot, releasePathValue) : undefined;
const releaseRuns = releasePath ? integerArgument('release-runs', 5) : 0;
const recoveryProject = argument(
	'recovery-project',
	'artifacts/novels/zero-hour-echo/Writing Buddy Project'
);

await mkdir(artifactRoot, { recursive: true });
const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	status: 'running',
	configuration: {
		browserRuns,
		performanceRuns,
		recoveryRuns,
		releaseRuns,
		recoveryProject,
		...(releasePath ? { releaseExecutable: releasePath } : {})
	},
	browser: [],
	performance: [],
	recovery: [],
	release: []
};

try {
	for (let index = 1; index <= browserRuns; index += 1) {
		await run(
			process.execPath,
			['scripts/acceptance/validate-user-detail-soak.mjs'],
			`User-detail browser soak ${index}/${browserRuns}`
		);
		const sample = await readJson(browserReportPath);
		const archivePath = join(artifactRoot, `browser-${index}.json`);
		await copyFile(browserReportPath, archivePath);
		report.browser.push({
			index,
			contentLength: sample.longManuscript.contentLength,
			pasteMilliseconds: sample.longManuscript.pasteMilliseconds,
			renderMilliseconds: sample.longManuscript.renderMilliseconds,
			saveMilliseconds: sample.longManuscript.saveMilliseconds,
			resizeAttempts: sample.resize.attempts,
			workspaceTransitions: sample.workspaceTransitions.length,
			reloads: sample.workspaceReloads.length,
			audits: sample.audits.length,
			status: 'passed'
		});
	}

	for (let index = 1; index <= performanceRuns; index += 1) {
		const output = `artifacts/phase-1.2s/stress/performance-${index}.json`;
		await run(
			'powershell.exe',
			['-NoProfile', '-File', 'scripts/perf/measure-storyforge.ps1', '-OutputPath', output],
			`Large-project performance ${index}/${performanceRuns}`
		);
		const sample = await readJson(join(repositoryRoot, output));
		report.performance.push({ index, ...sample.result.metricsMs, status: 'passed' });
	}

	for (let index = 1; index <= recoveryRuns; index += 1) {
		const output = `artifacts/phase-1.2s/stress/recovery-${index}.json`;
		await run(
			'powershell.exe',
			[
				'-NoProfile',
				'-File',
				'scripts/acceptance/verify-storyforge-recovery.ps1',
				'-ProjectRoot',
				recoveryProject,
				'-OutputPath',
				output
			],
			`Backup/recovery cycle ${index}/${recoveryRuns}`
		);
		const sample = await readJson(join(repositoryRoot, output));
		report.recovery.push({ index, ...sample.result, status: 'passed' });
	}

	for (let index = 1; index <= releaseRuns; index += 1) {
		console.log(`\n[STRESS] Release launch ${index}/${releaseRuns}: ${basename(releasePath)}`);
		report.release.push(await smokeRelease(releasePath, index));
	}

	const performanceKeys = [
		'projectInteractive',
		'resourceSwitch',
		'singleResourceSave',
		'timelineFeedback',
		'filteredGraph'
	];
	report.summary = {
		browser: {
			completedRuns: report.browser.length,
			contentLength: summarize(report.browser.map(sample => sample.contentLength)),
			pasteMilliseconds: summarize(report.browser.map(sample => sample.pasteMilliseconds)),
			renderMilliseconds: summarize(report.browser.map(sample => sample.renderMilliseconds)),
			saveMilliseconds: summarize(report.browser.map(sample => sample.saveMilliseconds)),
			totalResizeAttempts: report.browser.reduce((sum, sample) => sum + sample.resizeAttempts, 0),
			totalWorkspaceTransitions: report.browser.reduce((sum, sample) => sum + sample.workspaceTransitions, 0)
		},
		performance: Object.fromEntries(performanceKeys.map(key => [
			key,
			summarize(report.performance.map(sample => sample[key]))
		])),
		recovery: {
			completedCycles: report.recovery.length,
			secondLaunches: report.recovery.filter(sample => sample.secondLaunch).length,
			maximumUnresolvedBacklinks: report.recovery.length
				? Math.max(...report.recovery.map(sample => sample.unresolvedBacklinks))
				: 0
		},
		release: {
			completedLaunches: report.release.length,
			aliveMilliseconds: report.release.length
				? summarize(report.release.map(sample => sample.aliveMilliseconds))
				: undefined
		}
	};
	report.status = 'passed';
} catch (error) {
	report.status = 'failed';
	report.error = error instanceof Error ? error.message : String(error);
	process.exitCode = 1;
} finally {
	report.completedAt = new Date().toISOString();
	report.durationMs = new Date(report.completedAt).getTime() - new Date(report.generatedAt).getTime();
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`\nUser stress ${report.status}: ${reportPath}`);
