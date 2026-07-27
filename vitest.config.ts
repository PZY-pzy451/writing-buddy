import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@writing-buddy/domain': `${root}packages/domain/src/index.ts`,
			'@writing-buddy/project': `${root}packages/project/src/index.ts`,
			'@writing-buddy/resource': `${root}packages/resource/src/index.ts`,
			'@writing-buddy/review': `${root}packages/review/src/index.ts`,
			'@writing-buddy/ai': `${root}packages/ai/src/index.ts`,
			'@writing-buddy/ai-actions': `${root}packages/ai-actions/src/index.ts`,
			'@writing-buddy/version': `${root}packages/version/src/index.ts`,
			'@writing-buddy/backup': `${root}packages/backup/src/index.ts`,
			'@writing-buddy/schema': `${root}packages/schema/src/index.ts`,
			'@writing-buddy/migration': `${root}packages/migration/src/index.ts`,
			'@writing-buddy/platform-ports': `${root}packages/platform-ports/src/index.ts`,
			'@writing-buddy/compatibility': `${root}packages/compatibility/src/index.ts`,
			'@writing-buddy/test-support': `${root}packages/test-support/src/index.ts`
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		maxWorkers: 4,
		setupFiles: ['./apps/desktop/tests/setup.tsx'],
		include: [
			'packages/**/*.test.ts',
			'apps/desktop/**/*.test.ts?(x)',
			'apps/desktop/tests/e2e/**/*.spec.ts?(x)'
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary', 'html'],
			include: ['packages/**/*.ts', 'apps/desktop/src/**/*.ts?(x)'],
			exclude: ['**/*.test.ts?(x)', '**/main.tsx']
		}
	}
});
