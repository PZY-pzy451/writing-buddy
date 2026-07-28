import {
	AlertTriangle,
	BookOpenCheck,
	Building2,
	Landmark,
	Map,
	MapPin,
	Scale,
	Shield,
	Sparkles
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	DesktopStoryRepository,
	findLocationHierarchyCycles,
	parseFaction,
	parseLocation,
	parseWorldRule,
	type Faction,
	type Location,
	type WorldRule
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { LocationTree } from './LocationTree';
import { WorldRuleEditor } from './WorldRuleEditor';
import { WorldAiPanel } from './WorldAiPanel';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import { AppEmptyState } from '../../shared/presentation/AppEmptyState';
import './WorldbuildingPage.css';

export interface WorldbuildingData {
	readonly locations: readonly Location[];
	readonly factions: readonly Faction[];
	readonly rules: readonly WorldRule[];
}

export type WorldbuildingLoader = (projectRoot: string) => Promise<WorldbuildingData>;

const defaultLoadData: WorldbuildingLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const [locations, factions, rules] = await Promise.all([
		repository.list('location'),
		repository.list('faction'),
		repository.list('worldRule')
	]);
	return {
		locations: locations.map(value => parseLocation(value as never)),
		factions: factions.map(value => parseFaction(value as never)),
		rules: rules.map(value => parseWorldRule(value as never))
	};
};

