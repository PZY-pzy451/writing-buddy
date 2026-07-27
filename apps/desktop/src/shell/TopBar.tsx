import {
	BookOpenText,
	Focus,
	PanelRightClose,
	PanelRightOpen,
	Save,
	Search,
	Sparkles
} from 'lucide-react';
import { useAppStore } from '../app/store';

export function TopBar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const search = useAppStore(state => state.search);
	const setSearch = useAppStore(state => state.setSearch);
	const save = useAppStore(state => state.save);
	const session = useAppStore(state => state.session);
	const focusMode = useAppStore(state => state.focusMode);
	const toggleFocus = useAppStore(state => state.toggleFocus);
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const activeMode = useAppStore(state => state.activeMode);
	const toggleAssistant = useAppStore(state => state.toggleAssistant);

	return (
		<header className="top-bar" data-tauri-drag-region>
			<div className="brand-lockup">
				<span className="brand-mark" aria-hidden="true"><BookOpenText size={21} /></span>
				<span className="brand-name">Writing Buddy</span>
			</div>
			<div className="project-crumb" aria-label="当前作品">
				<span>{snapshot?.project.title ?? '尚未打开作品'}</span>
			</div>
			<label className="project-search">
				<Search size={17} aria-hidden="true" />
				<span className="sr-only">搜索当前作品</span>
				<input
					value={search}
					onChange={event => setSearch(event.target.value)}
					placeholder="搜索当前作品"
					aria-label="搜索当前作品"
				/>
				<kbd>Ctrl K</kbd>
			</label>
			<div className="top-actions">
				<button className="ghost-button" type="button" onClick={() => void save()} disabled={!session?.state.dirty}>
					<Save size={17} />
					<span>{session?.state.dirty ? '保存' : '已保存'}</span>
				</button>
				<button className={`ghost-button ${focusMode ? 'is-active' : ''}`} type="button" onClick={toggleFocus}>
					<Focus size={17} />
					<span>{focusMode ? '退出专注' : '专注模式'}</span>
				</button>
				{['works', 'references'].includes(activeMode) && (
					<button className="icon-button" type="button" onClick={toggleAssistant} aria-label={assistantOpen ? '收起写作助手' : '展开写作助手'}>
						{assistantOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
					</button>
				)}
				<span className="ai-state"><Sparkles size={15} /> AI 本地预览</span>
			</div>
		</header>
	);
}
