import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const themeDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = join(themeDirectory, '..');

function filesBelow(directory: string, extension: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const path = join(directory, entry.name);
		return entry.isDirectory()
			? filesBelow(path, extension)
			: extname(entry.name) === extension
				? [path]
				: [];
	});
}

function cssRules(source: string): readonly { readonly selector: string; readonly declarations: string }[] {
	return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({
		selector: match[1] ?? '',
		declarations: match[2] ?? ''
	}));
}

describe('Y6 visual contract', () => {
	it('defines the shared control and icon tiers', () => {
		const tokens = readFileSync(join(themeDirectory, 'tokens.css'), 'utf8');

		expect(tokens).toContain('--control-height-sm: 32px');
		expect(tokens).toContain('--control-height-md: 40px');
		expect(tokens).toContain('--control-height-lg: 44px');
		expect(tokens).toContain('--icon-size-sm: 16px');
		expect(tokens).toContain('--icon-size-md: 18px');
		expect(tokens).toContain('--icon-size-lg: 20px');
	});

	it('keeps shell controls on their declared tiers and supports reduced motion', () => {
		const contract = readFileSync(join(themeDirectory, 'visualPolish.css'), 'utf8');

		expect(contract).toMatch(/\.icon-button\s*\{[^}]*var\(--control-height-lg\)/s);
		expect(contract).toMatch(/\.icon-button\.compact\s*\{[^}]*var\(--control-height-md\)/s);
		expect(contract).toMatch(/\.status-bar button\s*\{[^}]*var\(--control-height-sm\)/s);
		expect(contract).toMatch(/button:disabled\s*\{[^}]*color:\s*var\(--text-secondary\)/s);
		expect(contract).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
	});

	it('prevents jumpy hover motion and low-opacity disabled states', () => {
		const rules = filesBelow(sourceDirectory, '.css')
			.flatMap(path => cssRules(readFileSync(path, 'utf8')));
		const jumpyHoverRules = rules.filter(rule =>
			rule.selector.includes(':hover')
			&& /transform:\s*translateY\(-1px\)/.test(rule.declarations)
		);
		const fadedDisabledRules = rules.filter(rule =>
			/(:disabled|\[disabled\])/.test(rule.selector)
			&& /opacity:\s*0?\.[0-7](?:\d+)?/.test(rule.declarations)
		);

		expect(jumpyHoverRules).toEqual([]);
		expect(fadedDisabledRules).toEqual([]);
	});

	it('does not reintroduce intermediate one-off control icon sizes', () => {
		const disallowed = filesBelow(sourceDirectory, '.tsx').flatMap(path => {
			const source = readFileSync(path, 'utf8');
			return [...source.matchAll(/size=\{(14|15|17|19|21)\}/g)]
				.map(match => `${path}:${match[1]}`);
		});

		expect(disallowed).toEqual([]);
	});
});
