import {
	BookMarked,
	Check,
	ClipboardCheck,
	Compass,
	Feather,
	HeartPulse,
	Lightbulb,
	ListTree,
	Maximize2,
	MapPin,
	UsersRound,
	WandSparkles,
	X
} from 'lucide-react';
import type {
	ManuscriptContinuationMode,
	ScenePlanActionType,
	SelectionRewriteActionType
} from '@writing-buddy/story-kernel';
import { replaceReviewIssuesForResource, runLocalReview } from '@writing-buddy/review';
import { useMemo, useState } from 'react';
import { useAppStore, type AssistantActionIntent } from '../app/store';
import { SelectionRewritePanel } from '../features/story/ai-context/SelectionRewritePanel';
import { ManuscriptContinuationPanel } from '../features/story/ai-context/ManuscriptContinuationPanel';
import { ScenePlanningPanel } from '../features/story/ai-context/ScenePlanningPanel';
import { PendingFactsReview } from '../features/story/ai-context/PendingFactsReview';
import { StoryKernelGeneratorPanel } from '../features/story/ai-context/StoryKernelGeneratorPanel';
import { ResizeHandle } from '../shell/ResizeHandle';

export function AssistantPanel(): React.JSX.Element {
	const assistantIntent = useAppStore(state => state.assistantIntent);
	return (
		<AssistantPanelContent
			key={assistantIntent?.id ?? 'assistant-default'}
			initialIntent={assistantIntent}
		/>
	);
}

