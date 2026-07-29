import { useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
	readonly className: string;
	readonly label: string;
	readonly axis: 'x' | 'y';
	readonly direction: 1 | -1;
	readonly value: number;
	readonly min: number;
	readonly max: number;
	readonly defaultValue: number;
	readonly step?: number;
	readonly onChange: (value: number) => void;
}

export function ResizeHandle(props: ResizeHandleProps): React.JSX.Element {
	const start = useRef<{ coordinate: number; value: number } | undefined>(undefined);
	const [resizing, setResizing] = useState(false);
	const cursorClass = props.axis === 'x' ? 'is-resizing-x' : 'is-resizing-y';

	const clamp = (value: number) => Math.min(props.max, Math.max(props.min, Math.round(value)));
	const finishResize = (target?: HTMLDivElement, pointerId?: number) => {
		start.current = undefined;
		setResizing(false);
		document.documentElement.classList.remove(cursorClass);
		if (target && pointerId !== undefined && target.hasPointerCapture(pointerId)) {
			target.releasePointerCapture(pointerId);
		}
	};

	useEffect(() => () => {
		document.documentElement.classList.remove('is-resizing-x', 'is-resizing-y');
	}, []);

	return (
		<div
			className={`product-resize-handle ${props.className}${resizing ? ' is-resizing' : ''}`}
			role="separator"
			aria-label={props.label}
			aria-orientation={props.axis === 'x' ? 'vertical' : 'horizontal'}
			aria-valuemin={props.min}
			aria-valuemax={props.max}
			aria-valuenow={Math.round(props.value)}
			aria-valuetext={`${Math.round(props.value)} 像素`}
			title={`${props.label}；拖动或使用方向键，双击恢复默认`}
			tabIndex={0}
			onPointerDown={event => {
				if (event.button !== 0) return;
				event.preventDefault();
				const coordinate = props.axis === 'x' ? event.clientX : event.clientY;
				start.current = { coordinate, value: props.value };
				setResizing(true);
				document.documentElement.classList.add(cursorClass);
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={event => {
				if (!start.current || !event.currentTarget.hasPointerCapture(event.pointerId)) {
					return;
				}
				const coordinate = props.axis === 'x' ? event.clientX : event.clientY;
				props.onChange(clamp(
					start.current.value + ((coordinate - start.current.coordinate) * props.direction)
				));
			}}
			onPointerUp={event => {
				finishResize(event.currentTarget, event.pointerId);
			}}
			onPointerCancel={event => finishResize(event.currentTarget, event.pointerId)}
			onLostPointerCapture={() => finishResize()}
			onDoubleClick={() => props.onChange(clamp(props.defaultValue))}
			onKeyDown={event => {
				if (event.key === 'Home') {
					event.preventDefault();
					props.onChange(props.min);
					return;
				}
				if (event.key === 'End') {
					event.preventDefault();
					props.onChange(props.max);
					return;
				}
				if (event.key === 'Enter') {
					event.preventDefault();
					props.onChange(clamp(props.defaultValue));
					return;
				}
				const decrease = props.axis === 'x' ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
				const increase = props.axis === 'x' ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
				if (!decrease && !increase) {
					return;
				}
				event.preventDefault();
				const step = event.shiftKey ? 32 : (props.step ?? 12);
				const delta = decrease ? -step : step;
				props.onChange(clamp(props.value + (delta * props.direction)));
			}}
		/>
	);
}
