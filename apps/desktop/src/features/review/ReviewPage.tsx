import {
	AlertTriangle,
	BookOpenCheck,
	Bot,
	CheckCircle2,
	ChevronDown,
	ClipboardCheck,
	ExternalLink,
	FileWarning,
	KeyRound,
	ListChecks,
	LoaderCircle,
	OctagonX,
	ShieldCheck,
	Sparkles,
	Square
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AI_CHAPTER_REVIEW_MAX_CHARS, type AiJobState } from '@writing-buddy/ai';
import { countWords, flattenChapters, type ChapterDescriptor } from '@writing-buddy/domain';
import {
	replaceReviewIssuesForResource,
	runLocalReview,
	type ReviewIssue
} from '@writing-buddy/review';
import { useAppStore } from '../../app/store';
import { desktopBridge } from '../../platform/bridge';
import { useAiStore } from '../ai/stores/aiStore';
import { createWorkSourceFingerprint } from '../export/ChapterExportModel';
import {
	selectPublishReadiness,
	type PublishReadinessAction,
	type PublishReadinessCheck,
	type PublishReadinessModel,
	type PublishSourceInspection
} from './PublishReadinessModel';
import { useReviewAutomationStore } from './stores/reviewAutomationStore';

type ReviewMode = 'manual' | 'ai';

const activeJobStates: readonly AiJobState[] = ['queued', 'connecting', 'thinking', 'streaming'];

