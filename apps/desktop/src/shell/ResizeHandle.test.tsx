import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResizeHandle } from './ResizeHandle';

function installPointerCapture(element: HTMLElement): void {
	const captured = new Set<number>();
	Object.defineProperties(element, {
		setPointerCapture: {
			configurable: true,
			value: (pointerId: number) => captured.add(pointerId)
		},
		hasPointerCapture: {
			configurable: true,
			value: (pointerId: number) => captured.has(pointerId)
		},
		releasePointerCapture: {
			configurable: true,
			value: (pointerId: number) => captured.delete(pointerId)
		}
	});
}

function renderHandle(overrides: Partial<React.ComponentProps<typeof ResizeHandle>> = {}) {
	const onChange = vi.fn();
	render(
		<ResizeHandle
			className="test-resize-handle"
			label="调整测试面板"
			axis="x"
			direction={1}
			value={300}
			min={220}
			max={440}
			defaultValue={320}
			onChange={onChange}
			{...overrides}
		/>
	);
	const separator = screen.getByRole('separator', { name: '调整测试面板' });
	installPointerCapture(separator);
	return { separator, onChange };
}

describe('ResizeHandle', () => {
	afterEach(() => {
		document.documentElement.classList.remove('is-resizing-x', 'is-resizing-y');
	});

	it('exposes bounded separator values and resizes with pointer capture', () => {
		const { separator, onChange } = renderHandle();
		expect(separator).toHaveAttribute('aria-orientation', 'vertical');
		expect(separator).toHaveAttribute('aria-valuemin', '220');
		expect(separator).toHaveAttribute('aria-valuemax', '440');
		expect(separator).toHaveAttribute('aria-valuenow', '300');
		expect(separator).toHaveAttribute('aria-valuetext', '300 像素');

		fireEvent.pointerDown(separator, { pointerId: 7, button: 0, clientX: 100 });
		expect(separator).toHaveClass('is-resizing');
		expect(document.documentElement).toHaveClass('is-resizing-x');
		fireEvent.pointerMove(separator, { pointerId: 7, clientX: 172 });
		expect(onChange).toHaveBeenLastCalledWith(372);

		fireEvent.pointerUp(separator, { pointerId: 7 });
		expect(separator).not.toHaveClass('is-resizing');
		expect(document.documentElement).not.toHaveClass('is-resizing-x');
	});

	it('supports inverse horizontal and vertical dragging with clamped values', () => {
		const inverse = renderHandle({ direction: -1, value: 360, min: 280, max: 480 });
		fireEvent.pointerDown(inverse.separator, { pointerId: 2, button: 0, clientX: 500 });
		fireEvent.pointerMove(inverse.separator, { pointerId: 2, clientX: 420 });
		expect(inverse.onChange).toHaveBeenLastCalledWith(440);
		fireEvent.pointerMove(inverse.separator, { pointerId: 2, clientX: -500 });
		expect(inverse.onChange).toHaveBeenLastCalledWith(480);
		fireEvent.pointerCancel(inverse.separator, { pointerId: 2 });
		expect(document.documentElement).not.toHaveClass('is-resizing-x');
		cleanup();

		const vertical = renderHandle({ axis: 'y', direction: -1, value: 240, min: 144 });
		fireEvent.pointerDown(vertical.separator, { pointerId: 3, button: 0, clientY: 500 });
		fireEvent.pointerMove(vertical.separator, { pointerId: 3, clientY: 620 });
		expect(vertical.onChange).toHaveBeenLastCalledWith(144);
		expect(document.documentElement).toHaveClass('is-resizing-y');
		fireEvent.pointerUp(vertical.separator, { pointerId: 3 });
		expect(document.documentElement).not.toHaveClass('is-resizing-y');
	});

	it('supports arrow steps, accelerated movement, bounds, and reset keys', () => {
		const { separator, onChange } = renderHandle();
		fireEvent.keyDown(separator, { key: 'ArrowRight' });
		expect(onChange).toHaveBeenLastCalledWith(312);
		fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
		expect(onChange).toHaveBeenLastCalledWith(268);
		fireEvent.keyDown(separator, { key: 'Home' });
		expect(onChange).toHaveBeenLastCalledWith(220);
		fireEvent.keyDown(separator, { key: 'End' });
		expect(onChange).toHaveBeenLastCalledWith(440);
		fireEvent.keyDown(separator, { key: 'Enter' });
		expect(onChange).toHaveBeenLastCalledWith(320);
	});

	it('restores the default on double click and ignores non-primary pointer input', () => {
		const { separator, onChange } = renderHandle();
		fireEvent.pointerDown(separator, { pointerId: 9, button: 2, clientX: 100 });
		fireEvent.pointerMove(separator, { pointerId: 9, clientX: 180 });
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.doubleClick(separator);
		expect(onChange).toHaveBeenCalledWith(320);
	});
});
