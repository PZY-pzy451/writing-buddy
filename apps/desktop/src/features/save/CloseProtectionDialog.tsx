import { AlertTriangle, Download, LoaderCircle, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../app/store';
import { useModalFocus } from '../../accessibility/useModalFocus';
import { closeProtectionFor } from './SaveStateModel';

export interface CloseProtectionDialogProps {
	readonly onExit: () => Promise<void> | void;
}

export function CloseProtectionDialog({
	onExit
}: CloseProtectionDialogProps): React.JSX.Element | null {
	const open = useAppStore(state => state.closeProtectionOpen);
	const saveState = useAppStore(state => state.saveState);
	const activeResource = useAppStore(state => state.activeResource);
	const save = useAppStore(state => state.save);
	const saveAs = useAppStore(state => state.saveAs);
	const flushWriterSession = useAppStore(state => state.flushWriterSession);
	const dismiss = useAppStore(state => state.dismissCloseProtection);
	const waitingToExit = useRef(saveState.type === 'saving');
	const exiting = useRef(false);
	const dialogRef = useModalFocus(dismiss);
	const protection = closeProtectionFor(saveState);

	const finishExit = useCallback(async () => {
		if (exiting.current) return;
		exiting.current = true;
		flushWriterSession();
		dismiss();
		await onExit();
	}, [dismiss, flushWriterSession, onExit]);

	useEffect(() => {
		if (!open) {
			waitingToExit.current = false;
			exiting.current = false;
			return;
		}
		if (saveState.type === 'saving') {
			waitingToExit.current = true;
			return;
		}
		if (waitingToExit.current && saveState.type === 'clean') {
			void finishExit();
		}
	}, [finishExit, open, saveState.type]);

	if (!open) return null;

	const retryAndExit = async () => {
		waitingToExit.current = true;
		await save();
		if (useAppStore.getState().saveState.type === 'clean') {
			await finishExit();
		}
	};
	const saveCopyAndExit = async () => {
		if (await saveAs()) await finishExit();
	};

	return (
		<div className="modal-backdrop close-protection-backdrop" role="presentation">
			<section
				ref={dialogRef}
				data-testid="close-protection-dialog"
				tabIndex={-1}
				className="close-protection-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="close-protection-title"
				aria-describedby="close-protection-description"
			>
				<header>
					<span className="conflict-icon" aria-hidden="true">
						{saveState.type === 'saving'
							? <LoaderCircle className="spin" size={20} />
							: <AlertTriangle size={20} />}
					</span>
					<div>
						<h2 id="close-protection-title">退出前确认正文安全</h2>
						<p id="close-protection-description">{protection.action === 'allow'
							? '当前正文已保存。'
							: protection.message}</p>
					</div>
					<button
						className="icon-button"
						type="button"
						data-testid="close-protection-cancel"
						onClick={dismiss}
						aria-label="取消退出"
					>
						<X size={18} />
					</button>
				</header>
				<div className="close-protection-summary">
					<strong>{activeResource?.title ?? '当前正文'}</strong>
					<p>快速记录已经单独落盘；未确认的 AI 候选不会写入正文。</p>
				</div>
				<footer>
					<button
						className="secondary-button"
						type="button"
						data-testid="close-protection-continue-writing"
						onClick={dismiss}
					>
						继续写作
					</button>
					{saveState.type === 'external_conflict' ? (
						<button
							className="primary-button"
							type="button"
							data-testid="close-protection-resolve-conflict"
							onClick={dismiss}
						>
							先处理文件冲突
						</button>
					) : (
						<>
							<button
								className="secondary-button"
								type="button"
								data-testid="close-protection-save-copy"
								onClick={() => void saveCopyAndExit()}
								disabled={saveState.type === 'saving'}
							>
								<Download size={16} />另存副本并退出
							</button>
							<button
								className="danger-button"
								type="button"
								data-testid="close-protection-discard"
								onClick={() => void finishExit()}
								disabled={saveState.type === 'saving'}
							>
								不保存并退出
							</button>
							<button
								className="primary-button"
								type="button"
								data-testid="close-protection-save-exit"
								onClick={() => void retryAndExit()}
								disabled={saveState.type === 'saving'
									|| (saveState.type === 'failed' && !saveState.retryable)}
							>
								{saveState.type === 'saving'
									? <LoaderCircle className="spin" size={16} />
									: <Save size={16} />}
								{saveState.type === 'saving' ? '正在保存…' : '保存并退出'}
							</button>
						</>
					)}
				</footer>
			</section>
		</div>
	);
}
