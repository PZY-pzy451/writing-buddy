import { readFileSync } from 'node:fs';

const tokensCss = readFileSync('apps/desktop/src/theme/tokens.css', 'utf8');
const semanticTokens = [
	'--highlight-selected-bg',
	'--highlight-selected-fg',
	'--highlight-hover-bg',
	'--highlight-hover-border',
	'--highlight-focus',
	'--highlight-focus-halo',
	'--highlight-drag-source-bg',
	'--highlight-drag-source-border',
	'--highlight-drag-target-bg',
	'--highlight-drag-target-border',
	'--highlight-drag-invalid-bg',
	'--highlight-drag-invalid-border',
	'--highlight-ai-bg',
	'--highlight-ai-fg',
	'--highlight-conflict-bg',
	'--highlight-conflict-fg',
	'--highlight-warning-bg',
	'--highlight-warning-fg',
	'--highlight-success-bg',
	'--highlight-success-fg',
	'--highlight-info-bg',
	'--highlight-info-fg',
	'--entity-character-bg',
	'--entity-character-border',
	'--entity-location-bg',
	'--entity-location-border',
	'--entity-item-bg',
	'--entity-item-border',
	'--entity-foreshadowing-bg',
	'--entity-foreshadowing-border'
] as const;

function block(selector: string, nextSelector: string): string {
	const start = tokensCss.indexOf(selector);
	const end = tokensCss.indexOf(nextSelector, start + selector.length);
	return tokensCss.slice(start, end < 0 ? undefined : end);
}

describe('semantic interaction token contract', () => {
	it('defines every highlight token for Paper, Midnight, Fog, and Focus', () => {
		const themes = [
			block(':root {', '.theme-midnight'),
			block('.theme-midnight', '.theme-fog'),
			block('.theme-fog', '.theme-focus'),
			block('.theme-focus', '.accent-blue')
		];
		for (const theme of themes) {
			for (const token of semanticTokens) {
				expect(theme, `${token} missing from theme`).toContain(token);
			}
		}
	});

	it('uses the handoff Paper and Deep Night focus and selection colors', () => {
		expect(tokensCss).toContain('--highlight-selected-bg: #f1dfcf');
		expect(tokensCss).toContain('--highlight-selected-fg: #a85c31');
		expect(tokensCss).toContain('--highlight-focus: #4f7db8');
		expect(tokensCss).toContain('--entity-character-bg: #eaf2fc');
		expect(tokensCss).toContain('--entity-foreshadowing-border: #c17a2e');
		expect(block('.theme-midnight', '.theme-fog')).toContain('--highlight-selected-bg: #3a2a22');
		expect(block('.theme-midnight', '.theme-fog')).toContain('--highlight-focus: #78a5d8');
	});

	it('keeps a visible outline and readable disabled state', () => {
		expect(tokensCss).toContain('outline: 2px solid var(--highlight-focus)');
		expect(tokensCss).not.toContain('button:disabled {\n\tcursor: not-allowed;\n\topacity:');
	});
});
