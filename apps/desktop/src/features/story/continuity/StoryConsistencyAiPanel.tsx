import {
	AlertTriangle,
	CheckCircle2,
	CircleStop,
	FileCheck2,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
	X
} from 'lucide-react';
import {
	buildStoryConsistencyAnalysisMessages,
	parseStoryConsistencyAnalysisResponse,
	type AiJobState,
	type StoryConsistencySourceInput
} from '@writing-buddy/ai';
import {
	DesktopStoryRepository,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type { ReviewIssue } from '@writing-buddy/review';
import { useEffect, useMemo, useState } from 'react';
import { desktopBridge } from '../../../platform/bridge';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import { runGroundedJsonJob } from '../ai-context/GroundedAiRunner';
import { loadSafeStoryConsistencyFacts } from './StoryConsistencyReviewService';
import './StoryConsistencyAiPanel.css';

function friendlyError(reason: unknown): string {
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
	const [selectedIds, setSelectedIds] = useState<readonly string[]>(defaultIds);
	const [instruction, setInstruction] = useState(
		'检查所选章节之间的人物状态、时间、地点、物品、信息权限与因果关系是否存在明确矛盾。'
	);
	const [factsCount, setFactsCount] = useState(0);
	const [state, setState] = useState<AiJobState>('created');
	const [streamedLength, setStreamedLength] = useState(0);
	const [activeJobId, setActiveJobId] = useState<string>();
	const [running, setRunning] = useState(false);
	const [resultCount, setResultCount] = useState<number>();
	const [error, setError] = useState('');
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

	const run = async () => {
		if (selectedIds.length < 2 || selectedIds.length > 12 || !instruction.trim()) return;
		setRunning(true);
		setError('');
		setResultCount(undefined);
		try {
			const sources: StoryConsistencySourceInput[] = [];
			for (const resourceId of selectedIds) {
				const chapter = props.chapters.find(item => item.resourceId === resourceId);
				if (!chapter) throw new Error('invalidStoryConsistencyAnalysisInput');
				const file = await desktopBridge.readText(props.projectRoot, chapter.path);
				sources.push({
					resourceId,
					sourceRevision: file.hash,
					content: file.content
				});
			}
			const storyFacts = await loadSafeStoryConsistencyFacts(repository);
			const messages = buildStoryConsistencyAnalysisMessages({
				instruction,
				sources,
				storyFacts
			});
			const response = await runGroundedJsonJob({
				jobType: 'story-consistency-analysis',
				messages,
				onJobId: setActiveJobId,
				onProgress: progress => {
					setState(progress.state);
					setStreamedLength(progress.output.length);
				}
			});
			const issues = parseStoryConsistencyAnalysisResponse({
				projectId: props.projectId,
				sources,
				storyFacts,
				response: response.output
			});
			props.onCreated(issues);
			setResultCount(issues.length);
		} catch (reason) {
			setError(friendlyError(reason));
		} finally {
			setRunning(false);
			setActiveJobId(undefined);
		}
	};

	const cancel = async () => {
		if (activeJobId) await desktopBridge.cancelAiJob(activeJobId);
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
						<span>发送 2–12 个勾选章节与 {factsCount} 条非秘密 Story Fact；作者秘密、隐藏伏笔真相、项目路径和密钥不会发送。</span>
					</div>
				</section>

				<section className="story-consistency-source-section">
					<header>
						<div><FileCheck2 size={18} /><h3>选择对照章节</h3></div>
						<strong>{selectedIds.length}/12</strong>
					</header>
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
						{state} · 已接收 {streamedLength.toLocaleString()} 字符
					</p>
				) : null}
				{resultCount !== undefined ? (
					<p className="story-consistency-success" role="status">
						<CheckCircle2 size={16} />已创建 {resultCount} 条待处理建议；最高严重级别为“警告”。
					</p>
				) : null}
				{error ? <p className="story-consistency-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}

				<footer>
					<span><Sparkles size={16} />点击开始后才会调用 DeepSeek</span>
					<div>
						{running ? (
							<button type="button" onClick={() => void cancel()}>
								<CircleStop size={18} />停止
							</button>
						) : (
							<button
								type="button"
								disabled={
									props.readOnly
									|| selectedIds.length < 2
									|| !instruction.trim()
								}
								onClick={() => void run()}
							>
								<Sparkles size={18} />开始对照审查
							</button>
						)}
					</div>
				</footer>
			</aside>
		</div>
	);
}
