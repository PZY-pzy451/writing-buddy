import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLElement
		&& (
			target.isContentEditable
			|| ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
		);
}

export function useStoryDragUndoShortcut(
	enabled: boolean,
	onUndo: () => void
): void {
	useEffect(() => {
		if (!enabled) return undefined;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				(event.ctrlKey || event.metaKey)
				&& event.key.toLocaleLowerCase() === 'z'
				&& !event.shiftKey
				&& !isEditableTarget(event.target)
			) {
				event.preventDefault();
				onUndo();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [enabled, onUndo]);
}
