import {
	resolveWriterShortcut,
	writerShortcutDefinitions,
	type WriterShortcutId
} from './writerShortcuts';

function event(
	key: string,
	overrides: Partial<Parameters<typeof resolveWriterShortcut>[0]> = {}
) {
	return {
		key,
		code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...overrides
	};
}

describe('writer shortcuts', () => {
	it.each<[WriterShortcutId, ReturnType<typeof event>]>([
		['writer-navigator', event('k', { ctrlKey: true })],
		['full-search', event('f', { ctrlKey: true, shiftKey: true })],
		['new-chapter', event('n', { ctrlKey: true })],
		['quick-create', event('n', { ctrlKey: true, shiftKey: true })],
		['quick-capture', event(' ', { ctrlKey: true, shiftKey: true })],
		['ai-quick-actions', event('a', { altKey: true })],
		['focus-mode', event('F11', { code: 'F11' })],
		['save', event('s', { ctrlKey: true })],
		['close-tab', event('w', { ctrlKey: true })],
		['restore-tab', event('t', { ctrlKey: true, shiftKey: true })],
		['switch-tab', event('Tab', { code: 'Tab', ctrlKey: true })],
		['undo', event('z', { ctrlKey: true })]
	])('resolves %s without colliding with another command', (expected, input) => {
		expect(resolveWriterShortcut(input)).toBe(expected);
	});

	it('supports the platform Meta modifier and rejects extra modifiers', () => {
		expect(resolveWriterShortcut(event('k', { metaKey: true }))).toBe('writer-navigator');
		expect(resolveWriterShortcut(event('k', { ctrlKey: true, altKey: true }))).toBeUndefined();
		expect(resolveWriterShortcut(event('F11', { ctrlKey: true }))).toBeUndefined();
		expect(resolveWriterShortcut(event('a', { altKey: true, shiftKey: true }))).toBeUndefined();
	});

	it('publishes one discoverable definition for every supported command', () => {
		expect(writerShortcutDefinitions.map(definition => definition.id)).toEqual([
			'writer-navigator',
			'full-search',
			'new-chapter',
			'quick-create',
			'quick-capture',
			'ai-quick-actions',
			'focus-mode',
			'save',
			'close-tab',
			'restore-tab',
			'switch-tab',
			'undo'
		]);
		expect(new Set(writerShortcutDefinitions.map(definition => definition.display)).size)
			.toBe(writerShortcutDefinitions.length);
	});
});
