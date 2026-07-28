import { BookOpenText, FolderInput, FolderOpen, Plus } from 'lucide-react';
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
					<p>创建一部新作品，或打开已有的 Writing Buddy 项目。所有内容默认保存在本地。</p>
				</div>
				<div className="welcome-actions">
					<button className="primary-button" type="button" onClick={openProjectWizard}>
						<Plus size={18} />新建作品
					</button>
					<button className="secondary-button" type="button" onClick={() => void chooseProject()}>
						<FolderOpen size={18} />打开作品
					</button>
				</div>
				<button className="ghost-button welcome-import" type="button" onClick={() => void chooseProject()}>
					<FolderInput size={16} />导入旧项目
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
						<span>创建第一部作品后会显示在这里</span>
					</div>
				)}
			</section>
		</main>
	);
}
