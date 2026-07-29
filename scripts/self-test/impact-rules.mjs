function matchesAny(file, patterns) {
	return patterns.some(pattern => pattern.test(file));
}

export const impactRules = [
	{
		id: 'global-test-infrastructure',
		description: 'Global test, dependency, or build configuration',
		patterns: [
			/^package\.json$/,
			/^pnpm-lock\.yaml$/,
			/^pnpm-workspace\.yaml$/,
			/^tsconfig(?:\.[^/]+)?\.json$/,
			/^vitest\.config\.[cm]?[jt]s$/,
			/^vite\.config\.[cm]?[jt]s$/,
			/^eslint\.config\.[cm]?[jt]s$/,
			/^scripts\/self-test\//
		],
		riskAreas: ['test infrastructure', 'workspace dependency graph'],
		fullFrontend: true,
		frontendBuild: true
	},
	{
		id: 'ai-contracts',
		description: 'AI request, output, privacy, and prompt parity contracts',
		patterns: [
			/^packages\/ai\//,
			/^packages\/ai-actions\//,
			/^apps\/desktop\/src\/features\/ai\//,
			/^apps\/desktop\/src-tauri\/src\/ai\//
		],
		riskAreas: ['AI contracts', 'prompt parity', 'privacy boundaries'],
		testFiles: [
			'apps/desktop/src/features/ai/AiPromptContractParity.test.ts',
			'apps/desktop/src/features/ai/AiExperience.test.tsx',
			'apps/desktop/src/features/ai/errors/AiErrorPresentation.test.ts',
			'packages/ai/src/index.test.ts',
			'packages/ai-actions/src/apply/AiApplyService.test.ts'
		]
	},
	{
		id: 'snapshot-and-versioning',
		description: 'Snapshot-before-write, backup, and version safety',
		patterns: [
			/^packages\/version\//,
			/^packages\/backup\//,
			/^packages\/platform-ports\//,
			/^apps\/desktop\/src\/platform\/bridge\.ts$/,
			/^apps\/desktop\/src\/features\/story\/(?:ai-context|characters|assets|worldbuilding|relationships|timeline|plots|extraction)\//
		],
		riskAreas: ['snapshot ordering', 'version history', 'fail-before-write'],
		testFiles: [
			'apps/desktop/src/features/story/ai-context/StoryKernelGeneratorPanel.test.tsx',
			'packages/ai-actions/src/apply/AiApplyService.test.ts',
			'packages/backup/src/index.test.ts'
		]
	},
	{
		id: 'story-kernel',
		description: 'Story Kernel schema, repository, and author-confirmed writes',
		patterns: [
			/^packages\/story-kernel\//,
			/^apps\/desktop\/src\/features\/story\//
		],
		riskAreas: ['Story Kernel schema', 'resource transactions', 'candidate confirmation'],
		testFiles: [
			'packages/story-kernel/src/schema/schemaRegistry.test.ts',
			'packages/story-kernel/src/repository/StoryRepository.test.ts'
		]
	},
	{
		id: 'project-persistence',
		description: 'Project structure, filesystem ports, and persistence',
		patterns: [
			/^packages\/(?:domain|project|resource|platform-ports)\//,
			/^apps\/desktop\/src\/features\/projects\//,
			/^apps\/desktop\/src-tauri\/src\/(?:commands|filesystem|story)\//
		],
		riskAreas: ['project persistence', 'revision safety', 'filesystem boundaries'],
		testFiles: [
			'apps/desktop/src/features/projects/application/ProjectOpenService.test.ts',
			'apps/desktop/src/features/projects/application/ProjectCreationService.test.ts',
			'apps/desktop/src/features/projects/application/ProjectStructureMoveService.test.ts',
			'packages/project/src/index.test.ts'
		]
	},
	{
		id: 'desktop-shell-and-layout',
		description: 'Desktop bootstrap, shell, theme, and responsive layout',
		patterns: [
			/^apps\/desktop\/src\/(?:App|main)\.tsx$/,
			/^apps\/desktop\/src\/app\/store\.ts$/,
			/^apps\/desktop\/src\/shell\//,
			/^apps\/desktop\/src\/theme\//,
			/^apps\/desktop\/src\/styles\//,
			/^apps\/desktop\/src\/.*\.css$/
		],
		riskAreas: ['desktop bootstrap', 'workspace layout', 'theme behavior'],
		testFiles: [
			'apps/desktop/tests/App.test.tsx',
			'apps/desktop/tests/e2e/storyforge-layout.spec.ts',
			'apps/desktop/src/theme/workspaceLayout.test.ts',
			'apps/desktop/src/shell/workspaceResize.test.ts'
		],
		frontendBuild: true
	},
	{
		id: 'native-boundary',
		description: 'Tauri command, capability, or native runtime boundary',
		patterns: [
			/^apps\/desktop\/src-tauri\//
		],
		riskAreas: ['native command boundary', 'Tauri runtime'],
		native: true
	}
];

export function matchImpactRules(files) {
	return impactRules.filter(rule => files.some(file => matchesAny(file, rule.patterns)));
}
