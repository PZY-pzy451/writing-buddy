import {
	createDefaultWriterWorkspaceLayouts,
	parseWriterWorkspaceLayouts,
	updateWriterWorkspaceLayout
} from './writerWorkspace';

describe('writer workspace layout contract', () => {
	it('starts writing quietly with a compact chapter tree and hidden auxiliary panes', () => {
		const layouts = createDefaultWriterWorkspaceLayouts();

		expect(layouts.writing).toMatchObject({
			sidebarVisible: true,
			assistantVisible: false,
			dockVisible: false,
			inspectorVisible: false
		});
		expect(layouts.writing.projectSidebarWidth).toBeGreaterThanOrEqual(240);
		expect(layouts.writing.projectSidebarWidth).toBeLessThanOrEqual(280);
	});

	it('keeps manual geometry independent for writing, planning, reference, review and history', () => {
		const defaults = createDefaultWriterWorkspaceLayouts();
		const changed = updateWriterWorkspaceLayout(defaults, 'planning', {
			projectSidebarWidth: 388,
			assistantVisible: true
		});

		expect(changed.planning.projectSidebarWidth).toBe(388);
		expect(changed.planning.assistantVisible).toBe(true);
		expect(changed.writing).toEqual(defaults.writing);
		expect(changed.reference).toEqual(defaults.reference);
		expect(changed.review).toEqual(defaults.review);
		expect(changed.history).toEqual(defaults.history);
	});

	it('repairs corrupt persisted layouts without losing valid workspace customizations', () => {
		const parsed = parseWriterWorkspaceLayouts({
			writing: {
				projectSidebarWidth: 410,
				assistantWidth: 420,
				assistantVisible: false,
				inspectorVisible: false,
				sidebarVisible: true,
				dockHeight: 280,
				dockVisible: false
			},
			planning: 'corrupt'
		});

		expect(parsed.writing.projectSidebarWidth).toBe(410);
		expect(parsed.planning).toEqual(createDefaultWriterWorkspaceLayouts().planning);
		expect(parsed.history).toEqual(createDefaultWriterWorkspaceLayouts().history);
	});
});
