export type WorkspaceShortcutId = 'sidebar' | 'assistant' | 'dock';

export const workspaceShortcutDefinitions: readonly {
	readonly id: WorkspaceShortcutId;
	readonly label: string;
	readonly description: string;
	readonly display: string;
	readonly keys: readonly string[];
	readonly ariaKeyShortcuts: string;
}[] = [
	{
		id: 'sidebar',
		label: '作品侧栏',
		description: '显示或隐藏作品侧栏',
		display: 'Ctrl+B',
		keys: ['Ctrl', 'B'],
		ariaKeyShortcuts: 'Control+B Meta+B'
	},
	{
		id: 'assistant',
		label: '写作助手',
		description: '显示或隐藏右侧写作助手',
		display: 'Ctrl+Alt+B',
		keys: ['Ctrl', 'Alt', 'B'],
		ariaKeyShortcuts: 'Control+Alt+B Meta+Alt+B'
	},
	{
		id: 'dock',
		label: '任务区',
		description: '显示或隐藏底部任务与审校区',
		display: 'Ctrl+J',
		keys: ['Ctrl', 'J'],
		ariaKeyShortcuts: 'Control+J Meta+J'
	}
] as const;

type WorkspaceShortcutEvent = Pick<
	KeyboardEvent,
	'altKey' | 'code' | 'ctrlKey' | 'isComposing' | 'metaKey' | 'repeat' | 'shiftKey'
>;

interface WorkspaceShortcutActions {
	readonly toggleSidebar: () => void;
	readonly toggleAssistant: () => void;
	readonly toggleDock: () => void;
}

export function resolveWorkspaceShortcut(
	event: WorkspaceShortcutEvent
): WorkspaceShortcutId | undefined {
	if (
		(!event.ctrlKey && !event.metaKey)
		|| event.shiftKey
		|| event.repeat
		|| event.isComposing
	) {
		return undefined;
	}
	if (event.code === 'KeyB') {
		return event.altKey ? 'assistant' : 'sidebar';
	}
	if (event.code === 'KeyJ' && !event.altKey) {
		return 'dock';
	}
	return undefined;
}

export function dispatchWorkspaceShortcut(
	event: KeyboardEvent,
	actions: WorkspaceShortcutActions
): boolean {
	const shortcut = resolveWorkspaceShortcut(event);
	if (!shortcut) {
		return false;
	}
	event.preventDefault();
	if (shortcut === 'sidebar') actions.toggleSidebar();
	if (shortcut === 'assistant') actions.toggleAssistant();
	if (shortcut === 'dock') actions.toggleDock();
	return true;
}
