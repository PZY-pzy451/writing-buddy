import { describe, expect, it } from 'vitest';
import { discoverVitestTests } from './test-discovery.mjs';

describe('Vitest inventory discovery', () => {
	it('discovers ordinary tests and source locations', () => {
		const tests = discoverVitestTests('ordinary.test.ts', `
			it('keeps author data', () => {});
			test.skip('reports a reason', () => {});
		`);

		expect(tests).toMatchObject([
			{ title: 'keeps author data', declarationLine: 2, parameterized: false },
			{ title: 'reports a reason', declarationLine: 3, parameterized: false }
		]);
	});

	it('expands literal and identifier-backed each tables', () => {
		const tests = discoverVitestTests('parameterized.test.ts', `
			const resourceTypes = ['character', 'item'] as const;
			it.each(resourceTypes)('parses %s', () => {});
			it.each([[1, true], [2, false]] satisfies readonly unknown[][])(
				'checks row %o',
				() => {}
			);
		`);

		expect(tests.map(test => test.title)).toEqual([
			'parses character',
			'parses item',
			'checks row 1',
			'checks row 2'
		]);
		expect(tests.every(test => test.parameterizationResolved)).toBe(true);
	});

	it('expands tests declared inside a statically bounded object loop', () => {
		const tests = discoverVitestTests('loop.test.ts', `
			const contracts = { STORY: 'one', CHARACTER: 'two', ITEM: 'three' } as const;
			for (const [name] of Object.entries(contracts)) {
				it(\`keeps \${name} aligned\`, () => {});
			}
		`);

		expect(tests.map(test => test.title)).toEqual([
			'keeps STORY aligned',
			'keeps CHARACTER aligned',
			'keeps ITEM aligned'
		]);
	});

	it('marks unknown each tables without inventing case counts', () => {
		const tests = discoverVitestTests('dynamic.test.ts', `
			it.each(loadCases())('handles %s', () => {});
		`);

		expect(tests).toMatchObject([{
			title: 'handles %s',
			parameterized: true,
			parameterizationResolved: false
		}]);
	});
});
