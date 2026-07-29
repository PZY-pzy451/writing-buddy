import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workspace = readFileSync(
	join(process.cwd(), 'apps/desktop/src/theme/workspace.css'),
	'utf8'
);
const interaction = readFileSync(
	join(process.cwd(), 'apps/desktop/src/features/shared/interaction/interaction.css'),
	'utf8'
);
const timeline = readFileSync(
	join(process.cwd(), 'apps/desktop/src/features/story/timeline/TimelinePage.css'),
	'utf8'
);

describe('Gate G interaction feedback contract', () => {
	it('keeps tree handles quiet until hover, focus or active drag', () => {
		expect(workspace).toMatch(/\.tree-drag-handle\s*\{[^}]*opacity:\s*0/s);
		expect(workspace).toContain('.tree-row:hover .tree-drag-handle');
		expect(workspace).toContain('.tree-row:focus-within .tree-drag-handle');
		expect(workspace).toContain('.tree-row[data-interaction-state="drag-source"] .tree-drag-handle');
	});

	it('uses the specified panel and toast timing without layout motion', () => {
		expect(interaction).toContain('interaction-panel-in 200ms');
		expect(interaction).toContain('interaction-toast-in 160ms');
		expect(interaction).toMatch(/@keyframes interaction-toast-in[\s\S]*opacity:\s*0[\s\S]*translateY\(8px\)/);
	});

	it('provides responsive dialogs, 44px actions and reduced motion', () => {
		expect(workspace).toMatch(/\.chapter-create-dialog > footer button\s*\{[^}]*min-height:\s*44px/s);
		expect(workspace).toContain('@media (max-width: 640px), (max-height: 600px)');
		expect(workspace).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.chapter-create-dialog/);
		expect(interaction).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.interaction-undo-toast/);
		expect(timeline).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.timeline-reorder-card/);
	});
});
