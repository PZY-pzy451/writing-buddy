import { delimiter, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolvePnpmCommand } from './resolvePnpmCommand.mjs';

describe('safe pnpm command resolution', () => {
	it('runs an explicit pnpm entry through Node without a shell', () => {
		const pnpmEntry = join('tools', 'pnpm.cjs');
		const exists = vi.fn(candidate => candidate === pnpmEntry);

		expect(resolvePnpmCommand(['test'], {
			environment: { npm_execpath: pnpmEntry },
			executable: 'node-24',
			exists
		})).toEqual({
			executable: 'node-24',
			args: [pnpmEntry, 'test'],
			shell: false
		});
	});

	it('finds the bundled pnpm entry from PATH without using pnpm.cmd', () => {
		const firstDirectory = join('runtime', 'bin');
		const secondDirectory = join('codex', 'bin');
		const pnpmEntry = join(secondDirectory, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');

		const command = resolvePnpmCommand(['acceptance'], {
			environment: { PATH: `${firstDirectory}${delimiter}${secondDirectory}` },
			executable: 'node-24',
			exists: candidate => candidate === pnpmEntry
		});

		expect(command).toEqual({
			executable: 'node-24',
			args: [pnpmEntry, 'acceptance'],
			shell: false
		});
		expect(command.executable).not.toMatch(/pnpm\.cmd$/u);
	});

	it('fails closed when no safe pnpm JavaScript entry can be found', () => {
		expect(() => resolvePnpmCommand(['test'], {
			environment: { PATH: join('missing', 'bin') },
			exists: () => false
		})).toThrow('Could not resolve the pnpm JavaScript entry point.');
	});
});
