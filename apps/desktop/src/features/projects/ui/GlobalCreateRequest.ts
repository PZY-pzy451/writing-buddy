export const openCreateMenuEvent = 'writing-buddy:open-create-menu';

export function requestGlobalCreateMenu(focus: 'first' | 'chapter' = 'first'): void {
	window.dispatchEvent(new CustomEvent(openCreateMenuEvent, { detail: { focus } }));
}
