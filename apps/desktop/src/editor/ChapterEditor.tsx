import Editor, { type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { editor as MonacoEditor } from 'monaco-editor';
import {
	DesktopStoryRepository,
	toStoryChapterId,
	type StoryScene
} from '@writing-buddy/story-kernel';
import { useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { SceneNavigator } from '../features/story/manuscript/SceneNavigator';
import { SceneService } from '../features/story/manuscript/SceneService';

export function ChapterEditor(): React.JSX.Element {
	const activeResource = useAppStore(state => state.activeResource);
	const snapshot = useAppStore(state => state.snapshot);
	const session = useAppStore(state => state.session);
	const selection = useAppStore(state => state.selection);
	const setContent = useAppStore(state => state.setContent);
	const setSelection = useAppStore(state => state.setSelection);
	const updateCursor = useAppStore(state => state.updateCursor);
	const theme = useAppStore(state => state.theme);
	const readOnly = useAppStore(state => state.snapshot?.readOnly ?? true);
	const pendingEdit = useAppStore(state => state.pendingEdit);
	const clearEditorEdit = useAppStore(state => state.clearEditorEdit);
	const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | undefined>(undefined);
	const cursorTimerRef = useRef<number | undefined>(undefined);
	const sceneDecorationIdsRef = useRef<readonly string[]>([]);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [scenes, setScenes] = useState<readonly StoryScene[]>([]);
	const projectRoot = snapshot?.root;
	const sceneService = useMemo(() => projectRoot
		? new SceneService(new DesktopStoryRepository(projectRoot, desktopBridge))
		: undefined, [projectRoot]);
	const storyChapterId = activeResource?.type === 'chapter'
		? toStoryChapterId(activeResource.id)
		: undefined;

	const handleMount: OnMount = useCallback(editor => {
		editorRef.current = editor;
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
			setCurrentOffset(model.getOffsetAt(event.selection.getPosition()));
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
		if (session) {
			editor.setPosition({
				lineNumber: session.state.cursor.lineNumber,
				column: session.state.cursor.column
			});
			editor.setScrollTop(session.state.cursor.scrollTop);
			const model = editor.getModel();
			if (model) {
				setCurrentOffset(model.getOffsetAt({
					lineNumber: session.state.cursor.lineNumber,
					column: session.state.cursor.column
				}));
			}
		}
	}, [session, setSelection, updateCursor]);

	useEffect(() => () => window.clearTimeout(cursorTimerRef.current), []);

	useEffect(() => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model || !pendingEdit || pendingEdit.resourceId !== session?.state.resourceId) {
			return;
		}
		editor.pushUndoStop();
		editor.executeEdits('writing-buddy.review', [{
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
		editor.focus();
		clearEditorEdit(pendingEdit.id);
	}, [clearEditorEdit, pendingEdit, session?.state.resourceId]);

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
	}, [scenes]);

	const navigateToOffset = useCallback((offset: number) => {
		const editor = editorRef.current;
		const model = editor?.getModel();
		if (!editor || !model) {
			return;
		}
		const position = model.getPositionAt(offset);
		editor.setPosition(position);
		editor.revealPositionInCenter(position);
		editor.focus();
		setCurrentOffset(offset);
	}, []);

	const updateScenes = useCallback((nextScenes: readonly StoryScene[]) => {
		setScenes(nextScenes);
	}, []);

	if (!activeResource || !session) {
		return <div className="canvas-empty">选择一个章节或笔记开始写作。</div>;
	}

	const monacoTheme = theme === 'paper' || theme === 'fog' ? 'vs' : 'vs-dark';

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
					onNavigate={navigateToOffset}
					onScenesChange={updateScenes}
				/>
			)}
			<div className="chapter-editor-host">
				<Editor
				height="100%"
				path={session.state.modelUri}
				language="markdown"
				theme={monacoTheme}
				value={session.content}
				onChange={(value, event) => setContent(
					value ?? '',
					event.isUndoing ? 'undo' : event.isRedoing ? 'redo' : 'edit'
				)}
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
					fontSize: 18,
					glyphMargin: activeResource.type === 'chapter',
					hideCursorInOverviewRuler: true,
					hover: { enabled: 'off' },
					lineDecorationsWidth: 0,
					lineHeight: 34,
					lineNumbers: 'off',
					links: false,
					matchBrackets: 'never',
					minimap: { enabled: false },
					overviewRulerBorder: false,
					overviewRulerLanes: 0,
					padding: { top: 38, bottom: 80 },
					quickSuggestions: false,
					readOnly,
					renderLineHighlight: 'none',
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
			</div>
		</div>
	);
}
