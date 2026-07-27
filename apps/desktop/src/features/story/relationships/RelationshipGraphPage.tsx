import {
	AlertTriangle,
	Focus,
	GitBranch,
	Grid3X3,
	Network,
	RotateCcw,
	Sparkles
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	parseRelationship,
	parseStoryPosition,
	type Character,
	type Relationship
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { RelationshipInspector } from './RelationshipInspector';
import { RelationshipMatrix } from './RelationshipMatrix';
import { RelationshipAiPanel } from './RelationshipAiPanel';
import type {
	RelationshipReviewBatch,
	RelationshipReviewCandidate
} from './RelationshipAiReviewService';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import {
	circularGraphLayout,
	filterRelationshipsAt,
	RelationshipService,
	type RelationshipGraphViewModel
} from './RelationshipService';
import './RelationshipGraphPage.css';

export interface RelationshipPageData {
	readonly characters: readonly Character[];
	readonly relationships: readonly Relationship[];
}

export type RelationshipPageLoader = (projectRoot: string) => Promise<RelationshipPageData>;

const defaultLoadData: RelationshipPageLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [characters, relationships] = await Promise.all([
		repository.list('character'),
		repository.list('relationship')
	]);
	return {
		characters: characters as unknown as readonly Character[],
		relationships: relationships.map(value => parseRelationship(
			value as unknown as Parameters<typeof parseRelationship>[0]
		))
	};
};

function maximumPosition(relationships: readonly Relationship[]): number {
	return relationships.reduce((maximum, relationship) => (
		Math.max(maximum, relationship.effectiveFrom.narrativeOrder)
	), 0);
}

function RelationshipGraph({
	model,
	selectedId,
	onSelect,
	selectedRelationshipId,
	onSelectRelationship,
	pendingCandidates,
	selectedPendingId,
	onSelectPending
}: {
	readonly model: RelationshipGraphViewModel;
	readonly selectedId?: string;
	readonly onSelect: (id: string) => void;
	readonly selectedRelationshipId?: string;
	readonly onSelectRelationship: (id: string) => void;
	readonly pendingCandidates: readonly RelationshipReviewCandidate[];
	readonly selectedPendingId?: string;
	readonly onSelectPending: (id: string) => void;
}): React.JSX.Element {
	const [positions, setPositions] = useState(() => circularGraphLayout(model.nodes));

	useEffect(() => {
		if (typeof Worker === 'undefined') {
			const timer = window.setTimeout(() => setPositions(circularGraphLayout(model.nodes)), 0);
			return () => window.clearTimeout(timer);
		}
		const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = event => setPositions(event.data as typeof positions);
		worker.postMessage({ nodes: model.nodes, width: 760, height: 680 });
		return () => worker.terminate();
	}, [model.nodes]);

	return (
		<div className="relationship-graph-canvas" aria-label="人物关系图">
			<svg viewBox="0 0 760 680" role="img" aria-label={`${model.nodes.length} 个人物，${model.edges.length} 条有向关系`}>
				<defs>
					<marker id="relationship-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
						<path d="M 0 0 L 10 5 L 0 10 z" />
					</marker>
					<marker id="relationship-candidate-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
						<path d="M 0 0 L 10 5 L 0 10 z" />
					</marker>
				</defs>
				{model.edges.map(edge => {
					const source = positions[edge.source];
					const target = positions[edge.target];
					return source && target ? (
						<g
							key={edge.id}
							role="button"
							tabIndex={0}
							aria-label={`${edge.label}关系，选择查看来源`}
							className={selectedRelationshipId === edge.id ? 'is-active' : ''}
							onClick={() => onSelectRelationship(edge.id)}
							onKeyDown={event => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onSelectRelationship(edge.id);
								}
							}}
						>
							<line
								x1={source.x}
								y1={source.y}
								x2={target.x}
								y2={target.y}
								strokeWidth={1 + edge.strength * 3}
								markerEnd="url(#relationship-arrow)"
							/>
							<text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 6}>{edge.label}</text>
						</g>
					) : null;
				})}
				{pendingCandidates.map(candidate => {
					const source = positions[candidate.sourceCharacterId];
					const target = positions[candidate.targetCharacterId];
					if (!source || !target) return null;
					const length = Math.hypot(target.x - source.x, target.y - source.y) || 1;
					const offsetX = -(target.y - source.y) / length * 10;
					const offsetY = (target.x - source.x) / length * 10;
					const x1 = source.x + offsetX;
					const y1 = source.y + offsetY;
					const x2 = target.x + offsetX;
					const y2 = target.y + offsetY;
					return (
						<g
							key={candidate.id}
							role="button"
							tabIndex={0}
							aria-label={`AI 候选关系：${candidate.sourceTitle}到${candidate.targetTitle}，${candidate.relationshipType}`}
							className={`is-ai-candidate ${selectedPendingId === candidate.id ? 'is-active' : ''}`}
							onClick={() => onSelectPending(candidate.id)}
							onKeyDown={event => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									onSelectPending(candidate.id);
								}
							}}
						>
							<line
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								strokeWidth={1 + candidate.strength * 2}
								markerEnd="url(#relationship-candidate-arrow)"
							/>
							<text
								x={(x1 + x2) / 2 + offsetX * 1.5}
								y={(y1 + y2) / 2 + offsetY * 1.5}
							>
								AI · {candidate.relationshipType}
							</text>
						</g>
					);
				})}
			</svg>
			{model.nodes.map(node => {
				const point = positions[node.id];
				return point ? (
					<button
						type="button"
						key={node.id}
						style={{ left: `${point.x / 7.6}%`, top: `${point.y / 6.8}%` }}
						className={selectedId === node.id ? 'is-active' : ''}
						onClick={() => onSelect(node.id)}
					>
						<span>{node.label.slice(0, 1)}</span>
						<strong>{node.label}</strong>
					</button>
				) : null;
			})}
		</div>
	);
}

