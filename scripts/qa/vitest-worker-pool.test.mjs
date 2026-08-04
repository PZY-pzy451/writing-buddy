import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('supported Vitest worker pool', () => {
	it('uses the bounded thread pool verified on Windows and Node 24', () => {
		const config = readFileSync(resolve(process.cwd(), 'vitest.config.ts'), 'utf8');

		expect(config).toMatch(/pool:\s*'threads'/u);
		expect(config).toMatch(/maxWorkers:\s*2/u);
	});
});
