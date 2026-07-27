import {
	AlertTriangle,
	ArrowRightLeft,
	Box,
	History,
	MapPin,
	PackageOpen,
	UserRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	getItemStateAt,
	parseItemState,
	parseStoryItem,
	runItemRules,
	type ItemState,
	type StoryItem
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { ItemTransferDialog } from './ItemTransferDialog';
import './StoryAssetsPage.css';

export interface StoryAssetsData {
	readonly items: readonly StoryItem[];
	readonly states: readonly ItemState[];
	readonly stateHash?: string;
}

export type StoryAssetsLoader = (projectRoot: string) => Promise<StoryAssetsData>;

const statePath = 'story/states/item-states.json';
const defaultLoadData: StoryAssetsLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const items = (await repository.list('item')).map(value => parseStoryItem(value as never));
	try {
		const file = await desktopBridge.readText(projectRoot, statePath);
		const json = JSON.parse(file.content) as unknown;
		return {
			items,
			states: Array.isArray(json) ? json.map(value => parseItemState(value as never)) : [],
			stateHash: file.hash
		};
	} catch {
		return { items, states: [] };
	}
};

export function StoryAssetsPage({
	projectRoot,
	loadData = defaultLoadData
}: {
	readonly projectRoot?: string;
	readonly loadData?: StoryAssetsLoader;
}): React.JSX.Element {
	const [data, setData] = useState<StoryAssetsData>();
	const [selectedId, setSelectedId] = useState<string>();
	const [search, setSearch] = useState('');
	const [order, setOrder] = useState(0);
	const [transferOpen, setTransferOpen] = useState(false);
	const [error, setError] = useState<string>();

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ items: [], states: [] });
			return;
		}
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => current ?? loaded.items[0]?.id);
			setOrder(loaded.states.reduce((maximum, state) => Math.max(maximum, state.effectiveFrom.narrativeOrder), 0));
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '物品资料读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const filtered = useMemo(() => (data?.items ?? []).filter(item => (
		`${item.title} ${item.itemType ?? ''} ${item.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())
	)), [data?.items, search]);
	const selected = data?.items.find(item => item.id === selectedId);
	const current = selected ? getItemStateAt(data?.states ?? [], selected.id, order) : undefined;
	const history = (data?.states ?? [])
		.filter(state => state.itemId === selectedId)
		.sort((left, right) => right.effectiveFrom.narrativeOrder - left.effectiveFrom.narrativeOrder);
	const issues = useMemo(() => runItemRules(data?.items ?? [], data?.states ?? []), [data]);

	const commitTransfer = async (state: ItemState) => {
		if (!projectRoot || !data) return;
		const nextStates = [...data.states, state];
		const result = await desktopBridge.writeTextAtomic({
			projectRoot,
			relativePath: statePath,
			content: `${JSON.stringify(nextStates, undefined, 2)}\n`,
			expectedHash: data.stateHash ?? '',
			eol: 'lf',
			hasBom: false,
			...(data.stateHash ? {} : { force: true })
		});
		setData({ ...data, states: nextStates, stateHash: result.hash });
		setOrder(Math.max(order, state.effectiveFrom.narrativeOrder));
		setTransferOpen(false);
	};

	return (
		<main className="story-assets-page" aria-label="物品与叙事资产">
			<aside className="story-assets-list">
				<header><div><span className="eyebrow">STORY ASSETS</span><h1>物品与资产</h1></div><span>{filtered.length}</span></header>
				<label><span className="sr-only">搜索物品</span><input aria-label="搜索物品" value={search} onChange={event => setSearch(event.target.value)} placeholder="名称、类型或标签" /></label>
				<div>
					{filtered.map(item => (
						<button type="button" key={item.id} className={selectedId === item.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}>
							<Box size={18} /><span><strong>{item.title}</strong><small>{item.unique ? '唯一物品' : item.itemType ?? '叙事资产'}</small></span>
						</button>
					))}
				</div>
			</aside>
			<section className="story-assets-detail">
				<header>
					<div><span className="eyebrow">OWNERSHIP & CONDITION</span><h2>{selected?.title ?? '选择物品'}</h2><p>{selected?.description ?? selected?.summary ?? '追踪获得、转移、使用、丢失与销毁。'}</p></div>
					<label><span>叙事位置</span><input type="number" aria-label="物品叙事位置" min={0} value={order} onChange={event => setOrder(Number(event.target.value))} /></label>
					<button type="button" disabled={!selected} onClick={() => setTransferOpen(true)}><ArrowRightLeft size={16} />记录转移</button>
				</header>
				<div className="story-assets-messages">
					{error ? <div role="alert"><AlertTriangle size={16} />{error}</div> : null}
					{issues.length ? <div role="status"><AlertTriangle size={16} />{issues.length} 条物品一致性问题</div> : null}
				</div>
				{selected ? (
					<div className="story-assets-content">
						<section className="asset-current-grid">
							<article><UserRound size={18} /><span>当前持有人</span><strong>{current?.holderCharacterId ?? '未指定'}</strong></article>
							<article><MapPin size={18} /><span>当前位置</span><strong>{current?.locationId ?? '未指定'}</strong></article>
							<article><PackageOpen size={18} /><span>数量 / 状态</span><strong>{current?.quantity ?? 0} {selected.quantityUnit ?? ''} · {current?.condition ?? '正常'}</strong></article>
						</section>
						<section className="asset-story-function">
							<h3>剧情作用与限制</h3>
							<p>{selected.plotFunction ?? '尚未定义剧情作用。'}</p>
							<div>{selected.restrictions.map(restriction => <span key={restriction}>{restriction}</span>)}</div>
						</section>
						<section className="asset-history">
							<header><History size={17} /><h3>流转历史</h3><span>{history.length}</span></header>
							{history.map(state => (
								<article key={state.id}>
									<span className={`asset-action is-${state.action}`}>{state.action}</span>
									<div><strong>{state.holderCharacterId ?? '无持有人'} · {state.quantity} {selected.quantityUnit ?? ''}</strong><small>叙事位置 {state.effectiveFrom.narrativeOrder} · {state.locationId ?? '未指定地点'}</small></div>
									<em>{state.confirmation === 'confirmed' ? '作者确认' : '待确认'}</em>
								</article>
							))}
						</section>
					</div>
				) : <div className="story-assets-empty"><PackageOpen size={38} />还没有物品资源</div>}
			</section>
			{transferOpen && selected ? <ItemTransferDialog item={selected} current={current} onCancel={() => setTransferOpen(false)} onCommit={commitTransfer} /> : null}
		</main>
	);
}
