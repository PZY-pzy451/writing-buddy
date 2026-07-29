import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspaceCss = readFileSync(
	'apps/desktop/src/theme/workspace.css',
	'utf8'
).replaceAll('\r\n', '\n');
const tokenCss = readFileSync(
	'apps/desktop/src/theme/tokens.css',
	'utf8'
).replaceAll('\r\n', '\n');

describe('workspace grid contracts', () => {
	it('lets dashboard and system pages override the closed dock editor rows', () => {
		const dockRule = workspaceCss.indexOf('.is-dock-closed .center-workspace');
		const fullHeightRule = workspaceCss.indexOf(
			'.is-system-page .center-workspace,\n.is-dashboard .center-workspace'
		);

		expect(dockRule).toBeGreaterThanOrEqual(0);
		expect(fullHeightRule).toBeGreaterThan(dockRule);
		expect(workspaceCss.slice(fullHeightRule)).toContain(
			'grid-template-rows: minmax(0, 1fr);'
		);
	});

	it('keeps responsive resize handles active and consumes persisted pane sizes', () => {
		expect(workspaceCss).not.toContain(
			'.product-resize-handle {\n\t\tdisplay: none;'
		);
		expect(workspaceCss).not.toContain(
			'--sidebar-width: clamp(280px, calc(160px + 9.375vw), 304px);'
		);
		expect(workspaceCss).toContain(
			'/ var(--rail-width) var(--sidebar-width) minmax(0, 1fr);'
		);
		expect(workspaceCss).toContain(
			'width: clamp(280px, var(--assistant-width-user), calc(100vw - var(--rail-width) - 220px));'
		);
		expect(workspaceCss).toContain(
			'--sidebar-width: clamp(220px, var(--sidebar-width-user), 440px);'
		);
		expect(workspaceCss).toContain(
			'--dock-height: clamp(144px, var(--dock-height-user), 420px);'
		);
		expect(workspaceCss).toContain(
			'/ var(--rail-width) var(--sidebar-width) minmax(280px, 1fr) var(--assistant-width);'
		);
		expect(tokenCss).not.toContain('--sidebar-width:');
		expect(tokenCss).toContain('--sidebar-width-user: 320px;');
		expect(tokenCss).toContain('--assistant-width-user: 360px;');
	});

	it('removes closed sidebars from inline and compact story layouts', () => {
		expect(workspaceCss).toContain(
			'.app-shell.is-sidebar-closed {\n\t--sidebar-width: 0px;'
		);
		expect(workspaceCss).toContain(
			'.is-sidebar-closed .project-sidebar {\n\tdisplay: none;'
		);
		expect(workspaceCss).toContain(
			'.app-shell.is-story-studio.is-sidebar-closed {'
		);
		expect(workspaceCss).toContain(
			'"rail center" minmax(0, 1fr)'
		);
	});

	it('keeps quiet workspace transitions responsive and honors reduced motion', () => {
		expect(workspaceCss).toContain('grid-template-columns 180ms ease,');
		expect(workspaceCss).toContain('grid-template-rows 180ms ease;');
		expect(workspaceCss).toContain('@media (max-width: 1279px)');
		expect(workspaceCss).toContain('@media (max-width: 1099px)');
		expect(workspaceCss).toContain('.mode-planning');
		expect(tokenCss).toContain('@media (prefers-reduced-motion: reduce)');
		expect(tokenCss).toContain('transition-duration: 0.01ms !important;');
	});
});
