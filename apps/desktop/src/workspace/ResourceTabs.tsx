import { Circle, X } from 'lucide-react';
import { useAppStore } from '../app/store';

export function ResourceTabs(): React.JSX.Element {
	const tabs = useAppStore(state => state.tabs);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const closeResource = useAppStore(state => state.closeResource);

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
							aria-selected={active}
							onClick={() => void openResource(resource)}
						>
							{dirty && <Circle className="dirty-dot" size={8} fill="currentColor" />}
							<span>{resource.title}</span>
						</button>
						<button className="tab-close" type="button" onClick={() => closeResource(resource.id)} aria-label={`关闭 ${resource.title}`}>
							<X size={14} />
						</button>
					</div>
				);
			})}
		</div>
	);
}
