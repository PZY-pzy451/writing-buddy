import {
	BookOpenText,
	History,
	LibraryBig,
	ListChecks,
	Search,
	Settings2,
	Sparkles
} from 'lucide-react';
import { type RailMode, useAppStore } from '../app/store';

const items: readonly {
	readonly mode: RailMode;
	readonly label: string;
	readonly icon: React.ComponentType<{ size?: number }>;
}[] = [
	{ mode: 'works', label: '作品', icon: LibraryBig },
	{ mode: 'search', label: '搜索', icon: Search },
	{ mode: 'references', label: '资料', icon: BookOpenText },
	{ mode: 'review', label: '审校', icon: ListChecks },
	{ mode: 'versions', label: '版本', icon: History }
];

export function GlobalRail(): React.JSX.Element {
	const activeMode = useAppStore(state => state.activeMode);
	const setMode = useAppStore(state => state.setMode);

	return (
		<nav className="global-rail" aria-label="全局导航">
			<div className="rail-primary">
				{items.map(item => {
					const Icon = item.icon;
					return (
						<button
							key={item.mode}
							type="button"
							className={`rail-item ${activeMode === item.mode ? 'is-active' : ''}`}
							onClick={() => setMode(item.mode)}
							aria-current={activeMode === item.mode ? 'page' : undefined}
						>
							<Icon size={20} />
							<span>{item.label}</span>
						</button>
					);
				})}
			</div>
			<div className="rail-secondary">
				<button
					type="button"
					className={`rail-item rail-ai ${activeMode === 'ai' ? 'is-active' : ''}`}
					onClick={() => setMode('ai')}
					aria-current={activeMode === 'ai' ? 'page' : undefined}
					title="打开 StoryForge AI 测试台"
				>
					<Sparkles size={18} />
					<span>AI 测试</span>
				</button>
				<button
					type="button"
					className={`rail-item ${activeMode === 'settings' ? 'is-active' : ''}`}
					onClick={() => setMode('settings')}
				>
					<Settings2 size={20} />
					<span>设置</span>
				</button>
			</div>
		</nav>
	);
}
