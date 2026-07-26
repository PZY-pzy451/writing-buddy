import {
	Archive,
	Check,
	ChevronDown,
	CircleAlert,
	ClipboardList,
	Clock3,
	Files,
	RotateCcw,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EditTransactionService } from '@writing-buddy/project';
import type { BackupInspection, BackupResult } from '@writing-buddy/platform-ports';
import { resolveAnchor, ReviewResolutionService } from '@writing-buddy/review';
import { useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { ResizeHandle } from '../shell/ResizeHandle';

const resolution = new ReviewResolutionService(new EditTransactionService());

export function TaskDock(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const setContent = useAppStore(state => state.setContent);
	const requestEditorEdit = useAppStore(state => state.requestEditorEdit);
	const toggleDock = useAppStore(state => state.toggleDock);
	const reloadProject = useAppStore(state => state.reloadProject);
	const dockHeight = useAppStore(state => state.dockHeight);
	const setDockHeight = useAppStore(state => state.setDockHeight);
	const [tab, setTab] = useState<'issues' | 'diff' | 'tasks' | 'backups'>('issues');
	const [selectedId, setSelectedId] = useState<string>();
	const [message, setMessage] = useState('');
	const [lastBackup, setLastBackup] = useState<BackupResult>();
	const [inspection, setInspection] = useState<BackupInspection>();

	const selected = issues.find(issue => issue.id === selectedId) ?? issues[0];
	const counts = useMemo(() => ({
		open: issues.filter(issue => issue.status === 'open').length,
		warning: issues.filter(issue => issue.severity === 'warning' || issue.severity === 'error').length,
		ignored: issues.filter(issue => issue.status === 'ignored').length
	}), [issues]);

	const updateIssue = (issueId: string, nextIssue: typeof issues[number]) => {
		setIssues(issues.map(issue => issue.id === issueId ? nextIssue : issue));
	};

	const accept = () => {
		if (!selected || !session) {
			return;
		}
		const range = resolveAnchor(session.content, selected.anchor);
		if (!range || selected.replacement === undefined) {
			updateIssue(selected.id, { ...selected, status: 'stale', updatedAt: new Date().toISOString() });
			return;
		}
		const result = resolution.accept(selected, session.content);
		updateIssue(selected.id, result.issue);
		requestEditorEdit({
			id: `review:${selected.id}:${Date.now()}`,
			resourceId: selected.resourceId,
			start: range.start,
			end: range.end,
			text: selected.replacement
		});
	};

	const ignore = () => {
		if (selected) {
			updateIssue(selected.id, resolution.ignore(selected));
		}
	};

	const restore = () => {
		if (!selected || !session) {
			return;
		}
		const result = resolution.restore(selected, session.content);
		updateIssue(selected.id, result.issue);
		setContent(result.content);
	};

	const createBackup = async () => {
		if (!snapshot) {
			return;
		}
		const result = await desktopBridge.createBackup(snapshot.root);
		const checked = await desktopBridge.inspectBackup(result.path);
		setLastBackup(result);
		setInspection(checked);
		setMessage(`备份已创建并校验：${result.entryCount} 个文件，${Math.round(result.byteLength / 1024)} KB`);
	};

	const chooseBackup = async () => {
		const path = await desktopBridge.chooseBackup();
		if (!path) {
			return;
		}
		const checked = await desktopBridge.inspectBackup(path);
		setLastBackup({
			path,
			hash: '',
			byteLength: 0,
			entryCount: checked.entryCount
		});
		setInspection(checked);
		setMessage(checked.valid ? '所选备份已通过完整性检查。' : '所选备份未通过完整性检查。');
	};

	const restoreBackup = async () => {
		if (!snapshot || !lastBackup || !inspection?.valid
			|| !window.confirm('恢复备份会替换当前项目副本中的文件。系统会先创建恢复前快照。确定继续吗？')) {
			return;
		}
		const restored = await desktopBridge.restoreBackup(lastBackup.path, snapshot.root, true);
		setMessage(`已从校验通过的备份恢复 ${restored} 个文件。`);
		await reloadProject();
	};

	return (
		<section className="task-dock" aria-label="任务与审校">
			<header className="dock-tabs">
				<div role="tablist">
					<button type="button" role="tab" aria-selected={tab === 'issues'} onClick={() => setTab('issues')}>
						<ClipboardList size={16} />待处理 <span>{counts.open}</span>
					</button>
					<button type="button" role="tab" aria-selected={tab === 'diff'} onClick={() => setTab('diff')}>
						<Files size={16} />修改对比
					</button>
					<button type="button" role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')}>
						<Clock3 size={16} />后台任务
					</button>
					<button type="button" role="tab" aria-selected={tab === 'backups'} onClick={() => setTab('backups')}>
						<Archive size={16} />备份记录
					</button>
				</div>
				<button className="icon-button" type="button" onClick={toggleDock} aria-label="关闭任务区"><X size={17} /></button>
			</header>

			{tab === 'issues' && (
				<div className="dock-body issue-dock">
					<div className="issue-filters">
						<button type="button" className="is-active"><CircleAlert size={15} />全部 <strong>{issues.length}</strong></button>
						<button type="button">严重与警告 <strong>{counts.warning}</strong></button>
						<button type="button">已忽略 <strong>{counts.ignored}</strong></button>
					</div>
					<div className="issue-list">
						{issues.length === 0 && <div className="dock-empty"><Check size={24} /><span>当前章节没有待处理问题</span></div>}
						{issues.map(issue => (
							<button
								key={issue.id}
								type="button"
								className={`issue-row ${selected?.id === issue.id ? 'is-active' : ''}`}
								onClick={() => setSelectedId(issue.id)}
							>
								<span className="severity-dot" data-severity={issue.severity} />
								<strong>{issue.title}</strong>
								<span>{issue.message}</span>
								<small>{issue.status}</small>
							</button>
						))}
					</div>
					<div className="issue-detail">
						{selected ? (
							<>
								<div className="detail-title"><span data-severity={selected.severity}>{selected.severity}</span><strong>{selected.title}</strong></div>
								<p>{selected.message}</p>
								<blockquote>{selected.anchor.target}</blockquote>
								{selected.replacement !== undefined && <div className="replacement-preview">{selected.replacement || '删除这段文字'}</div>}
								<div className="detail-actions">
									<button className="primary-button" type="button" onClick={accept} disabled={selected.status !== 'open' || selected.replacement === undefined}>接受</button>
									<button className="secondary-button" type="button" onClick={ignore} disabled={selected.status !== 'open'}>忽略</button>
									<button className="secondary-button" type="button" onClick={restore} disabled={selected.status !== 'accepted' && selected.status !== 'ignored'}><RotateCcw size={15} />恢复状态</button>
								</div>
							</>
						) : <div className="dock-empty">选择一个问题查看详情</div>}
					</div>
				</div>
			)}

			{tab === 'diff' && (
				<div className="dock-body diff-dock">
					<div><span>原文</span><pre>{selected?.anchor.target ?? '选择一个带建议的问题'}</pre></div>
					<div><span>建议</span><pre>{selected?.replacement ?? '暂无替换内容'}</pre></div>
				</div>
			)}

			{tab === 'tasks' && (
				<div className="dock-body task-list">
					<div><Check size={17} /><span>读取项目清单</span><strong>完成</strong></div>
					<div><Check size={17} /><span>建立资源索引</span><strong>完成</strong></div>
					<div><ChevronDown size={17} /><span>本地章节审校</span><strong>{issues.length ? '完成' : '待运行'}</strong></div>
				</div>
			)}

			{tab === 'backups' && (
				<div className="dock-body backup-dock">
					<div>
						<Archive size={24} />
						<strong>项目副本备份</strong>
						<span>创建前会通过 Rust 校验项目根路径和可用空间。</span>
					</div>
					<button className="primary-button" type="button" onClick={() => void createBackup()}>创建 .wbbackup</button>
					<button className="secondary-button" type="button" onClick={() => void chooseBackup()}>选择已有备份</button>
					<button className="secondary-button" type="button" onClick={() => void restoreBackup()} disabled={!inspection?.valid}>恢复最近备份</button>
					{message && <p>{message}</p>}
					{inspection && (
						<p className={inspection.valid ? 'success-message' : 'error-message'}>
							{inspection.valid
								? `格式 v${inspection.formatVersion}，校验通过`
								: `备份不可用：${inspection.issues.join('、')}`}
						</p>
					)}
				</div>
			)}
			<ResizeHandle
				className="dock-resize-handle"
				label="调整任务区高度"
				axis="y"
				direction={-1}
				value={dockHeight}
				onChange={setDockHeight}
			/>
		</section>
	);
}
