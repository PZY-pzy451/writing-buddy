import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspaceCss = readFileSync(
	'apps/desktop/src/theme/workspace.css',
	'utf8'
);

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
});
