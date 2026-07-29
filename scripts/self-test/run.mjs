import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildImpactPlan, createExecutionSteps, normalizeFiles } from './impact.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultReportPath = join(repositoryRoot, 'artifacts', 'self-test', 'latest.json');

function parseArguments(argv) {
	const options = {
		mode: 'changed',
		dryRun: false,
		keepGoing: false,
		base: process.env.SELF_TEST_BASE || process.env.GITHUB_BASE_SHA || undefined,
		reportPath: defaultReportPath
	};
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === '--all') {
			options.mode = 'full';
		} else if (argument === '--release') {
			options.mode = 'release';
		} else if (argument === '--dry-run') {
			options.dryRun = true;
		} else if (argument === '--keep-going') {
			options.keepGoing = true;
		} else if (argument === '--base') {
			const base = argv[index + 1];
			if (!base) throw new Error('--base requires a Git reference.');
			options.base = base;
			index += 1;
		} else if (argument === '--report') {
			const path = argv[index + 1];
			if (!path) throw new Error('--report requires a file path.');
			options.reportPath = isAbsolute(path) ? path : resolve(repositoryRoot, path);
			index += 1;
		} else {
			throw new Error(`Unknown self-test option: ${argument}`);
		}
	}
	if (/^0+$/u.test(options.base ?? '')) options.base = undefined;
	return options;
}

