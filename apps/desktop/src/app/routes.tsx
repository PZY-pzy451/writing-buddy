import { useAppStore } from './store';
import { StoryResourceView } from '../features/story/ui/StoryResourceView';

/**
 * Story routes stay inside the existing workspace state machine. The persisted
 * route shape is `story/:type/:id`; no second client router is introduced.
 */
export function StoryWorkspaceRoute(): React.JSX.Element | null {
	const activeResource = useAppStore(state => state.activeResource);
	const result = useAppStore(state => state.storyOpenResult);
	const openStoryResource = useAppStore(state => state.openStoryResource);
	const restoreStoryResource = useAppStore(state => state.restoreStoryResource);

	if (activeResource?.type !== 'story') {
		return null;
	}

	return (
		<StoryResourceView
			result={result}
			onRetry={reference => void openStoryResource(reference)}
			onRestore={() => void restoreStoryResource()}
		/>
	);
}
