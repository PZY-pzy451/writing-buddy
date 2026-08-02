import {
	Download,
	FileSearch,
	FileText,
	History,
	Search,
	ShieldCheck
} from 'lucide-react';
import type { VersionSummary } from '@writing-buddy/platform-ports';
import {
	DesktopStoryRepository,
	storyResourceTypes,
	toStoryChapterId,
	type MentionLink,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectNovelWordCount, useAppStore } from '../app/store';
import { desktopBridge } from '../platform/bridge';
import { SettingsPage } from '../settings/SettingsPage';
import { AiPlaygroundPage } from '../features/ai/AiPlaygroundPage';
import { ReviewPage } from '../features/review/ReviewPage';
import { AppEmptyState } from '../features/shared/presentation/AppEmptyState';
import { MentionService } from '../features/story/manuscript/MentionService';
import {
	EntityPeekService,
	type EntityPeekResult
} from '../features/story/manuscript/EntityPeekService';
import { EntityPeekCard } from '../features/story/manuscript/EntityPeekCard';
import {
	chapterExportFormatLabels,
	type ChapterExportFormat,
	type WorkExportFormat
} from '../features/export/ChapterExportModel';
import { ProjectBackupPanel } from '../features/backup/ProjectBackupPanel';

export function SystemPage(): React.JSX.Element | null {
	const mode = useAppStore(state => state.activeMode);
	const snapshot = useAppStore(state => state.snapshot);
	const search = useAppStore(state => state.search);
	const openResource = useAppStore(state => state.openResource);
	const activeResource = useAppStore(state => state.activeResource);
	const session = useAppStore(state => state.session);
	const reloadProject = useAppStore(state => state.reloadProject);
	const exportActiveChapter = useAppStore(state => state.exportActiveChapter);
	const exportWholeWork = useAppStore(state => state.exportWholeWork);
	const chapterExportBusy = useAppStore(state => state.chapterExportBusy);
	const chapterExportReceipts = useAppStore(state => state.chapterExportReceipts);
	const exportError = useAppStore(state => (
		state.error?.includes('导出') || state.error?.includes('正文尚未安全保存')
			? state.error
			: undefined
	));
	const novelWordCount = useAppStore(selectNovelWordCount);
	const [versions, setVersions] = useState<readonly VersionSummary[]>([]);
	const [selectedVersion, setSelectedVersion] = useState<string>();
	const [versionText, setVersionText] = useState<string>();
	const [versionMessage, setVersionMessage] = useState('');
	const [storySearchResources, setStorySearchResources] = useState<readonly {
		readonly id: string;
		readonly type: StoryResourceType;
		readonly title: string;
	}[]>([]);
	const [searchPeek, setSearchPeek] = useState<{
		readonly x: number;
		readonly y: number;
		readonly result?: EntityPeekResult;
		readonly loading?: boolean;
		readonly error?: string;
	}>();
	const peekTriggerRef = useRef<HTMLElement | null>(null);
	const storyRepository = useMemo(() => snapshot
		? new DesktopStoryRepository(snapshot.root, desktopBridge)
		: undefined, [snapshot]);
	const mentionService = useMemo(() => snapshot
		? new MentionService(snapshot.root, desktopBridge)
		: undefined, [snapshot]);
	const entityPeekService = useMemo(() => (
		storyRepository && mentionService
			? new EntityPeekService(storyRepository, mentionService)
			: undefined
	), [mentionService, storyRepository]);

	useEffect(() => {
		if (mode !== 'search' || !storyRepository) {
			return;
		}
		let cancelled = false;
		void Promise.all(storyResourceTypes.map(async type => (
			(await storyRepository.list(type)).map(resource => ({
				id: resource.id,
				type,
				title: resource.title
			}))
		))).then(groups => {
			if (!cancelled) setStorySearchResources(groups.flat());
		}).catch(() => {
			if (!cancelled) setStorySearchResources([]);
		});
		return () => { cancelled = true; };
	}, [mode, storyRepository]);

	useEffect(() => {
		if (mode === 'versions' && snapshot) {
			void desktopBridge.listVersions(snapshot.root).then(result => {
				setVersions(result);
				setSelectedVersion(current => current && result.some(version => version.id === current)
					? current
					: result[0]?.id);
			});
		}
	}, [mode, snapshot]);

	useEffect(() => {
		if (!snapshot || !selectedVersion || !activeResource?.path) {
			return;
		}
		void desktopBridge
			.readVersionText(snapshot.root, selectedVersion, activeResource.path)
			.then(result => setVersionText(result.content))
			.catch(() => setVersionText(undefined));
	}, [activeResource, selectedVersion, snapshot]);

	if (mode === 'settings') {
		return <SettingsPage />;
	}
	if (mode === 'ai') {
		return <AiPlaygroundPage />;
	}
	if (mode === 'works' || mode === 'references') {
		return null;
	}

	if (mode === 'search') {
		const chapters = snapshot?.project.volumes.flatMap(volume => volume.chapters) ?? [];
		const resources = snapshot?.resources ?? [];
		const normalized = search.trim().toLocaleLowerCase();
		const results = [
			...chapters.filter(chapter => !normalized || chapter.title.toLocaleLowerCase().includes(normalized)).map(chapter => ({
				id: chapter.id,
				type: 'chapter' as const,
				title: chapter.title,
				path: chapter.file
			})),
			...resources.filter(resource => !normalized || resource.title.toLocaleLowerCase().includes(normalized))
		];
		const storyResults = storySearchResources.filter(resource => (
			!normalized
			|| resource.title.toLocaleLowerCase().includes(normalized)
			|| resource.id.toLocaleLowerCase().includes(normalized)
		));
		const closeSearchPeek = () => {
			setSearchPeek(undefined);
			window.requestAnimationFrame(() => peekTriggerRef.current?.focus());
		};
		const openSearchPeek = (
			resourceId: string,
			trigger: HTMLElement
		) => {
			if (!entityPeekService) return;
			peekTriggerRef.current = trigger;
			const rect = trigger.getBoundingClientRect();
			const position = {
				x: rect.right + 8,
				y: rect.top
			};
			setSearchPeek({ ...position, loading: true });
			void entityPeekService.loadResource(resourceId)
				.then(result => setSearchPeek({ ...position, result }))
				.catch(() => setSearchPeek({
					...position,
					error: '暂时无法读取这条资料。'
				}));
		};
		const openFullSearchPeek = () => {
			const resource = searchPeek?.result?.resource;
			if (!resource) return;
			setSearchPeek(undefined);
			void useAppStore.getState().openStoryResource({
				type: resource.type,
				id: resource.id
			});
		};
		const jumpSearchBacklink = async (mention: MentionLink) => {
			if (!snapshot) return;
			const chapter = snapshot.project.volumes
				.flatMap(volume => volume.chapters)
				.find(candidate => toStoryChapterId(candidate.id) === mention.chapterId);
			if (!chapter) return;
			await useAppStore.getState().openResource({
				id: chapter.id,
				type: 'chapter',
				title: chapter.title,
				path: chapter.file,
				projectId: snapshot.project.projectId
			});
			useAppStore.getState().requestEditorReveal(chapter.id, mention.anchor.start);
			setSearchPeek(undefined);
		};
		return (
			<div className="system-page search-page">
				<header><span className="eyebrow">Project Search</span><h1>搜索当前作品</h1><p>搜索章节标题和写作资料，不扫描项目外文件。</p></header>
				<div className="search-result-list">
					{results.map(result => (
						<button type="button" key={`${result.type}:${result.id}`} onClick={() => snapshot && void openResource({ ...result, projectId: snapshot.project.projectId })}>
							<FileSearch size={18} /><span><strong>{result.title}</strong><small>{result.path}</small></span>
						</button>
					))}
					{storyResults.map(result => (
						<div className="search-story-result" key={result.id}>
							<button
								type="button"
								onClick={() => void useAppStore.getState().openStoryResource({
									type: result.type,
									id: result.id
								})}
							>
								<FileSearch size={18} />
								<span><strong>{result.title}</strong><small>{result.id}</small></span>
							</button>
							<button
								type="button"
								aria-label={`速览 ${result.title}`}
								onClick={event => openSearchPeek(result.id, event.currentTarget)}
							>
								速览
							</button>
						</div>
					))}
					{results.length === 0 && storyResults.length === 0 && (
						<AppEmptyState
							icon={Search}
							title="没有找到匹配内容"
							description="调整顶部搜索词，或清空搜索以查看全部章节和资料。"
							className="system-empty"
						/>
					)}
				</div>
				{searchPeek && (
					<EntityPeekCard
						x={searchPeek.x}
						y={searchPeek.y}
						candidates={[]}
						result={searchPeek.result}
						loading={searchPeek.loading}
						error={searchPeek.error}
						onSelect={() => undefined}
						onClose={closeSearchPeek}
						onOpenFull={openFullSearchPeek}
						onJumpBacklink={mention => void jumpSearchBacklink(mention)}
					/>
				)}
			</div>
		);
	}

	if (mode === 'review') {
		return <ReviewPage />;
	}

	const createSnapshot = async () => {
		if (!snapshot) {
			return;
		}
		await desktopBridge.createSnapshot(snapshot.root, 'manual', '手动快照');
		setVersionMessage('安全快照已创建。');
		const result = await desktopBridge.listVersions(snapshot.root);
		setVersions(result);
		setSelectedVersion(result[0]?.id);
	};

	const restoreSelected = async () => {
		if (!snapshot || !selectedVersion
			|| !window.confirm('恢复版本会替换当前项目副本中的受管资源。系统会先自动创建 .wbbackup。确定继续吗？')) {
			return;
		}
		const restored = await desktopBridge.restoreVersion(snapshot.root, selectedVersion);
		setVersionMessage(`已恢复 ${restored} 个受管资源。`);
		await reloadProject();
	};
	const exportChapter = async (format: ChapterExportFormat) => {
		const exported = await exportActiveChapter(format);
		if (exported) {
			setVersionMessage(`当前章节已导出为${chapterExportFormatLabels[format]}。`);
		}
	};
	const exportWork = async (format: WorkExportFormat) => {
		const exported = await exportWholeWork(format);
		if (exported) {
			setVersionMessage(`整部作品已导出为${chapterExportFormatLabels[format]}。`);
		}
	};
	const activeChapterReady = activeResource?.type === 'chapter' && Boolean(session);
	const projectChapterCount = snapshot?.project.volumes.reduce((total, volume) => (
		total + volume.chapters.length
	), 0) ?? 0;
	const wholeWorkReady = Boolean(snapshot && projectChapterCount > 0);
	const projectExportReceipts = snapshot
		? chapterExportReceipts.filter(receipt => (
			receipt.projectId === snapshot.project.projectId
		)).slice(0, 8)
		: [];

	return (
		<div className="system-page versions-page">
			<header>
				<span className="eyebrow">History</span>
				<h1>历史与导出</h1>
				<p>交付整部作品，并用可校验备份与快照保护每次重要修改。</p>
				{versionMessage && <span className="success-message">{versionMessage}</span>}
			</header>
			<section className="history-export-card" aria-labelledby="history-export-title">
				<div className="history-card-icon"><Download size={22} /></div>
				<div className="history-card-copy">
					<span className="eyebrow">当前任务</span>
					<h2 id="history-export-title">导出整部作品</h2>
					{wholeWorkReady ? (
						<p>
							<strong>{snapshot?.project.title}</strong>
							<span>{projectChapterCount} 章 · {novelWordCount.toLocaleString()} 字 · 导出前自动保存当前原稿</span>
						</p>
					) : (
						<p><strong>作品还没有章节</strong><span>创建并写下第一个章节后即可导出整部作品。</span></p>
					)}
				</div>
				<div className="history-export-actions">
					<button
						className="primary-button"
						type="button"
						disabled={!wholeWorkReady || chapterExportBusy}
						onClick={() => void exportWork('docx')}
					>
						<Download size={18} />
						{chapterExportBusy ? '正在导出…' : '导出 Word 文档'}
					</button>
					<button
						className="secondary-button"
						type="button"
						disabled={!wholeWorkReady || chapterExportBusy}
						onClick={() => void exportWork('markdown')}
					>
						<FileText size={18} />作品 Markdown
					</button>
					<button
						className="secondary-button"
						type="button"
						disabled={!wholeWorkReady || chapterExportBusy}
						onClick={() => void exportWork('plain-text')}
					>
						<FileText size={18} />作品纯文本
					</button>
					<button
						className="secondary-button"
						type="button"
						disabled={!activeChapterReady || chapterExportBusy}
						onClick={() => void exportChapter('markdown')}
					>
						<FileText size={18} />当前章 Markdown
					</button>
					<button
						className="secondary-button"
						type="button"
						disabled={!activeChapterReady || chapterExportBusy}
						onClick={() => void exportChapter('plain-text')}
					>
						<FileText size={18} />当前章纯文本
					</button>
				</div>
				{exportError && <p className="history-export-error" role="alert">{exportError}</p>}
			</section>

			{projectExportReceipts.length > 0 && (
				<section className="history-receipts" aria-labelledby="history-receipts-title">
					<header>
						<div>
							<span className="eyebrow">Export receipts</span>
							<h2 id="history-receipts-title">最近导出</h2>
						</div>
						<small>仅在文件写入成功后记录</small>
					</header>
					<ol>
						{projectExportReceipts.map(receipt => (
							<li key={receipt.id}>
								<span className="history-receipt-icon"><FileText size={16} /></span>
								<span className="history-receipt-main">
									<span className="history-receipt-title">
										<strong>{receipt.title}</strong>
										<small>{receipt.scope === 'work' ? '整部作品' : '当前章节'}</small>
									</span>
									<code title={receipt.destination}>{receipt.destination}</code>
								</span>
								<span className="history-receipt-meta">
									<strong>{chapterExportFormatLabels[receipt.format]}</strong>
									<small>
										{receipt.scope === 'work' ? `${receipt.chapterCount} 章 · ` : ''}
										{receipt.wordCount.toLocaleString()} 字
										{receipt.scope === 'work'
											? receipt.sourceFingerprint ? ' · 精确源指纹' : ' · 旧回执'
											: ''}
										{' · '}{new Date(receipt.exportedAt).toLocaleString()}
									</small>
								</span>
							</li>
						))}
					</ol>
				</section>
			)}

			<section className="history-backup" aria-label="项目便携备份">
				<ProjectBackupPanel />
			</section>

			<section className="history-safety" aria-labelledby="history-safety-title">
				<header>
					<div className="history-safety-heading">
						<span className="history-card-icon"><ShieldCheck size={20} /></span>
						<div><h2 id="history-safety-title">安全快照</h2><p>比较受管内容；恢复前会自动创建兼容的 .wbbackup。</p></div>
					</div>
					<div className="page-actions">
						<button className="secondary-button" type="button" onClick={() => void createSnapshot()} disabled={!snapshot || snapshot.readOnly}>创建安全快照</button>
						<button className="secondary-button" type="button" onClick={() => void restoreSelected()} disabled={!selectedVersion || snapshot?.readOnly}>恢复所选版本</button>
					</div>
				</header>
				{versions.length === 0 ? (
					<div className="history-empty">
						<History size={22} />
						<span><strong>还没有安全快照</strong><small>创建第一个快照后，可在这里比较并恢复受管资源。</small></span>
					</div>
				) : (
					<div className="version-workspace">
						<div className="version-list">
							{versions.map(version => (
								<button
									key={version.id}
									type="button"
									className={selectedVersion === version.id ? 'is-active' : ''}
									onClick={() => setSelectedVersion(version.id)}
								>
									<History size={18} />
									<span><strong>{version.label || '未命名快照'}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></span>
								</button>
							))}
						</div>
						<div className="version-diff">
							<div><span>所选快照</span><pre>{versionText ?? '该快照不包含当前资源。'}</pre></div>
							<div><span>当前内容</span><pre>{session?.content ?? '请先打开一个章节或笔记进行对比。'}</pre></div>
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
