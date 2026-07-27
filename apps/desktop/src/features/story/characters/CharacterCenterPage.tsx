import {
	AlertTriangle,
	BookOpenCheck,
	Search,
	Sparkles,
	UserRound,
	UsersRound
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	characterRoleLabels,
	DesktopStoryRepository,
	parseStateRecord,
	type Character,
	type CharacterRole,
	type StateRecord
} from '@writing-buddy/story-kernel';
import { desktopBridge } from '../../../platform/bridge';
import { CharacterEditor } from './CharacterEditor';
import { CharacterStateTimeline } from './CharacterStateTimeline';
import { CharacterAiPanel } from './CharacterAiPanel';
import type {
	AiChapterSource,
	OpenAiEvidence
} from '../ai-context/AiChapterSource';
import './CharacterCenterPage.css';

export interface CharacterCenterData {
	readonly characters: readonly Character[];
	readonly states: readonly StateRecord[];
}

export type CharacterCenterLoader = (projectRoot: string) => Promise<CharacterCenterData>;
export type CharacterSaver = (character: Character) => Promise<Character>;

const tabs = ['概览', '当前状态', '人物弧', '关系', '时间线', '出场记录', '来源与冲突'] as const;
type CharacterTab = typeof tabs[number];

const defaultLoadData: CharacterCenterLoader = async projectRoot => {
	const repository = new DesktopStoryRepository(projectRoot, desktopBridge);
	const characters = await repository.list('character') as unknown as readonly Character[];
	let states: readonly StateRecord[] = [];
	try {
		const file = await desktopBridge.readText(projectRoot, 'story/states/character-states.json');
		const json = JSON.parse(file.content) as unknown;
		if (Array.isArray(json)) {
			states = json.map(value => parseStateRecord(value as Parameters<typeof parseStateRecord>[0]));
		}
	} catch {
		// State history is optional for migrated projects.
	}
	return { characters, states };
};

function maxPosition(records: readonly StateRecord[]): number {
	return records.reduce((maximum, record) => (
		Math.max(maximum, record.effectiveFrom.narrativeOrder)
	), 0);
}

interface CharacterCenterPageProps {
	readonly projectRoot?: string;
	readonly loadData?: CharacterCenterLoader;
	readonly saveCharacter?: CharacterSaver;
	readonly chapters?: readonly AiChapterSource[];
	readonly onOpenEvidence?: OpenAiEvidence;
	readonly readOnly?: boolean;
}

