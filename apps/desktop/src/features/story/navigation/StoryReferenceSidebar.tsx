import {
	BookOpenCheck,
	CalendarClock,
	Network,
	UserRound,
	UsersRound
} from 'lucide-react';
import { useAppStore, type StoryViewId } from '../../../app/store';

const navigation: readonly {
	readonly id: StoryViewId;
	readonly label: string;
	readonly description: string;
	readonly icon: React.ComponentType<{ size?: number }>;
	readonly available: boolean;
}[] = [
	{ id: 'characters', label: '人物中心', description: '动态状态与来源', icon: UserRound, available: true },
	{ id: 'relationships', label: '人物关系', description: '图谱与有向矩阵', icon: Network, available: false },
	{ id: 'timeline', label: '多轨时间线', description: '实际时间与叙事顺序', icon: CalendarClock, available: false }
];

export function StoryReferenceSidebar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const storyView = useAppStore(state => state.storyView);
	const setStoryView = useAppStore(state => state.setStoryView);

	return (
		<aside className="project-sidebar story-reference-sidebar">
			<header className="sidebar-heading">
				<div><span className="eyebrow">STORY KERNEL</span><h2>资料中心</h2></div>
				<BookOpenCheck size={20} />
			</header>
			<div className="story-reference-project">
				<UsersRound size={18} />
				<span><strong>{snapshot?.project.title}</strong><small>结构化故事资源</small></span>
			</div>
			<nav aria-label="资料中心页面">
				{navigation.map(item => {
					const Icon = item.icon;
					return (
						<button
							type="button"
							key={item.id}
							className={storyView === item.id ? 'is-active' : ''}
							onClick={() => item.available && setStoryView(item.id)}
							disabled={!item.available}
							aria-label={`${item.label}，${item.description}`}
						>
							<Icon size={19} />
							<span><strong>{item.label}</strong><small>{item.description}</small></span>
							{!item.available ? <em>本阶段</em> : null}
						</button>
					);
				})}
			</nav>
			<footer className="sidebar-footer">
				<span>Gate C</span>
				<strong>人物 · 关系 · 时间线</strong>
			</footer>
		</aside>
	);
}
