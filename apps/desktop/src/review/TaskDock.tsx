import {
	Archive,
	Check,
	ChevronDown,
	CircleAlert,
	ClipboardList,
	Clock3,
	FileInput,
	Files,
	Lightbulb,
	Link2,
	RotateCcw,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EditTransactionService } from '@writing-buddy/project';
import { resolveAnchor, ReviewResolutionService } from '@writing-buddy/review';
import { useAppStore } from '../app/store';
import { ResizeHandle } from '../shell/ResizeHandle';
import { workspaceResizeBounds } from '../shell/workspaceResize';
import { AppEmptyState } from '../features/shared/presentation/AppEmptyState';
import type {
	QuickCaptureConversionTarget
} from '../features/quick-capture/QuickCaptureConversionService';
import { ProjectBackupPanel } from '../features/backup/ProjectBackupPanel';

const resolution = new ReviewResolutionService(new EditTransactionService());

export function TaskDock(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const setContent = useAppStore(state => state.setContent);
	const requestEditorEdit = useAppStore(state => state.requestEditorEdit);
	const toggleDock = useAppStore(state => state.toggleDock);
	const dockHeight = useAppStore(state => state.dockHeight);
	const setDockHeight = useAppStore(state => state.setDockHeight);
	const tab = useAppStore(state => state.dockTab);
	const setTab = useAppStore(state => state.setDockTab);
	const quickCaptures = useAppStore(state => state.quickCaptures);
	const quickCaptureBusy = useAppStore(state => state.quickCaptureBusy);
	const setQuickCaptureStatus = useAppStore(state => state.setQuickCaptureStatus);
	const convertQuickCapture = useAppStore(state => state.convertQuickCapture);
	const jumpToQuickCaptureSource = useAppStore(state => state.jumpToQuickCaptureSource);
	const [selectedId, setSelectedId] = useState<string>();
	const [conversionTargets, setConversionTargets] = useState<
		Readonly<Record<string, QuickCaptureConversionTarget>>
	>({});

	const selected = issues.find(issue => issue.id === selectedId) ?? issues[0];
	const counts = useMemo(() => ({
		open: issues.filter(issue => issue.status === 'open').length,
		warning: issues.filter(issue => issue.severity === 'warning' || issue.severity === 'error').length,
		ignored: issues.filter(issue => issue.status === 'ignored').length
	}), [issues]);
	const inboxGroups = useMemo(() => {
		const active = quickCaptures.filter(capture => (
			capture.status === 'inbox' || capture.status === 'later'
		));
		const linked = (snapshot?.project.volumes ?? []).flatMap(volume => (
			volume.chapters.map(chapter => ({
				id: chapter.id,
				title: chapter.title,
				captures: active.filter(capture => (
					capture.chapterId === `chapter:${chapter.id}`
				))
			}))
		));
		return [
			...linked,
			{
				id: 'unlinked',
				title: '未关联章节',
				captures: active.filter(capture => !capture.chapterId)
			}
		].filter(group => group.captures.length > 0);
	}, [quickCaptures, snapshot?.project.volumes]);

	const updateIssue = (issueId: string, nextIssue: typeof issues[number]) => {
		setIssues(issues.map(issue => issue.id === issueId ? nextIssue : issue));
	};
	const defaultConversionTarget = (type: typeof quickCaptures[number]['type']):
		QuickCaptureConversionTarget => {
		if (type === 'character') return 'character';
		if (type === 'world') return 'worldRule';
		return 'foreshadowing';
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

	return (
		<section className="task-dock" aria-label="任务与审校">
			<header className="dock-tabs">
				<div role="tablist">
					<button type="button" role="tab" aria-selected={tab === 'issues'} onClick={() => setTab('issues')}>
						<ClipboardList size={16} />待处理 <span>{counts.open}</span>
					</button>
					<button type="button" role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}>
						<Lightbulb size={16} />待整理 <span>{quickCaptures.filter(capture => capture.status === 'inbox' || capture.status === 'later').length}</span>
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
				<button
					className="icon-button"
					type="button"
					onClick={toggleDock}
					aria-label="关闭任务区"
					aria-keyshortcuts="Control+J Meta+J"
					title="关闭任务区 (Ctrl+J)"
				>
					<X size={18} />
				</button>
			</header>

			{tab === 'issues' && (
				<div className="dock-body issue-dock">
					<div className="issue-filters">
						<button type="button" className="is-active"><CircleAlert size={16} />全部 <strong>{issues.length}</strong></button>
						<button type="button">严重与警告 <strong>{counts.warning}</strong></button>
						<button type="button">已忽略 <strong>{counts.ignored}</strong></button>
					</div>
					<div className="issue-list">
						{issues.length === 0 && (
							<AppEmptyState
								icon={Check}
								title="当前章节没有待处理问题"
								density="compact"
								tone="positive"
								className="dock-empty"
							/>
						)}
						{issues.map(issue => (
							<button
								key={issue.id}
								type="button"
								data-testid="task-dock-issue"
								data-issue-id={issue.id}
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
									<button className="secondary-button" type="button" onClick={restore} disabled={selected.status !== 'accepted' && selected.status !== 'ignored'}><RotateCcw size={16} />恢复状态</button>
								</div>
							</>
						) : (
							<AppEmptyState
								icon={ClipboardList}
								title="选择一个问题查看详情"
								density="compact"
								className="dock-empty"
							/>
						)}
					</div>
				</div>
			)}

			{tab === 'diff' && (
				<div className="dock-body diff-dock">
					<div><span>原文</span><pre>{selected?.anchor.target ?? '选择一个带建议的问题'}</pre></div>
					<div><span>建议</span><pre>{selected?.replacement ?? '暂无替换内容'}</pre></div>
				</div>
			)}

			{tab === 'inbox' && (
				<div className="dock-body quick-capture-inbox">
					{quickCaptures.filter(capture => (
						capture.status === 'inbox' || capture.status === 'later'
					)).length === 0 ? (
							<AppEmptyState
								icon={Lightbulb}
								title="待整理箱是空的"
								description="写作时按 Ctrl+Shift+Space，先把想法记下来。"
								density="compact"
								tone="positive"
								className="dock-empty"
							/>
						) : (
							inboxGroups.map(group => (
									<section className="quick-capture-group" key={group.id}>
										<header>
											<strong>{group.title}</strong>
											<span>{group.captures.length}</span>
										</header>
										<div>
											{group.captures.map(capture => (
												<article className="quick-capture-row" key={capture.id}>
													<div>
														<span data-capture-type={capture.type}>
															{({
																idea: '灵感',
																revision: '待修改',
																foreshadowing: '伏笔',
																character: '人物',
																world: '设定'
															} as const)[capture.type]}
														</span>
														{capture.status === 'later' && <small>稍后处理</small>}
													</div>
													<p>{capture.text}</p>
													<footer>
														<label className="quick-capture-conversion">
															<span className="sr-only">正式资料类型</span>
															<select
																aria-label="正式资料类型"
																value={conversionTargets[capture.id] ?? defaultConversionTarget(capture.type)}
																disabled={quickCaptureBusy}
																onChange={event => setConversionTargets(current => ({
																	...current,
																	[capture.id]: event.target.value as QuickCaptureConversionTarget
																}))}
															>
																<option value="character">人物</option>
																<option value="location">地点</option>
																<option value="item">物品</option>
																<option value="foreshadowing">伏笔</option>
																<option value="worldRule">世界规则</option>
															</select>
															<button
																type="button"
																disabled={quickCaptureBusy}
																onClick={() => void convertQuickCapture(
																	capture.id,
																	conversionTargets[capture.id]
																		?? defaultConversionTarget(capture.type)
																)}
															>
																<FileInput size={16} />转为正式资料
															</button>
														</label>
														<button
															type="button"
															disabled={quickCaptureBusy || !capture.anchor}
															onClick={() => void jumpToQuickCaptureSource(capture)}
														>
															<Link2 size={16} />跳到原文
														</button>
														<button
															type="button"
															disabled={quickCaptureBusy}
															onClick={() => void setQuickCaptureStatus(capture.id, 'later')}
														>
															稍后
														</button>
														<button
															type="button"
															disabled={quickCaptureBusy}
															onClick={() => void setQuickCaptureStatus(capture.id, 'dismissed')}
														>
															忽略
														</button>
													</footer>
												</article>
											))}
										</div>
									</section>
								))
						)}
				</div>
			)}

			{tab === 'tasks' && (
				<div className="dock-body task-list">
					<div><Check size={18} /><span>读取项目清单</span><strong>完成</strong></div>
					<div><Check size={18} /><span>建立资源索引</span><strong>完成</strong></div>
					<div><ChevronDown size={18} /><span>本地章节审校</span><strong>{issues.length ? '完成' : '待运行'}</strong></div>
				</div>
			)}

			{tab === 'backups' && (
				<div className="dock-body backup-dock">
					<ProjectBackupPanel density="compact" />
				</div>
			)}
			<ResizeHandle
				className="dock-resize-handle"
				label="调整任务区高度"
				axis="y"
				direction={-1}
				value={dockHeight}
				min={workspaceResizeBounds.dock.min}
				max={workspaceResizeBounds.dock.max}
				defaultValue={workspaceResizeBounds.dock.defaultValue}
				onChange={setDockHeight}
			/>
		</section>
	);
}
