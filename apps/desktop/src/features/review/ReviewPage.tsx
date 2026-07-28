import {
	Bot,
	CheckCircle2,
	ClipboardCheck,
	ExternalLink,
	FileWarning,
	KeyRound,
	ListChecks,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
	Square
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AI_CHAPTER_REVIEW_MAX_CHARS, type AiJobState } from '@writing-buddy/ai';
import {
	replaceReviewIssuesForResource,
	runLocalReview,
	type ReviewIssue
} from '@writing-buddy/review';
import { useAppStore } from '../../app/store';
import { useAiStore } from '../ai/stores/aiStore';
import { useReviewAutomationStore } from './stores/reviewAutomationStore';

type ReviewMode = 'manual' | 'ai';

const activeJobStates: readonly AiJobState[] = ['queued', 'connecting', 'thinking', 'streaming'];

export function ReviewPage(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const setRailMode = useAppStore(state => state.setMode);
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
	const isChapter = activeResource?.type === 'chapter' && Boolean(session);
	const configured = status?.secret.configured ?? false;
	const active = activeJobStates.includes(jobState);

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

	return (
		<div className="system-page review-page">
			<header>
				<span className="eyebrow">Review Center</span>
				<h1>审校中心</h1>
				<p>选择本地手动审校或 AI 自动审校。两种模式都只生成待确认建议，不会自动修改正文。</p>
			</header>

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
							<button className="primary-button" type="button" onClick={runManual} disabled={!isChapter}>
								<ClipboardCheck size={18} />手动运行审校
							</button>
						) : (
							<>
								<button
									className="primary-button"
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
