import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	parseStoryId,
	type MentionLink
} from '@writing-buddy/story-kernel';
import {
	EntityHighlightControls
} from './EntityHighlightControls';
import {
	loadManuscriptHighlightKinds,
	mentionHighlightKind,
	saveManuscriptHighlightKinds
} from './EntityHighlightPreferences';

const mention = (resourceId: string): MentionLink => ({
	id: parseStoryId(`mention:${resourceId.replace(':', '-')}`),
	resourceId: parseStoryId(resourceId),
	chapterId: parseStoryId('chapter:one'),
	anchor: {
		start: 0,
		end: 2,
		revision: 0,
		quote: '样例',
		before: '',
		after: ''
	},
	displayText: '样例',
	status: 'active',
	revision: 0,
	createdAt: '2026-07-28T00:00:00.000Z',
	updatedAt: '2026-07-28T00:00:00.000Z'
});

describe('EntityHighlightControls', () => {
	it('derives only supported quiet manuscript highlight kinds', () => {
		expect(mentionHighlightKind('character:lin-yue')).toBe('character');
		expect(mentionHighlightKind('location:station')).toBe('location');
		expect(mentionHighlightKind('item:ticket')).toBe('item');
		expect(mentionHighlightKind('foreshadowing:signal')).toBe('foreshadowing');
		expect(mentionHighlightKind('information:secret')).toBeUndefined();
	});

	it('starts from the supplied disabled state and toggles one independent kind', () => {
		const onToggle = vi.fn();
		render(
			<EntityHighlightControls
				mentions={[
					mention('character:lin-yue'),
					mention('location:station')
				]}
				enabledKinds={new Set()}
				onToggle={onToggle}
			/>
		);

		fireEvent.click(screen.getByText('资料高亮'));
		const character = screen.getByRole('checkbox', { name: /人物/ });
		expect(character).not.toBeChecked();
		expect(screen.getAllByText('1 处链接')).toHaveLength(2);
		fireEvent.click(character);
		expect(onToggle).toHaveBeenCalledWith('character', true);
	});

	it('persists only known highlight kinds per project', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value)
		};
		saveManuscriptHighlightKinds(
			'D:/Novel',
			new Set(['character', 'item']),
			storage
		);
		expect([...loadManuscriptHighlightKinds('D:/Novel', storage)])
			.toEqual(['character', 'item']);
	});
});
