import {
	BookOpenText,
	Focus,
	MoreHorizontal,
	PanelLeftClose,
	PanelLeftOpen,
	PanelRightClose,
	PanelRightOpen,
	RotateCcw,
	Save,
	Search,
	Settings2,
	StickyNote,
	Sparkles
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { openAiQuickActions } from '../features/ai/drawer/openAiQuickActions';
import { GlobalCreateMenu } from '../features/projects/ui/GlobalCreateMenu';
import { SaveStateIndicator } from '../features/save/SaveStateIndicator';

export function TopBar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const openWriterNavigator = useAppStore(state => state.openWriterNavigator);
	const save = useAppStore(state => state.save);
	const saveState = useAppStore(state => state.saveState);
	const session = useAppStore(state => state.session);
	const focusMode = useAppStore(state => state.focusMode);
	const toggleFocus = useAppStore(state => state.toggleFocus);
	const sidebarOpen = useAppStore(state => state.sidebarOpen);
	const toggleSidebar = useAppStore(state => state.toggleSidebar);
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const activeMode = useAppStore(state => state.activeMode);
	const toggleAssistant = useAppStore(state => state.toggleAssistant);
	const resetWorkspaceLayout = useAppStore(state => state.resetWorkspaceLayout);
	const openQuickCapture = useAppStore(state => state.openQuickCapture);
	const setMode = useAppStore(state => state.setMode);
	const activeResource = useAppStore(state => state.activeResource);
	const quietWriterHeader = activeMode === 'works' && Boolean(activeResource);

	if (focusMode) {
		return (
			<header className="top-bar focus-top-bar" data-tauri-drag-region>
				<div className="focus-context" aria-label="当前专注章节">
					<BookOpenText size={18} />
					<span>{snapshot?.project.title ?? 'Writing Buddy'}</span>
					{activeResource && <><span>/</span><strong>{activeResource.title}</strong></>}
				</div>
				<div className="top-actions">
					<SaveStateIndicator className="focus-save-status" compact />
					<button
						className="ghost-button focus-exit"
						type="button"
						aria-label="退出专注"
						aria-keyshortcuts="Escape F11"
						onClick={toggleFocus}
					>
						<Focus size={18} />
						<span>退出专注</span>
						<kbd>Esc</kbd>
					</button>
				</div>
			</header>
		);
	}

	return (
		<header className="top-bar" data-tauri-drag-region>
			<div className="brand-lockup">
				<span className="brand-mark" aria-hidden="true"><BookOpenText size={20} /></span>
				<span className="brand-name">Writing Buddy</span>
			</div>
			<div className="project-crumb" aria-label="当前作品">
				<span>
					{snapshot?.project.title ?? '尚未打开作品'}
					{activeResource ? ` / ${activeResource.title}` : ''}
				</span>
			</div>
			<button
				className="project-search"
				type="button"
				onClick={openWriterNavigator}
				aria-label="打开作者导航器"
				aria-keyshortcuts="Control+K Meta+K"
			>
				<Search size={18} aria-hidden="true" />
				<span>搜索章节、正文、资料或命令</span>
				<kbd>Ctrl K</kbd>
			</button>
			<div className="top-actions">
				<GlobalCreateMenu shortcutOnly={quietWriterHeader} />
				<button
					className="ghost-button"
					type="button"
					aria-label={saveState.type === 'saving'
						? '正在保存'
						: session?.state.dirty ? '保存' : '已保存'}
					onClick={() => void save()}
					disabled={!session?.state.dirty || saveState.type === 'saving'}
				>
					<Save size={18} />
					<span>{saveState.type === 'saving'
						? '正在保存…'
						: session?.state.dirty ? '保存' : '已保存'}</span>
				</button>
				<button
					className={`ghost-button ${focusMode ? 'is-active' : ''}`}
					type="button"
					aria-label={focusMode ? '退出专注' : '专注模式'}
					aria-keyshortcuts="F11"
					onClick={toggleFocus}
				>
					<Focus size={18} />
					<span>{focusMode ? '退出专注' : '专注模式'}</span>
				</button>
				<details className="writer-more-menu">
					<summary aria-label={quietWriterHeader ? '更多写作操作' : '更多全局操作'} role="button"><MoreHorizontal size={20} /></summary>
					<div
						role="menu"
						onClickCapture={event => {
							if ((event.target as HTMLElement).closest('[role="menuitem"]')) {
								event.currentTarget.closest('details')?.removeAttribute('open');
							}
						}}
					>
						{quietWriterHeader && (
							<>
							<button type="button" role="menuitem" onClick={toggleSidebar}>
								{sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
								{sidebarOpen ? '收起章节树' : '展开章节树'}
							</button>
							<button type="button" role="menuitem" onClick={toggleAssistant}>
								{assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
								{assistantOpen ? '收起写作助手' : '打开写作助手'}
							</button>
							<button type="button" role="menuitem" onClick={openAiQuickActions}>
								<Sparkles size={18} />AI 快速动作
							</button>
							<button type="button" role="menuitem" onClick={resetWorkspaceLayout}>
								<RotateCcw size={18} />恢复写作布局
							</button>
							</>
						)}
						<button type="button" role="menuitem" onClick={() => openQuickCapture()}>
							<StickyNote size={18} />快速记录
						</button>
						<button type="button" role="menuitem" onClick={() => setMode('settings')}>
							<Settings2 size={18} />设置
						</button>
						<button type="button" role="menuitem" onClick={() => setMode('ai')}>
							<Sparkles size={18} />AI 连接测试
						</button>
					</div>
				</details>
				{!quietWriterHeader && Boolean(snapshot) && ['works', 'planning', 'references'].includes(activeMode) && (
					<>
						<button
							className="icon-button"
							type="button"
							onClick={toggleSidebar}
							aria-label={sidebarOpen ? '收起作品侧栏' : '展开作品侧栏'}
							aria-keyshortcuts="Control+B Meta+B"
							title={`${sidebarOpen ? '收起作品侧栏' : '展开作品侧栏'} (Ctrl+B)`}
						>
							{sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
						</button>
						<button
							className="icon-button"
							type="button"
							onClick={toggleAssistant}
							aria-label={assistantOpen ? '收起写作助手' : '展开写作助手'}
							aria-keyshortcuts="Control+Alt+B Meta+Alt+B"
							title={`${assistantOpen ? '收起写作助手' : '展开写作助手'} (Ctrl+Alt+B)`}
						>
							{assistantOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
						</button>
						<button
							className="icon-button"
							type="button"
							onClick={resetWorkspaceLayout}
							aria-label="恢复当前工作区默认布局"
							title="恢复当前工作区默认布局"
						>
							<RotateCcw size={20} />
						</button>
					</>
				)}
				{!quietWriterHeader && <span className="ai-state">本地优先</span>}
			</div>
		</header>
	);
}
