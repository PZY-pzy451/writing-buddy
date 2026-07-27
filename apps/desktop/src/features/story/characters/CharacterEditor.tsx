import { Save } from 'lucide-react';
import { useState } from 'react';
import {
	characterRoleLabels,
	type Character,
	type CharacterRole
} from '@writing-buddy/story-kernel';

interface CharacterEditorProps {
	readonly character: Character;
	readonly saving: boolean;
	readonly onDirtyChange: (dirty: boolean) => void;
	readonly onSave: (character: Character) => Promise<void>;
}

function listValue(values: readonly string[]): string {
	return values.join('、');
}

function parseList(value: string): readonly string[] {
	return value.split(/[、,\n]/u).map(item => item.trim()).filter(Boolean);
}

export function CharacterEditor({
	character,
	saving,
	onDirtyChange,
	onSave
}: CharacterEditorProps): React.JSX.Element {
	const [draft, setDraft] = useState(character);

	const update = <K extends keyof Character>(key: K, value: Character[K]) => {
		setDraft(current => ({ ...current, [key]: value }));
		onDirtyChange(true);
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		await onSave({
			...draft,
			updatedAt: new Date().toISOString()
		});
		onDirtyChange(false);
	};

	return (
		<form className="character-editor" onSubmit={event => void submit(event)}>
			<div className="character-form-grid">
				<label>
					<span>人物姓名</span>
					<input
						aria-label="人物姓名"
						value={draft.title}
						onChange={event => update('title', event.target.value)}
					/>
				</label>
				<label>
					<span>叙事角色</span>
					<select
						aria-label="叙事角色"
						value={draft.role ?? ''}
						onChange={event => update(
							'role',
							event.target.value
								? event.target.value as CharacterRole
								: undefined
						)}
					>
						<option value="">未分类</option>
						{Object.entries(characterRoleLabels).map(([value, label]) => (
							<option key={value} value={value}>{label}</option>
						))}
					</select>
				</label>
				<label>
					<span>称谓 / 代词</span>
					<input
						value={draft.pronouns ?? ''}
						onChange={event => update('pronouns', event.target.value || undefined)}
					/>
				</label>
				<label>
					<span>职业 / 身份</span>
					<input
						value={draft.occupation ?? ''}
						onChange={event => update('occupation', event.target.value || undefined)}
					/>
				</label>
				<label className="is-wide">
					<span>人物摘要</span>
					<textarea
						rows={3}
						value={draft.summary ?? ''}
						onChange={event => update('summary', event.target.value || undefined)}
					/>
				</label>
				<label className="is-wide">
					<span>当前目标</span>
					<input
						value={listValue(draft.goals)}
						onChange={event => update('goals', parseList(event.target.value))}
						placeholder="用顿号分隔多个目标"
					/>
				</label>
				<label>
					<span>渴望</span>
					<input
						value={listValue(draft.desires)}
						onChange={event => update('desires', parseList(event.target.value))}
					/>
				</label>
				<label>
					<span>恐惧</span>
					<input
						value={listValue(draft.fears)}
						onChange={event => update('fears', parseList(event.target.value))}
					/>
				</label>
				<label className="is-wide">
					<span>语言风格</span>
					<textarea
						rows={2}
						value={draft.speechStyle ?? ''}
						onChange={event => update('speechStyle', event.target.value || undefined)}
					/>
				</label>
			</div>
			<div className="character-editor-actions">
				<span>Revision {character.revision}</span>
				<button type="submit" disabled={saving || !draft.title.trim()}>
					<Save size={16} />{saving ? '保存中…' : '保存人物'}
				</button>
			</div>
		</form>
	);
}
