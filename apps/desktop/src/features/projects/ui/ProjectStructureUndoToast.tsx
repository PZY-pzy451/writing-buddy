import { useEffect } from 'react';
import { useAppStore } from '../../../app/store';
import { UndoToast } from '../../shared/interaction';

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
		<UndoToast
			title="项目结构已更新"
			message={undo.description}
			busy={busy}
			onUndo={() => void undoMove()}
			onDismiss={dismiss}
		/>
	);
}