export function ReviewPage(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const saveState = useAppStore(state => state.saveState);
	const chapterExportReceipts = useAppStore(state => state.chapterExportReceipts);
	const setIssues = useAppStore(state => state.setIssues);
	const openResource = useAppStore(state => state.openResource);
	const save = useAppStore(state => state.save);
	const setRailMode = useAppStore(state => state.setMode);
	const setStoryView = useAppStore(state => state.setStoryView);
	const openWriterTool = useAppStore(state => state.openWriterTool);
	const requestEditorReveal = useAppStore(state => state.requestEditorReveal);
	const dockOpen = useAppStore(state => state.dockOpen);
	const toggleDock = useAppStore(state => state.toggleDock);
	const {
		initialized,
		status,
		preferences,
		initialize
	} = useAiStore();
	const {
		jobState,
		usage,
		durationMs,
		error,
		run,
		cancel,
		reset
	} = useReviewAutomationStore();
	const [mode, setMode] = useState<ReviewMode>('manual');
	const [notice, setNotice] = useState('');
	const [publishExpanded, setPublishExpanded] = useState(false);
	const sourceInspectionKey = snapshot
		? [snapshot.root, snapshot.projectRevision, session?.state.diskHash ?? ''].join('\u0000')
		: '';
	const sourceInspectionRequestKey = `${sourceInspectionKey}\u0000${publishExpanded ? 'open' : 'closed'}`;
	const [sourceInspectionState, setSourceInspectionState] = useState<{
		readonly key: string;
		readonly inspection: PublishSourceInspection;
	}>({ key: '', inspection: { status: 'checking' } });
	const sourceInspection = useMemo<PublishSourceInspection>(() => (
		sourceInspectionState.key === sourceInspectionRequestKey
			? sourceInspectionState.inspection
			: { status: 'checking' }
	), [sourceInspectionRequestKey, sourceInspectionState]);
	const isChapter = activeResource?.type === 'chapter' && Boolean(session);
	const configured = status?.secret.configured ?? false;
	const active = activeJobStates.includes(jobState);
	const chapters = useMemo(
		() => snapshot ? flattenChapters(snapshot.project) : [],
		[snapshot]
	);
	const projectOpenIssues = useMemo(
		() => issues.filter(issue => issue.status === 'open'),
		[issues]
	);
	const affectedChapterIds = useMemo(
		() => new Set(projectOpenIssues.map(issue => issue.resourceId)),
		[projectOpenIssues]
	);
	const affectedChapters = useMemo(
		() => chapters.filter(chapter => affectedChapterIds.has(chapter.id)),
		[affectedChapterIds, chapters]
	);
	const nextChapter = affectedChapters[0] ?? chapters[0];
	const projectAiIssues = projectOpenIssues.filter(issue => issue.origin === 'ai');

	useEffect(() => {
		if (!snapshot) return;
		let cancelled = false;
		const expectedSnapshot = snapshot;
		const key = sourceInspectionRequestKey;
		void (async () => {
			try {
				const liveSnapshot = await desktopBridge.openProject(
					expectedSnapshot.root,
					'read-only'
				);
				if (
					liveSnapshot.project.projectId !== expectedSnapshot.project.projectId
					|| liveSnapshot.projectRevision !== expectedSnapshot.projectRevision
				) {
					if (!cancelled) {
						setSourceInspectionState({
							key,
							inspection: { status: 'stale-project' }
						});
					}
					return;
				}
				const liveChapters = flattenChapters(liveSnapshot.project);
				const revisions = liveSnapshot.manuscriptRevisions ?? {};
				const sourceChapters = await Promise.all(liveChapters.map(async chapter => ({
					id: chapter.id,
					path: chapter.file,
					hash: revisions[chapter.id]
						?? (await desktopBridge.readText(liveSnapshot.root, chapter.file)).hash
				})));
				const fingerprint = await createWorkSourceFingerprint(
					liveSnapshot.projectRevision,
					sourceChapters
				);
				if (!cancelled) {
					setSourceInspectionState({
						key,
						inspection: { status: 'ready', fingerprint }
					});
				}
			} catch {
				if (!cancelled) {
					setSourceInspectionState({ key, inspection: { status: 'unavailable' } });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [snapshot, sourceInspectionRequestKey]);

	const publishReadiness = useMemo(() => snapshot
		? selectPublishReadiness({
			snapshot,
			saveState,
			issues,
			receipts: chapterExportReceipts,
			sourceInspection,
			...(activeResource?.type === 'chapter' && session
				? {
					activeChapter: {
						resourceId: activeResource.id,
						wordCount: countWords(session.content)
					}
				}
				: {})
		})
		: undefined, [activeResource, chapterExportReceipts, issues, saveState, session, snapshot, sourceInspection]);

	useEffect(() => {
		void initialize();
		return () => {
			void useReviewAutomationStore.getState().cancel();
		};
	}, [initialize]);

	const currentIssues = useMemo(
		() => activeResource
			? issues.filter(issue => issue.resourceId === activeResource.id)
			: [],
		[activeResource, issues]
	);
	const localIssues = currentIssues.filter(issue => issue.origin === 'local');
	const aiIssues = currentIssues.filter(issue => issue.origin === 'ai');
	const openIssues = currentIssues.filter(issue => issue.status === 'open');

	const chooseMode = (nextMode: ReviewMode) => {
		if (nextMode === mode) {
			return;
		}
		if (active) {
			void cancel();
		}
		reset();
		setNotice('');
		setMode(nextMode);
	};

	const runManual = () => {
		if (!snapshot || !activeResource || !session || activeResource.type !== 'chapter') {
			return;
		}
		const result = runLocalReview(
			snapshot.project.projectId,
			activeResource.id,
			session.content
		);
		setIssues(replaceReviewIssuesForResource(
			useAppStore.getState().issues,
			result.issues,
			activeResource.id,
			'local'
		));
		setNotice(result.issues.length
			? `本地审校完成，发现 ${result.issues.length} 个问题。`
			: '本地审校完成，没有发现规则问题。');
	};

	const runAi = async () => {
		if (!snapshot || !activeResource || !session || activeResource.type !== 'chapter') {
			return;
		}
		setNotice('');
		try {
			const result = await run({
				projectId: snapshot.project.projectId,
				resourceId: activeResource.id,
				content: session.content,
				preferences
			});
			if (!result) {
				setNotice('AI 自动审校已停止，未替换现有审校结果。');
				return;
			}
			setIssues(replaceReviewIssuesForResource(
				useAppStore.getState().issues,
				result,
				activeResource.id,
				'ai'
			));
			setNotice(result.length
				? `AI 自动审校完成，生成 ${result.length} 条待确认建议。`
				: 'AI 自动审校完成，没有返回可验证的问题。');
		} catch {
			// The store exposes the redacted public error beside the controls.
		}
	};

	const returnToEditor = () => {
		setRailMode('works');
		if (!dockOpen) {
			toggleDock();
		}
	};
	const openReviewChapter = async (chapter: ChapterDescriptor) => {
		if (!snapshot) return;
		await openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
	};
	const openWholeWorkConsistency = () => {
		setRailMode('planning');
		setStoryView('continuity');
	};
	const openPublishChapter = async (resourceId: string, reviewOffset?: number) => {
		const chapter = chapters.find(candidate => candidate.id === resourceId);
		if (!chapter) {
			openWholeWorkConsistency();
			return;
		}
		await openReviewChapter(chapter);
		setRailMode('works');
		if (reviewOffset !== undefined) {
			requestEditorReveal(chapter.id, reviewOffset);
			openWriterTool('review');
		}
	};
	const runPublishAction = async (action: PublishReadinessAction) => {
		switch (action.type) {
			case 'save':
				await save();
				return;
			case 'planning':
				setRailMode('planning');
				return;
			case 'chapter':
				await openPublishChapter(action.resourceId);
				return;
			case 'review':
				if (action.resourceId) {
					await openPublishChapter(action.resourceId, action.offset);
				} else {
					openWholeWorkConsistency();
				}
				return;
			case 'history':
				setRailMode('versions');
				return;
		}
	};

	return (
		<div className="system-page review-page">
			<header>
				<span className="eyebrow">Review Center</span>
				<h1>审校中心</h1>
				<p>选择本地手动审校或 AI 自动审校。两种模式都只生成待确认建议，不会自动修改正文。</p>
			</header>

			<section className="review-task-overview" aria-labelledby="review-task-overview-title">
				<div className="review-task-heading">
					<span><ListChecks size={20} /></span>
					<div>
						<h2 id="review-task-overview-title">项目待处理事项</h2>
						<p>{projectOpenIssues.length
							? `优先定位仍有问题的章节，再决定运行哪一种审校。`
							: '目前没有遗留问题，可以选择一个章节开始新一轮检查。'}</p>
					</div>
				</div>
				<div className="review-task-metrics" aria-label="项目审校概况">
					<ReviewMetric label="待处理" value={projectOpenIssues.length} />
					<ReviewMetric label="涉及章节" value={affectedChapters.length} />
					<ReviewMetric label="AI 建议" value={projectAiIssues.length} />
				</div>
				<div className="review-task-action">
					{isChapter ? (
						<>
							<CheckCircle2 size={18} />
							<span><small>当前检查目标</small><strong>{activeResource.title}</strong></span>
						</>
					) : nextChapter ? (
						<button className="primary-button" type="button" onClick={() => void openReviewChapter(nextChapter)}>
							<ClipboardCheck size={18} />
							{affectedChapterIds.has(nextChapter.id) ? '打开下一项' : '打开章节'}：{nextChapter.title}
						</button>
					) : (
						<button className="primary-button" type="button" onClick={() => setRailMode('planning')}>
							<ListChecks size={18} />先规划第一个章节
						</button>
					)}
				</div>
			</section>

			{publishReadiness && (
				<PublishReadinessPanel
					model={publishReadiness}
					expanded={publishExpanded}
					onToggle={() => setPublishExpanded(expanded => !expanded)}
					onAction={action => void runPublishAction(action)}
				/>
			)}

			<section className="review-whole-work-card" aria-labelledby="review-whole-work-title">
				<span className="review-whole-work-icon"><BookOpenCheck size={22} /></span>
				<div>
					<h2 id="review-whole-work-title">全书一致性</h2>
					<p>跨章节核对人物状态、时间、地点、物品、信息权限与因果；结果保留原文证据，只进入待处理列表。</p>
				</div>
				<button
					className="secondary-button"
					type="button"
					disabled={chapters.length < 2 || snapshot?.readOnly}
					onClick={openWholeWorkConsistency}
				>
					<BookOpenCheck size={18} />打开全书扫描
				</button>
			</section>

			<div className="review-mode-grid" role="tablist" aria-label="审校模式">
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'manual'}
					className={mode === 'manual' ? 'is-active' : ''}
					onClick={() => chooseMode('manual')}
				>
					<span className="review-mode-icon"><ShieldCheck size={22} /></span>
					<span><strong>本地手动审校</strong><small>主动运行确定性规则，正文不离开设备</small></span>
					<span className="review-mode-state">{mode === 'manual' ? '当前模式' : '选择'}</span>
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'ai'}
					className={mode === 'ai' ? 'is-active' : ''}
					onClick={() => chooseMode('ai')}
				>
					<span className="review-mode-icon"><Sparkles size={22} /></span>
					<span><strong>AI 自动审校</strong><small>DeepSeek 自动发现问题，修改仍由作者确认</small></span>
					<span className="review-mode-state">{mode === 'ai' ? '当前模式' : '选择'}</span>
				</button>
			</div>

			<div className="review-dashboard">
				<section className="review-run-panel" aria-labelledby="review-run-title">
					<div className="review-panel-heading">
						{mode === 'manual' ? <ClipboardCheck size={20} /> : <Bot size={20} />}
						<div>
							<h2 id="review-run-title">{mode === 'manual' ? '运行本地规则' : '运行 AI 自动审校'}</h2>
							<p>{activeResource?.type === 'chapter'
								? `当前章节：${activeResource.title}`
								: '请先打开一个章节。'}</p>
						</div>
					</div>

					{mode === 'manual' ? (
						<div className="review-privacy-note">
							<ShieldCheck size={18} />
							<span>检查标点、连续空格、重复句和过长段落；全程离线，不读取其他章节。</span>
						</div>
					) : (
						<div className="review-privacy-note is-ai">
							<FileWarning size={18} />
							<span>点击开始后，只将当前编辑器中的章节正文发送给 DeepSeek，不发送项目路径、资料或历史。</span>
						</div>
					)}

					{!isChapter && (
						<div className="review-empty-inline">
							<ListChecks size={22} />
							<span>打开一个章节后即可开始审校。</span>
							<button className="secondary-button" type="button" onClick={() => setRailMode('works')}>返回作品</button>
						</div>
					)}

					{mode === 'ai' && initialized && !configured && (
						<div className="review-empty-inline">
							<KeyRound size={22} />
							<span>需要先配置并验证 DeepSeek API Key。</span>
							<button className="secondary-button" type="button" onClick={() => setRailMode('settings')}>打开 AI 设置</button>
						</div>
					)}

					{session && session.content.length > AI_CHAPTER_REVIEW_MAX_CHARS && mode === 'ai' && (
						<p className="ai-inline-error" role="alert">
							当前章节超过 {AI_CHAPTER_REVIEW_MAX_CHARS.toLocaleString()} 字符，请拆分后再进行 AI 审校。
						</p>
					)}

					<div className="review-run-actions">
						{mode === 'manual' ? (
							<button className={isChapter ? 'primary-button' : 'secondary-button'} type="button" onClick={runManual} disabled={!isChapter}>
								<ClipboardCheck size={18} />手动运行审校
							</button>
						) : (
							<>
								<button
									className={isChapter ? 'primary-button' : 'secondary-button'}
									type="button"
									onClick={() => void runAi()}
									disabled={!isChapter || !configured || active || Boolean(session && session.content.length > AI_CHAPTER_REVIEW_MAX_CHARS)}
								>
									{active ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
									{active ? 'AI 正在审校…' : '开始 AI 自动审校'}
								</button>
								<button className="secondary-button" type="button" onClick={() => void cancel()} disabled={!active}>
									<Square size={16} />停止
								</button>
							</>
						)}
					</div>
					{notice && <p className="review-run-notice" role="status">{notice}</p>}
					{error && mode === 'ai' && <p className="ai-inline-error" role="alert">{error.message}</p>}
					{mode === 'ai' && (usage || durationMs !== undefined) && (
						<div className="review-run-meta">
							<span>输入 {usage?.inputTokens?.toLocaleString() ?? '—'}</span>
							<span>输出 {usage?.outputTokens?.toLocaleString() ?? '—'}</span>
							<span>耗时 {durationMs === undefined ? '—' : `${(durationMs / 1000).toFixed(1)}s`}</span>
						</div>
					)}
				</section>

				<section className="review-results-panel" aria-labelledby="review-results-title">
					<div className="review-results-heading">
						<div><CheckCircle2 size={20} /><h2 id="review-results-title">当前章节结果</h2></div>
						<button className="secondary-button" type="button" onClick={returnToEditor} disabled={!isChapter || currentIssues.length === 0}>
							回到正文处理<ExternalLink size={16} />
						</button>
					</div>
					<div className="review-metric-grid">
						<ReviewMetric label="待处理" value={openIssues.length} />
						<ReviewMetric label="本地规则" value={localIssues.length} />
						<ReviewMetric label="AI 建议" value={aiIssues.length} />
					</div>
					<div className="review-issue-list">
						{currentIssues.length === 0 ? (
							<div className="review-results-empty">
								<CheckCircle2 size={27} />
								<strong>还没有审校结果</strong>
								<span>选择一种模式并运行后，问题会显示在这里。</span>
							</div>
						) : currentIssues.map(issue => <ReviewIssueCard key={issue.id} issue={issue} />)}
					</div>
				</section>
			</div>
		</div>
	);
}

function PublishReadinessPanel(props: {
	readonly model: PublishReadinessModel;
	readonly expanded: boolean;
	readonly onToggle: () => void;
	readonly onAction: (action: PublishReadinessAction) => void;
}): React.JSX.Element {
	const statusLabel = props.model.status === 'blocked'
		? '有阻断项'
		: props.model.status === 'attention' ? '待作者确认' : '检查通过';
	return (
		<section
			className="publish-readiness"
			data-status={props.model.status}
			aria-labelledby="publish-readiness-title"
		>
			<div className="publish-readiness-summary">
				<span className="publish-readiness-icon">
					{props.model.status === 'blocked'
						? <OctagonX size={22} />
						: props.model.status === 'attention'
							? <AlertTriangle size={22} />
							: <CheckCircle2 size={22} />}
				</span>
				<div className="publish-readiness-copy">
					<span className="eyebrow">Final Pass</span>
					<div>
						<h2 id="publish-readiness-title">发布前检查</h2>
						<span className="publish-readiness-state">{statusLabel}</span>
					</div>
					<strong>{props.model.title}</strong>
					<p>{props.model.summary}</p>
				</div>
				<div className="publish-readiness-metrics" aria-label="发布检查概况">
					<ReviewMetric label="阻断" value={props.model.blockedCount} />
					<ReviewMetric label="待确认" value={props.model.attentionCount} />
					<ReviewMetric label="已通过" value={props.model.passedCount} />
				</div>
				<button
					className="secondary-button publish-readiness-toggle"
					type="button"
					aria-expanded={props.expanded}
					aria-controls="publish-readiness-checklist"
					onClick={props.onToggle}
				>
					{props.expanded ? '收起清单' : '查看发布清单'}
					<ChevronDown size={18} aria-hidden="true" />
				</button>
			</div>
			{props.expanded && (
				<div id="publish-readiness-checklist" className="publish-readiness-checklist">
					<div className="publish-readiness-context">
						<span>{props.model.chapterCount} 章</span>
						<span>{props.model.wordCount.toLocaleString()} 字</span>
						<p>检查只读取当前本地状态；不会运行 AI、修改正文或创建导出文件。</p>
					</div>
					<div className="publish-readiness-list">
						{props.model.checks.map(check => (
							<PublishReadinessRow
								key={check.id}
								check={check}
								onAction={props.onAction}
							/>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

function PublishReadinessRow(props: {
	readonly check: PublishReadinessCheck;
	readonly onAction: (action: PublishReadinessAction) => void;
}): React.JSX.Element {
	const label = props.check.status === 'blocked'
		? '阻断'
		: props.check.status === 'attention' ? '待确认' : '已通过';
	return (
		<article className="publish-readiness-row" data-status={props.check.status}>
			<span className="publish-readiness-row-icon">
				{props.check.status === 'blocked'
					? <OctagonX size={18} />
					: props.check.status === 'attention'
						? <AlertTriangle size={18} />
						: <CheckCircle2 size={18} />}
			</span>
			<div>
				<header>
					<strong>{props.check.title}</strong>
					<span>{label}</span>
				</header>
				<p>{props.check.detail}</p>
			</div>
			{props.check.action && (
				<button
					className="secondary-button"
					type="button"
					onClick={() => props.onAction(props.check.action!)}
				>
					{props.check.action.label}<ExternalLink size={16} aria-hidden="true" />
				</button>
			)}
		</article>
	);
}

function ReviewMetric(props: { readonly label: string; readonly value: number }): React.JSX.Element {
	return <div><strong>{props.value}</strong><span>{props.label}</span></div>;
}

function ReviewIssueCard(props: { readonly issue: ReviewIssue }): React.JSX.Element {
	const severityLabels: Readonly<Record<ReviewIssue['severity'], string>> = {
		info: '信息',
		suggestion: '建议',
		warning: '警告',
		error: '错误'
	};
	return (
		<article className="review-issue-card">
			<div>
				<span className="severity-dot" data-severity={props.issue.severity} />
				<strong>{props.issue.title}</strong>
				<span className={`review-origin origin-${props.issue.origin}`}>
					{props.issue.origin === 'ai' ? 'AI' : '本地'}
				</span>
				<span className="review-severity">{severityLabels[props.issue.severity]}</span>
			</div>
			<p>{props.issue.message}</p>
			<blockquote>{props.issue.anchor.target}</blockquote>
			{props.issue.replacement !== undefined && (
				<div className="review-replacement">{props.issue.replacement || '建议删除此处'}</div>
			)}
		</article>
	);
}
