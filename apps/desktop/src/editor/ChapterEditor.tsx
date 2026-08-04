import Editor, { type OnMount } from '@monaco-editor/react';
import { Feather } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import type * as MonacoNamespace from 'monaco-editor';
import type { StoryKernelGenerationResourceType } from '@writing-buddy/ai';
import { resolveAnchor, type ReviewIssue } from '@writing-buddy/review';
import {
	DesktopStoryRepository,
	toStoryChapterId,
	type MentionLink,
	type StoryResourceType,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { SceneNavigator } from '../features/story/manuscript/SceneNavigator';
import { SceneService } from '../features/story/manuscript/SceneService';
import { MentionService } from '../features/story/manuscript/MentionService';
import {
	EntityHighlightControls
} from '../features/story/manuscript/EntityHighlightControls';
import {
	loadManuscriptHighlightKinds,
	mentionHighlightKind,
	saveManuscriptHighlightKinds,
	type ManuscriptHighlightKind
} from '../features/story/manuscript/EntityHighlightPreferences';
import { SelectionActionMenu } from '../features/story/manuscript/SelectionActionMenu';
import { storyReferenceFromId } from '../features/story/application/StoryResourceRegistry';
import { EntityPeekCard } from '../features/story/manuscript/EntityPeekCard';
import {
	collectMentionCandidates,
	EntityPeekService,
	type EntityPeekResult
} from '../features/story/manuscript/EntityPeekService';
import { InlineLanguageCheckControl } from '../features/review/inline/InlineLanguageCheckControl';
import { useInlineLanguageCheck } from '../features/review/inline/useInlineLanguageCheck';
import { InlinePlotExpansionControl } from '../features/story/ai-context/InlinePlotExpansionControl';
import {
	useInlinePlotExpansion
} from '../features/story/ai-context/useInlinePlotExpansion';
import type {
	InlinePlotExpansionSuggestion
} from '../features/story/ai-context/InlinePlotExpansionService';
import { isCursorAtParagraphEnd } from '../features/ai/contextual/ContextualActionResolver';
import { InlineDraftCard } from '../features/story/ai-context/InlineDraftCard';
import {
	editPendingDraftCandidate,
	isPendingDraftCandidateStale,
	isPendingDraftCandidateTargetCurrent,
	resolvePendingDraftEdit
} from '../features/story/ai-context/InlineDraftCandidateModel';
import {
	canUndoCommittedDraft,
	type InlineDraftCommitNotice
} from './InlineDraftCommitNoticeModel';
import { rollbackAppliedInlineDraft } from './InlineDraftRollbackModel';
import { InlineDraftCommitNoticeBanner } from './InlineDraftCommitNoticeBanner';

const INLINE_LANGUAGE_MARKER_OWNER = 'writing-buddy.inline-language';
type MonacoApi = typeof MonacoNamespace;

interface EntityPeekState {
	readonly x: number;
	readonly y: number;
	readonly candidates: readonly MentionLink[];
	readonly result?: EntityPeekResult;
	readonly loading?: boolean;
	readonly error?: string;
}

const selectionResourceIntents: Readonly<Partial<Record<StoryResourceType, {
	readonly targetType: StoryKernelGenerationResourceType;
	readonly instruction: string;
}>>> = {
	character: {
		targetType: 'character',
		instruction: '从当前选区提取并生成一个人物候选；保留原文证据，不补写没有依据的设定。'
	},
	location: {
		targetType: 'location',
		instruction: '从当前选区提取并生成一个地点候选；保留原文证据，不补写没有依据的设定。'
	},
	item: {
		targetType: 'item',
		instruction: '从当前选区提取并生成一个物品候选；保留原文证据，不补写没有依据的设定。'
	},
	information: {
		targetType: 'information',
		instruction: '从当前选区提取并生成一个信息揭示候选；明确事实内容与知情范围。'
	},
	foreshadowing: {
		targetType: 'foreshadowing',
		instruction: '从当前选区提取并生成一个伏笔候选；保留原文证据并标明当前状态。'
	}
};

export function ChapterEditor(): React.JSX.Element {
	const activeResource = useAppStore(state => state.activeResource);
	const snapshot = useAppStore(state => state.snapshot);
	const session = useAppStore(state => state.session);
	const selection = useAppStore(state => state.selection);
	const setContent = useAppStore(state => state.setContent);
	const setSelection = useAppStore(state => state.setSelection);
	const setCursorOffset = useAppStore(state => state.setCursorOffset);
	const storeCursorOffset = useAppStore(state => state.cursorOffset);
	const updateCursor = useAppStore(state => state.updateCursor);
	const theme = useAppStore(state => state.theme);
	const readOnly = useAppStore(state => state.snapshot?.readOnly ?? true);
	const pendingEdit = useAppStore(state => state.pendingEdit);
	const clearEditorEdit = useAppStore(state => state.clearEditorEdit);
	const pendingDraftCandidate = useAppStore(state => state.pendingDraftCandidate);
	const setPendingDraftCandidate = useAppStore(state => state.setPendingDraftCandidate);
	const clearPendingDraftCandidate = useAppStore(state => state.clearPendingDraftCandidate);
	const save = useAppStore(state => state.save);
	const pendingReveal = useAppStore(state => state.pendingReveal);
	const clearEditorReveal = useAppStore(state => state.clearEditorReveal);
	const requestAssistantAction = useAppStore(state => state.requestAssistantAction);
	const openWriterTool = useAppStore(state => state.openWriterTool);
	const requestEditorEdit = useAppStore(state => state.requestEditorEdit);
	const sceneBarExpanded = useAppStore(state => state.sceneBarExpanded);
	const assistantOpen = useAppStore(state => state.assistantOpen);
	const assistantWidth = useAppStore(state => state.assistantWidth);
	const setSceneBarExpanded = useAppStore(state => state.setSceneBarExpanded);
	const setActiveSceneId = useAppStore(state => state.setActiveSceneId);
	const manuscriptDensity = useAppStore(state => state.manuscriptDensity);
	const inlineLanguageCheckEnabled = useAppStore(
		state => state.inlineLanguageCheckEnabled
	);
	const setInlineLanguageCheckEnabled = useAppStore(
		state => state.setInlineLanguageCheckEnabled
	);
	const inlinePlotExpansionEnabled = useAppStore(
		state => state.inlinePlotExpansionEnabled
	);
	const setInlinePlotExpansionEnabled = useAppStore(
		state => state.setInlinePlotExpansionEnabled
	);
	const setMode = useAppStore(state => state.setMode);
	const openQuickCapture = useAppStore(state => state.openQuickCapture);
	const syncStructureScenesForChapter = useAppStore(
		state => state.syncStructureScenesForChapter
	);
	const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | undefined>(undefined);
	const monacoRef = useRef<MonacoApi | undefined>(undefined);
	const cursorTimerRef = useRef<number | undefined>(undefined);
	const sceneDecorationIdsRef = useRef<readonly string[]>([]);
	const mentionDecorationIdsRef = useRef<readonly string[]>([]);
	const inlineLanguageDecorationIdsRef = useRef<readonly string[]>([]);
	const aiInsertDecorationIdsRef = useRef<readonly string[]>([]);
	const aiInsertHighlightTimerRef = useRef<number | undefined>(undefined);
	const inlineDraftZoneRef = useRef<string | undefined>(undefined);
	const committingDraftRef = useRef(false);
	const inlinePlotSuggestionRef = useRef<
		InlinePlotExpansionSuggestion | undefined
	>(undefined);
	const inlinePlotHandlersRef = useRef<{
		readonly reject: () => void;
		readonly markAccepted: () => void;
	} | undefined>(undefined);
	const inlinePlotProviderRef = useRef<
		MonacoNamespace.IDisposable | undefined
	>(undefined);
	const activeModelUriRef = useRef<string | undefined>(undefined);
	const mentionsRef = useRef<readonly MentionLink[]>([]);
	const highlightKindsRef = useRef<ReadonlySet<ManuscriptHighlightKind>>(new Set());
	const entityPeekServiceRef = useRef<EntityPeekService | undefined>(undefined);
	const entityPeekRequestRef = useRef(0);
	const entityPeekHoverTimerRef = useRef<number | undefined>(undefined);
	const openEntityPeekRef = useRef<(
		candidates: readonly MentionLink[],
		x: number,
		y: number
	) => void>(() => undefined);
	const lastMentionContentRef = useRef<{
		readonly resourceId: string;
		readonly content: string;
	} | undefined>(undefined);
	const mentionTextRevisionRef = useRef(0);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [editorReady, setEditorReady] = useState(false);
	const [inlineDraftPosition, setInlineDraftPosition] = useState<{
		readonly top: number;
		readonly visible: boolean;
		readonly height: number;
		readonly right: number;
	}>();
	const [draftCommitNotice, setDraftCommitNotice] = useState<InlineDraftCommitNotice>();
	const [scenes, setScenes] = useState<readonly StoryScene[]>([]);
	const [mentions, setMentions] = useState<readonly MentionLink[]>([]);
	const [entityPeek, setEntityPeek] = useState<EntityPeekState>();
	const [highlightOverrides, setHighlightOverrides] = useState<
		ReadonlyMap<string, ReadonlySet<ManuscriptHighlightKind>>
	>(new Map());
	const clearAiInsertHighlight = useCallback(() => {
		window.clearTimeout(aiInsertHighlightTimerRef.current);
		aiInsertHighlightTimerRef.current = undefined;
		const editor = editorRef.current;
		if (editor) {
			aiInsertDecorationIdsRef.current = editor.deltaDecorations(
				[...aiInsertDecorationIdsRef.current],
				[]
			);
		} else {
			aiInsertDecorationIdsRef.current = [];
		}
	}, []);
	const highlightAiEdit = useCallback((
		model: MonacoEditor.ITextModel,
		startOffset: number,
		text: string,
		durationMs = 10_000
	) => {
		const editor = editorRef.current;
		if (!editor || !text.length) return;
		clearAiInsertHighlight();
		const insertedLength = text.replaceAll(/\r\n?/gu, '\n').length;
		const endOffset = Math.min(model.getValueLength(), startOffset + insertedLength);
		const start = model.getPositionAt(startOffset);
		const end = model.getPositionAt(endOffset);
		aiInsertDecorationIdsRef.current = editor.deltaDecorations([], [{
			range: {
				startLineNumber: start.lineNumber,
				startColumn: start.column,
				endLineNumber: end.lineNumber,
				endColumn: end.column
			},
			options: {
				inlineClassName: 'ai-insert-highlight',
				hoverMessage: { value: 'AI 草稿刚刚写入；可用一次 Ctrl+Z 完整撤销。' }
			}
		}]);
		aiInsertHighlightTimerRef.current = window.setTimeout(
			clearAiInsertHighlight,
			Math.max(1_000, Math.min(durationMs, 20_000))
		);
	}, [clearAiInsertHighlight]);
	const projectRoot = snapshot?.root;
	const storyRepository = useMemo(() => projectRoot
		? new DesktopStoryRepository(projectRoot, desktopBridge)
		: undefined, [projectRoot]);
	const sceneService = useMemo(() => storyRepository
		? new SceneService(storyRepository)
		: undefined, [storyRepository]);
	const mentionService = useMemo(() => projectRoot
		? new MentionService(projectRoot, desktopBridge)
		: undefined, [projectRoot]);
	const entityPeekService = useMemo(() => (
		storyRepository && mentionService
			? new EntityPeekService(storyRepository, mentionService)
			: undefined
	), [mentionService, storyRepository]);
	const storyChapterId = activeResource?.type === 'chapter'
		? toStoryChapterId(activeResource.id)
		: undefined;
	const sessionResourceId = session?.state.resourceId;
	const sessionContent = session?.content;
	const activePendingDraft = pendingDraftCandidate
		&& snapshot
		&& session
		&& isPendingDraftCandidateTargetCurrent(pendingDraftCandidate, {
			projectRoot: snapshot.root,
			projectId: snapshot.project.projectId,
			resourceId: session.state.resourceId,
			resourcePath: session.state.path,
			modelUri: session.state.modelUri
		})
		&& !['applied', 'discarded'].includes(pendingDraftCandidate.status)
		? pendingDraftCandidate
		: undefined;
	const pendingDraftStale = Boolean(
		activePendingDraft
		&& session
		&& isPendingDraftCandidateStale(
			activePendingDraft,
			{
				projectRoot: snapshot?.root ?? '',
				projectId: snapshot?.project.projectId ?? '',
				resourceId: session.state.resourceId,
				resourcePath: session.state.path,
				modelUri: session.state.modelUri,
				revision: session.state.version,
				content: session.content
			}
		)
	);
	const activePendingDraftId = activePendingDraft?.id;
	const activePendingDraftTargetEnd = activePendingDraft?.target.range.end;
	const defaultHighlightKinds = useMemo<ReadonlySet<ManuscriptHighlightKind>>(
		() => projectRoot
			? loadManuscriptHighlightKinds(projectRoot)
			: new Set<ManuscriptHighlightKind>(),
		[projectRoot]
	);
	const highlightKinds = projectRoot
		? highlightOverrides.get(projectRoot) ?? defaultHighlightKinds
		: defaultHighlightKinds;
	useEffect(() => {
		highlightKindsRef.current = highlightKinds;
	}, [highlightKinds]);
	useEffect(() => {
		entityPeekServiceRef.current = entityPeekService;
	}, [entityPeekService]);
	const inlineLanguageCheck = useInlineLanguageCheck({
		enabled: inlineLanguageCheckEnabled
			&& activeResource?.type === 'chapter'
			&& Boolean(session),
		ready: editorReady,
		projectId: activeResource?.projectId ?? snapshot?.project.projectId ?? '',
		resourceId: session?.state.resourceId ?? '',
		content: session?.content ?? '',
		cursorOffset: currentOffset
	});
	const inlinePlotExpansion = useInlinePlotExpansion({
		enabled: inlinePlotExpansionEnabled
			&& activeResource?.type === 'chapter'
			&& Boolean(session),
		ready: editorReady,
		readOnly,
		projectId: activeResource?.projectId ?? snapshot?.project.projectId ?? '',
		resourceId: session?.state.resourceId ?? '',
		content: session?.content ?? '',
		cursorOffset: currentOffset,
		selectionActive: selection !== undefined,
		languageStatus: inlineLanguageCheck.status
	});
	const openEntityPeek = useCallback((
		candidates: readonly MentionLink[],
		x: number,
		y: number
	) => {
		const exact = candidates.filter(candidate => candidate.status === 'active');
		if (!exact.length) return;
		const request = ++entityPeekRequestRef.current;
		if (exact.length > 1) {
			setEntityPeek({ x, y, candidates: exact });
			return;
		}
		const mention = exact[0];
		const service = entityPeekServiceRef.current;
		if (!mention || !service) return;
		setEntityPeek({ x, y, candidates: exact, loading: true });
		void service.load(mention)
			.then(result => {
				if (entityPeekRequestRef.current === request) {
					setEntityPeek({ x, y, candidates: exact, result });
				}
			})
			.catch(error => {
				if (entityPeekRequestRef.current === request) {
					setEntityPeek({
						x,
						y,
						candidates: exact,
						error: error instanceof Error && error.message === 'entityPeekResourceMissing'
							? '关联资料已经不存在。'
							: '暂时无法读取这条资料。'
					});
				}
			});
	}, []);
	useEffect(() => {
		openEntityPeekRef.current = openEntityPeek;
	}, [openEntityPeek]);
	const handleMount: OnMount = useCallback((editor, monaco: MonacoApi) => {
		editorRef.current = editor;
		monacoRef.current = monaco;
		inlinePlotProviderRef.current?.dispose();
		inlinePlotProviderRef.current = monaco.languages.registerInlineCompletionsProvider(
			'markdown',
			{
				displayName: 'Writing Buddy Tab 情节拓展',
				provideInlineCompletions(model, position) {
					const suggestion = inlinePlotSuggestionRef.current;
					if (
						!suggestion
						|| model.uri.toString() !== activeModelUriRef.current
						|| model.getValue() !== suggestion.sourceContent
						|| model.getOffsetAt(position) !== suggestion.cursorOffset
					) {
						return { items: [] };
					}
					const range = new monaco.Range(
						position.lineNumber,
						position.column,
						position.lineNumber,
						position.column
					);
					return {
						items: [{
							insertText: suggestion.insertion,
							range,
							completeBracketPairs: false
						}]
					};
				},
				disposeInlineCompletions() {}
			}
		);
		setEditorReady(true);
		const scheduleCursorPersistence = () => {
			window.clearTimeout(cursorTimerRef.current);
			cursorTimerRef.current = window.setTimeout(() => {
				updateCursor({
					lineNumber: editor.getPosition()?.lineNumber ?? 1,
					column: editor.getPosition()?.column ?? 1,
					scrollTop: editor.getScrollTop()
				});
			}, 180);
		};
		editor.onDidChangeCursorSelection(event => {
			const model = editor.getModel();
			if (!model) {
				return;
			}
			const offset = model.getOffsetAt(event.selection.getPosition());
			setCurrentOffset(offset);
			setCursorOffset(offset);
			if (event.selection.isEmpty()) {
				setSelection(undefined);
				return;
			}
			setSelection({
				start: model.getOffsetAt(event.selection.getStartPosition()),
				end: model.getOffsetAt(event.selection.getEndPosition()),
				text: model.getValueInRange(event.selection)
			});
		});
		editor.onDidChangeCursorPosition(scheduleCursorPersistence);
		editor.onDidScrollChange(scheduleCursorPersistence);
		editor.onKeyDown(event => {
			if (
				event.keyCode === monaco.KeyCode.Escape
				&& inlinePlotSuggestionRef.current
			) {
				event.preventDefault();
				event.stopPropagation();
				inlinePlotHandlersRef.current?.reject();
				editor.trigger(
					'writing-buddy.inline-plot',
					'editor.action.inlineSuggest.hide',
					undefined
				);
			}
		});
		editor.onMouseDown(event => {
			const model = editor.getModel();
			const position = event.target.position;
			if (
				!model
				|| !position
				|| (!event.event.ctrlKey && !event.event.metaKey)
			) {
				return;
			}
			const offset = model.getOffsetAt(position);
			const candidates = collectMentionCandidates(mentionsRef.current, offset);
			if (candidates.length) {
				event.event.preventDefault();
				event.event.stopPropagation();
				openEntityPeekRef.current(
					candidates,
					event.event.posx + 10,
					event.event.posy + 10
				);
			}
		});
		editor.onMouseMove(event => {
			window.clearTimeout(entityPeekHoverTimerRef.current);
			const model = editor.getModel();
			const position = event.target.position;
			if (!model || !position || event.event.ctrlKey || event.event.metaKey) return;
			const offset = model.getOffsetAt(position);
			const candidates = collectMentionCandidates(mentionsRef.current, offset)
				.filter(candidate => {
					const kind = mentionHighlightKind(candidate.resourceId);
					return kind ? highlightKindsRef.current.has(kind) : false;
				});
			if (!candidates.length) return;
			entityPeekHoverTimerRef.current = window.setTimeout(() => {
				openEntityPeekRef.current(
					candidates,
					event.event.posx + 10,
					event.event.posy + 10
				);
			}, 420);
		});
		editor.onMouseLeave(() => {
			window.clearTimeout(entityPeekHoverTimerRef.current);
		});
		if (session) {
			editor.setPosition({
				lineNumber: session.state.cursor.lineNumber,
				column: session.state.cursor.column
			});
			editor.setScrollTop(session.state.cursor.scrollTop);
			const model = editor.getModel();
			if (model) {
				const offset = model.getOffsetAt({
					lineNumber: session.state.cursor.lineNumber,
					column: session.state.cursor.column
				});
				setCurrentOffset(offset);
				setCursorOffset(offset);
				const reveal = useAppStore.getState().pendingReveal;
				if (reveal?.resourceId === session.state.resourceId) {
					const revealPosition = model.getPositionAt(reveal.offset);
					if (!reveal.preserveSelection) {
						editor.setPosition(revealPosition);
					}
					editor.revealPositionInCenter(revealPosition);
					useAppStore.getState().clearEditorReveal(reveal.resourceId, reveal.offset);
				}
			}
		}
	}, [session, setCursorOffset, setSelection, updateCursor]);

	useEffect(() => () => {
		window.clearTimeout(cursorTimerRef.current);
		window.clearTimeout(entityPeekHoverTimerRef.current);
		inlinePlotProviderRef.current?.dispose();
	}, []);

	useEffect(() => {
		const focusEditor = () => editorRef.current?.focus();
		window.addEventListener('writing-buddy:focus-editor', focusEditor);
		return () => window.removeEventListener('writing-buddy:focus-editor', focusEditor);
	}, []);

	useEffect(() => {
		const editor = editorRef.current;
		inlinePlotSuggestionRef.current = inlinePlotExpansion.suggestion;
		inlinePlotHandlersRef.current = {
			reject: inlinePlotExpansion.reject,
			markAccepted: inlinePlotExpansion.markAccepted
		};
		activeModelUriRef.current = session?.state.modelUri;
		if (!editor) return;
		if (inlinePlotExpansion.suggestion) {
			queueMicrotask(() => {
				if (
					editorRef.current === editor
					&& inlinePlotSuggestionRef.current === inlinePlotExpansion.suggestion
				) {
					editor.trigger(
						'writing-buddy.inline-plot',
						'editor.action.inlineSuggest.trigger',
						undefined
					);
				}
			});
		} else {
			editor.trigger(
				'writing-buddy.inline-plot',
				'editor.action.inlineSuggest.hide',
				undefined
			);
		}
	}, [
		editorReady,
		inlinePlotExpansion.markAccepted,
		inlinePlotExpansion.reject,
		inlinePlotExpansion.suggestion,
		session?.state.modelUri
	]);

	useEffect(() => {
		const monaco = monacoRef.current;
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!monaco || !editor || !model || activeResource?.type !== 'chapter') {
			return;
		}
		inlineLanguageDecorationIdsRef.current = editor.deltaDecorations(
			[...inlineLanguageDecorationIdsRef.current],
			inlineLanguageCheck.issues.map(issue => ({
				range: {
					startLineNumber: model.getPositionAt(issue.anchor.start).lineNumber,
					startColumn: model.getPositionAt(issue.anchor.start).column,
					endLineNumber: model.getPositionAt(issue.anchor.end).lineNumber,
					endColumn: model.getPositionAt(issue.anchor.end).column
				},
				options: {
					hoverMessage: {
						value: markerHoverMessage(issue)
					}
				}
			}))
		);
		monaco.editor.setModelMarkers(
			model,
			INLINE_LANGUAGE_MARKER_OWNER,
			inlineLanguageCheck.issues.map(issue => {
				const start = model.getPositionAt(issue.anchor.start);
				const end = model.getPositionAt(issue.anchor.end);
				return {
					startLineNumber: start.lineNumber,
					startColumn: start.column,
					endLineNumber: end.lineNumber,
					endColumn: end.column,
					severity: markerSeverity(monaco, issue),
					message: markerMessage(issue),
					source: 'AI 语法检查',
					code: issue.id
				};
			})
		);
		return () => {
			inlineLanguageDecorationIdsRef.current = editor.deltaDecorations(
				[...inlineLanguageDecorationIdsRef.current],
				[]
			);
			monaco.editor.setModelMarkers(model, INLINE_LANGUAGE_MARKER_OWNER, []);
		};
	}, [
		activeResource?.type,
		inlineLanguageCheck.issues,
		session?.state.modelUri
	]);

	useEffect(() => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model || !pendingEdit || pendingEdit.resourceId !== session?.state.resourceId) {
			return;
		}
		const source = pendingEdit.origin === 'ai'
			? 'writing-buddy.ai'
			: 'writing-buddy.review';
		const startOffset = Math.max(0, Math.min(pendingEdit.start, model.getValueLength()));
		editor.pushUndoStop();
		editor.executeEdits(source, [{
			range: {
				startLineNumber: model.getPositionAt(pendingEdit.start).lineNumber,
				startColumn: model.getPositionAt(pendingEdit.start).column,
				endLineNumber: model.getPositionAt(pendingEdit.end).lineNumber,
				endColumn: model.getPositionAt(pendingEdit.end).column
			},
			text: pendingEdit.text,
			forceMoveMarkers: true
		}]);
		editor.pushUndoStop();
		if (pendingEdit.origin === 'ai' && pendingEdit.text.length > 0) {
			highlightAiEdit(
				model,
				startOffset,
				pendingEdit.text,
				pendingEdit.highlightDurationMs
			);
		}
		editor.focus();
		clearEditorEdit(pendingEdit.id);
	}, [
		clearAiInsertHighlight,
		clearEditorEdit,
		highlightAiEdit,
		pendingEdit,
		session?.state.resourceId
	]);

	useEffect(() => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (
			!editor
			|| !model
			|| !activePendingDraftId
			|| activePendingDraftTargetEnd === undefined
		) {
			setInlineDraftPosition(undefined);
			return;
		}
		const spacer = document.createElement('div');
		spacer.className = 'inline-draft-spacer';
		const targetPosition = model.getPositionAt(activePendingDraftTargetEnd);
		let zoneId: string | undefined;
		editor.changeViewZones(accessor => {
			zoneId = accessor.addZone({
				afterLineNumber: targetPosition.lineNumber,
				heightInPx: 470,
				domNode: spacer
			});
		});
		inlineDraftZoneRef.current = zoneId;
		const lineHeight = manuscriptDensity === 'compact'
			? 30
			: manuscriptDensity === 'spacious' ? 38 : 34;
		const updatePosition = () => {
			const top = editor.getTopForLineNumber(targetPosition.lineNumber)
				- editor.getScrollTop()
				+ lineHeight;
			const viewportHeight = editor.getLayoutInfo().height;
			const editorRect = editor.getDomNode()?.getBoundingClientRect();
			const assistantRect = assistantOpen
				? document.querySelector('.assistant-panel')?.getBoundingClientRect()
				: undefined;
			setInlineDraftPosition({
				top,
				visible: top > -440 && top < viewportHeight - 24,
				height: Math.max(180, viewportHeight - Math.max(0, top)),
				right: editorRect && assistantRect
					? Math.max(0, editorRect.right - assistantRect.left)
					: 0
			});
		};
		const scrollListener = editor.onDidScrollChange(updatePosition);
		const layoutListener = editor.onDidLayoutChange(updatePosition);
		editor.setScrollTop(Math.max(
			0,
			editor.getTopForLineNumber(targetPosition.lineNumber) - 12
		));
		updatePosition();
		const frame = window.requestAnimationFrame(updatePosition);
		return () => {
			window.cancelAnimationFrame(frame);
			scrollListener.dispose();
			layoutListener.dispose();
			setInlineDraftPosition(undefined);
			if (zoneId) {
				const currentZoneId = zoneId;
				editor.changeViewZones(accessor => accessor.removeZone(currentZoneId));
			}
			if (inlineDraftZoneRef.current === zoneId) {
				inlineDraftZoneRef.current = undefined;
			}
		};
	}, [
		activePendingDraftId,
		activePendingDraftTargetEnd,
		assistantOpen,
		assistantWidth,
		editorReady,
		manuscriptDensity,
		sessionResourceId
	]);

	useEffect(() => () => clearAiInsertHighlight(), [clearAiInsertHighlight]);

	useEffect(() => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model) {
			return;
		}
		sceneDecorationIdsRef.current = editor.deltaDecorations(
			[...sceneDecorationIdsRef.current],
			scenes.map(scene => {
				const position = model.getPositionAt(scene.manuscriptRange.start);
				return {
					range: {
						startLineNumber: position.lineNumber,
						startColumn: 1,
						endLineNumber: position.lineNumber,
						endColumn: 1
					},
					options: {
						isWholeLine: true,
						glyphMarginClassName: 'story-scene-glyph',
						glyphMarginHoverMessage: { value: scene.title }
					}
				};
			})
		);
	}, [editorReady, scenes]);

	useEffect(() => {
		const highlightedMentions = mentions.filter(mention => {
			const kind = mentionHighlightKind(mention.resourceId);
			return mention.status === 'active' && Boolean(kind && highlightKinds.has(kind));
		});
		mentionsRef.current = mentions;
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model) {
			return;
		}
		mentionDecorationIdsRef.current = editor.deltaDecorations(
			[...mentionDecorationIdsRef.current],
			highlightedMentions
				.map(mention => ({
					range: {
						startLineNumber: model.getPositionAt(mention.anchor.start).lineNumber,
						startColumn: model.getPositionAt(mention.anchor.start).column,
						endLineNumber: model.getPositionAt(mention.anchor.end).lineNumber,
						endColumn: model.getPositionAt(mention.anchor.end).column
					},
					options: {
						inlineClassName: `story-mention-range story-mention-${mentionHighlightKind(
							mention.resourceId
						)}`,
						hoverMessage: {
							value: `链接到 **${mention.resourceId}** — Ctrl+点击速览`
						}
					}
				}))
		);
	}, [editorReady, highlightKinds, mentions]);

	const toggleHighlightKind = useCallback((
		kind: ManuscriptHighlightKind,
		enabled: boolean
	) => {
		if (!projectRoot) return;
		setHighlightOverrides(current => {
			const nextKinds = new Set(
				current.get(projectRoot) ?? loadManuscriptHighlightKinds(projectRoot)
			);
			if (enabled) nextKinds.add(kind);
			else nextKinds.delete(kind);
			saveManuscriptHighlightKinds(projectRoot, nextKinds);
			const next = new Map(current);
			next.set(projectRoot, nextKinds);
			return next;
		});
	}, [projectRoot]);

	const navigateToOffset = useCallback((
		offset: number,
		preserveSelection = false
	) => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model) {
			return false;
		}
		const position = model.getPositionAt(offset);
		if (!preserveSelection) {
			editor.setPosition(position);
		}
		editor.revealPositionInCenter(position);
		editor.focus();
		setCurrentOffset(offset);
		setCursorOffset(offset);
		return true;
	}, [setCursorOffset]);

	const updateScenes = useCallback((nextScenes: readonly StoryScene[]) => {
		setScenes(nextScenes);
		if (storyChapterId) {
			syncStructureScenesForChapter(storyChapterId, nextScenes);
		}
	}, [storyChapterId, syncStructureScenesForChapter]);
	const generateResourceFromSelection = useCallback((type: StoryResourceType) => {
		const intent = selectionResourceIntents[type];
		if (intent) {
			requestAssistantAction({
				kind: 'story-kernel',
				targetType: intent.targetType,
				instruction: intent.instruction
			});
		}
	}, [requestAssistantAction]);
	const applyInlineLanguageIssue = useCallback((issue: ReviewIssue) => {
		if (readOnly || issue.replacement === undefined) return;
		const currentSession = useAppStore.getState().session;
		if (!currentSession || currentSession.state.resourceId !== issue.resourceId) {
			return;
		}
		const resolved = resolveAnchor(currentSession.content, issue.anchor);
		if (!resolved || currentSession.content.slice(resolved.start, resolved.end) !== issue.anchor.target) {
			return;
		}
		requestEditorEdit({
			id: crypto.randomUUID(),
			resourceId: issue.resourceId,
			start: resolved.start,
			end: resolved.end,
			text: issue.replacement
		});
	}, [readOnly, requestEditorEdit]);
	const acceptInlinePlotExpansion = useCallback(() => {
		const suggestion = inlinePlotSuggestionRef.current;
		const currentSession = useAppStore.getState().session;
		if (
			readOnly
			|| !suggestion
			|| !currentSession
			|| currentSession.state.resourceId !== suggestion.resourceId
			|| currentSession.content !== suggestion.sourceContent
		) {
			return;
		}
		inlinePlotHandlersRef.current?.markAccepted();
		requestEditorEdit({
			id: crypto.randomUUID(),
			resourceId: suggestion.resourceId,
			start: suggestion.cursorOffset,
			end: suggestion.cursorOffset,
			text: suggestion.insertion
		});
	}, [readOnly, requestEditorEdit]);

	useEffect(() => {
		if (!mentionService || !storyChapterId) {
			return;
		}
		let cancelled = false;
		void mentionService.listMentionsForChapter(storyChapterId)
			.then(next => {
				if (!cancelled) {
					setMentions(next);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setMentions([]);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [mentionService, storyChapterId]);

	useEffect(() => {
		if (!mentionService || !storyChapterId) return;
		const refreshMentions = (event: Event) => {
			const detail = (event as CustomEvent<{ readonly chapterId?: string }>).detail;
			if (detail?.chapterId !== storyChapterId) return;
			void mentionService.listMentionsForChapter(storyChapterId)
				.then(setMentions)
				.catch(() => undefined);
		};
		window.addEventListener('writing-buddy:mentions-changed', refreshMentions);
		return () => window.removeEventListener(
			'writing-buddy:mentions-changed',
			refreshMentions
		);
	}, [mentionService, storyChapterId]);

	useEffect(() => {
		if (!mentionService
			|| !storyChapterId
			|| sessionContent === undefined
			|| !sessionResourceId
			|| activeResource?.type !== 'chapter') {
			return;
		}
		const previous = lastMentionContentRef.current;
		lastMentionContentRef.current = {
			resourceId: sessionResourceId,
			content: sessionContent
		};
		if (!previous
			|| previous.resourceId !== sessionResourceId
			|| previous.content === sessionContent
			|| mentionsRef.current.length === 0) {
			return;
		}
		mentionTextRevisionRef.current += 1;
		const revision = mentionTextRevisionRef.current;
		const timer = window.setTimeout(() => {
			void mentionService
				.rebaseMentions(storyChapterId, sessionContent, revision)
				.then(setMentions)
				.catch(() => undefined);
		}, 450);
		return () => window.clearTimeout(timer);
	}, [
		activeResource?.type,
		mentionService,
		sessionContent,
		sessionResourceId,
		storyChapterId
	]);

	useEffect(() => {
		if (!pendingReveal
			|| pendingReveal.resourceId !== session?.state.resourceId) {
			return;
		}
		if (navigateToOffset(
			pendingReveal.offset,
			pendingReveal.preserveSelection
		)) {
			clearEditorReveal(pendingReveal.resourceId, pendingReveal.offset);
		}
	}, [clearEditorReveal, navigateToOffset, pendingReveal, session?.state.resourceId]);

	if (!activeResource || !session) {
		return <div className="canvas-empty">选择一个章节或笔记开始写作。</div>;
	}

	const monacoTheme = theme === 'paper' || theme === 'fog' ? 'vs' : 'vs-dark';
	const currentScene = scenes.find(scene => (
		scene.manuscriptRange.start <= currentOffset
			&& currentOffset < scene.manuscriptRange.end
	));
	const canContinueFromCursor = activeResource.type === 'chapter'
		&& !readOnly
		&& !selection?.text
		&& Boolean(session.content.trim())
		&& isCursorAtParagraphEnd(session.content, storeCursorOffset);
	const updateInlineDraft = (content: string) => {
		if (!activePendingDraft || committingDraftRef.current) return;
		setPendingDraftCandidate(editPendingDraftCandidate(activePendingDraft, content));
	};
	const discardInlineDraft = () => {
		if (!activePendingDraft || committingDraftRef.current) return;
		clearPendingDraftCandidate(activePendingDraft.id);
		window.requestAnimationFrame(() => editorRef.current?.focus());
	};
	const commitInlineDraft = async () => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		const candidate = useAppStore.getState().pendingDraftCandidate;
		if (!candidate || committingDraftRef.current) {
			return;
		}
		const targetsCurrentCandidate = () => {
			const current = useAppStore.getState();
			const currentSession = current.session;
			return Boolean(
				current.snapshot
				&& currentSession
				&& current.activeResource?.type === 'chapter'
				&& current.activeResource.id === candidate.target.resourceId
				&& current.activeResource.projectId === candidate.target.projectId
				&& isPendingDraftCandidateTargetCurrent(candidate, {
					projectRoot: current.snapshot.root,
					projectId: current.snapshot.project.projectId,
					resourceId: currentSession.state.resourceId,
					resourcePath: currentSession.state.path,
					modelUri: currentSession.state.modelUri
				})
				&& model?.uri.toString() === candidate.target.modelUri
				&& editorRef.current?.getModel() === model
			);
		};
		if (!editor || !model || readOnly) {
			setPendingDraftCandidate({
				...candidate,
				status: 'failed',
				error: readOnly
					? '当前章节以只读模式打开，不能写入临时草稿。'
					: '正文编辑器尚未准备完成，请稍后重试。'
			});
			return;
		}
		committingDraftRef.current = true;
		let editApplied = false;
		try {
			const before = useAppStore.getState();
			const beforeSession = before.session;
			if (
				!beforeSession
				|| !targetsCurrentCandidate()
				|| before.snapshot?.readOnly
			) {
				throw new Error('当前章节不可写入，临时草稿仍然保留。');
			}
			resolvePendingDraftEdit(
				candidate,
				{
					projectRoot: before.snapshot?.root ?? '',
					projectId: before.snapshot?.project.projectId ?? '',
					resourceId: beforeSession.state.resourceId,
					resourcePath: beforeSession.state.path,
					modelUri: beforeSession.state.modelUri,
					revision: beforeSession.state.version,
					content: beforeSession.content
				}
			);
			const contentBeforeCommit = beforeSession.content;
			setPendingDraftCandidate({ ...candidate, status: 'applying', error: undefined });
			if (beforeSession.state.dirty || before.saveState.type !== 'clean') {
				await save();
			}

			const saved = useAppStore.getState();
			const savedSession = saved.session;
			if (
				!savedSession
				|| !targetsCurrentCandidate()
				|| savedSession.content !== contentBeforeCommit
				|| savedSession.state.dirty
				|| saved.saveState.type !== 'clean'
			) {
				throw new Error('正文尚未安全保存，已停止 AI 写入。请先解决保存问题后重试。');
			}

			await desktopBridge.createSnapshot(
				saved.snapshot?.root ?? '',
				'beforeDestructiveOperation',
				candidate.target.mode === 'replace_selection'
					? 'AI 临时草稿替换选区前'
					: 'AI 临时草稿写入光标前'
			);

			const verified = useAppStore.getState();
			const verifiedSession = verified.session;
			if (!verifiedSession || !targetsCurrentCandidate()) {
				throw new Error('当前章节已经关闭，未写入临时草稿。');
			}
			const edit = resolvePendingDraftEdit(
				candidate,
				{
					projectRoot: verified.snapshot?.root ?? '',
					projectId: verified.snapshot?.project.projectId ?? '',
					resourceId: verifiedSession.state.resourceId,
					resourcePath: verifiedSession.state.path,
					modelUri: verifiedSession.state.modelUri,
					revision: verifiedSession.state.version,
					content: verifiedSession.content
				}
			);
			if (model.getValue() !== verifiedSession.content) {
				throw new Error('编辑器与正文状态尚未同步，未写入临时草稿。');
			}
			const start = model.getPositionAt(edit.start);
			const end = model.getPositionAt(edit.end);
			editor.pushUndoStop();
			const applied = editor.executeEdits('writing-buddy.ai-draft', [{
				range: {
					startLineNumber: start.lineNumber,
					startColumn: start.column,
					endLineNumber: end.lineNumber,
					endColumn: end.column
				},
				text: edit.text,
				forceMoveMarkers: true
			}]);
			editor.pushUndoStop();
			if (!applied) throw new Error('编辑器未接受本次写入，临时草稿仍然保留。');
			editApplied = true;
			useAppStore.getState().setContent(model.getValue(), 'edit');
			highlightAiEdit(model, edit.start, edit.text);
			await useAppStore.getState().save();

			const completed = useAppStore.getState();
			if (
				!targetsCurrentCandidate()
				|| completed.session?.content !== model.getValue()
				|| completed.session.state.dirty
				|| completed.saveState.type !== 'clean'
			) {
				throw new Error('AI 草稿已撤回：自动保存未完成，请处理保存状态后重试。');
			}
			clearPendingDraftCandidate(candidate.id);
			setDraftCommitNotice({
				projectId: candidate.target.projectId,
				resourceId: completed.session.state.resourceId,
				modelUri: completed.session.state.modelUri,
				contentAfterCommit: model.getValue(),
				message: 'AI 草稿已写入正文，并已创建安全快照与自动保存。'
			});
			editor.focus();
		} catch (reason) {
			let rollbackFailed = false;
			if (editApplied) {
				try {
					const restoredContent = await rollbackAppliedInlineDraft(model);
					if (targetsCurrentCandidate()) {
						useAppStore.getState().setContent(restoredContent, 'undo');
					}
				} catch {
					rollbackFailed = true;
				}
				clearAiInsertHighlight();
			}
			const failureMessage = reason instanceof Error
				? reason.message
				: '临时草稿写入失败，正文未改变。';
			const message = rollbackFailed
				? `${failureMessage} 原编辑器撤回失败，请重新打开章节并核对正文。`
				: failureMessage;
			if (useAppStore.getState().pendingDraftCandidate?.id === candidate.id) {
				setPendingDraftCandidate({
					...candidate,
					status: 'failed',
					error: message
				});
			}
		} finally {
			committingDraftRef.current = false;
		}
	};
	const undoCommittedDraft = async () => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (
			!editor
			|| !model
			|| !canUndoCommittedDraft(draftCommitNotice, {
				projectId: activeResource.projectId,
				resourceId: session.state.resourceId,
				modelUri: model.uri.toString(),
				content: session.content
			})
		) {
			return;
		}
		editor.trigger('writing-buddy.ai-draft', 'undo', undefined);
		useAppStore.getState().setContent(model.getValue(), 'undo');
		clearAiInsertHighlight();
		setDraftCommitNotice(undefined);
		await useAppStore.getState().save();
		editor.focus();
	};
	const closeEntityPeek = () => {
		entityPeekRequestRef.current += 1;
		setEntityPeek(undefined);
		window.requestAnimationFrame(() => editorRef.current?.focus());
	};
	const openEntityPeekFull = () => {
		const resourceId = entityPeek?.result?.resource.id;
		const reference = resourceId ? storyReferenceFromId(resourceId) : undefined;
		if (!reference) return;
		setEntityPeek(undefined);
		void useAppStore.getState().openStoryResource(reference);
	};
	const jumpToEntityBacklink = async (mention: MentionLink) => {
		if (storyChapterId === mention.chapterId) {
			useAppStore.getState().requestEditorReveal(activeResource.id, mention.anchor.start);
			closeEntityPeek();
			return;
		}
		const chapter = snapshot?.project.volumes
			.flatMap(volume => volume.chapters)
			.find(candidate => toStoryChapterId(candidate.id) === mention.chapterId);
		if (!chapter || !snapshot) return;
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		useAppStore.getState().requestEditorReveal(chapter.id, mention.anchor.start);
		setEntityPeek(undefined);
	};

	return (
		<div
			className={`writing-canvas ${activeResource.type === 'chapter' ? 'has-scene-nav' : ''}`}
			data-resource-type={activeResource.type}
		>
			{activeResource.type === 'chapter' && sceneService && storyChapterId && (
				<SceneNavigator
					service={sceneService}
					chapterId={storyChapterId}
					manuscript={session.content}
					currentOffset={currentOffset}
					selection={selection ? { start: selection.start, end: selection.end } : undefined}
					readOnly={readOnly}
					expanded={sceneBarExpanded}
					onExpandedChange={setSceneBarExpanded}
					onNavigate={navigateToOffset}
					onActiveSceneChange={setActiveSceneId}
					onOpenOutline={() => openWriterTool('outline')}
					onCompleteScene={() => requestAssistantAction({
						kind: 'continuation',
						mode: 'finish-scene'
					})}
					onScenesChange={updateScenes}
				/>
			)}
			<div className="chapter-editor-host">
				{activeResource.type === 'chapter' ? (
					<div className="editor-overlay-controls">
						{canContinueFromCursor ? (
							<button
								className="contextual-continue-trigger"
								type="button"
								aria-label="从当前光标继续写作"
								title="从当前光标继续写作"
								onClick={() => requestAssistantAction({
									kind: 'continuation',
									mode: 'continue-paragraph'
								})}
							>
								<Feather size={16} /><span>继续</span>
							</button>
						) : null}
						<InlinePlotExpansionControl
							enabled={inlinePlotExpansionEnabled}
							status={inlinePlotExpansion.status}
							statusMessage={inlinePlotExpansion.statusMessage}
							suggestion={inlinePlotExpansion.suggestion}
							readOnly={readOnly}
							onToggle={setInlinePlotExpansionEnabled}
							onRetry={inlinePlotExpansion.retry}
							onAccept={acceptInlinePlotExpansion}
							onReject={inlinePlotExpansion.reject}
							onOpenSettings={() => setMode('settings')}
						/>
						<InlineLanguageCheckControl
							enabled={inlineLanguageCheckEnabled}
							status={inlineLanguageCheck.status}
							statusMessage={inlineLanguageCheck.statusMessage}
							issues={inlineLanguageCheck.issues}
							readOnly={readOnly}
							onToggle={setInlineLanguageCheckEnabled}
							onRetry={inlineLanguageCheck.retry}
							onOpenSettings={() => setMode('settings')}
							onApply={applyInlineLanguageIssue}
						/>
						<EntityHighlightControls
							mentions={mentions}
							enabledKinds={highlightKinds}
							onToggle={toggleHighlightKind}
						/>
					</div>
				) : null}
				<Editor
				height="100%"
				path={session.state.modelUri}
				language="markdown"
				theme={monacoTheme}
				value={session.content}
				onChange={(value, event) => {
					clearAiInsertHighlight();
					const suggestion = inlinePlotSuggestionRef.current;
					if (
						suggestion
						&& event.changes.some(change => (
							change.rangeOffset === suggestion.cursorOffset
							&& change.rangeLength === 0
							&& change.text.replace(/\r\n/gu, '\n') === suggestion.insertion
						))
					) {
						inlinePlotHandlersRef.current?.markAccepted();
					}
					setContent(
						value ?? '',
						event.isUndoing ? 'undo' : event.isRedoing ? 'redo' : 'edit'
					);
				}}
				onMount={handleMount}
				loading={<div className="editor-loading">正在准备书稿编辑器…</div>}
				options={{
					accessibilitySupport: 'auto',
					automaticLayout: true,
					codeLens: false,
					contextmenu: true,
					cursorBlinking: 'smooth',
					cursorSmoothCaretAnimation: 'on',
					folding: false,
					fontFamily: '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
					fontLigatures: false,
					fontSize: manuscriptDensity === 'compact'
						? 17
						: manuscriptDensity === 'spacious' ? 19 : 18,
					glyphMargin: activeResource.type === 'chapter',
					hideCursorInOverviewRuler: true,
					hover: {
						enabled: activeResource.type === 'chapter' ? 'on' : 'off',
						delay: 300,
						sticky: true
					},
					lineDecorationsWidth: 0,
					lineHeight: manuscriptDensity === 'compact'
						? 30
						: manuscriptDensity === 'spacious' ? 38 : 34,
					lineNumbers: 'off',
					links: false,
					matchBrackets: 'never',
					minimap: { enabled: false },
					overviewRulerBorder: false,
					overviewRulerLanes: 0,
					padding: {
						top: activeResource.type === 'chapter' ? 68 : 38,
						bottom: 80
					},
					quickSuggestions: false,
					readOnly,
					renderLineHighlight: 'none',
					inlineSuggest: {
						enabled: activeResource.type === 'chapter',
						keepOnBlur: true,
						minShowDelay: 0,
						mode: 'prefix',
						showToolbar: 'onHover',
						suppressInSnippetMode: true,
						suppressSuggestions: true,
						syntaxHighlightingEnabled: false
					},
					scrollBeyondLastLine: false,
					scrollbar: {
						horizontal: 'hidden',
						horizontalScrollbarSize: 0,
						verticalScrollbarSize: 8,
						useShadows: false
					},
					selectionHighlight: false,
					smoothScrolling: true,
					suggest: { showWords: false },
					wordWrap: 'on',
					wordWrapColumn: 80,
					wrappingIndent: 'none'
				}}
				/>
				{inlineDraftPosition?.visible && activePendingDraft
					? (
							<div
								className="inline-draft-floating-host"
								style={{
									top: inlineDraftPosition.top,
									height: inlineDraftPosition.height,
									right: inlineDraftPosition.right
								}}
							>
								<InlineDraftCard
									candidate={activePendingDraft}
									stale={pendingDraftStale}
									onChange={updateInlineDraft}
									onCommit={() => void commitInlineDraft()}
									onDiscard={discardInlineDraft}
								/>
							</div>
						)
					: null}
				{draftCommitNotice ? (
					<InlineDraftCommitNoticeBanner
						notice={draftCommitNotice}
						target={{
							projectId: activeResource.projectId,
							resourceId: session.state.resourceId,
							modelUri: session.state.modelUri,
							content: session.content
						}}
						onUndo={undoCommittedDraft}
						onDismiss={() => setDraftCommitNotice(undefined)}
					/>
				) : null}
				{activeResource.type === 'chapter'
					&& storyRepository
					&& mentionService
					&& storyChapterId
					&& selection
					&& (
						<SelectionActionMenu
							repository={storyRepository}
							mentionService={mentionService}
							chapterId={storyChapterId}
							sceneId={currentScene?.id}
							manuscript={session.content}
							selection={selection}
							readOnly={readOnly}
							onLinked={mention => setMentions(current => [...current, mention])}
							onRewrite={actionType => requestAssistantAction({
								kind: 'rewrite',
								actionType
							})}
							onAiMenuClosed={() => {
								window.requestAnimationFrame(() => editorRef.current?.focus());
							}}
							onQuickCapture={() => openQuickCapture({
								type: 'idea',
								text: selection.text
							})}
							onGenerateResource={generateResourceFromSelection}
						/>
					)}
				{entityPeek && (
					<EntityPeekCard
						x={entityPeek.x}
						y={entityPeek.y}
						candidates={entityPeek.candidates}
						result={entityPeek.result}
						loading={entityPeek.loading}
						error={entityPeek.error}
						onSelect={mention => openEntityPeekRef.current(
							[mention],
							entityPeek.x,
							entityPeek.y
						)}
						onClose={closeEntityPeek}
						onOpenFull={openEntityPeekFull}
						onJumpBacklink={mention => void jumpToEntityBacklink(mention)}
					/>
				)}
			</div>
		</div>
	);
}

function markerSeverity(
	monaco: MonacoApi,
	issue: ReviewIssue
): MonacoNamespace.MarkerSeverity {
	if (issue.severity === 'error') return monaco.MarkerSeverity.Error;
	if (issue.severity === 'warning') return monaco.MarkerSeverity.Warning;
	return monaco.MarkerSeverity.Info;
}

function markerMessage(issue: ReviewIssue): string {
	const replacement = issue.replacement === undefined
		? ''
		: `\n建议替换：${issue.replacement}`;
	return `${issue.title}\n${issue.message}${replacement}\n打开右上角“AI 语法”可查看并应用修正。`;
}

function markerHoverMessage(issue: ReviewIssue): string {
	const replacement = issue.replacement === undefined
		? ''
		: `\n\n**建议替换：** ${escapeMarkdown(issue.replacement)}`;
	return `**${escapeMarkdown(issue.title)}**\n\n${escapeMarkdown(issue.message)}${replacement}`
		+ '\n\n打开右上角“AI 语法”可查看并应用修正。';
}

function escapeMarkdown(value: string): string {
	return value.replace(/[\\`*_{}[\]()#+\-.!]/gu, '\\$&');
}
