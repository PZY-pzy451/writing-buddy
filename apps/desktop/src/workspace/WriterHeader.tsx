import {
	AlignJustify,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Compass,
	Download,
	Feather,
	ListChecks,
	LoaderCircle,
	MoreHorizontal,
	PencilLine,
	CircleDashed,
	Save
} from 'lucide-react';
import type { ManuscriptContinuationMode } from '@writing-buddy/story-kernel';
import {
	countWords,
	findChapter,
	flattenChapters,
	type ChapterStatus
} from '@writing-buddy/domain';
import { useAppStore } from '../app/store';
import { SaveStateIndicator } from '../features/save/SaveStateIndicator';
import { DailyWritingGoalControl } from '../features/progress/DailyWritingGoalControl';

const chapterStatuses: readonly {
	readonly id: ChapterStatus;
	readonly label: string;
	readonly description: string;
	readonly Icon: typeof CircleDashed;
}[] = [
	{ id: 'draft', label: '初稿', description: '内容仍在创作，可继续增删。', Icon: CircleDashed },
	{ id: 'revision', label: '修订中', description: '正在整理结构、语言或一致性。', Icon: PencilLine },
	{ id: 'completed', label: '已完成', description: '由你确认本章可进入交付检查。', Icon: CheckCircle2 }
];

export function WriterHeader(): React.JSX.Element | null {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const openResource = useAppStore(state => state.openResource);
	const save = useAppStore(state => state.save);
	const saveState = useAppStore(state => state.saveState);
	const exportActiveChapter = useAppStore(state => state.exportActiveChapter);
	const chapterExportBusy = useAppStore(state => state.chapterExportBusy);
	const chapterStatusBusy = useAppStore(state => state.chapterStatusBusy);
	const updateChapterStatus = useAppStore(state => state.updateChapterStatus);
	const requestAssistantAction = useAppStore(state => state.requestAssistantAction);
	const setStoryView = useAppStore(state => state.setStoryView);
	const focusMode = useAppStore(state => state.focusMode);
	const manuscriptDensity = useAppStore(state => state.manuscriptDensity);
	const setManuscriptDensity = useAppStore(state => state.setManuscriptDensity);

	if (!snapshot || !activeResource) {
		return null;
	}

	const found = activeResource.type === 'chapter' ? findChapter(snapshot.project, activeResource.id) : undefined;
	const chapters = flattenChapters(snapshot.project);
	const index = chapters.findIndex(chapter => chapter.id === activeResource.id);
	const chapterWords = session ? countWords(session.content) : 0;
	const chapterStatus = found?.chapter.status ?? 'draft';
	const chapterStatusOption = chapterStatuses.find(option => option.id === chapterStatus)
		?? chapterStatuses[0];
	const ChapterStatusIcon = chapterStatusOption.Icon;

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
	const exportChapter = async (target: HTMLElement) => {
		await exportActiveChapter('markdown');
		target.closest('details')?.removeAttribute('open');
	};
	const chooseChapterStatus = async (status: ChapterStatus, target: HTMLElement) => {
		if (!found || chapterStatusBusy) return;
		const updated = await updateChapterStatus(found.chapter.id, status);
		if (updated) target.closest('details')?.removeAttribute('open');
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
							<DailyWritingGoalControl placement="header" />
							<span className="word-chip">本章 {chapterWords.toLocaleString()} 字</span>
							{chapterStatusOption && (
								snapshot.readOnly ? (
									<span className="chapter-status-readonly" data-status={chapterStatus} title="只读作品不能修改章节状态">
										<ChapterStatusIcon size={16} />{chapterStatusOption.label}
									</span>
								) : (
									<details className="writer-tools-menu chapter-status-control" data-status={chapterStatus}>
										<summary
											role="button"
											aria-label={`章节状态：${chapterStatusOption.label}`}
											aria-disabled={chapterStatusBusy}
											onClick={event => {
												if (chapterStatusBusy) event.preventDefault();
											}}
										>
											{chapterStatusBusy
												? <LoaderCircle className="spin" size={16} />
												: <ChapterStatusIcon size={16} />}
											<span>{chapterStatusBusy ? '正在更新…' : chapterStatusOption.label}</span>
											<ChevronDown size={16} />
										</summary>
										<div role="menu" aria-label="选择章节状态">
											<p className="chapter-status-help">
												状态只由你确认，不会自动判断正文质量或修改正文。
											</p>
											{chapterStatuses.map(({ id, label, description, Icon }) => (
												<button
													key={id}
													type="button"
													role="menuitemradio"
													aria-checked={chapterStatus === id}
													disabled={chapterStatusBusy}
													onClick={event => void chooseChapterStatus(id, event.currentTarget)}
												>
													{chapterStatus === id ? <Check size={18} /> : <Icon size={18} />}
													<span><strong>{label}</strong><small>{description}</small></span>
												</button>
											))}
										</div>
									</details>
								)
							)}
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
										<button
											type="button"
											role="menuitem"
											aria-label="导出章节"
											disabled={chapterExportBusy}
											onClick={event => void exportChapter(event.currentTarget)}
										>
											<Download size={16} />
											<span>
												<strong>{chapterExportBusy ? '正在导出…' : '导出章节'}</strong>
												<small>保存为 Markdown，并在历史中记录路径</small>
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
										<hr />
										<span className="writer-menu-label">
											<AlignJustify size={16} />正文排版
										</span>
										{([
											['compact', '紧凑'],
											['comfortable', '舒适'],
											['spacious', '宽松']
										] as const).map(([density, label]) => (
											<button
												key={density}
												type="button"
												role="menuitemradio"
												aria-checked={manuscriptDensity === density}
												onClick={() => setManuscriptDensity(density)}
											>
												{manuscriptDensity === density
													? <Check size={16} />
													: <span className="writer-menu-icon-placeholder" />}
												{label}
											</button>
										))}
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
