export type WriterShortcutId =
	| 'writer-navigator'
	| 'full-search'
	| 'new-chapter'
	| 'quick-create'
	| 'quick-capture'
	| 'ai-quick-actions'
	| 'focus-mode'
	| 'save'
	| 'close-tab'
	| 'restore-tab'
	| 'switch-tab'
	| 'undo';

export interface WriterShortcutDefinition {
	readonly id: WriterShortcutId;
	readonly label: string;
	readonly description: string;
	readonly keys: readonly string[];
	readonly display: string;
}

export const writerShortcutDefinitions: readonly WriterShortcutDefinition[] = [
	{
		id: 'writer-navigator',
		label: '作者导航器',
		description: '跳转章节、正文、资料或运行本地命令。',
		keys: ['Ctrl', 'K'],
		display: 'Ctrl/Cmd+K'
	},
	{
		id: 'full-search',
		label: '完整搜索页',
		description: '打开当前作品的完整搜索结果页。',
		keys: ['Ctrl', 'Shift', 'F'],
		display: 'Ctrl/Cmd+Shift+F'
	},
	{
		id: 'new-chapter',
		label: '新建章节',
		description: '在当前作品中创建并打开一个章节。',
		keys: ['Ctrl', 'N'],
		display: 'Ctrl/Cmd+N'
	},
	{
		id: 'quick-create',
		label: '快速创建',
		description: '打开新建菜单，不会立即写入内容。',
		keys: ['Ctrl', 'Shift', 'N'],
		display: 'Ctrl/Cmd+Shift+N'
	},
	{
		id: 'quick-capture',
		label: '快速记录',
		description: '记录写作想法并关联当前正文位置。',
		keys: ['Ctrl', 'Shift', 'Space'],
		display: 'Ctrl/Cmd+Shift+Space'
	},
	{
		id: 'ai-quick-actions',
		label: 'AI 快捷动作',
		description: '打开现有 AI 动作面板，不会自动开始生成。',
		keys: ['Alt', 'A'],
		display: 'Alt/Option+A'
	},
	{
		id: 'focus-mode',
		label: '专注模式',
		description: '临时隐藏辅助界面，Esc 或 F11 退出。',
		keys: ['F11'],
		display: 'F11'
	},
	{
		id: 'save',
		label: '保存当前正文',
		description: '使用原子写入保存当前编辑内容。',
		keys: ['Ctrl', 'S'],
		display: 'Ctrl/Cmd+S'
	},
	{
		id: 'close-tab',
		label: '关闭标签',
		description: '关闭当前资源标签；未保存正文会先确认。',
		keys: ['Ctrl', 'W'],
		display: 'Ctrl/Cmd+W'
	},
	{
		id: 'restore-tab',
		label: '恢复标签',
		description: '重新打开最近关闭的资源标签。',
		keys: ['Ctrl', 'Shift', 'T'],
		display: 'Ctrl/Cmd+Shift+T'
	},
	{
		id: 'switch-tab',
		label: '切换标签',
		description: '按打开顺序切换到下一个资源标签。',
		keys: ['Ctrl', 'Tab'],
		display: 'Ctrl/Cmd+Tab'
	},
	{
		id: 'undo',
		label: '撤销',
		description: '编辑器内撤销文字；其他位置撤销最近的结构操作。',
		keys: ['Ctrl', 'Z'],
		display: 'Ctrl/Cmd+Z'
	}
] as const;

interface ShortcutEvent {
	readonly key: string;
	readonly code?: string;
	readonly ctrlKey: boolean;
	readonly metaKey: boolean;
	readonly shiftKey: boolean;
	readonly altKey: boolean;
}

export function resolveWriterShortcut(
	event: ShortcutEvent
): WriterShortcutId | undefined {
	const modifier = event.ctrlKey || event.metaKey;
	const key = event.key.toLocaleLowerCase();
	if (
		event.key === 'F11'
		&& !modifier
		&& !event.shiftKey
		&& !event.altKey
	) {
		return 'focus-mode';
	}
	if (
		event.altKey
		&& !modifier
		&& !event.shiftKey
		&& key === 'a'
	) {
		return 'ai-quick-actions';
	}
	if (!modifier || event.altKey) return undefined;
	if (event.shiftKey) {
		if (key === 'f') return 'full-search';
		if (key === 'n') return 'quick-create';
		if (key === 't') return 'restore-tab';
		if (event.code === 'Space' || key === ' ') return 'quick-capture';
		return undefined;
	}
	if (key === 'k') return 'writer-navigator';
	if (key === 'n') return 'new-chapter';
	if (key === 's') return 'save';
	if (key === 'w') return 'close-tab';
	if (key === 'tab') return 'switch-tab';
	if (key === 'z') return 'undo';
	return undefined;
}
