import { Save } from 'lucide-react';
import { useRef, useState } from 'react';
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
	const [submitting, setSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string>();
	const saveActiveRef = useRef(false);

	const update = <K extends keyof Character>(key: K, value: Character[K]) => {
		setDraft(current => ({ ...current, [key]: value }));
		onDirtyChange(true);
	};

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (saving || saveActiveRef.current) return;
		saveActiveRef.current = true;
		setSubmitting(true);
		setSaveError(undefined);
		try {
			await onSave({
				...draft,
				updatedAt: new Date().toISOString()
			});
			onDirtyChange(false);
		} catch {
			setSaveError('人物资料保存失败，请重试。');
		} finally {
			saveActiveRef.current = false;
			setSubmitting(false);
		}
	};
	const savePending = saving || submitting;

	return (
		<form
			className="character-editor"
			aria-label="人物编辑表单"
			data-testid="character-editor-form"
			onSubmit={event => void submit(event)}
		>
			<div className="character-form-grid">
				<label>
					<span>人物姓名</span>
					<input
						aria-label="人物姓名"
						data-testid="character-title"
						value={draft.title}
						onChange={event => update('title', event.target.value)}
					/>
				</label>
				<label>
					<span>叙事角色</span>
					<select
						aria-label="叙事角色"
						data-testid="character-role"
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
						aria-label="称谓 / 代词"
						data-testid="character-pronouns"
						value={draft.pronouns ?? ''}
						onChange={event => update('pronouns', event.target.value || undefined)}
					/>
				</label>
				<label>
					<span>职业 / 身份</span>
					<input
						aria-label="职业 / 身份"
						data-testid="character-occupation"
						value={draft.occupation ?? ''}
						onChange={event => update('occupation', event.target.value || undefined)}
					/>
				</label>
				<label className="is-wide">
					<span>人物摘要</span>
					<textarea
						aria-label="人物摘要"
						data-testid="character-summary"
						rows={3}
						value={draft.summary ?? ''}
						onChange={event => update('summary', event.target.value || undefined)}
					/>
				</label>
				<label className="is-wide">
					<span>当前目标</span>
					<input
						aria-label="当前目标"
						data-testid="character-goals"
						value={listValue(draft.goals)}
						onChange={event => update('goals', parseList(event.target.value))}
						placeholder="用顿号分隔多个目标"
					/>
				</label>
				<label>
					<span>渴望</span>
					<input
						aria-label="渴望"
						data-testid="character-desires"
						value={listValue(draft.desires)}
						onChange={event => update('desires', parseList(event.target.value))}
					/>
				</label>
				<label>
					<span>恐惧</span>
					<input
						aria-label="恐惧"
						data-testid="character-fears"
						value={listValue(draft.fears)}
						onChange={event => update('fears', parseList(event.target.value))}
					/>
				</label>
				<label className="is-wide">
					<span>语言风格</span>
					<textarea
						aria-label="语言风格"
						data-testid="character-speech-style"
						rows={2}
						value={draft.speechStyle ?? ''}
						onChange={event => update('speechStyle', event.target.value || undefined)}
					/>
				</label>
			</div>
			{saveError ? <p role="alert">{saveError}</p> : null}
			<div className="character-editor-actions">
				<span>Revision {character.revision}</span>
				<button
					type="submit"
					aria-label="保存人物"
					data-testid="character-save"
					disabled={savePending || !draft.title.trim()}
				>
					<Save size={16} />{savePending ? '保存中…' : '保存人物'}
				</button>
			</div>
		</form>
	);
}
