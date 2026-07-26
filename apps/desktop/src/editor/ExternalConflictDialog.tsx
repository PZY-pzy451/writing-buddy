import { AlertTriangle, Download, RefreshCcw, Save, X } from 'lucide-react';
import { useAppStore } from '../app/store';

export function ExternalConflictDialog(): React.JSX.Element | null {
	const conflict = useAppStore(state => state.externalConflict);
	const session = useAppStore(state => state.session);
	const saveAs = useAppStore(state => state.saveAs);
	const forceSave = useAppStore(state => state.forceSave);
	const reloadExternal = useAppStore(state => state.reloadExternal);
	const dismiss = useAppStore(state => state.dismissExternalConflict);

	if (!conflict || !session) {
		return null;
	}

	return (
		<div className="modal-backdrop" role="presentation">
			<section className="conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="external-conflict-title">
				<header>
					<div className="conflict-icon"><AlertTriangle size={22} /></div>
					<div>
						<h2 id="external-conflict-title">文件已在磁盘上被修改</h2>
						<p>Writing Buddy 没有覆盖外部修改。请比较本地编辑与磁盘版本后选择处理方式。</p>
					</div>
					<button className="icon-button" type="button" onClick={dismiss} aria-label="暂不处理"><X size={18} /></button>
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
					<button className="secondary-button" type="button" onClick={dismiss}>取消</button>
					<button
						className="secondary-button"
						type="button"
						onClick={() => void saveAs().then(dismiss)}
					>
						<Download size={16} />另存为
					</button>
					<button className="secondary-button" type="button" onClick={reloadExternal}>
						<RefreshCcw size={16} />重新加载磁盘版本
					</button>
					<button className="primary-button" type="button" onClick={() => void forceSave()}>
						<Save size={16} />明确覆盖
					</button>
				</footer>
			</section>
		</div>
	);
}
