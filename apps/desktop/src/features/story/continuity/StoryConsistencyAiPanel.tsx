import {
	AlertTriangle,
	BookOpenCheck,
	CheckCircle2,
	CircleStop,
	FileCheck2,
	ListChecks,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildStoryConsistencyAnalysisMessages,
	parseStoryConsistencyAnalysisResponse,
	type AiJobState
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type { ReviewIssue } from '@writing-buddy/review';
import { useEffect, useMemo, useRef, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import { loadSafeStoryConsistencyFacts } from './StoryConsistencyReviewService';
import {
	deduplicateStoryConsistencyIssues,
	planWholeWorkConsistency,
	toStoryConsistencySources,
	WholeWorkConsistencyPlanError,
	type WholeWorkConsistencyPlan,
	type WholeWorkConsistencySource
} from './WholeWorkConsistencyPlan';
import './StoryConsistencyAiPanel.css';

type ConsistencyScope = 'whole-work' | 'selected';

function friendlyError(reason: unknown): string {
	if (reason instanceof WholeWorkConsistencyPlanError) {
		const title = reason.chapterTitle ? `“${reason.chapterTitle}”` : '当前作品';
		const labels: Readonly<Record<WholeWorkConsistencyPlanError['code'], string>> = {
			notEnoughWrittenChapters: '至少需要 2 个已有正文的章节才能运行全书一致性扫描。',
			chapterTooLong: `${title}超过单章 100,000 字符上限，请拆分后再扫描。`,
			chaptersCannotShareBatch: `${title}附近的章节正文过长，无法在安全输入边界内形成对照批次。`,
			tooManyBatches: '当前作品需要超过 8 次 AI 请求；请改用“自选章节”分段检查。'
		};
		return labels[reason.code];
	}
	const code = reason instanceof Error ? reason.message : String(reason);
	const labels: Readonly<Record<string, string>> = {
		authentication_failed: 'DeepSeek 尚未配置或密钥已经失效。',
		network_unavailable: '当前无法连接 DeepSeek，请检查网络后重试。',
		connection_timeout: '连接 DeepSeek 超时，本次没有产生审查结果。',
		first_content_timeout: '等待首段结果超时，本次没有产生审查结果。',
		stream_idle_timeout: '生成流长时间没有新内容，本次没有产生审查结果。',
		invalidStoryConsistencyAnalysisInput: '所选正文为空、过长，或包含不能发送的字段。',
		invalidStoryConsistencyEvidence: 'AI 返回的证据无法与所选正文逐字对应，结果已拒绝。',
		unknownStoryConsistencyFact: 'AI 引用了未发送的 Story Fact，结果已拒绝。'
	};
	return labels[code] ?? 'AI 对照审查失败，未保存任何结果。';
}

export function StoryConsistencyAiPanel(props: {
	readonly projectId: string;
	readonly projectRoot: string;
	readonly chapters: readonly AiChapterSource[];
	readonly readOnly?: boolean;
	readonly repository?: StoryRepository;
	readonly onClose: () => void;
	readonly onCreated: (issues: readonly ReviewIssue[]) => void;
}): React.JSX.Element {
	const defaultIds = props.chapters.slice(0, 2).map(chapter => chapter.resourceId);
	const [scope, setScope] = useState<ConsistencyScope>('whole-work');
	const [selectedIds, setSelectedIds] = useState<readonly string[]>(defaultIds);
	const [instruction, setInstruction] = useState(
		'检查所选章节之间的人物状态、时间、地点、物品、信息权限与因果关系是否存在明确矛盾。'
	);
	const [factsCount, setFactsCount] = useState(0);
	const [state, setState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [running, setRunning] = useState(false);
	const [resultCount, setResultCount] = useState<number>();
	const [batchProgress, setBatchProgress] = useState<{ readonly current: number; readonly total: number }>();
	const [completedPlan, setCompletedPlan] = useState<WholeWorkConsistencyPlan>();
	const [error, setError] = useState('');
	const [cancellationPending, setCancellationPending] = useState(false);
	const runLockRef = useRef(false);
	const cancelRequestedRef = useRef(false);
	const cancelGuardRef = useRef(false);
	const activeJobIdRef = useRef<string | undefined>(undefined);
	const repository = useMemo(
		() => props.repository ?? new DesktopStoryRepository(props.projectRoot, desktopBridge),
		[props.projectRoot, props.repository]
	);

	useEffect(() => {
		let cancelled = false;
		void loadSafeStoryConsistencyFacts(repository)
			.then(facts => {
				if (!cancelled) setFactsCount(facts.length);
			})
			.catch(() => {
				if (!cancelled) setFactsCount(0);
			});
		return () => {
			cancelled = true;
		};
	}, [repository]);

	const toggleChapter = (resourceId: string) => {
		setSelectedIds(current => {
			if (current.includes(resourceId)) {
				return current.filter(id => id !== resourceId);
			}
			if (current.length >= 12) return current;
			return [...current, resourceId];
		});
	};
	const loadSources = async (
		chapters: readonly AiChapterSource[]
	): Promise<readonly WholeWorkConsistencySource[]> => Promise.all(chapters.map(async chapter => {
		const file = await desktopBridge.readText(props.projectRoot, chapter.path);
		return {
			resourceId: chapter.resourceId,
			sourceRevision: file.hash,
			content: file.content,
			title: chapter.title
		};
	}));

	const run = async () => {
		if (runLockRef.current || !instruction.trim()) return;
		if (scope === 'selected' && (selectedIds.length < 2 || selectedIds.length > 12)) return;
		runLockRef.current = true;
		cancelRequestedRef.current = false;
		cancelGuardRef.current = false;
		setCancellationPending(false);
		setRunning(true);
		setError('');
		setResultCount(undefined);
		setCompletedPlan(undefined);
		setBatchProgress(undefined);
		setState('created');
		setStreamedLength(0);
		try {
			const chapters = scope === 'whole-work'
				? props.chapters
				: selectedIds.map(resourceId => props.chapters.find(item => item.resourceId === resourceId))
					.filter((chapter): chapter is AiChapterSource => Boolean(chapter));
			if (chapters.length !== (scope === 'whole-work' ? props.chapters.length : selectedIds.length)) {
				throw new Error('invalidStoryConsistencyAnalysisInput');
			}
			const loaded = await loadSources(chapters);
			const wholePlan = scope === 'whole-work' ? planWholeWorkConsistency(loaded) : undefined;
			const batches = wholePlan
				? wholePlan.batches.map(toStoryConsistencySources)
				: [toStoryConsistencySources(loaded)];
			setBatchProgress({ current: 1, total: batches.length });
			const storyFacts = await loadSafeStoryConsistencyFacts(repository);
			const collected: ReviewIssue[] = [];
			for (const [index, sources] of batches.entries()) {
				if (cancelRequestedRef.current) throw new Error('cancelled');
				setBatchProgress({ current: index + 1, total: batches.length });
				setStreamedLength(0);
				const messages = buildStoryConsistencyAnalysisMessages({
					instruction,
					sources,
					storyFacts
				});
				const response = await runGroundedJsonJob({
					jobType: 'story-consistency-analysis',
					messages,
					onJobId: jobId => {
						activeJobIdRef.current = jobId;
					},
					onProgress: progress => {
						setState(progress.state);
						setStreamedLength(progress.output.length);
					}
				});
				collected.push(...parseStoryConsistencyAnalysisResponse({
					projectId: props.projectId,
					sources,
					storyFacts,
					response: response.output
				}));
			}
			if (cancelRequestedRef.current) throw new Error('cancelled');
			const issues = deduplicateStoryConsistencyIssues(collected);
			props.onCreated(issues);
			setResultCount(issues.length);
			setCompletedPlan(wholePlan);
		} catch (reason) {
			setError(cancelRequestedRef.current
				? '全书扫描已停止；已有审查结果保持不变，没有保存半成品。'
				: friendlyError(reason));
		} finally {
			runLockRef.current = false;
			cancelGuardRef.current = false;
			setCancellationPending(false);
			setRunning(false);
			activeJobIdRef.current = undefined;
		}
	};

	const cancel = async () => {
		if (cancelGuardRef.current) return;
		cancelGuardRef.current = true;
		cancelRequestedRef.current = true;
		setCancellationPending(true);
		setError('');
		try {
			if (!activeJobIdRef.current) return;
			const accepted = await desktopBridge.cancelAiJob(activeJobIdRef.current);
			if (!accepted) {
				cancelGuardRef.current = false;
				setCancellationPending(false);
				setError('没有找到正在生成的任务，请稍候后重试停止。');
			}
		} catch (reason) {
			cancelGuardRef.current = false;
			setCancellationPending(false);
			setError(friendlyError(reason));
		}
	};

	return (
		<div className="story-consistency-overlay" onMouseDown={event => {
			if (event.target === event.currentTarget && !running) props.onClose();
		}}>
			<aside
				className="story-consistency-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="story-consistency-title"
			>
				<header>
					<div>
						<span className="eyebrow">GROUNDED COMPARISON</span>
						<h2 id="story-consistency-title">AI 跨章对照审查</h2>
						<p>只创建带证据的待处理问题，不改正文、不覆盖 Story Kernel。</p>
					</div>
					<button type="button" aria-label="关闭 AI 对照审查" disabled={running} onClick={props.onClose}>
						<X size={20} />
					</button>
				</header>

				<section className="story-consistency-boundary">
					<ShieldCheck size={18} />
					<div>
						<strong>发送边界清晰</strong>
						<span>{scope === 'whole-work' ? '每批发送 2–12 个连续章节' : '发送 2–12 个勾选章节'}与 {factsCount} 条非秘密 Story Fact；作者秘密、隐藏伏笔真相、项目路径和密钥不会发送。</span>
					</div>
				</section>

				<div className="story-consistency-scope" role="tablist" aria-label="一致性审查范围">
					<button
						type="button"
						role="tab"
						aria-selected={scope === 'whole-work'}
						className={scope === 'whole-work' ? 'is-active' : ''}
						disabled={running}
						onClick={() => setScope('whole-work')}
					>
						<BookOpenCheck size={18} />
						<span><strong>全书扫描</strong><small>按顺序分批覆盖全部已写章节</small></span>
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={scope === 'selected'}
						className={scope === 'selected' ? 'is-active' : ''}
						disabled={running}
						onClick={() => setScope('selected')}
					>
						<ListChecks size={18} />
						<span><strong>自选章节</strong><small>精确选择 2–12 章对照</small></span>
					</button>
				</div>

				<section className="story-consistency-source-section">
					<header>
						<div><FileCheck2 size={18} /><h3>{scope === 'whole-work' ? '全书扫描范围' : '选择对照章节'}</h3></div>
						<strong>{scope === 'whole-work' ? `${props.chapters.length} 章` : `${selectedIds.length}/12`}</strong>
					</header>
					{scope === 'whole-work' ? (
						<div className="story-consistency-whole-summary">
							<BookOpenCheck size={24} />
							<div>
								<strong>覆盖所有已有正文的章节</strong>
								<span>启动时先在本地核验正文，再按连续章节分为最多 8 次请求；批次间尽量保留前一章。</span>
								<small>空章节会跳过；超过边界会在首次 AI 调用前停止。</small>
							</div>
						</div>
					) : (
						<div className="story-consistency-source-list">
							{props.chapters.map(chapter => (
								<label key={chapter.resourceId}>
									<input
										type="checkbox"
										checked={selectedIds.includes(chapter.resourceId)}
										disabled={running || (
											!selectedIds.includes(chapter.resourceId)
											&& selectedIds.length >= 12
										)}
										onChange={() => toggleChapter(chapter.resourceId)}
									/>
									<span>
										<strong>{chapter.title}</strong>
										<small>{chapter.volumeTitle ?? '未分卷'} · {chapter.resourceId}</small>
									</span>
								</label>
							))}
						</div>
					)}
				</section>

				<label className="story-consistency-instruction">
					<span>审查重点</span>
					<textarea
						value={instruction}
						maxLength={2_000}
						disabled={running}
						onChange={event => setInstruction(event.target.value)}
					/>
				</label>

				{running ? (
					<p className="story-consistency-progress" role="status">
						<LoaderCircle className="spin" size={16} />
						{batchProgress ? `第 ${batchProgress.current}/${batchProgress.total} 批 · ` : ''}
						{state} · 已接收 {streamedLength.toLocaleString()} 字符
					</p>
				) : null}
				{resultCount !== undefined ? (
					<p className="story-consistency-success" role="status">
						<CheckCircle2 size={16} />
						{completedPlan
							? `全书扫描完成：${completedPlan.writtenChapterCount} 个正文章节、${completedPlan.batches.length} 批，创建 ${resultCount} 条待处理建议${completedPlan.skippedEmptyCount ? `，跳过 ${completedPlan.skippedEmptyCount} 个空章节` : ''}；结果最高为“警告”。`
							: `已创建 ${resultCount} 条待处理建议；最高严重级别为“警告”。`}
					</p>
				) : null}
				{error ? <p className="story-consistency-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}

				<footer>
					<span><Sparkles size={16} />点击开始后才会调用 DeepSeek</span>
					<div>
						<button
							className="primary-action"
							type="button"
							disabled={
								running
								|| props.readOnly
								|| (scope === 'whole-work'
									? props.chapters.length < 2
									: selectedIds.length < 2)
								|| !instruction.trim()
							}
							onClick={() => void run()}
						>
							{running ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
							{running
								? '扫描正在进行'
								: scope === 'whole-work' ? '开始全书扫描' : '开始对照审查'}
						</button>
						{running ? (
							<button
								className="stop-action"
								type="button"
								disabled={cancellationPending}
								onClick={() => void cancel()}
							>
								{cancellationPending
									? <LoaderCircle className="spin" size={18} />
									: <CircleStop size={18} />}
								{cancellationPending ? '正在停止' : '停止'}
							</button>
						) : null}
					</div>
				</footer>
			</aside>
		</div>
	);
}
