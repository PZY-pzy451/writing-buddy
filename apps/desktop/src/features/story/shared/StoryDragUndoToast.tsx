import { Undo2, X } from 'lucide-react';
import './StoryDragUndoToast.css';

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
		<aside className="story-drag-undo-toast" role="status" aria-live="polite">
			<span>{message}</span>
			<button type="button" disabled={busy} onClick={onUndo}>
				<Undo2 size={16} />
				{busy ? '撤销中…' : '撤销'}
			</button>
			<button type="button" aria-label="关闭撤销提示" onClick={onDismiss}>
				<X size={16} />
			</button>
		</aside>
	);
}