export function WorldbuildingPage({
	projectRoot,
	loadData = defaultLoadData,
	chapters = [],
	readOnly,
	onOpenEvidence
}: {
	readonly projectRoot?: string;
	readonly loadData?: WorldbuildingLoader;
	readonly chapters?: readonly AiChapterSource[];
	readonly readOnly?: boolean;
	readonly onOpenEvidence?: OpenAiEvidence;
}): React.JSX.Element {
	const [data, setData] = useState<WorldbuildingData>();
	const [section, setSection] = useState<'locations' | 'factions' | 'rules'>('locations');
	const [selectedId, setSelectedId] = useState<string>();
	const [error, setError] = useState<string>();
	const [saving, setSaving] = useState(false);
	const [aiOpen, setAiOpen] = useState(false);

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ locations: [], factions: [], rules: [] });
			return;
		}
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => current ?? loaded.locations[0]?.id ?? loaded.factions[0]?.id ?? loaded.rules[0]?.id);
			setError(undefined);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : '世界观资料读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	const selectedLocation = data?.locations.find(location => location.id === selectedId);
	const selectedFaction = data?.factions.find(faction => faction.id === selectedId);
	const selectedRule = data?.rules.find(rule => rule.id === selectedId);
	const cycles = useMemo(() => findLocationHierarchyCycles(data?.locations ?? []), [data?.locations]);

	const saveRule = async (rule: WorldRule) => {
		if (!projectRoot) return;
		setSaving(true);
		try {
			const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
			const saved = parseWorldRule(await repository.save(rule, rule.revision) as never);
			setData(current => current ? {
				...current,
				rules: current.rules.map(candidate => candidate.id === saved.id ? saved : candidate)
			} : current);
		} finally {
			setSaving(false);
		}
	};

	const acceptAiResource = (resource: Location | Faction | WorldRule) => {
		setData(current => {
			if (!current) return current;
			if (resource.type === 'location') {
				return {
					...current,
					locations: [
						...current.locations.filter(candidate => candidate.id !== resource.id),
						resource
					]
				};
			}
			if (resource.type === 'faction') {
				return {
					...current,
					factions: [
						...current.factions.filter(candidate => candidate.id !== resource.id),
						resource
					]
				};
			}
			return {
				...current,
				rules: [
					...current.rules.filter(candidate => candidate.id !== resource.id),
					resource
				]
			};
		});
		setSection(resource.type === 'location'
			? 'locations'
			: resource.type === 'faction'
				? 'factions'
				: 'rules');
		setSelectedId(resource.id);
	};

	return (
		<main className="worldbuilding-page" aria-label="世界观中心">
			<header className="worldbuilding-header">
				<div><span className="eyebrow">WORLD BIBLE</span><h1>世界观中心</h1><p>地点层级、势力和世界规则共享同一组正文证据。</p></div>
				<div className="worldbuilding-header-actions">
					<button type="button" className="worldbuilding-ai-button" disabled={!projectRoot} onClick={() => setAiOpen(true)}><Sparkles size={16} />AI 世界观助手</button>
					<div role="tablist" aria-label="世界观分类">
						<button type="button" role="tab" aria-selected={section === 'locations'} className={section === 'locations' ? 'is-active' : ''} onClick={() => { setSection('locations'); setSelectedId(data?.locations[0]?.id); }}><MapPin size={16} />地点</button>
						<button type="button" role="tab" aria-selected={section === 'factions'} className={section === 'factions' ? 'is-active' : ''} onClick={() => { setSection('factions'); setSelectedId(data?.factions[0]?.id); }}><Shield size={16} />势力</button>
						<button type="button" role="tab" aria-selected={section === 'rules'} className={section === 'rules' ? 'is-active' : ''} onClick={() => { setSection('rules'); setSelectedId(data?.rules[0]?.id); }}><Scale size={16} />世界规则</button>
					</div>
				</div>
			</header>
			<div className="worldbuilding-messages">
				{error ? <div role="alert"><AlertTriangle size={16} />{error}<button type="button" onClick={() => void reload()}>重试</button></div> : null}
				{cycles.length ? <div role="alert"><AlertTriangle size={16} />检测到 {cycles.length} 个地点层级循环。</div> : null}
			</div>
			<section className="worldbuilding-workspace">
				<aside className="worldbuilding-list">
					{section === 'locations' ? <LocationTree locations={data?.locations ?? []} selectedId={selectedId} onSelect={location => setSelectedId(location.id)} /> : null}
					{section === 'factions' ? (data?.factions ?? []).map(faction => (
						<button type="button" key={faction.id} className={selectedId === faction.id ? 'is-active' : ''} onClick={() => setSelectedId(faction.id)}>
							<Building2 size={18} /><span><strong>{faction.title}</strong><small>{faction.territoryLocationIds.length} 个领地</small></span>
						</button>
					)) : null}
					{section === 'rules' ? (data?.rules ?? []).map(rule => (
						<button type="button" key={rule.id} className={selectedId === rule.id ? 'is-active' : ''} onClick={() => setSelectedId(rule.id)}>
							<Landmark size={18} /><span><strong>{rule.title}</strong><small>{rule.category}</small></span>
						</button>
					)) : null}
				</aside>
				<section className="worldbuilding-detail">
					{section === 'locations' && selectedLocation ? (
						<>
							<header><MapPin size={26} /><div><span className="eyebrow">LOCATION</span><h2>{selectedLocation.title}</h2><p>{selectedLocation.summary ?? '尚未补充地点说明。'}</p></div></header>
							<div className="world-map" role="img" aria-label="静态地点示意图">
								<div><Map size={26} /><span>静态地图 · 点位仅用于叙事定位</span></div>
								{(data?.locations ?? []).filter(location => location.mapPoint).map(location => (
									<button
										type="button"
										key={location.id}
										style={{ left: `${location.mapPoint?.x}%`, top: `${location.mapPoint?.y}%` }}
										onClick={() => setSelectedId(location.id)}
										aria-label={`定位到 ${location.title}`}
									><MapPin size={16} /><span>{location.title}</span></button>
								))}
							</div>
							<div className="world-detail-grid">
								<article><h3>地点规则</h3>{selectedLocation.rules.length ? selectedLocation.rules.map(rule => <p key={rule}>{rule}</p>) : <p>暂无规则</p>}</article>
								<article><h3>旅行连接</h3>{selectedLocation.travelLinks.length ? selectedLocation.travelLinks.map(link => <p key={link.targetLocationId}>{link.targetLocationId} · 最少 {link.minimumMinutes} 分钟</p>) : <p>暂无连接</p>}</article>
								<article><h3>正文证据与反向链接</h3>{selectedLocation.evidenceIds.length ? selectedLocation.evidenceIds.map(id => <code key={id}>{id}</code>) : <p>尚无正文证据</p>}</article>
							</div>
						</>
					) : null}
					{section === 'factions' && selectedFaction ? (
						<>
							<header><Shield size={26} /><div><span className="eyebrow">FACTION</span><h2>{selectedFaction.title}</h2><p>{selectedFaction.ideology ?? selectedFaction.summary ?? '尚未补充势力纲领。'}</p></div></header>
							<div className="world-detail-grid">
								<article><h3>当前目标</h3>{selectedFaction.goals.map(goal => <p key={goal}>{goal}</p>)}</article>
								<article><h3>联盟 / 敌对</h3><p>联盟 {selectedFaction.allyFactionIds.length} · 敌对 {selectedFaction.enemyFactionIds.length}</p></article>
								<article><h3>来源</h3><p>{selectedFaction.evidenceIds.length} 条正文证据</p></article>
							</div>
						</>
					) : null}
					{section === 'rules' && selectedRule ? <WorldRuleEditor key={selectedRule.id} rule={selectedRule} saving={saving} onSave={saveRule} /> : null}
					{data && !selectedLocation && !selectedFaction && !selectedRule ? (
						<AppEmptyState
							icon={BookOpenCheck}
							title="选择或创建世界资料"
							description="从左侧打开地点、势力或规则，或生成一组可逐项确认的候选。"
							density="full"
							className="worldbuilding-empty"
							actions={(
								<button type="button" disabled={!projectRoot} onClick={() => setAiOpen(true)}>
									<Sparkles size={16} />用 AI 创建世界资料
								</button>
							)}
						/>
					) : null}
				</section>
			</section>
			{aiOpen && projectRoot ? (
				<WorldAiPanel
					projectRoot={projectRoot}
					chapters={chapters}
					locations={data?.locations ?? []}
					factions={data?.factions ?? []}
					rules={data?.rules ?? []}
					readOnly={readOnly}
					onClose={() => setAiOpen(false)}
					onAccepted={acceptAiResource}
					onOpenEvidence={onOpenEvidence}
				/>
			) : null}
		</main>
	);
}
