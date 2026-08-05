import {
	AlertTriangle,
	CheckCircle2,
	GitBranch,
	Search,
	Unlink
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
	PlotThread,
	StoryScene
} from '@writing-buddy/story-kernel';
import type { AiChapterSource } from '../ai-context/AiChapterSource';
import {
	buildScenePlotGrid,
	filterScenePlotGridRows,
	type ScenePlotGridFilter,
	type ScenePlotLinkHealth
} from './ScenePlotGridModel';

const filters: readonly {
	readonly id: ScenePlotGridFilter;
	readonly label: string;
}[] = [
	{ id: 'all', label: '全部场景' },
	{ id: 'unlinked', label: '未关联' },
	{ id: 'incomplete', label: '节拍待补' },
	{ id: 'needs-sync', label: '关联待同步' }
];

const statusLabels: Readonly<Record<PlotThread['status'], string>> = {
	planned: '计划',
	active: '活跃',
	'at-risk': '风险',
	resolved: '已解决',
	abandoned: '已放弃'
};

const healthLabels: Readonly<Record<ScenePlotLinkHealth, string>> = {
	reciprocal: '关联正常',
	'scene-only': '仅场景记录，待同步',
	'thread-only': '仅剧情线记录，待同步'
};

export function ScenePlotGrid({
	scenes,
	threads,
	chapters,
	selectedSceneId,
	onSelectScene
}: {
	readonly scenes: readonly StoryScene[];
	readonly threads: readonly PlotThread[];
	readonly chapters: readonly AiChapterSource[];
	readonly selectedSceneId?: string;
	readonly onSelectScene: (scene: StoryScene) => void;
}): React.JSX.Element {
	const [filter, setFilter] = useState<ScenePlotGridFilter>('all');
	const [query, setQuery] = useState('');
	const searchInputRef = useRef<HTMLInputElement>(null);
	const model = useMemo(
		() => buildScenePlotGrid(scenes, threads, chapters),
		[chapters, scenes, threads]
	);
	const rows = useMemo(
		() => filterScenePlotGridRows(model.rows, filter, query),
		[filter, model.rows, query]
	);
	const hasDataQualityIssue = model.oneSidedLinkCount > 0
		|| model.danglingThreadSceneLinkCount > 0;

	return (
		<section className="scene-plot-grid-shell" aria-label="场景情节网格">
		<header className="scene-plot-grid-summary">
			<div>
				<span><strong>{model.rows.length}</strong> 个场景</span>
				<span><strong>{model.threads.length}</strong> 条剧情线</span>
				<span><strong>{model.reciprocalLinkCount}</strong> 个有效推进</span>
				<span className={model.unlinkedSceneCount ? 'is-warning' : ''}>
					<strong>{model.unlinkedSceneCount}</strong> 个未关联
				</span>
			</div>
			<p className={hasDataQualityIssue ? 'is-warning' : ''}>
				{hasDataQualityIssue ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
				{hasDataQualityIssue
					? `${model.oneSidedLinkCount + model.danglingThreadSceneLinkCount} 处关联需要同步；网格只展示，不会自动改写资料。`
					: '场景与剧情线关联一致；网格只展示，不会自动改写资料。'}
			</p>
		</header>

		<div className="scene-plot-grid-controls">
			<label>
				<Search size={16} />
				<span className="sr-only">搜索场景网格</span>
				<input
					ref={searchInputRef}
					data-testid="scene-plot-grid-search"
					type="search"
					value={query}
					placeholder="搜索章节、场景或剧情线"
					onChange={event => setQuery(event.target.value)}
				/>
			</label>
			<div role="group" aria-label="筛选场景">
				{filters.map(item => (
					<button
						key={item.id}
						type="button"
						data-testid="scene-plot-grid-filter"
						data-filter={item.id}
						aria-pressed={filter === item.id}
						className={filter === item.id ? 'is-active' : ''}
						onClick={() => setFilter(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
		</div>

		{model.rows.length === 0 ? (
			<div className="scene-plot-grid-empty">
				<GitBranch size={28} />
				<strong>还没有可映射的场景</strong>
				<p>先在故事结构中创建场景；场景与剧情线建立关联后会自动出现在这里。</p>
			</div>
		) : rows.length === 0 ? (
			<div className="scene-plot-grid-empty">
				<Search size={28} />
				<strong>当前条件下没有场景</strong>
				<button type="button" onClick={() => {
					setFilter('all');
					setQuery('');
					searchInputRef.current?.focus();
				}}>清除筛选</button>
			</div>
		) : (
			<div className="scene-plot-grid-scroll">
				<table className="scene-plot-grid" aria-label="场景与剧情线关联表">
					<thead>
						<tr>
							<th scope="col">章节与场景</th>
							{model.threads.map(thread => (
								<th scope="col" key={thread.id}>
									<strong>{thread.title}</strong>
									<small>{statusLabels[thread.status]}</small>
								</th>
							))}
							{model.threads.length === 0 ? <th scope="col">剧情线</th> : null}
						</tr>
					</thead>
					<tbody>
						{rows.map(row => (
							<tr key={row.scene.id} className={selectedSceneId === row.scene.id ? 'is-selected' : ''}>
								<th scope="row">
									<button
										type="button"
										data-testid="scene-plot-grid-scene"
										data-scene-id={row.scene.id}
										aria-label={`查看场景节拍：${row.scene.title}`}
										onClick={() => onSelectScene(row.scene)}
									>
										<small>{row.chapter?.title ?? '章节待修复'} · 场景 {row.sceneNumber}</small>
										<strong>{row.scene.title}</strong>
										<span><b>目标</b>{row.scene.goal ?? '待补充'}</span>
										<span><b>冲突</b>{row.scene.conflict ?? '待补充'}</span>
										{row.unknownThreadIds.length ? (
							<em><AlertTriangle size={16} />{row.unknownThreadIds.length} 个未知剧情线引用</em>
										) : null}
									</button>
								</th>
								{model.threads.map(thread => {
									const link = row.links.find(candidate => candidate.thread.id === thread.id);
									return (
										<td key={thread.id}>
											{link ? (
												<button
													type="button"
													data-testid="scene-plot-grid-link"
													data-scene-id={row.scene.id}
													data-thread-id={thread.id}
													data-link-health={link.health}
													className={`scene-plot-link is-${link.health}`}
													aria-label={`${row.scene.title}推进${thread.title}：${healthLabels[link.health]}`}
													onClick={() => onSelectScene(row.scene)}
												>
													{link.health === 'reciprocal' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
													<strong>推进</strong>
													<small>{link.health === 'reciprocal' ? '已关联' : '待同步'}</small>
												</button>
											) : <span className="scene-plot-no-link" aria-label={`${row.scene.title}未推进${thread.title}`}>—</span>}
										</td>
									);
								})}
								{model.threads.length === 0 ? (
									<td><span className="scene-plot-no-thread"><Unlink size={16} />尚未创建剧情线</span></td>
								) : null}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)}
		<footer className="scene-plot-grid-key">
			<span><CheckCircle2 size={16} />双向关联</span>
			<span><AlertTriangle size={16} />单向记录，待同步</span>
			<span>— 未推进</span>
		</footer>
		</section>
	);
}
