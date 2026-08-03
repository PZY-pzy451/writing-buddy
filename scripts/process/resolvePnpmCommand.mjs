import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export function resolvePnpmCommand(args, options = {}) {
	const environment = options.environment ?? process.env;
	const executable = options.executable ?? process.execPath;
	const exists = options.exists ?? existsSync;
	const explicit = environment.npm_execpath;
	const pathValue = environment.Path ?? environment.PATH ?? '';
	const candidates = [
		...(explicit ? [explicit] : []),
		...pathValue.split(delimiter).filter(Boolean).map(directory => (
			join(directory, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
		))
	];
	const pnpmEntry = [...new Set(candidates)].find(candidate => exists(candidate));
	if (!pnpmEntry) {
		throw new Error('Could not resolve the pnpm JavaScript entry point.');
	}
	return {
		executable,
		args: [pnpmEntry, ...args],
		shell: false
	};
}
