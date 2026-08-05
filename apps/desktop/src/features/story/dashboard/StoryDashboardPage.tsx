import {
	ArrowRight,
	BookOpenText,
	CheckCircle2,
	Clock3,
	Compass,
	FileText,
	ListChecks,
	Target,
	Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ResourceDescriptor } from '@writing-buddy/domain';
import {
	DesktopStoryRepository,
	type StoryResource,
	type StoryResourceType
} from '@writing-buddy/story-kernel';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import { DailyWritingGoalControl } from '../../progress/DailyWritingGoalControl';
import {
	selectStoryDashboardModel,
	type DashboardKernelData,
	type DashboardStoryItem
} from './dashboardSelectors';
import './StoryDashboardPage.css';

export interface DashboardKernelLoad extends DashboardKernelData {
	readonly plotError?: string;
	readonly foreshadowingError?: string;
	readonly pendingFactsError?: string;
}

export type DashboardKernelLoader = (projectRoot: string) => Promise<DashboardKernelLoad>;

function toDashboardItems(resources: readonly StoryResource[]): readonly DashboardStoryItem[] {
	return resources.map(resource => ({
		id: resource.id,
		title: resource.title,
		tags: resource.tags
	}));
}

async function settleStoryList(
	repository: DesktopStoryRepository,
	type: StoryResourceType
): Promise<{ readonly items: readonly DashboardStoryItem[]; readonly error?: string }> {
	try {
		return { items: toDashboardItems(await repository.list(type)) };
	} catch (error) {
		return {
			items: [],
			error: error instanceof Error ? error.message : 'storyReadFailed'
		};
	}
}

const defaultLoadKernelData: DashboardKernelLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [plot, foreshadowing, pendingFacts] = await Promise.all([
		settleStoryList(repository, 'plotThread'),
		settleStoryList(repository, 'foreshadowing'),
		settleStoryList(repository, 'information')
	]);
	return {
		plotThreads: plot.items,
		foreshadowing: foreshadowing.items,
		pendingFacts: pendingFacts.items,
		...(plot.error ? { plotError: plot.error } : {}),
		...(foreshadowing.error ? { foreshadowingError: foreshadowing.error } : {}),
		...(pendingFacts.error ? { pendingFactsError: pendingFacts.error } : {})
	};
};

const unavailableKernelData: DashboardKernelLoad = {
	plotThreads: [],
	foreshadowing: [],
	pendingFacts: [],
	plotError: 'storyReadFailed',
	foreshadowingError: 'storyReadFailed',
	pendingFactsError: 'storyReadFailed'
};

interface StoryDashboardPageProps {
	readonly loadKernelData?: DashboardKernelLoader;
}

function LoadingLines(): React.JSX.Element {
	return (
		<div className="dashboard-loading-lines" aria-label="正在加载">
			<span />
			<span />
			<span />
		</div>
	);
}

