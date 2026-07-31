import {
	BookOpenCheck,
	CalendarClock,
	ClipboardCheck,
	Files,
	Globe2,
	KeyRound,
	Link2,
	Milestone,
	Network,
	PackageSearch,
	Route,
	UserRound,
	UsersRound
} from 'lucide-react';
import { useAppStore, type StoryViewId } from '../../../app/store';
import {
	deriveAuthorProductStage,
	isLongformLibraryTool
} from '../../market-hierarchy/ProductHierarchy';

interface NavigationItem {
	readonly id: StoryViewId;
	readonly label: string;
	readonly description: string;
	readonly group: string;
	readonly icon: React.ComponentType<{ size?: number }>;
	readonly longform?: boolean;
}

const planningNavigation: readonly NavigationItem[] = [
	{
		id: 'creation-journey',
		label: '故事结构',
		description: '核心、总纲、分卷、章节与场景',
		group: '故事层级',
		icon: Route
	},
	{
		id: 'plots',
		label: '剧情线与伏笔',
		description: '推进、停滞、提醒与回收',
		group: '故事发展',
		icon: Milestone
	},
	{
		id: 'continuity',
		label: '结构检查',
		description: '计划与正文差异',
		group: '故事发展',
		icon: ClipboardCheck
	}
];

const libraryNavigation: readonly NavigationItem[] = [
	{
		id: 'associations',
		label: '当前相关',
		description: '本场景正在使用的人物与资料',
		group: '现在需要',
		icon: Link2
	},
	{
		id: 'extraction',
		label: '待完善',
		description: '从正文整理待确认资料',
		group: '现在需要',
		icon: Files
	},
	{
		id: 'characters',
		label: '人物',
		description: '身份、状态、弧光与来源',
		group: '全部资料',
		icon: UserRound
	},
	{
		id: 'relationships',
		label: '人物关系',
		description: '有向关系与变化',
		group: '全部资料',
		icon: Network,
		longform: true
	},
	{
		id: 'worldbuilding',
		label: '地点与世界规则',
		description: '地点、势力、文化与规则',
		group: '全部资料',
		icon: Globe2
	},
	{
		id: 'assets',
		label: '物品',
		description: '状态、持有人与流转',
		group: '全部资料',
		icon: PackageSearch
	},
	{
		id: 'timeline',
		label: '事件与时间线',
		description: '实际时间与叙事顺序',
		group: '全部资料',
		icon: CalendarClock,
		longform: true
	},
	{
		id: 'information',
		label: '人物知识',
		description: '真相、读者与知识边界',
		group: '全部资料',
		icon: KeyRound,
		longform: true
	}
];

export function StoryReferenceSidebar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeMode = useAppStore(state => state.activeMode);
	const storyView = useAppStore(state => state.storyView);
	const setStoryView = useAppStore(state => state.setStoryView);
	const planning = activeMode === 'planning';
	const navigation = planning ? planningNavigation : libraryNavigation;
	const stage = deriveAuthorProductStage(snapshot);
	const longformAvailable = isLongformLibraryTool(stage);
	const groups = [...new Set(navigation.map(item => item.group))];
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
		if (!next) return;
		setStoryView(next.id);
		event.currentTarget
			.closest('nav')
			?.querySelectorAll<HTMLButtonElement>('button')[nextIndex]
			?.focus();
	};

	return (
		<aside className="project-sidebar story-reference-sidebar">
			<header className="sidebar-heading">
				<div>
					<span className="eyebrow">{planning ? 'STORY PLANNING' : 'STORY LIBRARY'}</span>
					<h2>{planning ? '规划' : '故事库'}</h2>
				</div>
				<BookOpenCheck size={20} aria-hidden="true" />
			</header>
			<div className="story-reference-project">
				<UsersRound size={18} aria-hidden="true" />
				<span>
					<strong>{snapshot?.project.title}</strong>
					<small>{planning ? '故事接下来怎样发展' : '先显示当前任务需要的资料'}</small>
				</span>
			</div>
			<nav aria-label={planning ? '规划页面' : '故事库页面'}>
				{groups.map(group => (
					<section key={group} className="story-navigation-group" aria-labelledby={`story-navigation-${group}`}>
						<h3 id={`story-navigation-${group}`}>{group}</h3>
						{navigation.map((item, index) => {
							if (item.group !== group) return null;
							const Icon = item.icon;
							const muted = item.longform && !longformAvailable;
							return (
								<button
									type="button"
									key={item.id}
									className={`${storyView === item.id ? 'is-active' : ''} ${muted ? 'is-progressive-muted' : ''}`}
									onClick={() => setStoryView(item.id)}
									onKeyDown={event => moveFocus(event, index)}
									aria-label={`${item.label}，${item.description}${muted ? '，多章写作后更有用' : ''}`}
								>
									<Icon size={20} aria-hidden="true" />
									<span><strong>{item.label}</strong><small>{item.description}</small></span>
									{muted ? <em>稍后</em> : null}
								</button>
							);
						})}
					</section>
				))}
			</nav>
			<footer className="sidebar-footer">
				<span>{planning ? '规划即稿件结构' : '资料参与当前写作'}</span>
				<strong>{planning ? '核心 → 场景' : '当前相关优先'}</strong>
			</footer>
		</aside>
	);
}
