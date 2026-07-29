import {
	dispatchWorkspaceShortcut,
	resolveWorkspaceShortcut
} from './workspaceShortcuts';

function shortcutEvent(
	code: string,
	overrides: KeyboardEventInit = {}
): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		code,
		ctrlKey: true,
		cancelable: true,
		...overrides
	});
}

function shortcutActions() {
	return {
		toggleSidebar: vi.fn(),
		toggleAssistant: vi.fn(),
		toggleDock: vi.fn()
	};
}

describe('workspace layout shortcuts', () => {
	it('dispatches the VS Code primary-sidebar shortcut for Control and Meta', () => {
		for (const event of [
			shortcutEvent('KeyB'),
			shortcutEvent('KeyB', { ctrlKey: false, metaKey: true })
		]) {
			const actions = shortcutActions();
			expect(dispatchWorkspaceShortcut(event, actions)).toBe(true);
			expect(actions.toggleSidebar).toHaveBeenCalledOnce();
			expect(actions.toggleAssistant).not.toHaveBeenCalled();
			expect(actions.toggleDock).not.toHaveBeenCalled();
			expect(event.defaultPrevented).toBe(true);
		}
	});

	it('dispatches secondary-sidebar and task-dock shortcuts', () => {
		const assistantActions = shortcutActions();
		const assistantEvent = shortcutEvent('KeyB', { altKey: true });
		expect(dispatchWorkspaceShortcut(assistantEvent, assistantActions)).toBe(true);
		expect(assistantActions.toggleAssistant).toHaveBeenCalledOnce();
		expect(assistantEvent.defaultPrevented).toBe(true);

		const dockActions = shortcutActions();
		const dockEvent = shortcutEvent('KeyJ', { ctrlKey: false, metaKey: true });
		expect(dispatchWorkspaceShortcut(dockEvent, dockActions)).toBe(true);
		expect(dockActions.toggleDock).toHaveBeenCalledOnce();
		expect(dockEvent.defaultPrevented).toBe(true);
	});

	it('ignores conflicting modifiers, repeat, composition, and unrelated keys', () => {
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyB', { shiftKey: true }))).toBeUndefined();
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyJ', { altKey: true }))).toBeUndefined();
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyB', { repeat: true }))).toBeUndefined();
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyB', { isComposing: true }))).toBeUndefined();
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyK'))).toBeUndefined();
		expect(resolveWorkspaceShortcut(shortcutEvent('KeyB', {
			ctrlKey: false,
			metaKey: false
		}))).toBeUndefined();
	});

	it('leaves unrecognized events and actions untouched', () => {
		const actions = shortcutActions();
		const event = shortcutEvent('KeyJ', { shiftKey: true });
		expect(dispatchWorkspaceShortcut(event, actions)).toBe(false);
		expect(event.defaultPrevented).toBe(false);
		expect(actions.toggleSidebar).not.toHaveBeenCalled();
		expect(actions.toggleAssistant).not.toHaveBeenCalled();
		expect(actions.toggleDock).not.toHaveBeenCalled();
	});
});
