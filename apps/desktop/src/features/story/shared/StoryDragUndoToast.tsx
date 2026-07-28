import { UndoToast } from '../../shared/interaction';

export function StoryDragUndoToast({
	message,
	busy,
	onUndo,
	onDismiss
}: {
	readonly message: string;
	readonly busy?: boolean;
	readonly onUndo: () => void;
	readonly onDismiss: () => void;
}): React.JSX.Element {
	return (
		<UndoToast
			title="故事资料已更新"
			message={message}
			busy={busy}
			onUndo={onUndo}
			onDismiss={onDismiss}
		/>
	);
}
