import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../src/app/store';
import { StoryReferenceSidebar } from '../../src/features/story/navigation/StoryReferenceSidebar';

afterEach(() => {
	cleanup();
	useAppStore.setState({ storyView: 'characters', activeMode: 'works' });
});

describe('Story Reference navigation keyboard contract', () => {
	it('moves through resource navigation with Arrow, Home and End keyboard focus', () => {
		useAppStore.setState({ storyView: 'characters', activeMode: 'references' });
		render(<StoryReferenceSidebar />);
		const navigationItems = screen.getAllByTestId('story-reference-navigation-item');
		const first = navigationItems.find(control => (
			control.getAttribute('data-story-view') === 'associations'
		));
		if (!first) throw new Error('missing associations navigation item');
		expect(first).toHaveAccessibleName(/当前相关/u);
		first.focus();
		fireEvent.keyDown(first, { key: 'ArrowDown' });
		const second = screen.getByRole('button', { name: /待完善/u });
		expect(second).toHaveFocus();
		expect(useAppStore.getState().storyView).toBe('extraction');
		fireEvent.keyDown(second, { key: 'End' });
		expect(screen.getByRole('button', { name: /人物知识/u })).toHaveFocus();
		expect(useAppStore.getState().storyView).toBe('information');
	});
});
