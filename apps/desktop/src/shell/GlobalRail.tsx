import {
	BookOpenText,
	History,
	ListChecks,
	NotebookTabs,
	PenLine
} from 'lucide-react';
import { useAppStore } from '../app/store';
import {
	deriveAuthorProductStage,
	primaryModePresentation,
	type AuthorPrimaryMode
} from '../features/market-hierarchy/ProductHierarchy';

const items: readonly {
	readonly mode: AuthorPrimaryMode;
	readonly label: string;
	readonly icon: React.ComponentType<{ size?: number }>;
}[] = [
	{ mode: 'works', label: '写作', icon: PenLine },
	{ mode: 'planning', label: '规划', icon: NotebookTabs },
	{ mode: 'references', label: '故事库', icon: BookOpenText },
	{ mode: 'review', label: '检查', icon: ListChecks },
	{ mode: 'versions', label: '历史', icon: History }
];

export function GlobalRail(): React.JSX.Element {
	const activeMode = useAppStore(state => state.activeMode);
	const snapshot = useAppStore(state => state.snapshot);
	const setMode = useAppStore(state => state.setMode);
	const stage = deriveAuthorProductStage(snapshot);

	return (
		<nav className="global-rail" aria-label="全局导航">
			<div className="rail-primary">
				{items.map(item => {
					const Icon = item.icon;
					const presentation = primaryModePresentation(stage, item.mode);
					return (
						<button
							key={item.mode}
							type="button"
							data-testid="global-rail-item"
							data-global-mode={item.mode}
							className={`rail-item ${activeMode === item.mode ? 'is-active' : ''} ${presentation.muted ? 'is-progressive-muted' : ''}`}
							onClick={() => setMode(item.mode)}
							disabled={presentation.disabled}
							aria-current={activeMode === item.mode ? 'page' : undefined}
							title={presentation.hint}
						>
							<Icon size={20} />
							<span>{item.label}</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
