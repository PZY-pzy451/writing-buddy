import { BookOpenText, Check, Lightbulb } from 'lucide-react';
import { useAppStore } from '../../app/store';

const stages = ['灵感', '故事核心', '故事方向', '故事总纲', '章节', '正文'] as const;

export function CreationJourneySidebar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const openDashboard = useAppStore(state => state.openDashboard);

	return (
		<aside className="project-sidebar creation-journey-sidebar">
			<div className="sidebar-heading">
				<div>
					<span className="eyebrow">创作起点</span>
					<h2>小说创作旅程</h2>
				</div>
				<Lightbulb size={20} aria-hidden="true" />
			</div>
			<button
				className="creation-journey-project-card"
				type="button"
				data-testid="creation-journey-project"
				data-project-id={snapshot?.project.projectId}
				aria-label={`返回作品仪表盘：${snapshot?.project.title ?? '当前作品'}`}
				onClick={openDashboard}
			>
				<BookOpenText size={20} />
				<span><strong>{snapshot?.project.title}</strong><small>返回作品仪表盘</small></span>
			</button>
			<ol className="creation-sidebar-stages" aria-label="创作旅程包含的阶段">
				{stages.map((stage, index) => (
					<li key={stage}>
						<span>{index === 0 ? <Check size={16} /> : index + 1}</span>
						<strong>{stage}</strong>
					</li>
				))}
			</ol>
			<div className="creation-sidebar-note">
				<strong>不会自动生成整本小说</strong>
				<p>每次 AI 只帮助完成当前一个决定，结果都需要你确认。</p>
			</div>
		</aside>
	);
}
