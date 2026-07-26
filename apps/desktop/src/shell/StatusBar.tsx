import { Check, CircleAlert, Database, ListChecks } from 'lucide-react';
import { countWords } from '@writing-buddy/domain';
import { useAppStore } from '../app/store';

export function StatusBar(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const toggleDock = useAppStore(state => state.toggleDock);

	return (
		<footer className="status-bar">
			<div>
				<span><Database size={14} />本地项目副本</span>
				<span>{snapshot?.project.title ?? '未打开作品'}</span>
				<span>{activeResource?.title ?? '未选择资源'}</span>
			</div>
			<div>
				{session && <span>本章 {countWords(session.content).toLocaleString()} 字</span>}
				<button type="button" onClick={toggleDock}><ListChecks size={14} />待处理 {issues.filter(issue => issue.status === 'open').length}</button>
				<span className={session?.state.dirty ? 'status-warning' : 'status-success'}>
					{session?.state.dirty ? <CircleAlert size={14} /> : <Check size={14} />}
					{session?.state.dirty ? '尚未保存' : '已保存到本机'}
				</span>
			</div>
		</footer>
	);
}