export function CharacterCenterPage({
	projectRoot,
	loadData = defaultLoadData,
	saveCharacter,
	chapters = [],
	onOpenEvidence,
	readOnly = false
}: CharacterCenterPageProps): React.JSX.Element {
	const [data, setData] = useState<CharacterCenterData>();
	const [error, setError] = useState<string>();
	const [selectedId, setSelectedId] = useState<string>();
	const [activeTab, setActiveTab] = useState<CharacterTab>('概览');
	const [search, setSearch] = useState('');
	const [role, setRole] = useState<CharacterRole | 'all'>('all');
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [narrativeOrder, setNarrativeOrder] = useState(0);
	const [listScrollTop, setListScrollTop] = useState(0);
	const [listViewportHeight, setListViewportHeight] = useState(600);
	const [aiOpen, setAiOpen] = useState(false);

	const reload = useCallback(async () => {
		if (!projectRoot) {
			setData({ characters: [], states: [] });
			return;
		}
		setError(undefined);
		try {
			const loaded = await loadData(projectRoot);
			setData(loaded);
			setSelectedId(current => (
				current && loaded.characters.some(character => character.id === current)
					? current
					: loaded.characters[0]?.id
			));
			setNarrativeOrder(maxPosition(loaded.states));
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : '人物资料读取失败。');
		}
	}, [loadData, projectRoot]);

	useEffect(() => {
		const timer = window.setTimeout(() => void reload(), 0);
		return () => window.clearTimeout(timer);
	}, [reload]);

	useEffect(() => {
		if (!dirty) {
			return;
		}
		const guard = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener('beforeunload', guard);
		return () => window.removeEventListener('beforeunload', guard);
	}, [dirty]);

	const filtered = useMemo(() => {
		const normalized = search.trim().toLocaleLowerCase();
		return (data?.characters ?? []).filter(character => (
			(role === 'all' || character.role === role)
				&& (!normalized || [
					character.title,
					...character.aliases,
					...character.tags
				].some(value => value.toLocaleLowerCase().includes(normalized)))
		));
	}, [data, role, search]);
	const characterRowHeight = 64;
	const characterStart = Math.max(
		0,
		Math.floor(listScrollTop / characterRowHeight) - 4
	);
	const characterCount = Math.ceil(listViewportHeight / characterRowHeight) + 8;
	const characterEnd = Math.min(filtered.length, characterStart + characterCount);
	const visibleCharacters = filtered.slice(characterStart, characterEnd);
	const selected = data?.characters.find(character => character.id === selectedId);
	const selectedStates = data?.states.filter(record => record.characterId === selectedId) ?? [];

	const confirmDiscard = (): boolean => (
		!dirty || window.confirm('当前人物资料尚未保存。确定放弃修改并继续吗？')
	);

	const chooseCharacter = (id: string) => {
		if (!confirmDiscard()) {
			return;
		}
		setDirty(false);
		setSaved(false);
		setSelectedId(id);
		setNarrativeOrder(maxPosition(data?.states.filter(record => record.characterId === id) ?? []));
	};

	const chooseTab = (tab: CharacterTab) => {
		if (tab !== activeTab && !confirmDiscard()) {
			return;
		}
		setDirty(false);
		setActiveTab(tab);
	};

	const persistCharacter = async (character: Character) => {
		if (!projectRoot && !saveCharacter) {
			return;
		}
		setSaving(true);
		setSaved(false);
		setError(undefined);
		try {
			const savedCharacter = saveCharacter
				? await saveCharacter(character)
				: await new DesktopStoryRepository(projectRoot!, desktopBridge)
					.save(character, character.revision) as unknown as Character;
			setData(current => current ? {
				...current,
				characters: current.characters.map(candidate => (
					candidate.id === savedCharacter.id ? savedCharacter : candidate
				))
			} : current);
			setSaved(true);
			setDirty(false);
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : '人物资料保存失败。');
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="character-center" aria-label="人物中心">
			<aside className="character-list-pane">
				<header>
					<div><span className="eyebrow">CHARACTERS</span><h1>人物</h1></div>
					<div className="character-list-header-actions">
						<button type="button" onClick={() => setAiOpen(true)}>
							<Sparkles size={16} />AI 人物助手
						</button>
						<span className="character-count">{filtered.length}</span>
					</div>
				</header>
				<label className="character-search">
					<Search size={16} />
					<span className="sr-only">搜索人物</span>
					<input
						aria-label="搜索人物"
						value={search}
						onChange={event => {
							setSearch(event.target.value);
							setListScrollTop(0);
						}}
						placeholder="姓名、别名或标签"
					/>
				</label>
				<div className="character-role-filters" aria-label="按角色筛选">
					<button type="button" className={role === 'all' ? 'is-active' : ''} onClick={() => {
						setRole('all');
						setListScrollTop(0);
					}}>全部</button>
					{(Object.entries(characterRoleLabels) as [CharacterRole, string][]).map(([value, label]) => (
						<button
							type="button"
							key={value}
							className={role === value ? 'is-active' : ''}
							onClick={() => {
								setRole(value);
								setListScrollTop(0);
							}}
						>{label}</button>
					))}
				</div>
				<nav
					className="character-list"
					aria-label="人物列表"
					onScroll={event => {
						setListScrollTop(event.currentTarget.scrollTop);
						setListViewportHeight(event.currentTarget.clientHeight || 600);
					}}
				>
					{characterStart ? (
						<div
							className="character-list-spacer"
							style={{ height: characterStart * characterRowHeight }}
							aria-hidden="true"
						/>
					) : null}
					{visibleCharacters.map((character, visibleIndex) => (
						<button
							type="button"
							key={character.id}
							aria-current={selectedId === character.id ? 'true' : undefined}
							aria-posinset={characterStart + visibleIndex + 1}
							aria-setsize={filtered.length}
							className={selectedId === character.id ? 'is-active' : ''}
							onClick={() => chooseCharacter(character.id)}
							aria-label={`${character.title}，${character.role ? characterRoleLabels[character.role] : '未分类'}`}
						>
							<span className="character-avatar"><UserRound size={20} /></span>
							<span><strong>{character.title}</strong><small>{character.role ? characterRoleLabels[character.role] : '未分类'} · {character.tags.join(' / ') || '无标签'}</small></span>
						</button>
					))}
					{characterEnd < filtered.length ? (
						<div
							className="character-list-spacer"
							style={{ height: (filtered.length - characterEnd) * characterRowHeight }}
							aria-hidden="true"
						/>
					) : null}
					{data && filtered.length === 0 ? (
						<div className="character-list-empty"><UsersRound size={28} />没有符合筛选的人物</div>
					) : null}
				</nav>
			</aside>

			<section className="character-detail">
				{error ? (
					<div className="character-error" role="alert">
						<AlertTriangle size={22} /><strong>人物中心暂时不可用</strong><span>{error}</span>
						<button type="button" onClick={() => void reload()}>重新读取</button>
					</div>
				) : !data ? (
					<div className="character-loading" aria-live="polite">正在读取人物资料…</div>
				) : !selected ? (
					<div className="character-empty">
						<UsersRound size={36} />
						<h2>还没有人物</h2>
						<p>从正文选区创建人物，或让 AI 提供三个可逐字段确认的人物候选。</p>
						<button type="button" onClick={() => setAiOpen(true)}>
							<Sparkles size={17} />用 AI 创建人物
						</button>
					</div>
				) : (
					<>
						<header className="character-detail-header">
							<div className="character-portrait"><UserRound size={30} /></div>
							<div>
								<span className="eyebrow">CHARACTER DOSSIER</span>
								<h2>{selected.title}</h2>
								<p>{selected.summary || '为人物补充目标、状态与来源，保持长篇叙事一致。'}</p>
							</div>
							<div className="character-detail-meta">
								<span>{selected.role ? characterRoleLabels[selected.role] : '未分类'}</span>
								<span>{selectedStates.length} 条状态</span>
								{saved ? <strong><BookOpenCheck size={14} />已保存</strong> : null}
							</div>
						</header>
						<div className="character-tabs" role="tablist" aria-label="人物详情">
							{tabs.map(tab => (
								<button
									type="button"
									role="tab"
									key={tab}
									aria-selected={activeTab === tab}
									className={activeTab === tab ? 'is-active' : ''}
									onClick={() => chooseTab(tab)}
								>{tab}</button>
							))}
						</div>
						<div className="character-detail-content">
							{activeTab === '概览' ? (
								<CharacterEditor
									key={selected.id}
									character={selected}
									saving={saving}
									onDirtyChange={setDirty}
									onSave={persistCharacter}
								/>
							) : null}
							{activeTab === '当前状态' ? (
								<CharacterStateTimeline
									records={selectedStates}
									narrativeOrder={narrativeOrder}
									onNarrativeOrderChange={setNarrativeOrder}
								/>
							) : null}
							{activeTab === '来源与冲突' ? (
								<section className="character-evidence-panel">
									<h3>来源与冲突</h3>
									<p>正式字段只展示可追踪来源；同一叙事位置的不同值会并列保留。</p>
									<ul>
										{[...new Set([
											...selected.evidenceIds,
											...selectedStates.flatMap(record => record.evidenceIds)
										])].map(evidenceId => <li key={evidenceId}><BookOpenCheck size={15} />{evidenceId}</li>)}
									</ul>
								</section>
							) : null}
							{!['概览', '当前状态', '来源与冲突'].includes(activeTab) ? (
								<section className="character-linked-panel">
									<h3>{activeTab}</h3>
									<p>该视图将使用人物 ID 与 Story Kernel 资源联动，不把关系和事件复制进人物静态卡片。</p>
								</section>
							) : null}
						</div>
					</>
				)}
			</section>
			{aiOpen && projectRoot ? (
				<CharacterAiPanel
					projectRoot={projectRoot}
					chapters={chapters}
					characters={data?.characters ?? []}
					states={data?.states ?? []}
					selectedCharacter={selected}
					readOnly={readOnly}
					onClose={() => setAiOpen(false)}
					onOpenEvidence={onOpenEvidence}
					onAccepted={(character, states) => {
						setData(current => {
							if (!current) return current;
							const exists = current.characters.some(candidate => candidate.id === character.id);
							return {
								characters: exists
									? current.characters.map(candidate => (
										candidate.id === character.id ? character : candidate
									))
									: [...current.characters, character],
								states
							};
						});
						setSelectedId(character.id);
					}}
				/>
			) : null}
		</main>
	);
}