export function StoryDashboardPage({
	loadKernelData = defaultLoadKernelData
}: StoryDashboardPageProps): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const issues = useAppStore(state => state.issues);
	const writerSession = useAppStore(state => {
		const projectId = state.snapshot?.project.projectId;
		return projectId ? state.writerSessions[projectId] : undefined;
	});
	const sessionRestoreNotice = useAppStore(state => state.sessionRestoreNotice);
	const structureScenes = useAppStore(state => state.structureScenes);
	const openResource = useAppStore(state => state.openResource);
	const setMode = useAppStore(state => state.setMode);
	const openCreationJourney = useAppStore(state => state.openCreationJourney);
	const setError = useAppStore(state => state.setError);
	const [kernelState, setKernelState] = useState<{
		readonly projectRoot: string;
		readonly data: DashboardKernelLoad;
	}>();
	const [journeyAvailable, setJourneyAvailable] = useState(false);

	useEffect(() => {
		if (!snapshot) {
			return;
		}
		let cancelled = false;
		void Promise.resolve()
			.then(() => loadKernelData(snapshot.root))
			.then(result => {
				if (!cancelled) {
					setKernelState({ projectRoot: snapshot.root, data: result });
				}
			})
			.catch(() => {
				if (!cancelled) {
					setKernelState({ projectRoot: snapshot.root, data: unavailableKernelData });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [loadKernelData, snapshot]);

	useEffect(() => {
		if (!snapshot) return;
		let active = true;
		void desktopBridge.readCreationJourneyState(snapshot.root)
			.then(file => {
				if (active) setJourneyAvailable(Boolean(file));
			})
			.catch(() => {
				if (active) setJourneyAvailable(false);
			});
		return () => {
			active = false;
		};
	}, [snapshot]);

	const kernel = kernelState && snapshot && kernelState.projectRoot === snapshot.root
		? kernelState.data
		: undefined;
	const kernelLoadWarning = Boolean(
		kernel?.plotError || kernel?.foreshadowingError || kernel?.pendingFactsError
	);
	const model = useMemo(() => (
		snapshot && kernel
			? selectStoryDashboardModel(snapshot, issues, kernel, writerSession?.activeChapterId)
			: undefined
	), [issues, kernel, snapshot, writerSession?.activeChapterId]);

	if (!snapshot) {
		return (
			<main className="story-dashboard is-empty" aria-label="作品仪表盘">
				<BookOpenText size={32} />
				<h1>先打开一个作品</h1>
			</main>
		);
	}

	const openChapter = (chapter: NonNullable<typeof model>['recentChapter']) => {
		if (!chapter) {
			setError('请先在项目清单中添加第一章。');
			return;
		}
		const resource: ResourceDescriptor = {
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		};
		void openResource(resource);
	};

	const pendingLabel = model
		? model.pendingTotal === 0 ? '当前没有待处理问题' : `${model.pendingTotal} 项待处理`
		: '';
	const restoredSceneTitle = writerSession?.activeSceneId
		? structureScenes.find(scene => scene.id === writerSession.activeSceneId)?.title
		: undefined;
	const restoredPosition = writerSession?.cursor
		? [
				restoredSceneTitle,
				`第 ${writerSession.cursor.line} 段`
			].filter(Boolean).join(' · ')
		: restoredSceneTitle;
	const lastEditedLabel = writerSession?.updatedAt
		? new Intl.DateTimeFormat('zh-CN', {
				month: 'numeric',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(writerSession.updatedAt))
		: undefined;
	const nextStep = !model
		? undefined
		: !model.recentChapter
			? {
				title: '建立可写的故事结构',
				description: '先确定故事核心和章节，再进入第一场正文。',
				label: '前往规划',
				run: () => openCreationJourney(journeyAvailable ? undefined : 'genre')
			}
			: model.totalWords === 0
				? {
					title: '写下第一场',
					description: '章节已经就绪，从当前目标开始写第一段。',
					label: '打开当前章节',
					run: () => openChapter(model.recentChapter)
				}
				: model.pendingTotal > 0
					? {
						title: '整理并检查本章',
						description: `${model.pendingTotal} 项内容等待确认，正文不会被自动修改。`,
						label: '查看待处理事项',
						run: () => setMode('review')
					}
					: {
						title: '规划下一场',
						description: '当前内容已安全保存，可以继续推进故事结构。',
						label: '打开故事规划',
						run: () => setMode('planning')
					};

	return (
		<main
			className="story-dashboard"
			aria-label="写作首页"
			aria-busy={!model}
		>
			<header className="dashboard-header">
				<div>
					<span className="dashboard-eyebrow">WRITING HOME</span>
					<h1>{snapshot.project.title}</h1>
					<p>继续当前任务；只在需要时打开规划、资料和检查。</p>
					{kernelLoadWarning && (
						<p className="dashboard-load-warning" role="status">
							部分故事资料暂时无法读取；章节写作与导航仍可继续。
						</p>
					)}
				</div>
				<DailyWritingGoalControl placement="dashboard" />
			</header>

			<section className="dashboard-card dashboard-continue" aria-labelledby="dashboard-continue-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><BookOpenText size={18} /></span>
					<div><span>CONTINUE</span><h2 id="dashboard-continue-title">继续写作</h2></div>
				</div>
				{model ? (
					model.recentChapter ? (
						<>
							<strong className="dashboard-primary-value">{model.recentChapter.title}</strong>
							<p>{model.recentChapter.scene.location || '尚未设置地点'} · {model.recentChapter.scene.pov || '尚未设置视角'}</p>
							<div className="dashboard-restore-meta" aria-label="上次写作会话">
								{restoredPosition && <span>{restoredPosition}</span>}
								{lastEditedLabel && <span>上次编辑 {lastEditedLabel}</span>}
								<span>已保存</span>
							</div>
							{sessionRestoreNotice && (
								<p className="dashboard-restore-notice" role="status">{sessionRestoreNotice}</p>
							)}
							<div className="dashboard-actions">
								<button type="button" onClick={() => openChapter(model.recentChapter)}>
									继续上次位置<ArrowRight size={16} />
								</button>
								<button type="button" className="secondary" onClick={() => openChapter(model.recentChapter)}>
									查看当前场景
								</button>
								<button type="button" className="secondary" onClick={() => setMode('planning')}>
									打开作品全貌
								</button>
							</div>
						</>
					) : (
						<div className="dashboard-empty-copy">
							<strong>还没有章节</strong>
							<span>{journeyAvailable ? '你的创作旅程已经保存在项目中。' : '从题材或故事设想开始，不需要先建立完整资料库。'}</span>
							<button
								type="button"
								data-testid="story-dashboard-creation-journey"
								onClick={() => openCreationJourney(journeyAvailable ? undefined : 'genre')}
							>
								<Sparkles size={16} />{journeyAvailable ? '继续创作旅程' : '根据题材规划故事'}
							</button>
						</div>
					)
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-current" aria-labelledby="dashboard-current-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><Target size={18} /></span>
					<div><span>CURRENT TASK</span><h2 id="dashboard-current-title">当前章节</h2></div>
				</div>
				{model ? (
					model.recentChapter ? (
						<dl className="dashboard-task-list">
							<div><dt>目标</dt><dd>{model.recentChapter.scene.goal || '尚未设置'}</dd></div>
							<div><dt>地点</dt><dd>{model.recentChapter.scene.location || '尚未设置'}</dd></div>
							<div><dt>视角</dt><dd>{model.recentChapter.scene.pov || '尚未设置'}</dd></div>
						</dl>
					) : <span className="dashboard-recent-empty">建立章节后，这里会显示当前写作任务。</span>
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-next" aria-labelledby="dashboard-next-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><Compass size={18} /></span>
					<div><span>NEXT</span><h2 id="dashboard-next-title">下一步任务</h2></div>
				</div>
				{nextStep ? (
					<div className="dashboard-next-task">
						<strong>{nextStep.title}</strong>
						<p>{nextStep.description}</p>
						<button
							type="button"
							className="dashboard-text-action"
							data-testid="story-dashboard-next-step"
							onClick={nextStep.run}
						>
							{nextStep.label}<ArrowRight size={16} />
						</button>
					</div>
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-review" aria-labelledby="dashboard-review-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><ListChecks size={18} /></span>
					<div><span>ATTENTION</span><h2 id="dashboard-review-title">待处理审校</h2></div>
				</div>
				{model ? (
					<>
						<strong className={`dashboard-pending-total ${model.pendingTotal ? 'has-items' : ''}`}>
							{model.pendingTotal ? <Clock3 size={20} /> : <CheckCircle2 size={20} />}
							{pendingLabel}
						</strong>
						<div className="dashboard-review-counts">
							<span>审校 {model.openReviewIssues}</span>
							<span>逾期伏笔 {model.overdueForeshadowing}</span>
							<span>待确认事实 {model.pendingFacts}</span>
						</div>
						<button type="button" className="dashboard-text-action" onClick={() => setMode('review')}>
							打开审校中心<ArrowRight size={16} />
						</button>
					</>
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-recent" aria-labelledby="dashboard-recent-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><Sparkles size={18} /></span>
					<div><span>RECENT</span><h2 id="dashboard-recent-title">最近活动</h2></div>
				</div>
				{model ? (
					model.recentChapters.length ? (
						<ul className="dashboard-recent-list">
							{model.recentChapters.map(chapter => (
								<li key={chapter.id}>
									<button
										type="button"
										data-testid="story-dashboard-recent-chapter"
										onClick={() => openChapter(chapter)}
									>
										<FileText size={18} />
										<span><strong>{chapter.title}</strong><small>{chapter.scene.location || '未设置场景'}</small></span>
										<em>{(snapshot.wordCounts[chapter.id] ?? 0).toLocaleString()} 字</em>
										<ArrowRight size={16} />
									</button>
								</li>
							))}
						</ul>
					) : <span className="dashboard-recent-empty">写下第一章后，最近活动会出现在这里。</span>
				) : <LoadingLines />}
			</section>
		</main>
	);
}
