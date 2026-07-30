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
	Pin,
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
import {
	isCursorAtParagraphEnd,
	resolveContextualWriterActions
} from '../features/ai/contextual/ContextualActionResolver';
import { ResizeHandle } from '../shell/ResizeHandle';
import { workspaceResizeBounds } from '../shell/workspaceResize';
import type { WriterToolId } from '../app/writerWorkspace';
import { desktopBridge } from '../platform/bridge';

const writerToolLabels: Readonly<Record<WriterToolId, string>> = {
	outline: '细纲',
	characters: '人物',
	references: '资料',
	ai: 'AI',
	review: '检查'
};

function tabForTool(
	tool: WriterToolId,
	intent?: AssistantActionIntent
): 'suggestions' | 'outline' | 'review' | 'context' | 'kernel' {
	if (intent?.kind === 'story-kernel') return 'kernel';
	if (intent?.kind === 'scene-plan') return 'outline';
	if (tool === 'outline') return 'outline';
	if (tool === 'review') return 'review';
	if (tool === 'characters' || tool === 'references') return 'context';
	return 'suggestions';
}

function rewriteIcon(actionType: SelectionRewriteActionType): React.JSX.Element {
	switch (actionType) {
		case 'concise':
			return <Lightbulb size={18} />;
		case 'expand':
			return <Maximize2 size={18} />;
		case 'grammar':
			return <ClipboardCheck size={18} />;
		case 'dialogue':
			return <UsersRound size={18} />;
		case 'pacing':
			return <BookMarked size={18} />;
		case 'polish':
		default:
			return <WandSparkles size={18} />;
	}
}

export function AssistantPanel(): React.JSX.Element {
	const assistantIntent = useAppStore(state => state.assistantIntent);
	const writerTool = useAppStore(state => state.writerTool);
	return (
		<AssistantPanelContent
			key={`${writerTool}:${assistantIntent?.id ?? 'assistant-default'}`}
			initialIntent={assistantIntent}
			initialTool={writerTool}
		/>
	);
}

