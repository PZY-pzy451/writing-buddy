import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import './presentation.css';

export interface AppEmptyStateProps {
	readonly icon: LucideIcon;
	readonly title: string;
	readonly description?: string;
	readonly actions?: ReactNode;
	readonly density?: 'full' | 'panel' | 'compact';
	readonly tone?: 'neutral' | 'positive' | 'warning';
	readonly className?: string;
	readonly role?: 'status' | 'alert';
}

export function AppEmptyState({
	icon: Icon,
	title,
	description,
	actions,
	density = 'panel',
	tone = 'neutral',
	className,
	role
}: AppEmptyStateProps): React.JSX.Element {
	const iconSize = density === 'compact' ? 20 : density === 'panel' ? 24 : 32;
	return (
		<div
			className={[
				'app-empty-state',
				`is-${density}`,
				`is-${tone}`,
				className
			].filter(Boolean).join(' ')}
			role={role}
		>
			<span className="app-empty-state-icon" aria-hidden="true">
				<Icon size={iconSize} />
			</span>
			<div className="app-empty-state-copy">
				<strong>{title}</strong>
				{description ? <p>{description}</p> : null}
			</div>
			{actions ? <div className="app-empty-state-actions">{actions}</div> : null}
		</div>
	);
}
