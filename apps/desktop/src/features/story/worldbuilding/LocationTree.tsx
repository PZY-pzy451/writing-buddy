import { ChevronRight, MapPin } from 'lucide-react';
import type { Location } from '@writing-buddy/story-kernel';

interface LocationTreeProps {
	readonly locations: readonly Location[];
	readonly selectedId?: string;
	readonly onSelect: (location: Location) => void;
}

interface LocationNodeProps extends LocationTreeProps {
	readonly location: Location;
	readonly depth: number;
}

function LocationNode({
	location,
	locations,
	selectedId,
	onSelect,
	depth
}: LocationNodeProps): React.JSX.Element {
	const children = locations.filter(candidate => candidate.parentLocationId === location.id);
	return (
		<li>
			<button
				type="button"
				className={selectedId === location.id ? 'is-active' : ''}
				style={{ paddingLeft: `${12 + depth * 18}px` }}
				onClick={() => onSelect(location)}
				aria-label={`${location.title}，${children.length} 个子地点`}
			>
				{children.length ? <ChevronRight size={16} /> : <span className="world-tree-spacer" />}
				<MapPin size={16} />
				<span><strong>{location.title}</strong><small>{location.locationType ?? '未分类地点'}</small></span>
			</button>
			{children.length ? (
				<ul>
					{children.map(child => (
						<LocationNode
							key={child.id}
							location={child}
							locations={locations}
							selectedId={selectedId}
							onSelect={onSelect}
							depth={depth + 1}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}

export function LocationTree({
	locations,
	selectedId,
	onSelect
}: LocationTreeProps): React.JSX.Element {
	const ids = new Set(locations.map(location => location.id));
	const roots = locations.filter(location => (
		!location.parentLocationId || !ids.has(location.parentLocationId)
	));
	return (
		<ul className="world-location-tree" aria-label="地点层级">
			{roots.map(location => (
				<LocationNode
					key={location.id}
					location={location}
					locations={locations}
					selectedId={selectedId}
					onSelect={onSelect}
					depth={0}
				/>
			))}
		</ul>
	);
}
