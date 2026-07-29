import {
	BookOpenText,
	Command,
	Database,
	FileText,
	LoaderCircle,
	MapPinned,
	Search,
	Settings,
	X
} from 'lucide-react';
import { resolveAnchor } from '@writing-buddy/review';
import {
	DesktopStoryRepository,
	storyResourceTypes,
	type StoryResource
} from '@writing-buddy/story-kernel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import { useModalFocus } from '../../accessibility/useModalFocus';
import { desktopBridge } from '../../platform/bridge';
import {
	buildWriterNavigatorCatalog,
	createManuscriptSearchCache,
	searchManuscriptOccurrences,
	sortWriterNavigatorResults,
	type WriterNavigatorGroup,
	type WriterNavigatorResult,
	type WriterNavigatorStorySummary
} from './WriterNavigatorModel';

const groupOrder: readonly WriterNavigatorGroup[] = [
	'最近使用',
	'章节',
	'场景',
	'正文',
	'资料',
	'设置',
	'命令'
];

function summaryFor(resource: StoryResource): string | undefined {
	const record = resource as unknown as Readonly<Record<string, unknown>>;
	for (const key of ['summary', 'description', 'synopsis', 'role', 'status']) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim().slice(0, 180);
		}
	}
	return undefined;
}

function iconFor(result: WriterNavigatorResult): typeof Search {
	switch (result.kind) {
		case 'chapter': return BookOpenText;
		case 'scene': return MapPinned;
		case 'manuscript': return FileText;
		case 'resource': return Database;
		case 'setting': return Settings;
		case 'command': return Command;
	}
}

function grouped(
	results: readonly WriterNavigatorResult[]
): readonly {
	readonly group: WriterNavigatorGroup;
	readonly results: readonly WriterNavigatorResult[];
}[] {
	const buckets = new Map<WriterNavigatorGroup, WriterNavigatorResult[]>();
	for (const result of results) {
		const group = result.recent ? '最近使用' : result.group;
		buckets.set(group, [...(buckets.get(group) ?? []), result]);
	}
	return groupOrder
		.map(group => ({ group, results: buckets.get(group) ?? [] }))
		.filter(bucket => bucket.results.length);
}

