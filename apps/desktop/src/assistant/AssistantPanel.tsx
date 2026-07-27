import {
	BookMarked,
	Check,
	ChevronRight,
	ClipboardCheck,
	Lightbulb,
	MapPin,
	Sparkles,
	UsersRound,
	WandSparkles,
	X
} from 'lucide-react';
import {
	FakeAiProvider,
	buildSelectionContext,
	suggestionToReviewIssue
} from '@writing-buddy/ai';
import { runLocalReview } from '@writing-buddy/review';
import { useState } from 'react';
import { useAppStore } from '../app/store';
import { ResizeHandle } from '../shell/ResizeHandle';

const fakeAi = new FakeAiProvider();

export function AssistantPanel(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const selection = useAppStore(state => state.selection);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const setError = useAppStore(state => state.setError);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const setAssistantWidth = useAppStore(state => state.setAssistantWidth);
	const toggleAssistant = useAppStore(state => state.toggleAssistant);
	const [tab, setTab] = useState<'suggestions' | 'review' | 'context'>('suggestions');
	const [working, setWorking] = useState(false);

	const activeChapter = snapshot?.project.volumes
		.flatMap(volume => volume.chapters)
		.find(chapter => chapter.id === activeResource?.id);

	const runReview = () => {
		if (!snapshot || !activeResource || !session) {
			return;
		}
		setIssues(runLocalReview(snapshot.project.projectId, activeResource.id, session.content).issues);
		setTab('review');
	};

	const polish = async () => {
		if (!snapshot || !activeResource || !session || !selection?.text) {
			return;
		}
		setWorking(true);
		try {
			const messages = buildSelectionContext({
				projectTitle: snapshot.project.title,
				chapterTitle: activeResource.title,
				selection: selection.text,
				before: session.content.slice(Math.max(0, selection.start - 100), selection.start),
				after: session.content.slice(selection.end, selection.end + 100)
			});
			const suggestion = await fakeAi.complete({
				requestId: crypto.randomUUID(),
				model: 'local-fixture',
				messages,
				task: 'polish'
			});
			setIssues([
				suggestionToReviewIssue({
					projectId: snapshot.project.projectId,
					resourceId: activeResource.id,
					start: selection.start,
					end: selection.end,
					content: session.content,
					suggestion
				}),
				...issues
			]);
		} catch (error) {
			setError(error instanceof Error ? error.message : '生成建议失败。');
		} finally {
			setWorking(false);
		}
	};

	return (
		<aside className="assistant-panel">
			<div className="assistant-heading">
				<div>
					<span className="eyebrow">Writing Assistant</span>
					<h2>写作助手</h2>
				</div>
				<button className="icon-button" type="button" onClick={toggleAssistant} aria-label="关闭写作助手"><X size={18} /></button>
			</div>
			<div className="assistant-tabs" role="tablist">
				<button type="button" role="tab" aria-selected={tab === 'suggestions'} onClick={() => setTab('suggestions')}>建议</button>
				<button type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>审校</button>
				<button type="button" role="tab" aria-selected={tab === 'context'} onClick={() => setTab('context')}>上下文</button>
			</div>

			{tab === 'suggestions' && (
				<div className="assistant-scroll">
					<div className="selection-card">
						<span><WandSparkles size={16} /> 当前选区</span>
						<p>{selection?.text || '请先在正文中选择一段文字。'}</p>
						<button className="primary-button full-width" type="button" disabled={!selection?.text || working} onClick={() => void polish()}>
							<Sparkles size={17} />{working
								? '正在分析…'
								: '生成本地模拟建议'}
						</button>
					</div>
					<div className="quick-actions">
						<button type="button" disabled={!selection?.text}><Lightbulb size={17} />精简</button>
						<button type="button" disabled={!selection?.text}><ClipboardCheck size={17} />语病</button>
						<button type="button" disabled={!selection?.text}><UsersRound size={17} />对话</button>
						<button type="button" disabled={!selection?.text}><BookMarked size={17} />节奏</button>
					</div>
					{issues.filter(issue => issue.origin === 'ai').map(issue => (
						<article className="suggestion-card" key={issue.id}>
							<div className="card-kicker"><Sparkles size={15} />润色建议</div>
							<blockquote>{issue.replacement}</blockquote>
							<p>{issue.message}</p>
							<button type="button" onClick={() => setIssues(issues)}><span>在待处理区查看</span><ChevronRight size={16} /></button>
						</article>
					))}
				</div>
			)}

			{tab === 'review' && (
				<div className="assistant-scroll">
					<div className="review-summary-card">
						<div className="review-score"><Check size={22} /><strong>{issues.length}</strong></div>
						<div><strong>当前章节问题</strong><span>本地规则，不发送正文</span></div>
					</div>
					<button className="primary-button full-width" type="button" onClick={runReview} disabled={!session}>
						<ClipboardCheck size={17} />重新审校当前章节
					</button>
					{issues.map(issue => (
						<div className="compact-issue" key={issue.id}>
							<span data-severity={issue.severity} />
							<div><strong>{issue.title}</strong><p>{issue.message}</p></div>
						</div>
					))}
				</div>
			)}

			{tab === 'context' && (
				<div className="assistant-scroll context-list">
					<ContextCard icon={<MapPin size={18} />} label="场景" value={activeChapter?.scene.location || '未设置'} />
					<ContextCard icon={<BookMarked size={18} />} label="时间" value={activeChapter?.scene.time || '未设置'} />
					<ContextCard icon={<UsersRound size={18} />} label="视角人物" value={activeChapter?.scene.pov || '未设置'} />
					<ContextCard icon={<UsersRound size={18} />} label="出场人物" value={activeChapter?.scene.characters.join('、') || '未设置'} />
					<ContextCard icon={<Lightbulb size={18} />} label="本章目标" value={activeChapter?.scene.goal || '未设置'} />
					<ContextCard icon={<BookMarked size={18} />} label="备注" value={activeChapter?.scene.note || '未设置'} />
				</div>
			)}
			<ResizeHandle
				className="assistant-resize-handle"
				label="调整写作助手宽度"
				axis="x"
				direction={-1}
				value={assistantWidth}
				onChange={setAssistantWidth}
			/>
		</aside>
	);
}

function ContextCard(props: { readonly icon: React.ReactNode; readonly label: string; readonly value: string }): React.JSX.Element {
	return (
		<article className="context-card">
			<div className="context-icon">{props.icon}</div>
			<div><span>{props.label}</span><strong>{props.value}</strong></div>
		</article>
	);
}
