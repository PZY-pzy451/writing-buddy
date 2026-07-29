import { describe, expect, it } from 'vitest';
import { buildImpactPlan, createExecutionSteps } from './impact.mjs';

function stepIds(plan, resolved = {}) {
	return createExecutionSteps(plan, resolved).map(step => step.id);
}

describe('change-aware self-test impact planner', () => {
	it('keeps documentation-only changes on the repository hygiene gate', () => {
		const plan = buildImpactPlan(['docs/progress.md']);

		expect(plan.docsOnly).toBe(true);
		expect(plan.frontendRelevant).toBe(false);
		expect(plan.native).toBe(false);
		expect(stepIds(plan)).toEqual(['diff-check']);
	});

	it('accepts selection-aware repository checks for staged and unstaged changes', () => {
		const plan = buildImpactPlan(['docs/progress.md']);
		const ids = stepIds(plan, {
			repositoryChecks: [
				{
					id: 'diff-check-worktree',
					label: 'worktree',
					args: ['diff', '--check']
				},
				{
					id: 'diff-check-index',
					label: 'index',
					args: ['diff', '--cached', '--check']
				}
			]
		});

		expect(ids).toEqual(['diff-check-worktree', 'diff-check-index']);
	});

	it('selects related, feature, snapshot, type, lint, and build coverage for a character panel', () => {
		const file = 'apps/desktop/src/features/story/characters/CharacterAiPanel.tsx';
		const plan = buildImpactPlan([file]);
		const ids = stepIds(plan, {
			lintInputs: [file],
			relatedInputs: [file],
			safetyTests: [
				'apps/desktop/src/features/story/characters/CharacterCenterPage.test.tsx',
				'apps/desktop/src/features/story/ai-context/StoryKernelGeneratorPanel.test.tsx'
			]
		});

		expect(plan.fullFrontend).toBe(false);
		expect(plan.safetyRoots).toContain('apps/desktop/src/features/story/characters');
		expect(plan.matchedRules.map(rule => rule.id)).toEqual(expect.arrayContaining([
			'snapshot-and-versioning',
			'story-kernel'
		]));
		expect(ids).toEqual([
			'diff-check',
			'lint-changed',
			'typecheck',
			'related-tests',
			'safety-tests',
			'frontend-build'
		]);
	});

	it('adds Rust and prompt-parity safety coverage for a native AI change', () => {
		const plan = buildImpactPlan(['apps/desktop/src-tauri/src/ai/mod.rs']);
		const ids = stepIds(plan, {
			safetyTests: ['apps/desktop/src/features/ai/AiPromptContractParity.test.ts']
		});

		expect(plan.native).toBe(true);
		expect(plan.matchedRules.map(rule => rule.id)).toEqual(expect.arrayContaining([
			'ai-contracts',
			'native-boundary'
		]));
		expect(ids).toEqual([
			'diff-check',
			'safety-tests',
			'cargo-format',
			'cargo-test'
		]);
	});

	it('promotes dependency and test-infrastructure changes to complete frontend acceptance', () => {
		const plan = buildImpactPlan([
			'package.json',
			'scripts/self-test/run.mjs'
		]);

		expect(plan.fullFrontend).toBe(true);
		expect(stepIds(plan)).toEqual(['diff-check', 'frontend-acceptance']);
	});

	it('runs full frontend and native gates in full mode', () => {
		const plan = buildImpactPlan(['docs/progress.md'], { mode: 'full' });

		expect(stepIds(plan)).toEqual([
			'diff-check',
			'frontend-acceptance',
			'cargo-format',
			'cargo-test'
		]);
	});

	it('adds Tauri packaging only in release mode', () => {
		const plan = buildImpactPlan(['apps/desktop/src/App.tsx'], { mode: 'release' });

		expect(stepIds(plan).at(-1)).toBe('tauri-release');
	});

	it('normalizes Windows paths and keeps deleted source paths in impact selection', () => {
		const plan = buildImpactPlan([
			'apps\\desktop\\src\\features\\story\\plots\\PlotAiPanel.tsx',
			'apps/desktop/src/features/story/plots/PlotAiPanel.tsx'
		]);

		expect(plan.changedFiles).toEqual([
			'apps/desktop/src/features/story/plots/PlotAiPanel.tsx'
		]);
		expect(plan.safetyRoots).toEqual([
			'apps/desktop/src/features/story/plots'
		]);
	});

	it('falls back to the complete Vitest suite when runtime code has no discoverable tests', () => {
		const plan = buildImpactPlan(['apps/desktop/src/unknown-runtime.json']);
		const ids = stepIds(plan, {
			lintInputs: [],
			relatedInputs: [],
			safetyTests: []
		});

		expect(ids).toEqual([
			'diff-check',
			'fallback-tests',
			'frontend-build'
		]);
	});
});
