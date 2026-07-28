import type { CSSProperties, ReactNode } from 'react';
import './interaction.css';

export type TreeRowInteractionState =
	| 'idle'
	| 'drag-source'
	| 'drop-valid'
	| 'drop-invalid'
	| 'conflict';

export function TreeRow({
	children,
	className = '',
	selected = false,
	state = 'idle',
	style,
	nodeRef,
	dataStructureId
}: {
	readonly children: ReactNode;
	readonly className?: string;
	readonly selected?: boolean;
	readonly state?: TreeRowInteractionState;
	readonly style?: CSSProperties;
	readonly nodeRef?: (node: HTMLDivElement | null) => void;
	readonly dataStructureId?: string;
}): React.JSX.Element {
	return (
		<div
			ref={nodeRef}
			className={`interaction-tree-row ${className}`.trim()}
			data-selected={selected ? 'true' : 'false'}
			data-interaction-state={state}
			data-structure-id={dataStructureId}
			style={style}
		>
			{children}
		</div>
	);
}
