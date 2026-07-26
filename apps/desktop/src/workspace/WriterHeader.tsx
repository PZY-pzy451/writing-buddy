import { Check, ChevronLeft, ChevronRight, CircleDot, Save } from 'lucide-react';
import { countWords, findChapter, flattenChapters } from '@writing-buddy/domain';
import { selectNovelWordCount, useAppStore } from '../app/store';

export function WriterHeader(): React.JSX.Element | null {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const save = useAppStore(state => state.save);
	const novelWords = useAppStore(selectNovelWordCount);

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
					<span className={`save-indicator ${session?.state.dirty ? 'is-dirty' : ''}`}>
						{session?.state.dirty ? <CircleDot size={16} /> : <Check size={16} />}
						{session?.state.dirty ? '未保存' : '已保存'}
					</span>
					{activeResource.type === 'chapter' && (
						<>
							<span className="word-chip">本章 {chapterWords.toLocaleString()} 字</span>
							<span className="word-chip">全书 {novelWords.toLocaleString()} 字</span>
						</>
					)}
					<button className="icon-button" type="button" onClick={() => void save()} disabled={!session?.state.dirty} aria-label="保存">
						<Save size={18} />
					</button>
					<button className="chapter-nav-button" type="button" disabled={index <= 0} onClick={() => openChapterAt(index - 1)}>
						<ChevronLeft size={17} />上一章
					</button>
					<button className="chapter-nav-button" type="button" disabled={index < 0 || index >= chapters.length - 1} onClick={() => openChapterAt(index + 1)}>
						下一章<ChevronRight size={17} />
					</button>
				</div>
			</div>
		</header>
	);
}