function runGit(args, allowEmpty = false) {
	const result = spawnSync('git', args, {
		cwd: repositoryRoot,
		encoding: 'utf8',
		windowsHide: true
	});
	if (result.status !== 0) {
		if (allowEmpty) return '';
		throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed.`);
	}
	return result.stdout;
}

function lines(value) {
	return value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
}

function collectWorkingTreeFiles() {
	return normalizeFiles([
		...lines(runGit(['diff', '--name-only', '--diff-filter=ACDMRTUXB'])),
		...lines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB'])),
		...lines(runGit(['ls-files', '--others', '--exclude-standard']))
	]);
}

function collectChangedFiles(base) {
	const workingTree = collectWorkingTreeFiles();
	if (base) {
		runGit(['rev-parse', '--verify', `${base}^{commit}`]);
		const committed = lines(runGit([
			'diff',
			'--name-only',
			'--diff-filter=ACDMRTUXB',
			`${base}...HEAD`
		]));
		return {
			source: `base:${base}`,
			files: normalizeFiles([...committed, ...workingTree])
		};
	}
	if (workingTree.length > 0) {
		return { source: 'worktree', files: workingTree };
	}
	const latestCommit = lines(runGit([
		'diff-tree',
		'--root',
		'--no-commit-id',
		'--name-only',
		'-r',
		'HEAD'
	]));
	return { source: 'latest-commit', files: normalizeFiles(latestCommit) };
}

function listTests(root) {
	const absoluteRoot = join(repositoryRoot, root);
	if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) return [];
	const tests = [];
	const visit = directory => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const absolutePath = join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(absolutePath);
			} else if (/\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/u.test(entry.name)) {
				tests.push(relative(repositoryRoot, absolutePath).replaceAll('\\', '/'));
			}
		}
	};
	visit(absoluteRoot);
	return tests;
}

function resolvePlanInputs(plan) {
	const exists = file => existsSync(join(repositoryRoot, file));
	return {
		lintInputs: plan.lintInputs.filter(exists),
		relatedInputs: plan.relatedInputs.filter(exists),
		safetyTests: normalizeFiles([
			...plan.explicitTests.filter(exists),
			...plan.safetyRoots.flatMap(listTests)
		])
	};
}

function repositoryChecksFor(selection) {
	const worktreeChecks = [
		{
			id: 'diff-check-worktree',
			label: 'Unstaged whitespace and conflict-marker check',
			args: ['diff', '--check']
		},
		{
			id: 'diff-check-index',
			label: 'Staged whitespace and conflict-marker check',
			args: ['diff', '--cached', '--check']
		}
	];
	if (selection.source === 'latest-commit') {
		return [{
			id: 'diff-check-commit',
			label: 'Latest-commit whitespace and conflict-marker check',
			args: ['show', '--check', '--format=', 'HEAD']
		}];
	}
	if (selection.source.startsWith('base:')) {
		const base = selection.source.slice('base:'.length);
		return [
			{
				id: 'diff-check-base',
				label: 'Base-relative whitespace and conflict-marker check',
				args: ['diff', '--check', `${base}...HEAD`]
			},
			...worktreeChecks
		];
	}
	return worktreeChecks;
}

function printableCommand(step) {
	return [step.command, ...step.args].map(value =>
		/[\s"]/u.test(value) ? JSON.stringify(value) : value
	).join(' ');
}

function resolveCommand(step) {
	if (step.command !== 'pnpm') {
		return { executable: step.command, args: step.args, shell: false };
	}
	const pnpmEntry = process.env.npm_execpath;
	if (pnpmEntry && existsSync(pnpmEntry)) {
		return {
			executable: process.execPath,
			args: [pnpmEntry, ...step.args],
			shell: false
		};
	}
	return {
		executable: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
		args: step.args,
		shell: process.platform === 'win32'
	};
}

function writeReport(path, report) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
}

function printPlan(plan, selection, steps, reportPath) {
	console.log(`\nSelf-test selection: ${selection.source}`);
	console.log(`Mode: ${plan.mode}`);
	console.log(`Changed files: ${plan.changedFiles.length}`);
	for (const file of plan.changedFiles) console.log(`  - ${file}`);
	console.log(`Risk areas: ${plan.riskAreas.join(', ') || 'none'}`);
	console.log('Steps:');
	for (const step of steps) console.log(`  - ${step.label}: ${printableCommand(step)}`);
	console.log(`Report: ${relative(repositoryRoot, reportPath).replaceAll('\\', '/')}\n`);
}

function executeStep(step) {
	const startedAt = new Date();
	const started = performance.now();
	const command = resolveCommand(step);
	console.log(`\n[SELF-TEST] ${step.label}`);
	console.log(`$ ${printableCommand(step)}`);
	const result = spawnSync(command.executable, command.args, {
		cwd: resolve(repositoryRoot, step.cwd),
		stdio: 'inherit',
		shell: command.shell,
		windowsHide: true,
		env: process.env
	});
	const exitCode = result.status ?? 1;
	return {
		id: step.id,
		label: step.label,
		command: printableCommand(step),
		cwd: step.cwd,
		startedAt: startedAt.toISOString(),
		durationMs: Math.round(performance.now() - started),
		status: exitCode === 0 ? 'passed' : 'failed',
		exitCode,
		error: result.error?.message
	};
}

const options = parseArguments(process.argv.slice(2));
const selection = collectChangedFiles(options.base);
const plan = buildImpactPlan(selection.files, { mode: options.mode });
const resolvedInputs = resolvePlanInputs(plan);
const steps = createExecutionSteps(plan, {
	...resolvedInputs,
	repositoryChecks: repositoryChecksFor(selection)
});
const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	selection: selection.source,
	mode: plan.mode,
	dryRun: options.dryRun,
	keepGoing: options.keepGoing,
	changedFiles: plan.changedFiles,
	riskAreas: plan.riskAreas,
	matchedRules: plan.matchedRules,
	resolvedInputs,
	plannedSteps: steps.map(step => ({
		id: step.id,
		label: step.label,
		command: printableCommand(step),
		cwd: step.cwd
	})),
	results: [],
	status: options.dryRun ? 'planned' : 'running'
};

printPlan(plan, selection, steps, options.reportPath);
if (options.dryRun) {
	writeReport(options.reportPath, report);
	process.exitCode = 0;
} else {
	for (const step of steps) {
		const result = executeStep(step);
		report.results.push(result);
		if (result.status === 'failed' && !options.keepGoing) break;
	}
	const failed = report.results.some(result => result.status === 'failed');
	report.status = failed ? 'failed' : 'passed';
	report.completedAt = new Date().toISOString();
	writeReport(options.reportPath, report);
	console.log(`\nSelf-test ${report.status}. Report: ${relative(repositoryRoot, options.reportPath).replaceAll('\\', '/')}`);
	process.exitCode = failed ? 1 : 0;
}
