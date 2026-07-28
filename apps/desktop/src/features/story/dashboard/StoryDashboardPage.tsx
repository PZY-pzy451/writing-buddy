import {
	ArrowRight,
	BookOpenText,
	CalendarDays,
	CheckCircle2,
	Clock3,
	FileText,
	Flag,
	ListChecks,
	Plus,
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
	const openResource = useAppStore(state => state.openResource);
	const openStoryResource = useAppStore(state => state.openStoryResource);
	const setMode = useAppStore(state => state.setMode);
	const setError = useAppStore(state => state.setError);
	const [kernelState, setKernelState] = useState<{
		readonly projectRoot: string;
		readonly data: DashboardKernelLoad;
	}>();

	useEffect(() => {
		if (!snapshot) {
			return;
		}
		let cancelled = false;
		void loadKernelData(snapshot.root).then(result => {
			if (!cancelled) {
				setKernelState({ projectRoot: snapshot.root, data: result });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [loadKernelData, snapshot]);

	const kernel = kernelState && snapshot && kernelState.projectRoot === snapshot.root
		? kernelState.data
		: undefined;
	const model = useMemo(() => (
		snapshot && kernel ? selectStoryDashboardModel(snapshot, issues, kernel) : undefined
	), [issues, kernel, snapshot]);

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

	return (
		<main
			className="story-dashboard"
			aria-label="作品仪表盘"
			aria-busy={!model}
		>
			<header className="dashboard-header">
				<div>
					<span className="dashboard-eyebrow">STORYFORGE OVERVIEW</span>
					<h1>{snapshot.project.title}</h1>
					<p>从故事全局继续写作，关注真正需要推进和确认的内容。</p>
				</div>
				<div className="dashboard-project-meta">
					<span>{model?.chapterCount ?? '—'} 章</span>
					<span>{model?.totalWords.toLocaleString() ?? '—'} 字</span>
				</div>
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
							<div className="dashboard-actions">
								<button type="button" onClick={() => openChapter(model.recentChapter)}>
									继续写作<ArrowRight size={16} />
								</button>
								<button type="button" className="secondary" onClick={() => openChapter(model.recentChapter)}>
									打开章节计划
								</button>
							</div>
						</>
					) : (
						<div className="dashboard-empty-copy">
							<strong>还没有章节</strong>
							<button type="button" onClick={() => openChapter(undefined)}><Plus size={16} />创建第一章</button>
						</div>
					)
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-today" aria-labelledby="dashboard-today-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><CalendarDays size={18} /></span>
					<div><span>PROGRESS</span><h2 id="dashboard-today-title">今日目标</h2></div>
				</div>
				{model ? (
					<div className="dashboard-stat-grid">
						<div><strong>{model.totalWords.toLocaleString()}</strong><span>项目总字数</span></div>
						<div><strong>{model.chapterCount}</strong><span>章节</span></div>
						<div><strong>{snapshot.readOnly ? '只读' : '可写'}</strong><span>项目状态</span></div>
					</div>
				) : <LoadingLines />}
			</section>

			<section className="dashboard-card dashboard-plot" aria-labelledby="dashboard-plot-title">
				<div className="dashboard-card-heading">
					<span className="dashboard-card-icon"><Flag size={18} /></span>
					<div><span>NARRATIVE</span><h2 id="dashboard-plot-title">活跃剧情线</h2></div>
				</div>
				{!model ? <LoadingLines /> : kernel?.plotError ? (
					<div className="dashboard-card-error"><strong>剧情线暂时无法读取</strong><span>其他卡片仍可正常使用。</span></div>
				) : model.activePlotThreads.length ? (
					<ul className="dashboard-compact-list">
						{model.activePlotThreads.slice(0, 3).map(thread => (
							<li key={thread.id}>
								<button
									type="button"
									onClick={() => void openStoryResource({ type: 'plotThread', id: thread.id })}
								>
									<span>{thread.title}</span><ArrowRight size={16} />
								</button>
							</li>
						))}
					</ul>
				) : (
					<div className="dashboard-empty-copy">
						<strong>还没有活跃剧情线</strong>
						<span>建立主线后，这里会显示最近推进和风险。</span>
						<button type="button" onClick={() => setError('剧情线创建器将在后续 Gate 开放。')}>
							<Plus size={16} />创建剧情线
						</button>
					</div>
				)}
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
									<button type="button" onClick={() => openChapter(chapter)}>
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
