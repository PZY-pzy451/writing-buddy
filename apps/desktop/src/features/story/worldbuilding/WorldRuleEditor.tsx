import { Save } from 'lucide-react';
import { useState } from 'react';
import {
	worldRuleCategories,
	type WorldRule,
	type WorldRuleCategory
} from '@writing-buddy/story-kernel';

const categoryLabels: Readonly<Record<WorldRuleCategory, string>> = {
	culture: '文化',
	religion: '宗教',
	technology: '科技',
	magic: '魔法',
	law: '法律',
	other: '其他'
};

export function WorldRuleEditor({
	rule,
	saving,
	onSave
}: {
	readonly rule: WorldRule;
	readonly saving: boolean;
	readonly onSave: (rule: WorldRule) => Promise<void>;
}): React.JSX.Element {
	const [draft, setDraft] = useState(rule);

	return (
		<form className="world-rule-editor" onSubmit={event => {
			event.preventDefault();
			void onSave(draft);
		}}>
			<label>
				<span>规则名称</span>
				<input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
			</label>
			<label>
				<span>分类</span>
				<select value={draft.category} onChange={event => setDraft(current => ({
					...current,
					category: event.target.value as WorldRuleCategory
				}))}>
					{worldRuleCategories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}
				</select>
			</label>
			<label className="is-wide">
				<span>规则陈述</span>
				<textarea rows={5} value={draft.statement} onChange={event => setDraft(current => ({ ...current, statement: event.target.value }))} />
			</label>
			<label className="is-wide">
				<span>适用范围</span>
				<input
					value={draft.scope ?? ''}
					placeholder="例如：灰城旧城区、雨夜、登记在册的居民"
					onChange={event => {
						const scope = event.target.value;
						setDraft(current => ({
							...current,
							scope: scope.trim() ? scope : undefined
						}));
					}}
				/>
			</label>
			<label>
				<span>例外（每行一项）</span>
				<textarea rows={4} value={draft.exceptions.join('\n')} onChange={event => setDraft(current => ({
					...current,
					exceptions: event.target.value.split('\n').map(line => line.trim()).filter(Boolean)
				}))} />
			</label>
			<label>
				<span>违反后果（每行一项）</span>
				<textarea rows={4} value={draft.consequences.join('\n')} onChange={event => setDraft(current => ({
					...current,
					consequences: event.target.value.split('\n').map(line => line.trim()).filter(Boolean)
				}))} />
			</label>
			<div className="world-rule-actions">
				<small>Revision {rule.revision} · {rule.evidenceIds.length} 条正文证据</small>
				<button type="submit" disabled={saving || !draft.title.trim() || !draft.statement.trim()}>
					<Save size={16} />{saving ? '保存中…' : '保存规则'}
				</button>
			</div>
		</form>
	);
}
