import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { useAppStore } from '../app/store';
import { AssistantPanel } from './AssistantPanel';

describe('assistant action intent', () => {
	it('opens the assistant on a concrete rewrite action', () => {
		useAppStore.setState({ assistantOpen: false, assistantIntent: undefined });

		useAppStore.getState().requestAssistantAction({
			kind: 'rewrite',
			actionType: 'expand'
		});
		render(createElement(AssistantPanel));

		const pinButton = screen.getByTestId('assistant-panel-pin');
		expect(pinButton).toHaveAccessibleName('固定AI工具面板');
		const closeButton = screen.getByTestId('assistant-panel-close');
		expect(closeButton).toHaveAccessibleName('关闭AI工具面板');

		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: true,
			assistantIntent: {
				kind: 'rewrite',
				actionType: 'expand'
			}
		});
		fireEvent.click(closeButton);
		expect(useAppStore.getState().assistantOpen).toBe(false);
	});

	it('preserves a single Story Kernel target and author-visible instruction', () => {
		useAppStore.setState({ assistantOpen: false, assistantIntent: undefined });

		useAppStore.getState().requestAssistantAction({
			kind: 'story-kernel',
			targetType: 'character',
			instruction: '从当前选区创建人物候选。'
		});

		expect(useAppStore.getState().assistantIntent).toMatchObject({
			kind: 'story-kernel',
			targetType: 'character',
			instruction: '从当前选区创建人物候选。'
		});
	});
});
