import { ArrowRight, BookOpenCheck, Save, Shield } from 'lucide-react';
import { useState } from 'react';
import type {
	Character,
	Relationship,
	RelationshipVisibility
} from '@writing-buddy/story-kernel';
import { AppEmptyState } from '../../shared/presentation/AppEmptyState';

interface RelationshipInspectorProps {
	readonly relationship?: Relationship;
	readonly characters: readonly Character[];
	readonly saving?: boolean;
	readonly onSave?: (relationship: Relationship) => Promise<void>;
}

const visibilityLabels: Readonly<Record<RelationshipVisibility, string>> = {
	public: '公开',
	private: '私下',
	secret: '秘密'
};

export function RelationshipInspector({
	relationship,
	characters,
	saving = false,
	onSave
}: RelationshipInspectorProps): React.JSX.Element {
	if (!relationship) {
		return (
			<aside className="relationship-inspector is-empty">
				<AppEmptyState
					icon={ArrowRight}
					title="选择一条关系"
					description="查看方向、强度、时间范围、变化历史和正文来源。"
				/>
			</aside>
		);
	}
	return (
		<RelationshipInspectorForm
			key={relationship.id}
			relationship={relationship}
			characters={characters}
			saving={saving}
			onSave={onSave}
		/>
	);
}

function RelationshipInspectorForm({
	relationship,
	characters,
	saving,
	onSave
}: Required<Pick<RelationshipInspectorProps, 'relationship' | 'characters' | 'saving'>>
	& Pick<RelationshipInspectorProps, 'onSave'>): React.JSX.Element {
	const [draft, setDraft] = useState(relationship);
	const source = characters.find(character => character.id === relationship.sourceCharacterId);
	const target = characters.find(character => character.id === relationship.targetCharacterId);
	return (
		<aside className="relationship-inspector">
			<header>
				<span className="eyebrow">RELATIONSHIP INSPECTOR</span>
				<h2>{relationship.relationshipType}</h2>
				<p><strong>{source?.title ?? relationship.sourceCharacterId}</strong><ArrowRight size={16} /><strong>{target?.title ?? relationship.targetCharacterId}</strong></p>
			</header>
			<label>
				<span>关系类型</span>
				<input
					value={draft.relationshipType}
					onChange={event => setDraft(current => ({
						...current,
						relationshipType: event.target.value,
						title: `${source?.title ?? '人物'}${event.target.value}${target?.title ?? '人物'}`
					}))}
				/>
			</label>
			<label>
				<span>强度 {Math.round((draft.strength ?? 0.5) * 100)}%</span>
				<input
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={draft.strength ?? 0.5}
					onChange={event => setDraft(current => ({
						...current,
						strength: Number(event.target.value)
					}))}
				/>
			</label>
			<label>
				<span>公开程度</span>
				<select
					value={draft.visibility}
					onChange={event => setDraft(current => ({
						...current,
						visibility: event.target.value as RelationshipVisibility
					}))}
				>
					{Object.entries(visibilityLabels).map(([value, label]) => (
						<option key={value} value={value}>{label}</option>
					))}
				</select>
			</label>
			<dl className="relationship-period">
				<div><dt>起始</dt><dd>叙事位置 {relationship.effectiveFrom.narrativeOrder}</dd></div>
				<div><dt>结束</dt><dd>{relationship.effectiveUntil ? `叙事位置 ${relationship.effectiveUntil.narrativeOrder}` : '持续有效'}</dd></div>
			</dl>
			<section>
				<h3><BookOpenCheck size={16} />来源证据</h3>
				{relationship.evidenceIds.length
					? relationship.evidenceIds.map(id => <code key={id}>{id}</code>)
					: <p>尚无来源，保存前建议链接正文。</p>}
			</section>
			<section>
				<h3><Shield size={16} />变化历史</h3>
				{relationship.history.length
					? relationship.history.map((change, index) => (
						<p key={`${change.effectiveFrom.narrativeOrder}:${index}`}>
							位置 {change.effectiveFrom.narrativeOrder} · {change.relationshipType} · {visibilityLabels[change.visibility]}
						</p>
					))
					: <p>当前关系尚无历史变更。</p>}
			</section>
			{onSave ? (
				<button
					type="button"
					className="relationship-save"
					disabled={saving || !draft.relationshipType.trim()}
					onClick={() => void onSave({
						...draft,
						updatedAt: new Date().toISOString()
					})}
				>
					<Save size={16} />{saving ? '保存中…' : '保存关系'}
				</button>
			) : null}
		</aside>
	);
}
