import { useLayoutEffect, useRef } from 'react';

const focusableSelector = [
	'button:not([disabled])',
	'[href]',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');

export function useModalFocus(onDismiss?: () => void): React.RefObject<HTMLElement | null> {
	const dialogRef = useRef<HTMLElement>(null);
	const dismissRef = useRef(onDismiss);
	useLayoutEffect(() => {
		dismissRef.current = onDismiss;
	}, [onDismiss]);

	useLayoutEffect(() => {
		const previouslyFocused = document.activeElement instanceof HTMLElement
			? document.activeElement
			: undefined;
		const dialog = dialogRef.current;
		if (!dialog) return;

		const focusable = () => [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
			.filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
		(focusable()[0] ?? dialog).focus();

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && dismissRef.current) {
				event.preventDefault();
				dismissRef.current();
				return;
			}
			if (event.key !== 'Tab') return;
			const controls = focusable();
			if (!controls.length) {
				event.preventDefault();
				dialog.focus();
				return;
			}
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		dialog.addEventListener('keydown', handleKeyDown);
		return () => {
			dialog.removeEventListener('keydown', handleKeyDown);
			if (previouslyFocused?.isConnected) {
				previouslyFocused.focus();
			}
		};
	}, []);

	return dialogRef;
}
