import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync('apps/desktop/src/theme/workspace.css', 'utf8');

describe('outline quality check layout', () => {
	it('keeps explicit focus, touch targets, semantic state, and bounded scrolling', () => {
		expect(workspace).toMatch(/\.outline-quality-panel\s*\{[^}]*overflow:\s*hidden/s);
		expect(workspace).toMatch(/\.outline-quality-columns > section > header > button\s*\{[^}]*min-height:\s*44px/s);
		expect(workspace).toMatch(/\.outline-quality-issue > button\s*\{[^}]*min-height:\s*44px/s);
		expect(workspace).toContain('.outline-quality-panel button:focus-visible');
		expect(workspace).toMatch(/@media \(max-width: 1099px\)[\s\S]*?\.outline-quality-columns\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
	});

	it('fits a narrow viewport without forcing a three-column canvas', () => {
		expect(workspace).toMatch(/@media \(max-width: 719px\)[\s\S]*?\.outline-quality-panel\s*\{[^}]*position:\s*fixed/s);
		expect(workspace).toMatch(/@media \(max-width: 719px\)[\s\S]*?\.outline-quality-panel\s*\{[^}]*inset:\s*8px/s);
		expect(workspace).toMatch(/@media \(max-width: 719px\)[\s\S]*?\.structured-outline-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
	});
});
