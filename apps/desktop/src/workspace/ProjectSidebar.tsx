import {
	BookOpen,
	ChevronDown,
	ChevronRight,
	FileText,
	FolderOpen,
	Gem,
	Globe2,
	History,
	MoreHorizontal,
	NotebookPen,
	Plus,
	Trash2,
	UserRound
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { countWords, flattenChapters, type ResourceDescriptor } from '@writing-buddy/domain';
import { useAppStore } from '../app/store';
import { ResizeHandle } from '../shell/ResizeHandle';
import { StoryReferenceSidebar } from '../features/story/navigation/StoryReferenceSidebar';

const resourceIcons = {
	character: UserRound,
	worldbuilding: Globe2,
	timeline: History,
	item: Gem,
	note: NotebookPen
} as const;

export function ProjectSidebar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeMode = useAppStore(state => state.activeMode);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const search = useAppStore(state => state.search.trim().toLocaleLowerCase());
	const openResource = useAppStore(state => state.openResource);
	const openDashboard = useAppStore(state => state.openDashboard);
	const chooseProject = useAppStore(state => state.chooseProject);
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const openProject = useAppStore(state => state.openProject);
	const recentProjectRoots = useAppStore(state => state.recentProjectRoots) ?? [];
	const sidebarWidth = useAppStore(state => state.sidebarWidth);
	const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
	const [collapsedVolumes, setCollapsedVolumes] = useState<ReadonlySet<string>>(new Set());
	const [referencesExpanded, setReferencesExpanded] = useState(true);

	const resources = useMemo(() => {
		if (!snapshot) {
			return [];
		}
		return snapshot.resources.filter(resource => !search || resource.title.toLocaleLowerCase().includes(search));
	}, [search, snapshot]);

	if (!snapshot) {
		return (
			<aside className="project-sidebar empty-sidebar">
				<div className="empty-sidebar-heading">
					<span className="eyebrow">最近作品</span>
					<h2>作品书架</h2>
				</div>
				<div className="empty-sidebar-launcher">
					<button className="primary-button" type="button" onClick={openProjectWizard}><Plus size={17} />新建作品</button>
					<button className="secondary-button" type="button" onClick={() => void chooseProject()}><FolderOpen size={17} />打开作品</button>
				</div>
				<nav className="sidebar-recent-list" aria-label="最近作品">
					{recentProjectRoots.length ? recentProjectRoots.map(root => (
						<button type="button" key={root} onClick={() => void openProject(root)}>
							<BookOpen size={17} />
							<span>{root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}</span>
						</button>
					)) : <p>暂无最近作品</p>}
				</nav>
			</aside>
		);
	}

	if (activeMode === 'references') {
		return <StoryReferenceSidebar />;
	}

	const toggleVolume = (volumeId: string) => {
		setCollapsedVolumes(current => {
			const next = new Set(current);
			if (next.has(volumeId)) {
				next.delete(volumeId);
			} else {
				next.add(volumeId);
			}
			return next;
		});
	};

	const chapterWords = (chapterId: string): number => chapterId === activeResource?.id && session
		? countWords(session.content)
		: snapshot.wordCounts[chapterId] ?? 0;

	return (
		<aside className="project-sidebar">
			<div className="sidebar-heading">
				<div>
					<span className="eyebrow">我的作品</span>
					<h2>作品大纲</h2>
				</div>
				<button className="icon-button" type="button" aria-label="作品菜单"><MoreHorizontal size={19} /></button>
			</div>

			<div className="project-card">
				<button className="project-card-home" type="button" onClick={openDashboard} aria-label="打开作品仪表盘">
					<span className="cover-placeholder" aria-hidden="true"><BookOpen size={24} /></span>
					<span className="project-card-copy">
						<strong>{snapshot.project.title}</strong>
						<span>{flattenChapters(snapshot.project).length} 个章节</span>
					</span>
				</button>
				<button className="icon-button" type="button" onClick={() => void chooseProject()} aria-label="切换作品"><FolderOpen size={18} /></button>
			</div>

			<section className="tree-section" aria-labelledby="work-content-heading">
				<div className="section-label" id="work-content-heading">
					<span>作品内容</span>
					<button className="icon-button compact" type="button" aria-label="新建章节（迁移验收后启用）" disabled><Plus size={16} /></button>
				</div>
				<div className="resource-tree">
					{snapshot.project.volumes.map(volume => {
						const expanded = !collapsedVolumes.has(volume.id);
						const chapters = volume.chapters.filter(chapter => !search || chapter.title.toLocaleLowerCase().includes(search));
						if (search && chapters.length === 0 && !volume.title.toLocaleLowerCase().includes(search)) {
							return null;
						}
						return (
							<div className="tree-group" key={volume.id}>
								<button className="tree-row volume-row" type="button" onClick={() => toggleVolume(volume.id)}>
									{expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
									<FolderOpen size={18} />
									<span>{volume.title}</span>
								</button>
								{expanded && (
									<div className="tree-children">
										{chapters.map(chapter => {
											const resource: ResourceDescriptor = {
												id: chapter.id,
												type: 'chapter',
												title: chapter.title,
												path: chapter.file,
												projectId: snapshot.project.projectId
											};
											return (
												<button
													key={chapter.id}
													className={`tree-row chapter-row ${activeResource?.id === chapter.id ? 'is-active' : ''}`}
													type="button"
													onClick={() => void openResource(resource)}
												>
													<FileText size={17} />
													<span>{chapter.title}</span>
													<small>{chapterWords(chapter.id) || ''}</small>
												</button>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</section>

			<section className="tree-section" aria-labelledby="references-heading">
				<button className="section-label section-toggle" type="button" onClick={() => setReferencesExpanded(value => !value)}>
					<span id="references-heading">{referencesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />} 写作资料</span>
					<span>{resources.length}</span>
				</button>
				{referencesExpanded && (
					<div className="resource-tree reference-tree">
						{resources.map(resource => {
							const Icon = resourceIcons[resource.type];
							return (
								<button
									type="button"
									key={resource.id}
									className={`tree-row ${activeResource?.id === resource.id ? 'is-active' : ''}`}
									onClick={() => void openResource({ ...resource, projectId: snapshot.project.projectId })}
								>
									<Icon size={17} />
									<span>{resource.title}</span>
									<small>{resource.type === 'character' ? '人物' : ''}</small>
								</button>
							);
						})}
						<button className="tree-row muted-row" type="button">
							<Trash2 size={17} />
							<span>回收站</span>
						</button>
					</div>
				)}
			</section>
			<footer className="sidebar-footer">
				<span>项目副本</span>
				<strong>{snapshot.readOnly ? '只读预检' : '安全写入'}</strong>
			</footer>
			<ResizeHandle
				className="sidebar-resize-handle"
				label="调整作品侧栏宽度"
				axis="x"
				direction={1}
				value={sidebarWidth}
				onChange={setSidebarWidth}
			/>
		</aside>
	);
}
