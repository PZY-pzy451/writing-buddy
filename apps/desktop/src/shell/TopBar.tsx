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
import {
	aiGenerationStore,
	useAiGenerationStore
} from '../features/ai/drawer/aiGenerationStore';
import { GlobalCreateMenu } from '../features/projects/ui/GlobalCreateMenu';

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
	const activeResource = useAppStore(state => state.activeResource);
	const resourceContent = useAppStore(state => state.resourceContent);
	const selection = useAppStore(state => state.selection);
	const drawerOpen = useAiGenerationStore(state => state.open);

	const openAiDrawer = () => {
		const activeChapter = snapshot?.project.volumes
			.flatMap(volume => volume.chapters)
			.find(chapter => chapter.id === activeResource?.id);
		const content = session?.content ?? resourceContent;
		aiGenerationStore.getState().openAiAction(
			'review.consistency',
			{ instruction: '' },
			{
				currentResourceType: activeResource?.type,
				baseRevision: session?.state.version ?? 0,
				context: {
					...(snapshot ? {
						project: {
							id: snapshot.project.projectId,
							title: snapshot.project.title,
							summary: `${snapshot.project.volumes.length} 卷作品；仅发送当前明确勾选的上下文。`
						}
					} : {}),
					...(activeResource && content ? {
						currentResource: {
							id: activeResource.id,
							title: activeResource.title,
							summary: content
						}
					} : {}),
					...(selection?.text ? {
						selection: {
							id: `${activeResource?.id ?? 'selection'}:${selection.start}-${selection.end}`,
							title: '当前选区',
							summary: selection.text,
							start: selection.start,
							end: selection.end
						}
					} : {}),
					...(activeChapter ? {
						scene: {
							id: `${activeChapter.id}:scene`,
							title: '当前场景信息',
							summary: [
								activeChapter.scene.location ? `地点：${activeChapter.scene.location}` : '',
								activeChapter.scene.time ? `时间：${activeChapter.scene.time}` : '',
								activeChapter.scene.pov ? `视角：${activeChapter.scene.pov}` : '',
								activeChapter.scene.goal ? `目标：${activeChapter.scene.goal}` : ''
							].filter(Boolean).join('\n') || '当前章节尚未设置场景信息。'
						}
					} : {})
				}
			}
		);
	};

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
				<GlobalCreateMenu />
				<button
					className="ghost-button"
					type="button"
					aria-label={session?.state.dirty ? '保存' : '已保存'}
					onClick={() => void save()}
					disabled={!session?.state.dirty}
				>
					<Save size={17} />
					<span>{session?.state.dirty ? '保存' : '已保存'}</span>
				</button>
				<button
					className={`ghost-button ${focusMode ? 'is-active' : ''}`}
					type="button"
					aria-label={focusMode ? '退出专注' : '专注模式'}
					onClick={toggleFocus}
				>
					<Focus size={17} />
					<span>{focusMode ? '退出专注' : '专注模式'}</span>
				</button>
				<button
					className={`ghost-button ai-quick-open ${drawerOpen ? 'is-active' : ''}`}
					type="button"
					aria-label="AI 快速生成"
					onClick={openAiDrawer}
				>
					<Sparkles size={17} />
					<span>AI 快速生成</span>
				</button>
				{['works', 'references'].includes(activeMode) && (
					<button className="icon-button" type="button" onClick={toggleAssistant} aria-label={assistantOpen ? '收起写作助手' : '展开写作助手'}>
						{assistantOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
					</button>
				)}
				<span className="ai-state">本地优先</span>
			</div>
		</header>
	);
}
