import { Circle, X } from 'lucide-react';
import { useAppStore } from '../app/store';

export function ResourceTabs(): React.JSX.Element {
	const tabs = useAppStore(state => state.tabs);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const closeResource = useAppStore(state => state.closeResource);

	const handleTabKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>
	): void => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
			return;
		}
		const tablist = event.currentTarget.closest('[role="tablist"]');
		const tabButtons = tablist
			? Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
			: [];
		const currentIndex = tabButtons.indexOf(event.currentTarget);
		if (currentIndex < 0 || tabButtons.length < 2) {
			return;
		}
		event.preventDefault();
		const targetIndex = event.key === 'Home'
			? 0
			: event.key === 'End'
				? tabButtons.length - 1
				: (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabButtons.length)
					% tabButtons.length;
		const target = tabs[targetIndex];
		tabButtons[targetIndex]?.focus();
		if (target) {
			void openResource(target);
		}
	};

	return (
		<div className="resource-tabs" role="tablist" aria-label="已打开资源">
			{tabs.map(resource => {
				const active = resource.id === activeResource?.id;
				const dirty = active && session?.state.dirty;
				return (
					<div key={resource.id} className={`resource-tab ${active ? 'is-active' : ''}`} role="presentation">
						<button
							type="button"
							role="tab"
							data-testid="resource-tab-select"
							data-resource-id={resource.id}
							data-resource-type={resource.type}
							aria-selected={active}
							tabIndex={active ? 0 : -1}
							onClick={() => void openResource(resource)}
							onKeyDown={handleTabKeyDown}
						>
							{dirty && <Circle className="dirty-dot" size={8} fill="currentColor" />}
							<span>{resource.title}</span>
						</button>
						<button
							className="tab-close"
							type="button"
							onClick={() => closeResource(resource.id)}
							aria-label={`关闭 ${resource.title}`}
							title="关闭标签 (Ctrl+W)"
						>
							<X size={16} />
						</button>
					</div>
				);
			})}
		</div>
	);
}
