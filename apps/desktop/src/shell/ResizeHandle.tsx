import { useRef } from 'react';

interface ResizeHandleProps {
	readonly className: string;
	readonly label: string;
	readonly axis: 'x' | 'y';
	readonly direction: 1 | -1;
	readonly value: number;
	readonly onChange: (value: number) => void;
}

export function ResizeHandle(props: ResizeHandleProps): React.JSX.Element {
	const start = useRef<{ coordinate: number; value: number } | undefined>(undefined);

	return (
		<div
			className={`product-resize-handle ${props.className}`}
			role="separator"
			aria-label={props.label}
			aria-orientation={props.axis === 'x' ? 'vertical' : 'horizontal'}
			tabIndex={0}
			onPointerDown={event => {
				const coordinate = props.axis === 'x' ? event.clientX : event.clientY;
				start.current = { coordinate, value: props.value };
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={event => {
				if (!start.current || !event.currentTarget.hasPointerCapture(event.pointerId)) {
					return;
				}
				const coordinate = props.axis === 'x' ? event.clientX : event.clientY;
				props.onChange(start.current.value + ((coordinate - start.current.coordinate) * props.direction));
			}}
			onPointerUp={event => {
				start.current = undefined;
				event.currentTarget.releasePointerCapture(event.pointerId);
			}}
			onKeyDown={event => {
				const decrease = props.axis === 'x' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
				const increase = props.axis === 'x' ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
				if (!decrease && !increase) {
					return;
				}
				event.preventDefault();
				const delta = decrease ? -12 : 12;
				props.onChange(props.value + (delta * props.direction));
			}}
		/>
	);
}