function AssistantPanelContent(props: {
	readonly initialIntent?: AssistantActionIntent;
	readonly initialTool: WriterToolId;
}): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const selection = useAppStore(state => state.selection);
	const cursorOffset = useAppStore(state => state.cursorOffset);
	const issues = useAppStore(state => state.issues);
	const setIssues = useAppStore(state => state.setIssues);
	const save = useAppStore(state => state.save);
	const requestEditorEdit = useAppStore(state => state.requestEditorEdit);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const theme = useAppStore(state => state.theme);
	const setAssistantWidth = useAppStore(state => state.setAssistantWidth);
	const closeWriterTool = useAppStore(state => state.closeWriterTool);
	const writerToolPinned = useAppStore(state => state.writerToolPinned);
	const toggleWriterToolPinned = useAppStore(state => state.toggleWriterToolPinned);
	const toolLabel = writerToolLabels[props.initialTool];
	const tab = tabForTool(props.initialTool, props.initialIntent);
	const [suggestionKind, setSuggestionKind] = useState<'rewrite' | 'continuation'>(
		props.initialIntent?.kind === 'continuation'
			? 'continuation'
			: props.initialIntent?.kind === 'rewrite' || selection?.text
				? 'rewrite'
				: 'continuation'
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
	const contextualActions = useMemo(() => resolveContextualWriterActions({
		workspace: 'writing',
		hasProject: Boolean(snapshot),
		activeResourceType: activeResource?.type,
		selectionText: selection?.text,
		cursorAtParagraphEnd: session
			? isCursorAtParagraphEnd(session.content, cursorOffset)
			: false,
		chapterHasDraft: Boolean(session?.content.trim()),
		chapterHasPendingExtraction: false
	}), [activeResource?.type, cursorOffset, selection?.text, session, snapshot]);

	const activeChapter = snapshot?.project.volumes
		.flatMap(volume => volume.chapters)
		.find(chapter => chapter.id === activeResource?.id);

	const runReview = () => {
		if (!snapshot || !activeResource || !session) {
			return;
		}
		const result = runLocalReview(snapshot.project.projectId, activeResource.id, session.content);
		setIssues(replaceReviewIssuesForResource(issues, result.issues, activeResource.id, 'local'));
	};

	const prepareAiInsertionSnapshot = async (label: string) => {
		const before = useAppStore.getState();
		const expectedRoot = before.snapshot?.root;
		const expectedResourceId = before.activeResource?.id;
		if (
			!expectedRoot
			|| !expectedResourceId
			|| before.snapshot?.readOnly
			|| before.activeResource?.type !== 'chapter'
			|| before.session?.state.resourceId !== expectedResourceId
		) {
			throw new Error('当前章节不可写入，未创建快照。');
		}
		await save();
		const current = useAppStore.getState();
		if (
			current.snapshot?.root !== expectedRoot
			|| current.activeResource?.id !== expectedResourceId
			|| current.session?.state.resourceId !== expectedResourceId
			|| current.session.state.dirty
			|| current.saveState.type !== 'clean'
		) {
			throw new Error('正文尚未安全保存，已停止 AI 写入。请先解决保存问题后重试。');
		}
		await desktopBridge.createSnapshot(
			expectedRoot,
			'beforeDestructiveOperation',
			label
		);
	};

	return (
		<aside className="assistant-panel" aria-label={`${toolLabel}工具`}>
			<div className="assistant-heading">
				<div>
					<span className="eyebrow">Writer tools</span>
					<h2>{toolLabel}</h2>
				</div>
				<button
					className={`icon-button ${writerToolPinned ? 'is-active' : ''}`}
					type="button"
					onClick={toggleWriterToolPinned}
					aria-pressed={writerToolPinned}
					aria-label={`${writerToolPinned ? '取消固定' : '固定'}${toolLabel}工具面板`}
					title={writerToolPinned ? '取消固定；之后可按 Esc 收起' : '固定面板'}
				>
					<Pin size={18} />
				</button>
				<button
					className="icon-button"
					type="button"
					onClick={closeWriterTool}
					aria-label={`关闭${toolLabel}工具面板`}
					aria-keyshortcuts="Control+Alt+B Meta+Alt+B"
					title={`关闭${toolLabel}工具面板 (Ctrl+Alt+B)`}
				>
					<X size={18} />
				</button>
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
						{contextualActions.primary.map(action => action.kind === 'rewrite' && (
							<button
								key={action.id}
								type="button"
								className={rewriteAction === action.actionType ? 'is-active' : ''}
								disabled={!selection?.text}
								title={action.description}
								onClick={() => setRewriteAction(action.actionType)}
							>
								{rewriteIcon(action.actionType)}{action.label}
							</button>
						))}
					</div>
					{contextualActions.secondary.length > 0 && (
						<details className="assistant-more-actions">
							<summary>更多 AI 操作</summary>
							<div className="quick-actions">
								{contextualActions.secondary.map(action => action.kind === 'rewrite' && (
									<button
										key={action.id}
										type="button"
										className={rewriteAction === action.actionType ? 'is-active' : ''}
										disabled={!selection?.text}
										title={action.description}
										onClick={() => setRewriteAction(action.actionType)}
									>
										{rewriteIcon(action.actionType)}{action.label}
									</button>
								))}
							</div>
						</details>
					)}
					{snapshot && activeResource?.type === 'chapter' && session && selection?.text ? (
						<SelectionRewritePanel
							projectRoot={snapshot.root}
							resourceId={activeResource.id}
							sourceRevision={session.state.version}
							content={session.content}
							selection={selection}
							theme={['paper', 'fog'].includes(theme) ? 'vs' : 'vs-dark'}
							actionType={rewriteAction}
							onBeforeApply={prepareAiInsertionSnapshot}
							onApply={(start, end, text) => requestEditorEdit({
								id: crypto.randomUUID(),
								resourceId: activeResource.id,
								start,
								end,
								text,
								origin: 'ai',
								highlightDurationMs: 10_000
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
									<Feather size={18} />继续本段
								</button>
								<button
									type="button"
									className={continuationMode === 'finish-scene' ? 'is-active' : ''}
									onClick={() => setContinuationMode('finish-scene')}
								>
									<Check size={18} />完成场景
								</button>
								<button
									type="button"
									className={continuationMode === 'three-directions' ? 'is-active' : ''}
									onClick={() => setContinuationMode('three-directions')}
								>
									<Compass size={18} />三种走向
								</button>
							</div>
							{snapshot && activeResource?.type === 'chapter' && session ? (
								<ManuscriptContinuationPanel
									key={`${activeResource.id}:${continuationMode}`}
									projectRoot={snapshot.root}
									resourceId={activeResource.id}
									sourceRevision={session.state.version}
									content={session.content}
									cursorOffset={cursorOffset}
									mode={continuationMode}
									readOnly={snapshot.readOnly}
									theme={['paper', 'fog'].includes(theme) ? 'vs' : 'vs-dark'}
									onBeforeApply={prepareAiInsertionSnapshot}
									onApply={(start, end, text) => requestEditorEdit({
										id: crypto.randomUUID(),
										resourceId: activeResource.id,
										start,
										end,
										text,
										origin: 'ai',
										highlightDurationMs: 10_000
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
							<Lightbulb size={18} />生成目标
						</button>
						<button
							type="button"
							className={scenePlanAction === 'generate-outline' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('generate-outline')}
						>
							<ListTree size={18} />生成细纲
						</button>
						<button
							type="button"
							className={scenePlanAction === 'extract-outline' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('extract-outline')}
						>
							<ClipboardCheck size={18} />提取细纲
						</button>
						<button
							type="button"
							className={scenePlanAction === 'generate-emotion-beats' ? 'is-active' : ''}
							onClick={() => setScenePlanAction('generate-emotion-beats')}
						>
							<HeartPulse size={18} />情绪节拍
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
						<ClipboardCheck size={18} />重新审校当前章节
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
					{props.initialTool === 'characters' ? (
						<>
							<ContextCard icon={<UsersRound size={18} />} label="视角人物" value={activeChapter?.scene.pov || '未设置'} />
							<ContextCard icon={<UsersRound size={18} />} label="出场人物" value={activeChapter?.scene.characters.join('、') || '未设置'} />
						</>
					) : (
						<>
							<ContextCard icon={<MapPin size={18} />} label="地点" value={activeChapter?.scene.location || '未设置'} />
							<ContextCard icon={<BookMarked size={18} />} label="时间" value={activeChapter?.scene.time || '未设置'} />
							<ContextCard icon={<Lightbulb size={18} />} label="本章目标" value={activeChapter?.scene.goal || '未设置'} />
							<ContextCard icon={<BookMarked size={18} />} label="备注" value={activeChapter?.scene.note || '未设置'} />
						</>
					)}
					{props.initialTool === 'references'
						&& snapshot
						&& activeResource?.type === 'chapter'
						&& session ? (
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
				min={workspaceResizeBounds.assistant.min}
				max={workspaceResizeBounds.assistant.max}
				defaultValue={workspaceResizeBounds.assistant.defaultValue}
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
