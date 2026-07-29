import { AlertTriangle, Download, RefreshCcw } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { saveStatePresentation } from './SaveStateModel';

export function SaveRecoveryBanner(): React.JSX.Element | null {
	const saveState = useAppStore(state => state.saveState);
	const activeResource = useAppStore(state => state.activeResource);
	const save = useAppStore(state => state.save);
	const saveAs = useAppStore(state => state.saveAs);
	if (saveState.type !== 'failed' && saveState.type !== 'offline') return null;
	const presentation = saveStatePresentation(saveState);
	const diagnosticCode = saveState.type === 'failed'
		? saveState.errorCode
		: 'storageUnavailable';
	return (
		<aside className="save-recovery-banner" role="alert" aria-labelledby="save-recovery-title">
			<AlertTriangle size={20} aria-hidden="true" />
			<div className="save-recovery-copy">
				<strong id="save-recovery-title">
					无法保存“{activeResource?.title ?? '当前正文'}”
				</strong>
				<span>{presentation.detail}</span>
			</div>
			<div className="save-recovery-actions">
				<button
					className="primary-button"
					type="button"
					onClick={() => void save()}
					disabled={saveState.type === 'failed' && !saveState.retryable}
				>
					<RefreshCcw size={16} />重试
				</button>
				<button className="secondary-button" type="button" onClick={() => void saveAs()}>
					<Download size={16} />另存副本
				</button>
				<details>
					<summary>查看诊断</summary>
					<code>{diagnosticCode}</code>
				</details>
			</div>
		</aside>
	);
}
