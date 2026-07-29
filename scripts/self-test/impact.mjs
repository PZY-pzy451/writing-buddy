import { matchImpactRules } from './impact-rules.mjs';

const lintablePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const relatedPattern = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const testPattern = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/u;

export function normalizeFiles(files) {
	return [...new Set(files
		.map(file => file.trim().replaceAll('\\', '/').replace(/^\.\//u, ''))
		.filter(Boolean))]
		.sort((left, right) => left.localeCompare(right));
}

export function isDocumentationFile(file) {
	return file.startsWith('docs/')
		|| file === 'README.md'
		|| file === 'AGENTS.md'
		|| /\.(?:md|mdx|png|jpe?g|gif|svg)$/u.test(file);
}

function isFrontendRelevant(file) {
	return file.startsWith('apps/desktop/')
		|| file.startsWith('packages/')
		|| file.startsWith('scripts/')
		|| /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig.*\.json|vitest\.config\.|vite\.config\.|eslint\.config\.)/u.test(file);
}

function isFrontendRuntime(file) {
	return /^apps\/desktop\/src\//u.test(file)
		|| /^packages\/[^/]+\/src\//u.test(file)
		|| /^apps\/desktop\/vite\.config\./u.test(file)
		|| /^(?:vite|vitest)\.config\./u.test(file);
}

function isNativeFile(file) {
	return file.startsWith('apps/desktop/src-tauri/');
}

function automaticSafetyRoots(files) {
	const roots = [];
	for (const file of files) {
		const parts = file.split('/');
		if (parts[0] === 'packages' && parts.length >= 3) {
			roots.push(`packages/${parts[1]}`);
			continue;
		}
		if (parts.slice(0, 4).join('/') !== 'apps/desktop/src/features') continue;
		const featureParts = parts.slice(4);
		const fileName = featureParts.at(-1) ?? '';
		const directoryParts = testPattern.test(fileName)
			|| /\.[^/]+$/u.test(fileName)
			? featureParts.slice(0, -1)
			: featureParts;
		if (directoryParts.length === 0) continue;
		const depth = Math.min(directoryParts.length, 2);
		roots.push(`apps/desktop/src/features/${directoryParts.slice(0, depth).join('/')}`);
	}
	return roots;
}

export function buildImpactPlan(files, options = {}) {
	const mode = options.mode ?? 'changed';
	if (!['changed', 'full', 'release'].includes(mode)) {
		throw new Error(`Unsupported self-test mode: ${mode}`);
	}

	const changedFiles = normalizeFiles(files);
	const matchedRules = matchImpactRules(changedFiles);
	const docsOnly = changedFiles.length > 0 && changedFiles.every(isDocumentationFile);
	const fullFrontend = mode !== 'changed'
		|| matchedRules.some(rule => rule.fullFrontend === true);
	const native = mode !== 'changed'
		|| changedFiles.some(isNativeFile)
		|| matchedRules.some(rule => rule.native === true);
	const frontendRelevant = changedFiles.some(isFrontendRelevant)
		|| matchedRules.some(rule => (rule.testFiles?.length ?? 0) > 0);
	const frontendRuntime = changedFiles.some(isFrontendRuntime)
		|| matchedRules.some(rule => rule.frontendBuild === true);

	const riskAreas = new Set();
	for (const rule of matchedRules) {
		for (const area of rule.riskAreas ?? []) riskAreas.add(area);
	}
	if (docsOnly) riskAreas.add('documentation integrity');
	if (changedFiles.length === 0) riskAreas.add('empty change set');

	const explicitTests = matchedRules.flatMap(rule => rule.testFiles ?? []);
	const directTests = changedFiles.filter(file => testPattern.test(file));
	const safetyRoots = automaticSafetyRoots(changedFiles);

	return {
		mode,
		changedFiles,
		docsOnly,
		fullFrontend,
		native,
		release: mode === 'release',
		frontendRelevant: docsOnly ? false : frontendRelevant,
		frontendRuntime: docsOnly ? false : frontendRuntime,
		needsTypecheck: !docsOnly && changedFiles.some(file =>
			/\.(?:ts|tsx|mts|cts)$/u.test(file)
			|| /^(?:tsconfig|vitest\.config|vite\.config)/u.test(file)
		),
		lintInputs: docsOnly
			? []
			: changedFiles.filter(file => lintablePattern.test(file)),
		relatedInputs: docsOnly
			? []
			: changedFiles.filter(file => relatedPattern.test(file) && !file.startsWith('scripts/self-test/')),
		explicitTests: normalizeFiles([...explicitTests, ...directTests]),
		safetyRoots: normalizeFiles(safetyRoots),
		matchedRules: matchedRules.map(rule => ({
			id: rule.id,
			description: rule.description
		})),
		riskAreas: [...riskAreas].sort((left, right) => left.localeCompare(right))
	};
}

export function createExecutionSteps(plan, resolved = {}) {
	const lintInputs = normalizeFiles(resolved.lintInputs ?? plan.lintInputs);
	const relatedInputs = normalizeFiles(resolved.relatedInputs ?? plan.relatedInputs);
	const safetyTests = normalizeFiles(resolved.safetyTests ?? plan.explicitTests);
	const repositoryChecks = resolved.repositoryChecks ?? [{
		id: 'diff-check',
		label: 'Repository whitespace and conflict-marker check',
		args: ['diff', '--check']
	}];
	const steps = repositoryChecks.map(check => ({
		id: check.id,
		label: check.label,
		command: 'git',
		args: check.args,
		cwd: '.'
	}));

	if (plan.fullFrontend) {
		steps.push({
			id: 'frontend-acceptance',
			label: 'Complete frontend acceptance',
			command: 'pnpm',
			args: ['acceptance'],
			cwd: '.'
		});
	} else if (plan.frontendRelevant) {
		if (lintInputs.length > 0) {
			steps.push({
				id: 'lint-changed',
				label: 'ESLint for changed executable files',
				command: 'pnpm',
				args: ['exec', 'eslint', '--max-warnings', '0', ...lintInputs],
				cwd: '.'
			});
		}
		if (plan.needsTypecheck) {
			steps.push({
				id: 'typecheck',
				label: 'Workspace TypeScript contract check',
				command: 'pnpm',
				args: ['typecheck'],
				cwd: '.'
			});
		}
		if (relatedInputs.length > 0) {
			steps.push({
				id: 'related-tests',
				label: 'Vitest dependency-related tests',
				command: 'pnpm',
				args: ['exec', 'vitest', 'related', '--run', '--passWithNoTests', ...relatedInputs],
				cwd: '.'
			});
		}
		if (safetyTests.length > 0) {
			steps.push({
				id: 'safety-tests',
				label: 'Colocated and cross-cutting safety tests',
				command: 'pnpm',
				args: ['exec', 'vitest', 'run', ...safetyTests],
				cwd: '.'
			});
		}
		if (plan.frontendRuntime && relatedInputs.length === 0 && safetyTests.length === 0) {
			steps.push({
				id: 'fallback-tests',
				label: 'Fail-safe complete Vitest suite',
				command: 'pnpm',
				args: ['test'],
				cwd: '.'
			});
		}
		if (plan.frontendRuntime) {
			steps.push({
				id: 'frontend-build',
				label: 'Production frontend build',
				command: 'pnpm',
				args: ['build'],
				cwd: '.'
			});
		}
	}

	if (plan.native) {
		steps.push(
			{
				id: 'cargo-format',
				label: 'Rust formatting contract',
				command: 'cargo',
				args: ['fmt', '--', '--check'],
				cwd: 'apps/desktop/src-tauri'
			},
			{
				id: 'cargo-test',
				label: 'Complete Rust test suite',
				command: 'cargo',
				args: ['test'],
				cwd: 'apps/desktop/src-tauri'
			}
		);
	}

	if (plan.release) {
		steps.push({
			id: 'tauri-release',
			label: 'Tauri release and installer build',
			command: 'pnpm',
			args: ['tauri:build'],
			cwd: '.'
		});
	}

	return steps;
}
