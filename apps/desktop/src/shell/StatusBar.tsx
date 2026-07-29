import { Check, CircleAlert, Lightbulb, ListChecks } from 'lucide-react';
import { countWords } from '@writing-buddy/domain';
import { useAppStore } from '../app/store';

export function StatusBar(): React.JSX.Element {
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const toggleDock = useAppStore(state => state.toggleDock);
	const openQuickCapture = useAppStore(state => state.openQuickCapture);
	const openQuickCaptureInbox = useAppStore(state => state.openQuickCaptureInbox);
	const quickCaptures = useAppStore(state => state.quickCaptures);
	const inboxCount = quickCaptures.filter(capture => (
		capture.status === 'inbox' || capture.status === 'later'
	)).length;

	return (
		<footer className="status-bar" aria-label="工作区状态">
			<div>
				{session
					? <span>本章 {countWords(session.content).toLocaleString()} 字</span>
					: <span>本地优先</span>}
				<button
					type="button"
					onClick={() => openQuickCapture()}
					title="快速记录 (Ctrl+Shift+Space)"
					aria-keyshortcuts="Control+Shift+Space Meta+Shift+Space"
					disabled={!session}
				>
					<Lightbulb size={16} />快速记录
				</button>
				<button
					type="button"
					onClick={openQuickCaptureInbox}
					title="打开待整理箱"
					disabled={!session}
				>
					<ListChecks size={16} />待整理 {inboxCount}
				</button>
				<button
					type="button"
					onClick={toggleDock}
					title="显示或隐藏任务区 (Ctrl+J)"
					aria-keyshortcuts="Control+J Meta+J"
				>
					<ListChecks size={16} />待处理 {issues.filter(issue => issue.status === 'open').length}
				</button>
			</div>
			<div>
				<span className={session?.state.dirty ? 'status-warning' : 'status-success'}>
					{session?.state.dirty ? <CircleAlert size={16} /> : <Check size={16} />}
					{session?.state.dirty ? '尚未保存' : '已保存'}
				</span>
			</div>
		</footer>
	);
}
