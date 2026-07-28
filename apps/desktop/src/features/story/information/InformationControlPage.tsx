import { AlertTriangle, BotOff, Eye, EyeOff, KeyRound, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	parseKnowledgeState,
	parseStoryInformation,
	runInformationRules,
	type Character,
	type KnowledgeState,
	type StoryInformation
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { AppEmptyState } from '../../shared/presentation/AppEmptyState';
import { KnowledgeMatrix } from './KnowledgeMatrix';
import './InformationControlPage.css';

export interface InformationControlData {
	readonly information: readonly StoryInformation[];
	readonly characters: readonly Character[];
	readonly states: readonly KnowledgeState[];
}

export type InformationControlLoader = (projectRoot: string) => Promise<InformationControlData>;
const statePath = 'story/states/knowledge-states.json';

const defaultLoadData: InformationControlLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [information, characters] = await Promise.all([repository.list('information'), repository.list('character')]);
	let states: readonly KnowledgeState[] = [];
	try {
		const file = await desktopBridge.readText(projectRoot, statePath);
		const json = JSON.parse(file.content) as unknown;
		states = Array.isArray(json) ? json.map(value => parseKnowledgeState(value as never)) : [];
	} catch {
		// Knowledge history is optional for migrated projects.
	}
	return {
		information: information.map(value => parseStoryInformation(value as never)),
		characters: characters as unknown as readonly Character[],
		states
	};
};

export function InformationControlPage({
	projectRoot,
	loadData = defaultLoadData
}: {
	readonly projectRoot?: string;
	readonly loadData?: InformationControlLoader;
}): React.JSX.Element {
	const [data, setData] = useState<InformationControlData>();
	const [selectedId, setSelectedId] = useState<string>();
	const [search, setSearch] = useState('');
	const [filter, setFilter] = useState<'all' | 'secret' | 'revealed'>('all');
	const [narrativeOrder, setNarrativeOrder] = useState(0);
	const [error, setError] = useState<string>();

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ information: [], characters: [], states: [] });
			return;
		}
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => current ?? loaded.information[0]?.id);
			setNarrativeOrder(loaded.states.reduce((maximum, state) => Math.max(maximum, state.effectiveFrom.narrativeOrder), 0));
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '信息权限资料读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const filtered = useMemo(() => (data?.information ?? []).filter(fact => {
		const matchesText = `${fact.title} ${fact.truthStatement} ${fact.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
		const matchesFilter = filter === 'all'
			|| (filter === 'secret' && fact.authorSecret)
			|| (filter === 'revealed' && (fact.readerRevealAt?.narrativeOrder ?? Number.POSITIVE_INFINITY) <= narrativeOrder);
		return matchesText && matchesFilter;
	}), [data?.information, filter, narrativeOrder, search]);
	const selected = data?.information.find(fact => fact.id === selectedId);
	const issues = useMemo(() => runInformationRules(data?.information ?? []), [data?.information]);

	return (
		<section className="information-control-page">
			<aside className="information-fact-list">
				<header><div><span className="eyebrow">STORY TRUTH</span><h1>信息权限</h1></div><KeyRound size={20} /></header>
				<label className="information-search"><Search size={16} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索事实与秘密" /></label>
				<div className="information-filter" role="group" aria-label="信息筛选">
					{(['all', 'secret', 'revealed'] as const).map(value => (
						<button type="button" key={value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>
							{{ all: '全部', secret: '作者秘密', revealed: '读者已知' }[value]}
						</button>
					))}
				</div>
				<div className="information-facts">
					{filtered.map(fact => (
						<button type="button" key={fact.id} className={fact.id === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(fact.id)}>
							<span>{fact.authorSecret ? <EyeOff size={16} /> : <Eye size={16} />}<strong>{fact.title}</strong></span>
							<small>{fact.truthStatement}</small>
							<em>{fact.truthStatus === 'confirmed' ? '已确认' : fact.truthStatus === 'disputed' ? '有争议' : '待确认'}</em>
						</button>
					))}
					{filtered.length === 0 ? <p>当前筛选下没有故事事实。</p> : null}
				</div>
			</aside>

			<main className="information-workspace">
				<header className="information-toolbar">
					<div><span className="eyebrow">KNOWLEDGE SLICE</span><h2>{selected?.title ?? '选择一条故事事实'}</h2></div>
					<label><span>叙事位置</span><input type="number" min={0} value={narrativeOrder} onChange={event => setNarrativeOrder(Math.max(0, Number(event.target.value)))} /></label>
				</header>
				{error ? <p className="information-error"><AlertTriangle size={18} />{error}</p> : null}
				{selected ? (
					<div className="information-content">
						<section className="truth-summary">
							<div><span className="eyebrow">故事真实事实</span><p>{selected.truthStatement}</p></div>
							<div className="truth-badges">
								<span className={selected.authorSecret ? 'is-secret' : ''}>{selected.authorSecret ? <EyeOff size={16} /> : <Eye size={16} />}{selected.authorSecret ? '作者秘密' : '公开事实'}</span>
								<span className={selected.excludeFromAiByDefault ? 'is-protected' : ''}>{selected.excludeFromAiByDefault ? <BotOff size={16} /> : <ShieldCheck size={16} />}{selected.excludeFromAiByDefault ? '默认不发送给 AI' : '可加入 AI 上下文'}</span>
							</div>
						</section>
						<section className="information-matrix-card">
							<header><div><h3>知识时间切片</h3><p>区分真实事实、读者认知与每个人物当前所知。</p></div><span>{data?.characters.length ?? 0} 位人物</span></header>
							<KnowledgeMatrix information={selected} characters={data?.characters ?? []} states={data?.states ?? []} narrativeOrder={narrativeOrder} />
						</section>
						<section className="information-foot-grid">
							<div><span>事实生效</span><strong>{selected.truthEffectiveFrom ? `叙事位置 #${selected.truthEffectiveFrom.narrativeOrder}` : '未指定'}</strong></div>
							<div><span>读者揭示</span><strong>{selected.readerRevealAt ? `叙事位置 #${selected.readerRevealAt.narrativeOrder}` : '尚未计划'}</strong></div>
							<div><span>来源证据</span><strong>{selected.evidenceIds.length} 条</strong></div>
							<div className={issues.length ? 'has-warning' : ''}><span>揭示检查</span><strong>{issues.length ? `${issues.length} 项风险` : '顺序正常'}</strong></div>
						</section>
					</div>
				) : (
					<AppEmptyState
						icon={KeyRound}
						title="选择一条故事事实"
						description="从左侧打开事实，查看读者揭示与人物知识权限。"
						className="information-empty"
					/>
				)}
			</main>
		</section>
	);
}
