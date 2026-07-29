import { UndoToast } from '../../shared/interaction';

export function StoryDragUndoToast({
	title = '故事资料已更新',
	message,
	busy,
	onUndo,
	onDismiss
}: {
	readonly title?: string;
	readonly message: string;
	readonly busy?: boolean;
	readonly onUndo: () => void;
	readonly onDismiss: () => void;
}): React.JSX.Element {
	return (
		<UndoToast
			title={title}
			message={message}
			busy={busy}
			onUndo={onUndo}
			onDismiss={onDismiss}
		/>
	);
}