interface RelationshipGraphPageProps {
	readonly projectRoot?: string;
	readonly loadData?: RelationshipPageLoader;
	readonly chapters?: readonly AiChapterSource[];
	readonly onOpenEvidence?: OpenAiEvidence;
	readonly readOnly?: boolean;
}

export function RelationshipGraphPage({
	projectRoot,
	loadData = defaultLoadData,
	chapters = [],
	onOpenEvidence,
	readOnly = false
}: RelationshipGraphPageProps): React.JSX.Element {
	const [data, setData] = useState<RelationshipPageData>();
	const [error, setError] = useState<string>();
	const [view, setView] = useState<'graph' | 'matrix'>('graph');
	const [narrativeOrder, setNarrativeOrder] = useState(0);
	const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>();
	const [focusCharacterId, setFocusCharacterId] = useState<string>();
	const [saving, setSaving] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);
	const [aiBatch, setAiBatch] = useState<RelationshipReviewBatch>();
	const [selectedPendingId, setSelectedPendingId] = useState<string>();

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ characters: [], relationships: [] });
			return;
		}
		setError(undefined);
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setNarrativeOrder(maximumPosition(loaded.relationships));
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : '关系资料读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const position = useMemo(() => parseStoryPosition({
		chapterId: 'chapter:relationship-slice',
		narrativeOrder
	}), [narrativeOrder]);
	const visibleRelationships = useMemo(() => filterRelationshipsAt(
		data?.relationships ?? [],
		position
	), [data, position]);
	const service = useMemo(() => (
		new RelationshipService(new DesktopStoryRepository(projectRoot ?? '', desktopBridge))
	), [projectRoot]);
	const graph = useMemo(() => service.buildGraphViewModel(
		data?.characters ?? [],
		visibleRelationships,
		{ ...(focusCharacterId ? { focusCharacterId } : {}), hops: 2 }
	), [data, focusCharacterId, service, visibleRelationships]);
	const selectedRelationship = visibleRelationships.find(
		relationship => relationship.id === selectedRelationshipId
	);
	const pendingCandidates = aiBatch?.candidates.filter(
		candidate => candidate.status === 'candidate'
	) ?? [];

	const saveRelationship = async (relationship: Relationship) => {
		if (!projectRoot) {
			return;
		}
		setSaving(true);
		try {
			const saved = await service.upsertRelationship(relationship);
			setData(current => current ? {
				...current,
				relationships: current.relationships.map(candidate => (
					candidate.id === saved.id ? saved : candidate
				))
			} : current);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : '关系保存失败。');
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="relationship-page" aria-label="人物关系">
			<header className="relationship-header">
				<div><span className="eyebrow">RELATIONSHIP INTELLIGENCE</span><h1>人物关系</h1><p>有向关系 · 叙事位置 {narrativeOrder} · {visibleRelationships.length} 条有效关系</p></div>
				<div className="relationship-toolbar">
					<div role="tablist" aria-label="关系视图">
						<button type="button" role="tab" aria-selected={view === 'graph'} className={view === 'graph' ? 'is-active' : ''} onClick={() => setView('graph')}><Network size={16} />关系图</button>
						<button type="button" role="tab" aria-selected={view === 'matrix'} className={view === 'matrix' ? 'is-active' : ''} onClick={() => setView('matrix')}><Grid3X3 size={16} />关系矩阵</button>
					</div>
					<label>
						<span>叙事位置</span>
						<input
							type="number"
							min={0}
							aria-label="叙事位置"
							value={narrativeOrder}
							onChange={event => setNarrativeOrder(Math.max(0, Number(event.target.value)))}
						/>
					</label>
					{focusCharacterId ? (
						<button type="button" className="relationship-reset-focus" onClick={() => setFocusCharacterId(undefined)}><RotateCcw size={15} />显示全部</button>
					) : null}
					<button type="button" className="relationship-ai-button" onClick={() => setAiOpen(true)}>
						<Sparkles size={16} />AI 关系助手
					</button>
				</div>
			</header>
			<div className="relationship-messages">
				{error ? <div className="relationship-error" role="alert"><AlertTriangle size={18} />{error}<button type="button" onClick={() => void reload()}>重试</button></div> : null}
				{graph.omittedNodes || graph.omittedEdges ? (
					<div className="relationship-limit" role="status">
						<Focus size={15} />为保持流畅，已省略 {graph.omittedNodes} 个节点和 {graph.omittedEdges} 条关系；请聚焦人物或缩小筛选。
					</div>
				) : null}
			</div>
			<section className={`relationship-workspace is-${view}`}>
				<div className="relationship-primary-view">
					{!data ? (
						<div className="relationship-loading">正在构建关系视图…</div>
					) : view === 'matrix' ? (
						<RelationshipMatrix
							characters={data.characters}
							relationships={visibleRelationships}
							selectedId={selectedRelationshipId}
							onSelect={relationship => setSelectedRelationshipId(relationship.id)}
						/>
					) : (
						<RelationshipGraph
							model={graph}
							selectedId={focusCharacterId}
							onSelect={setFocusCharacterId}
							selectedRelationshipId={selectedRelationshipId}
							onSelectRelationship={setSelectedRelationshipId}
							pendingCandidates={pendingCandidates}
							selectedPendingId={selectedPendingId}
							onSelectPending={candidateId => {
								setSelectedPendingId(candidateId);
								setAiOpen(true);
							}}
						/>
					)}
				</div>
				{view === 'graph' || selectedRelationship ? (
					<RelationshipInspector
						relationship={selectedRelationship}
						characters={data?.characters ?? []}
						saving={saving}
						onSave={saveRelationship}
					/>
				) : null}
			</section>
			<div className="relationship-direction-legend"><GitBranch size={14} />箭头从关系发起者指向目标；反向关系单独记录。</div>
			{aiOpen && projectRoot ? (
				<RelationshipAiPanel
					projectRoot={projectRoot}
					chapters={chapters}
					characters={data?.characters ?? []}
					relationships={data?.relationships ?? []}
					readOnly={readOnly}
					selectedCandidateId={selectedPendingId}
					onClose={() => setAiOpen(false)}
					onBatchChange={next => {
						setAiBatch(next);
						if (!next?.candidates.some(candidate => candidate.id === selectedPendingId)) {
							setSelectedPendingId(undefined);
						}
					}}
					onOpenEvidence={onOpenEvidence}
					onAccepted={relationship => {
						setData(current => {
							if (!current) return current;
							const exists = current.relationships.some(candidate => candidate.id === relationship.id);
							return {
								...current,
								relationships: exists
									? current.relationships.map(candidate => (
										candidate.id === relationship.id ? relationship : candidate
									))
									: [...current.relationships, relationship]
							};
						});
						setSelectedRelationshipId(relationship.id);
					}}
				/>
			) : null}
		</main>
	);
}