export function WriterNavigator(): React.JSX.Element | null {
	const open = useAppStore(state => state.writerNavigatorOpen);
	const closeStore = useAppStore(state => state.closeWriterNavigator);
	const snapshot = useAppStore(state => state.snapshot);
	const scenes = useAppStore(state => state.structureScenes);
	const recentIds = useAppStore(state => state.writerNavigatorRecentIds);
	const remember = useAppStore(state => state.rememberWriterNavigatorResult);
	const setNotice = useAppStore(state => state.setWriterNavigatorNotice);
	const sourceVersion = useAppStore(state => state.session?.state.version);
	const activeResource = useAppStore(state => state.activeResource);
	const activeSession = useAppStore(state => state.session);
	const [query, setQuery] = useState('');
	const [storyResources, setStoryResources] = useState<readonly WriterNavigatorStorySummary[]>([]);
	const [manuscriptResults, setManuscriptResults] = useState<readonly WriterNavigatorResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const [preview, setPreview] = useState<WriterNavigatorResult>();
	const [searchCache] = useState(createManuscriptSearchCache);
	const requestSequence = useRef(0);
	const close = useCallback(() => {
		requestSequence.current += 1;
		setQuery('');
		setManuscriptResults([]);
		setLoading(false);
		setPreview(undefined);
		setActiveIndex(0);
		closeStore();
	}, [closeStore]);
	const dialogRef = useModalFocus(close, open);
	const repository = useMemo(() => snapshot
		? new DesktopStoryRepository(snapshot.root, desktopBridge)
		: undefined, [snapshot]);

	useEffect(() => {
		if (!open || !repository) return;
		let cancelled = false;
		const types = storyResourceTypes.filter(type => (
			type !== 'chapter' && type !== 'scene'
		));
		void Promise.all(types.map(async type => (
			(await repository.list(type)).map(resource => ({
				id: resource.id,
				type,
				title: resource.title,
				summary: summaryFor(resource)
			}))
		))).then(groups => {
			if (!cancelled) setStoryResources(groups.flat());
		}).catch(() => {
			if (!cancelled) setStoryResources([]);
		});
		return () => { cancelled = true; };
	}, [open, repository]);

	useEffect(() => {
		if (!activeResource?.path || sourceVersion === undefined) return;
		searchCache.files.delete(`${snapshot?.root ?? ''}\u0000${activeResource.path}`);
	}, [activeResource?.path, searchCache, snapshot?.root, sourceVersion]);

	useEffect(() => {
		if (!open || !snapshot || !query.trim()) return;
		const sequence = ++requestSequence.current;
		const timer = window.setTimeout(() => {
			setLoading(true);
			void searchManuscriptOccurrences(
				snapshot,
				query,
				async (projectRoot, relativePath) => {
					if (
						activeSession
						&& activeResource?.path === relativePath
						&& activeResource.id === activeSession.state.resourceId
					) {
						return {
							content: activeSession.content,
							encoding: 'utf-8',
							eol: activeSession.state.originalEol,
							hasBom: activeSession.state.hasBom,
							hash: activeSession.state.diskHash
						};
					}
					return desktopBridge.readText(projectRoot, relativePath);
				},
				4,
				searchCache
			).then(results => {
				if (sequence === requestSequence.current) {
					setManuscriptResults(results);
					setLoading(false);
				}
			});
		}, 90);
		return () => window.clearTimeout(timer);
	}, [
		activeResource?.id,
		activeResource?.path,
		activeSession,
		open,
		query,
		searchCache,
		snapshot
	]);

	const catalog = useMemo(() => snapshot
		? buildWriterNavigatorCatalog({
				snapshot,
				scenes,
				storyResources,
				recentIds
			})
		: [], [recentIds, scenes, snapshot, storyResources]);
	const results = useMemo(() => {
		const sorted = sortWriterNavigatorResults(
			[...catalog, ...manuscriptResults],
			query
		);
		return sorted.slice(0, 80);
	}, [catalog, manuscriptResults, query]);
	const groupedResults = useMemo(() => grouped(results), [results]);

	const safeActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

	if (!open) return null;

	const runCommand = async (result: WriterNavigatorResult) => {
		const state = useAppStore.getState();
		switch (result.commandId) {
			case 'quick-capture':
				state.openQuickCapture();
				break;
			case 'organize-chapter':
				if (state.session?.state.dirty) await state.save();
				state.setStoryView('extraction');
				break;
			case 'toggle-focus':
				state.toggleFocus();
				break;
			case 'reset-layout':
				state.resetWorkspaceLayout();
				break;
			case 'save':
				await state.save();
				break;
		}
	};

	const openResult = async (result: WriterNavigatorResult) => {
		if (!snapshot) return;
		remember(result.id);
		if (result.kind === 'command') {
			close();
			await runCommand(result);
			return;
		}
		if (result.kind === 'setting') {
			close();
			useAppStore.getState().setMode('settings');
			return;
		}
		if (result.kind === 'resource') {
			close();
			if (result.storyType && result.storyId) {
				await useAppStore.getState().openStoryResource({
					type: result.storyType,
					id: result.storyId
				});
				return;
			}
			const resource = snapshot.resources.find(candidate => candidate.id === result.resourceId);
			if (resource) {
				await useAppStore.getState().openResource({
					...resource,
					projectId: snapshot.project.projectId
				});
			}
			return;
		}
		const chapter = snapshot.project.volumes
			.flatMap(volume => volume.chapters)
			.find(candidate => candidate.id === result.chapterId);
		if (!chapter) return;
		close();
		await useAppStore.getState().openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		});
		const current = useAppStore.getState().session;
		const resolved = current && result.anchor
			? resolveAnchor(current.content, result.anchor)
			: undefined;
		const fallback = Math.min(
			Math.max(0, result.offset ?? 0),
			current?.content.length ?? 0
		);
		const offset = resolved?.start ?? fallback;
		if (result.anchor && !resolved) {
			setNotice('正文已变化，已定位到附近位置。');
		}
		useAppStore.getState().requestEditorReveal(chapter.id, offset);
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing || !results.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActiveIndex(index => (index + 1) % results.length);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActiveIndex(index => (index - 1 + results.length) % results.length);
		} else if (event.key === 'Home') {
			event.preventDefault();
			setActiveIndex(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			setActiveIndex(results.length - 1);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const result = results[safeActiveIndex];
			if (!result) return;
			if (event.ctrlKey || event.metaKey) {
				setPreview(result);
			} else {
				void openResult(result);
			}
		}
	};

	return (
		<div className="writer-navigator-backdrop" role="presentation" onMouseDown={event => {
			if (event.target === event.currentTarget) close();
		}}>
			<section
				ref={dialogRef}
				tabIndex={-1}
				className={`writer-navigator ${preview ? 'has-preview' : ''}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="writer-navigator-title"
			>
				<header>
					<label className="writer-navigator-input">
						<Search size={18} aria-hidden="true" />
						<span className="sr-only" id="writer-navigator-title">作者导航器</span>
						<input
							value={query}
							onChange={event => {
								const value = event.target.value;
								setQuery(value);
								setActiveIndex(0);
								if (!value.trim()) {
									requestSequence.current += 1;
									setManuscriptResults([]);
									setLoading(false);
								}
							}}
							onKeyDown={onKeyDown}
							placeholder="跳转章节、正文、资料或运行命令…"
							role="combobox"
							aria-label="作者导航器"
							aria-controls="writer-navigator-results"
							aria-expanded="true"
							aria-activedescendant={results[safeActiveIndex]
								? `writer-navigator-option-${results[safeActiveIndex].id.replace(/[^A-Za-z0-9_-]/g, '-')}`
								: undefined}
						/>
						{loading && <LoaderCircle className="spin" size={18} aria-label="正在搜索正文" />}
						<kbd>Esc</kbd>
					</label>
					<button className="icon-button" type="button" onClick={close} aria-label="关闭作者导航器">
						<X size={18} />
					</button>
				</header>
				<div className="writer-navigator-body">
					<div
						id="writer-navigator-results"
						className="writer-navigator-results"
						role="listbox"
						aria-label="导航结果"
					>
						{groupedResults.map(bucket => (
							<section key={bucket.group} aria-labelledby={`navigator-group-${bucket.group}`}>
								<h3 id={`navigator-group-${bucket.group}`}>{bucket.group}</h3>
								{bucket.results.map(result => {
									const index = results.indexOf(result);
									const Icon = iconFor(result);
									return (
										<button
											id={`writer-navigator-option-${result.id.replace(/[^A-Za-z0-9_-]/g, '-')}`}
											key={result.id}
											type="button"
											role="option"
											data-result-id={result.id}
											data-result-kind={result.kind}
											data-command-id={result.commandId}
											aria-selected={index === safeActiveIndex}
											className={[
												index === safeActiveIndex ? 'is-active' : '',
												result.kind === 'command' ? 'is-command' : ''
											].filter(Boolean).join(' ')}
											onMouseEnter={() => setActiveIndex(index)}
											onClick={() => void openResult(result)}
										>
											<Icon size={18} aria-hidden="true" />
											<span>
												<strong>{result.title}</strong>
												{result.subtitle && <small>{result.subtitle}</small>}
											</span>
											{result.recent && <em>最近</em>}
										</button>
									);
								})}
							</section>
						))}
						{!results.length && !loading && (
							<div className="writer-navigator-empty">
								<Search size={20} />
								<strong>没有找到匹配内容</strong>
								<span>尝试章节名、人物名、正文词语或命令名称。</span>
							</div>
						)}
					</div>
					{preview && (
						<aside className="writer-navigator-preview" aria-label="结果预览">
							<span className="eyebrow">Side Preview</span>
							<strong>{preview.title}</strong>
							<small>{preview.group} · {preview.subtitle ?? preview.kind}</small>
							<p>{preview.preview ?? '按 Enter 打开此结果；预览不会改变当前章节。'}</p>
							<button className="primary-button" type="button" onClick={() => void openResult(preview)}>
								打开结果
							</button>
						</aside>
					)}
				</div>
				<footer>
					<span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
					<span><kbd>Enter</kbd> 打开</span>
					<span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 侧边预览</span>
					<strong>只搜索本地项目，不调用 AI</strong>
				</footer>
			</section>
		</div>
	);
}
