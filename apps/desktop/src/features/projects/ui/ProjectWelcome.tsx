import {
	BookOpenText,
	FileInput,
	FileText,
	FolderOpen,
	Sparkles
} from 'lucide-react';
import { useAppStore } from '../../../app/store';

function projectNameFromRoot(root: string): string {
	return root.split(/[\\/]/).filter(Boolean).at(-1) ?? root;
}

export function ProjectWelcome(): React.JSX.Element {
	const recentProjectRoots = useAppStore(state => state.recentProjectRoots) ?? [];
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const chooseProject = useAppStore(state => state.chooseProject);
	const openProject = useAppStore(state => state.openProject);

	return (
		<main className="project-welcome" aria-label="开始使用 Writing Buddy">
			<section className="welcome-hero" aria-labelledby="welcome-title">
				<span className="welcome-mark" aria-hidden="true"><BookOpenText size={32} /></span>
				<div>
					<span className="eyebrow">WRITING BUDDY</span>
					<h1 id="welcome-title">开始你的故事</h1>
					<p>从题材、大纲、已有正文或空白作品开始。所有内容默认保存在本地。</p>
				</div>
				<h2 className="welcome-question">你想怎样开始？</h2>
				<div className="welcome-actions">
					<button className="primary-button welcome-genre-action" type="button" onClick={() => openProjectWizard('genre')}>
						<Sparkles size={18} />根据题材生成大纲
					</button>
				</div>
				<div className="welcome-start-options" aria-label="其他创作起点">
					<button type="button" onClick={() => openProjectWizard('outline')}>
						<FileInput size={18} /><span><strong>导入已有大纲</strong><small>预览后创建章节结构</small></span>
					</button>
					<button type="button" onClick={() => openProjectWizard('manuscript')}>
						<FileText size={18} /><span><strong>导入已有正文</strong><small>文字不经 AI 改写并打开第一章</small></span>
					</button>
					<button type="button" onClick={() => openProjectWizard('blank')}>
						<BookOpenText size={18} /><span><strong>创建空白作品</strong><small>不生成任何内容</small></span>
					</button>
				</div>
				<button className="ghost-button welcome-import" type="button" onClick={() => void chooseProject()}>
					<FolderOpen size={16} />打开已有 Writing Buddy 作品
				</button>
			</section>

			<section className="welcome-recent" aria-labelledby="welcome-recent-title">
				<div className="welcome-section-heading">
					<div>
						<span className="eyebrow">RECENT</span>
						<h2 id="welcome-recent-title">最近使用</h2>
					</div>
					<span>{recentProjectRoots.length}/3</span>
				</div>
				{recentProjectRoots.length ? (
					<div className="recent-project-grid">
						{recentProjectRoots.map(root => (
							<button type="button" key={root} onClick={() => void openProject(root)}>
								<span className="recent-project-icon" aria-hidden="true"><BookOpenText size={20} /></span>
								<span>
									<strong>{projectNameFromRoot(root)}</strong>
									<small>{root}</small>
								</span>
							</button>
						))}
					</div>
				) : (
					<div className="recent-project-empty">
						<BookOpenText size={24} aria-hidden="true" />
						<span>创建第一个项目后会显示在这里</span>
					</div>
				)}
			</section>
		</main>
	);
}
