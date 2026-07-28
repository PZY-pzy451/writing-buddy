import { Check, RotateCcw, X } from 'lucide-react';
import './interaction.css';

export function UndoToast({
	title,
	message,
	busy = false,
	onUndo,
	onDismiss
}: {
	readonly title: string;
	readonly message: string;
	readonly busy?: boolean;
	readonly onUndo: () => void;
	readonly onDismiss: () => void;
}): React.JSX.Element {
	return (
		<aside className="interaction-undo-toast" role="status" aria-live="polite">
			<span className="interaction-undo-toast-icon" aria-hidden="true">
				<Check size={18} />
			</span>
			<span className="interaction-undo-toast-copy">
				<strong>{title}</strong>
				<small>{message}</small>
			</span>
			<button type="button" disabled={busy} onClick={onUndo}>
				<RotateCcw size={16} aria-hidden="true" />
				{busy ? '撤销中…' : '撤销'}
			</button>
			<button type="button" aria-label="关闭撤销提示" onClick={onDismiss}>
				<X size={16} />
			</button>
		</aside>
	);
}
