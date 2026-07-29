import { useAppStore } from '../app/store';
import { clampWorkspaceSize, workspaceResizeBounds } from './workspaceResize';

describe('workspace resize bounds', () => {
	beforeEach(() => {
		useAppStore.setState({
			sidebarWidth: workspaceResizeBounds.sidebar.defaultValue,
			assistantWidth: workspaceResizeBounds.assistant.defaultValue,
			dockHeight: workspaceResizeBounds.dock.defaultValue
		});
	});

	it('clamps and rounds every persisted pane size', () => {
		expect(clampWorkspaceSize('sidebar', 219.6)).toBe(220);
		expect(clampWorkspaceSize('sidebar', 411.7)).toBe(412);
		expect(clampWorkspaceSize('assistant', 900)).toBe(480);
		expect(clampWorkspaceSize('dock', -1)).toBe(144);
	});

	it('stores the defined VS Code-style resize range', () => {
		useAppStore.getState().setSidebarWidth(999);
		useAppStore.getState().setAssistantWidth(100);
		useAppStore.getState().setDockHeight(511.6);

		const state = useAppStore.getState();
		expect(state.sidebarWidth).toBe(440);
		expect(state.assistantWidth).toBe(280);
		expect(state.dockHeight).toBe(420);
	});
});