function AssistantPanelContent(props: {
	readonly initialIntent?: AssistantActionIntent;
}): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const selection = useAppStore(state => state.selection);
	const cursorOffset = useAppStore(state => state.cursorOffset);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const requestEditorEdit = useAppStore(state => state.requestEditorEdit);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const theme = useAppStore(state => state.theme);
	const setAssistantWidth = useAppStore(state => state.setAssistantWidth);
	const toggleAssistant = useAppStore(state => state.toggleAssistant);
	const [tab, setTab] = useState<'suggestions' | 'outline' | 'review' | 'context' | 'kernel'>(
		props.initialIntent?.kind === 'story-kernel'
			? 'kernel'
			: props.initialIntent?.kind === 'scene-plan'
				? 'outline'
				: 'suggestions'
	);
	const [suggestionKind, setSuggestionKind] = useState<'rewrite' | 'continuation'>(
		props.initialIntent?.kind === 'continuation' ? 'continuation' : 'rewrite'
	);
	const [rewriteAction, setRewriteAction] = useState<SelectionRewriteActionType>(
		props.initialIntent?.kind === 'rewrite' ? props.initialIntent.actionType : 'polish'
	);
	const [continuationMode, setContinuationMode] = useState<ManuscriptContinuationMode>(
		props.initialIntent?.kind === 'continuation'
			? props.initialIntent.mode
			: 'continue-paragraph'
	);
	const [scenePlanAction, setScenePlanAction] = useState<ScenePlanActionType>(
		props.initialIntent?.kind === 'scene-plan'
			? props.initialIntent.actionType
			: 'generate-outline'
	);
	const kernelPreset = useMemo(() => props.initialIntent?.kind === 'story-kernel'
		? {
			id: props.initialIntent.id,
			instruction: props.initialIntent.instruction,
			targetTypes: [props.initialIntent.targetType]
		}
		: undefined, [props.initialIntent]);

	const activeChapter = snapshot?.project.volumes
		.flatMap(volume => volume.chapters)
		.find(chapter => chapter.id === activeResource?.id);

	const runReview = () => {
		if (!snapshot || !activeResource || !session) {
			return;
		}
		const result = runLocalReview(snapshot.project.projectId, activeResource.id, session.content);
		setIssues(replaceReviewIssuesForResource(issues, result.issues, activeResource.id, 'local'));
		setTab('review');
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
				<button type="button" role="tab" aria-selected={tab === 'outline'} onClick={() => setTab('outline')}>细纲</button>
				<button type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>审校</button>
				<button type="button" role="tab" aria-selected={tab === 'context'} onClick={() => setTab('context')}>上下文</button>
				<button type="button" role="tab" aria-selected={tab === 'kernel'} onClick={() => setTab('kernel')}>内核</button>
			</div>

			{tab === 'suggestions' && (
				<div className="assistant-scroll">
					<div className="assistant-mode-switch" aria-label="建议类型">
						<button
							type="button"
							className={suggestionKind === 'rewrite' ? 'is-active' : ''}
							onClick={() => setSuggestionKind('rewrite')}
						>
							<WandSparkles size={16} />选区改写
						</button>
						<button
							type="button"
							className={suggestionKind === 'continuation' ? 'is-active' : ''}
							onClick={() => setSuggestionKind('continuation')}
						>
							<Feather size={16} />光标续写
						</button>
					</div>
					{suggestionKind === 'rewrite' ? (
						<>
					<div className="selection-card">
						<span><WandSparkles size={16} /> 当前选区</span>
						<p>{selection?.text || '请先在正文中选择一段文字。'}</p>
					</div>
					<div className="quick-actions">
						<button type="button" className={rewriteAction === 'polish' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('polish')}><WandSparkles size={17} />润色</button>
						<button type="button" className={rewriteAction === 'concise' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('concise')}><Lightbulb size={17} />精简</button>
						<button type="button" className={rewriteAction === 'expand' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('expand')}><Maximize2 size={17} />扩写</button>
						<button type="button" className={rewriteAction === 'grammar' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('grammar')}><ClipboardCheck size={17} />语病</button>
						<button type="button" className={rewriteAction === 'dialogue' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('dialogue')}><UsersRound size={17} />对话</button>
						<button type="button" className={rewriteAction === 'pacing' ? 'is-active' : ''} disabled={!selection?.text} onClick={() => setRewriteAction('pacing')}><BookMarked size={17} />节奏</button>
					</div>
					{snapshot && activeResource?.type === 'chapter' && session && selection?.text ? (
						<SelectionRewritePanel
							projectRoot={snapshot.root}
							resourceId={activeResource.id}
							sourceRevision={session.state.version}
							content={session.content}
							selection={selection}
							theme={['paper', 'fog'].includes(theme) ? 'vs' : 'vs-dark'}
							actionType={rewriteAction}
							onApply={(start, end, text) => requestEditorEdit({
								id: crypto.randomUUID(),
								resourceId: activeResource.id,
								start,
								end,
								text
							})}
							onReplaceDocument={content => requestEditorEdit({
								id: crypto.randomUUID(),
								resourceId: activeResource.id,
								start: 0,
								end: session.content.length,
								text: content
							})}
						/>
					) : null}
						</>
					) : (
						<>
							<div className="quick-actions continuation-mode-actions">
								<button
									type="button"
									className={continuationMode === 'continue-paragraph' ? 'is-active' : ''}
									onClick={() => setContinuationMode('continue-paragraph')}
								>
									<Feather size={17} />继续本段
								</button>
								<button
									type="button"
									className={continuationMode === 'finish-scene' ? 'is-active' : ''}
									onClick={() => setContinuationMode('finish-scene')}
								>
									<Check size={17} />完成场景
								</button>
								<button
									type="button"
									className={continuationMode === 'three-directions' ? 'is-active' : ''}
									onClick={() => setContinuationMode('three-directions')}
								>
									<Compass size={17} />三种走向
								</button>
							</div>
							{snapshot && activeResource?.type === 'chapter' && session ? (
								<ManuscriptContinuationPanel
									projectRoot={snapshot.root}
									resourceId={activeResource.id}
									sourceRevision={session.state.version}
									content={session.content}
									cursorOffset={cursorOffset}
									mode={continuationMode}
									readOnly={snapshot.readOnly}
									onApply={(start, end, text) => requestEditorEdit({
										id: crypto.randomUUID(),
										resourceId: activeResource.id,
										start,
										end,
										text
									})}
									onReplaceDocument={content => requestEditorEdit({
										id: crypto.randomUUID(),
										resourceId: activeResource.id,
										start: 0,
										end: session.content.length,
										text: content
									})}
								/>
							) : (
								<p className="kernel-generator-empty">请先打开一个章节，再从光标位置生成续写候选。</p>
							)}
						</>
					)}
				</div>
			)}

			{tab === 'outline' && (
				<div className="assistant-scroll">
					<div className="quick-actions scene-plan-actions">
						<button
							type="button"
							className={scenePlanAction === 'generate-goal' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('generate-goal')}
						>
							<Lightbulb size={17} />生成目标
						</button>
						<button
							type="button"
							className={scenePlanAction === 'generate-outline' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('generate-outline')}
						>
							<ListTree size={17} />生成细纲
						</button>
						<button
							type="button"
							className={scenePlanAction === 'extract-outline' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('extract-outline')}
						>
							<ClipboardCheck size={17} />提取细纲
						</button>
						<button
							type="button"
							className={scenePlanAction === 'generate-emotion-beats' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('generate-emotion-beats')}
						>
							<HeartPulse size={17} />情绪节拍
						</button>
					</div>
					{snapshot && activeResource?.type === 'chapter' && session ? (
						<ScenePlanningPanel
							projectRoot={snapshot.root}
							resourceId={activeResource.id}
							sourceRevision={session.state.version}
							content={session.content}
							cursorOffset={cursorOffset}
							actionType={scenePlanAction}
							readOnly={snapshot.readOnly}
						/>
					) : (
						<p className="kernel-generator-empty">请先打开章节并把光标放在已建立的场景中。</p>
					)}
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
					{snapshot && activeResource?.type === 'chapter' && session ? (
						<PendingFactsReview
							projectRoot={snapshot.root}
							resourceId={activeResource.id}
							sourceRevision={session.state.version}
							content={session.content}
							selection={selection}
						/>
					) : null}
				</div>
			)}
			{tab === 'kernel' && (
				<div className="assistant-scroll">
					{snapshot && activeResource?.type === 'chapter' && session ? (
						<StoryKernelGeneratorPanel
							projectRoot={snapshot.root}
							resourceId={activeResource.id}
							sourceRevision={session.state.version}
							content={session.content}
							readOnly={snapshot.readOnly}
							selection={selection}
							preset={kernelPreset}
						/>
					) : (
						<p className="kernel-generator-empty">
							请先打开一个章节，再让 AI 从正文直接生成 Story Kernel 候选。
						</p>
					)}
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
