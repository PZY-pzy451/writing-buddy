import {
	BookOpenCheck,
	CalendarClock,
	ClipboardCheck,
	Globe2,
	KeyRound,
	Milestone,
	Network,
	PackageSearch,
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
	{ id: 'relationships', label: '人物关系', description: '图谱与有向矩阵', icon: Network, available: true },
	{ id: 'timeline', label: '多轨时间线', description: '实际时间与叙事顺序', icon: CalendarClock, available: true }
	,
	{ id: 'worldbuilding', label: '世界观中心', description: '地点、势力与规则', icon: Globe2, available: true },
	{ id: 'assets', label: '物品与资产', description: '持有人、数量与流转', icon: PackageSearch, available: true },
	{ id: 'plots', label: '剧情线与伏笔', description: '生命周期与回收风险', icon: Milestone, available: true },
	{ id: 'information', label: '信息权限', description: '真相、读者与人物知识', icon: KeyRound, available: true }
	,
	{ id: 'continuity', label: '一致性审查', description: '规则、Kernel 与 AI', icon: ClipboardCheck, available: true }
];

export function StoryReferenceSidebar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const storyView = useAppStore(state => state.storyView);
	const setStoryView = useAppStore(state => state.setStoryView);
	const moveFocus = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		index: number
	) => {
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const nextIndex = event.key === 'Home'
			? 0
			: event.key === 'End'
				? navigation.length - 1
				: Math.min(
					navigation.length - 1,
					Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1))
				);
		const next = navigation[nextIndex];
		if (!next?.available) return;
		setStoryView(next.id);
		event.currentTarget
			.closest('nav')
			?.querySelectorAll<HTMLButtonElement>('button')[nextIndex]
			?.focus();
	};

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
				{navigation.map((item, index) => {
					const Icon = item.icon;
					return (
						<button
							type="button"
							key={item.id}
							className={storyView === item.id ? 'is-active' : ''}
							onClick={() => item.available && setStoryView(item.id)}
							onKeyDown={event => moveFocus(event, index)}
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
				<span>Gate E</span>
				<strong>Grounded AI · 长篇一致性</strong>
			</footer>
		</aside>
	);
}
