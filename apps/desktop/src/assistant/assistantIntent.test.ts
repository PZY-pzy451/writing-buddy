import { useAppStore } from '../app/store';

describe('assistant action intent', () => {
	it('opens the assistant on a concrete rewrite action', () => {
		useAppStore.setState({ assistantOpen: false, assistantIntent: undefined });

		useAppStore.getState().requestAssistantAction({
			kind: 'rewrite',
			actionType: 'expand'
		});

		expect(useAppStore.getState()).toMatchObject({
			assistantOpen: true,
			assistantIntent: {
				kind: 'rewrite',
				actionType: 'expand'
			}
		});
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
