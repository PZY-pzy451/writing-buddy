import { Save } from 'lucide-react';
import { useRef, useState } from 'react';
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
	const [submitting, setSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string>();
	const saveActiveRef = useRef(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (saving || saveActiveRef.current) return;
		saveActiveRef.current = true;
		setSubmitting(true);
		setSaveError(undefined);
		try {
			await onSave(draft);
		} catch {
			setSaveError('世界规则保存失败，请重试。');
		} finally {
			saveActiveRef.current = false;
			setSubmitting(false);
		}
	};

	const savePending = saving || submitting;

	return (
		<form
			className="world-rule-editor"
			data-testid="world-rule-editor-form"
			onSubmit={event => void handleSubmit(event)}
		>
			<label>
				<span>规则名称</span>
				<input
					data-testid="world-rule-title"
					value={draft.title}
					onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
				/>
			</label>
			<label>
				<span>分类</span>
				<select
					data-testid="world-rule-category"
					value={draft.category}
					onChange={event => setDraft(current => ({
						...current,
						category: event.target.value as WorldRuleCategory
					}))}
				>
					{worldRuleCategories.map(category => <option key={category} value={category}>{categoryLabels[category]}</option>)}
				</select>
			</label>
			<label className="is-wide">
				<span>规则陈述</span>
				<textarea
					data-testid="world-rule-statement"
					rows={5}
					value={draft.statement}
					onChange={event => setDraft(current => ({ ...current, statement: event.target.value }))}
				/>
			</label>
			<label className="is-wide">
				<span>适用范围</span>
				<input
					data-testid="world-rule-scope"
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
				<textarea
					data-testid="world-rule-exceptions"
					rows={4}
					value={draft.exceptions.join('\n')}
					onChange={event => setDraft(current => ({
						...current,
						exceptions: event.target.value.split('\n').map(line => line.trim()).filter(Boolean)
					}))}
				/>
			</label>
			<label>
				<span>违反后果（每行一项）</span>
				<textarea
					data-testid="world-rule-consequences"
					rows={4}
					value={draft.consequences.join('\n')}
					onChange={event => setDraft(current => ({
						...current,
						consequences: event.target.value.split('\n').map(line => line.trim()).filter(Boolean)
					}))}
				/>
			</label>
			{saveError ? <p role="alert">{saveError}</p> : null}
			<div className="world-rule-actions">
				<small>Revision {rule.revision} · {rule.evidenceIds.length} 条正文证据</small>
				<button
					type="submit"
					data-testid="world-rule-save"
					disabled={savePending || !draft.title.trim() || !draft.statement.trim()}
				>
					<Save size={16} />{savePending ? '保存中…' : '保存规则'}
				</button>
			</div>
		</form>
	);
}
