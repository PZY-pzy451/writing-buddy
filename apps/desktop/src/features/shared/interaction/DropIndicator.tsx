import { Ban, Check, Link2 } from 'lucide-react';
import './interaction.css';

export type DropIndicatorState = 'valid' | 'invalid' | 'association';
export type DropIndicatorPlacement = 'before' | 'after' | 'inside';

export function DropIndicator({
	state,
	placement = 'inside',
	label
}: {
	readonly state: DropIndicatorState;
	readonly placement?: DropIndicatorPlacement;
	readonly label?: string;
}): React.JSX.Element {
	const Icon = state === 'invalid' ? Ban : state === 'association' ? Link2 : Check;
	return (
		<span
			className="interaction-drop-indicator"
			data-state={state}
			data-placement={placement}
			aria-label={label}
		>
			{placement === 'inside' && label ? (
				<span className="interaction-drop-indicator-label">
					<Icon size={14} aria-hidden="true" />
					{label}
				</span>
			) : null}
		</span>
	);
}
