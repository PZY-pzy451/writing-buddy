import { AlertTriangle, Download, RefreshCcw, Save, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAppStore } from '../app/store';
import { useModalFocus } from '../accessibility/useModalFocus';

export function ExternalConflictDialog(): React.JSX.Element | null {
	const conflict = useAppStore(state => state.externalConflict);
	const session = useAppStore(state => state.session);
	const saveState = useAppStore(state => state.saveState);
	const saveAs = useAppStore(state => state.saveAs);
	const forceSave = useAppStore(state => state.forceSave);
	const reloadExternal = useAppStore(state => state.reloadExternal);
	const dismiss = useAppStore(state => state.dismissExternalConflict);
	const [busyAction, setBusyAction] = useState<'copy' | 'overwrite'>();
	const busy = busyAction !== undefined || saveState.type === 'saving';
	const dismissSafely = useCallback(() => {
		if (!busy) dismiss();
	}, [busy, dismiss]);
	const dialogRef = useModalFocus(dismissSafely);
	const saveCopy = useCallback(async () => {
		if (busy) return;
		setBusyAction('copy');
		try {
			if (await saveAs()) dismiss();
		} finally {
			setBusyAction(undefined);
		}
	}, [busy, dismiss, saveAs]);
	const overwrite = useCallback(async () => {
		if (busy) return;
		setBusyAction('overwrite');
		try {
			await forceSave();
		} finally {
			setBusyAction(undefined);
		}
	}, [busy, forceSave]);

	if (!conflict || !session) {
		return null;
	}

	return (
		<div className="modal-backdrop" role="presentation">
			<section ref={dialogRef} tabIndex={-1} className="conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="external-conflict-title" aria-busy={busy}>
				<header>
					<div className="conflict-icon"><AlertTriangle size={22} /></div>
					<div>
						<h2 id="external-conflict-title">文件已在磁盘上被修改</h2>
						<p>Writing Buddy 没有覆盖外部修改。请比较本地编辑与磁盘版本后选择处理方式。</p>
					</div>
					<button className="icon-button" type="button" onClick={dismissSafely} aria-label="暂不处理" disabled={busy}><X size={18} /></button>
				</header>
				<div className="conflict-comparison">
					<div>
						<span>当前未保存内容</span>
						<pre>{session.content}</pre>
					</div>
					<div>
						<span>磁盘上的新内容</span>
						<pre>{conflict.disk.content}</pre>
					</div>
				</div>
				<footer>
					<button className="secondary-button" type="button" onClick={dismissSafely} disabled={busy}>取消</button>
					<button
						className="secondary-button"
						type="button"
						disabled={busy}
						onClick={() => void saveCopy()}
					>
						<Download size={16} />另存为
					</button>
					<button className="secondary-button" type="button" onClick={reloadExternal} disabled={busy}>
						<RefreshCcw size={16} />重新加载磁盘版本
					</button>
					<button className="primary-button" type="button" disabled={busy} onClick={() => void overwrite()}>
						<Save size={16} />明确覆盖
					</button>
				</footer>
			</section>
		</div>
	);
}
