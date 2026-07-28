import { Check, RotateCcw, X } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from '../../../app/store';

export function ProjectStructureUndoToast(): React.JSX.Element | null {
	const undo = useAppStore(state => state.structureUndo);
	const busy = useAppStore(state => state.structureMoveBusy);
	const undoMove = useAppStore(state => state.undoProjectStructureMove);
	const dismiss = useAppStore(state => state.dismissProjectStructureUndo);

	useEffect(() => {
		if (!undo) return;
		const remaining = Math.max(0, undo.expiresAt - Date.now());
		const timer = window.setTimeout(dismiss, remaining);
		return () => window.clearTimeout(timer);
	}, [dismiss, undo]);

	if (!undo) {
		return null;
	}

	return (
		<div className="structure-undo-toast">
			<span className="structure-undo-icon" aria-hidden="true"><Check size={17} /></span>
			<span className="structure-undo-copy" role="status" aria-live="polite">
				<strong>项目结构已更新</strong>
				<small>{undo.description}</small>
			</span>
			<button type="button" disabled={busy} onClick={() => void undoMove()}>
				<RotateCcw size={16} aria-hidden="true" />撤销
			</button>
			<button className="icon-button compact" type="button" aria-label="关闭撤销提示" onClick={dismiss}>
				<X size={16} />
			</button>
		</div>
	);
}
