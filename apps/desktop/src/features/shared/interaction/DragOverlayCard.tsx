import type { ReactNode } from 'react';
import './interaction.css';

export function DragOverlayCard({
	icon,
	kind,
	title,
	hint,
	trailing
}: {
	readonly icon: ReactNode;
	readonly kind: string;
	readonly title: string;
	readonly hint?: string;
	readonly trailing?: ReactNode;
}): React.JSX.Element {
	return (
		<div className="interaction-drag-overlay">
			<span className="interaction-drag-overlay-icon" aria-hidden="true">{icon}</span>
			<span className="interaction-drag-overlay-copy">
				<small>{kind}</small>
				<strong>{title}</strong>
				{hint ? <em>{hint}</em> : null}
			</span>
			{trailing ? (
				<span className="interaction-drag-overlay-trailing" aria-hidden="true">
					{trailing}
				</span>
			) : null}
		</div>
	);
}
