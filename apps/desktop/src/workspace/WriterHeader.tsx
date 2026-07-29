import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Compass,
	Feather,
	ListChecks,
	MoreHorizontal,
	Save
} from 'lucide-react';
import type { ManuscriptContinuationMode } from '@writing-buddy/story-kernel';
import { countWords, findChapter, flattenChapters } from '@writing-buddy/domain';
import { useAppStore } from '../app/store';
import { SaveStateIndicator } from '../features/save/SaveStateIndicator';

export function WriterHeader(): React.JSX.Element | null {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const save = useAppStore(state => state.save);
	const saveState = useAppStore(state => state.saveState);
	const requestAssistantAction = useAppStore(state => state.requestAssistantAction);
	const setStoryView = useAppStore(state => state.setStoryView);
	const focusMode = useAppStore(state => state.focusMode);

	if (!snapshot || !activeResource) {
		return null;
	}

	const found = activeResource.type === 'chapter' ? findChapter(snapshot.project, activeResource.id) : undefined;
	const chapters = flattenChapters(snapshot.project);
	const index = chapters.findIndex(chapter => chapter.id === activeResource.id);
	const chapterWords = session ? countWords(session.content) : 0;

	const openChapterAt = (targetIndex: number) => {
		const chapter = chapters[targetIndex];
		if (!chapter) {
			return;
		}
		void openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
	};
	const openContinuation = (
		mode: ManuscriptContinuationMode,
		target: HTMLElement
	) => {
		requestAssistantAction({ kind: 'continuation', mode });
		target.closest('details')?.removeAttribute('open');
	};
	const openChapterOrganization = async (target: HTMLElement) => {
		if (session?.state.dirty) await save();
		setStoryView('extraction');
		target.closest('details')?.removeAttribute('open');
	};

	return (
		<header className="writer-header">
			<div className="writer-path">
				<span>{snapshot.project.title}</span>
				<span>/</span>
				<span>{found?.volume.title ?? '写作资料'}</span>
				<span>/</span>
				<strong>{activeResource.title}</strong>
			</div>
			<div className="writer-header-main">
				<div>
					<span className="chapter-kind">{activeResource.type === 'chapter' ? '当前章节' : '写作资料'}</span>
					<h1>{activeResource.title}</h1>
				</div>
				<div className="chapter-actions">
					<SaveStateIndicator className="save-indicator" />
					{!focusMode && activeResource.type === 'chapter' && (
						<>
							<span className="word-chip">本章 {chapterWords.toLocaleString()} 字</span>
							{!snapshot.readOnly ? (
								<details className="writer-tools-menu">
									<summary aria-label="更多章节操作" role="button">
										<MoreHorizontal size={18} /><span>更多</span><ChevronDown size={16} />
									</summary>
									<div role="menu">
										<button
											type="button"
											role="menuitem"
											onClick={event => openContinuation('continue-paragraph', event.currentTarget)}
										>
											<Feather size={16} />
											<span><strong>继续本段</strong><small>沿当前光标生成一个候选</small></span>
										</button>
										<button
											type="button"
											role="menuitem"
											onClick={event => openContinuation('finish-scene', event.currentTarget)}
										>
											<Check size={16} />
											<span><strong>完成场景</strong><small>收束当前已关联场景</small></span>
										</button>
										<button
											type="button"
											role="menuitem"
											onClick={event => openContinuation('three-directions', event.currentTarget)}
										>
											<Compass size={16} />
											<span><strong>三种走向</strong><small>并排审阅三种后续方向</small></span>
										</button>
										<hr />
										<button
											type="button"
											role="menuitem"
											aria-label="整理本章"
											onClick={event => void openChapterOrganization(event.currentTarget)}
										>
											<ListChecks size={16} />
											<span>
												<strong>整理本章</strong>
												<small>先查看范围与 Token，不会自动调用 AI</small>
											</span>
										</button>
										<hr />
										<button
											type="button"
											role="menuitem"
											disabled={index <= 0}
											onClick={() => openChapterAt(index - 1)}
										>
											<ChevronLeft size={16} />上一章
										</button>
										<button
											type="button"
											role="menuitem"
											disabled={index < 0 || index >= chapters.length - 1}
											onClick={() => openChapterAt(index + 1)}
										>
											<ChevronRight size={16} />下一章
										</button>
									</div>
								</details>
							) : null}
						</>
					)}
					{!focusMode && (
						<button
							className="icon-button"
							type="button"
							onClick={() => void save()}
							disabled={!session?.state.dirty || saveState.type === 'saving'}
							aria-label={saveState.type === 'saving' ? '正在保存' : '保存'}
						>
							<Save size={18} />
						</button>
					)}
				</div>
			</div>
		</header>
	);
}
