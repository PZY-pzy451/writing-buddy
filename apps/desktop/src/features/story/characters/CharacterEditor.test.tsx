import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parseStoryId, type Character } from '@writing-buddy/story-kernel';
import { CharacterEditor } from './CharacterEditor';

const timestamp = '2026-08-04T00:00:00.000Z';

function createCharacter(revision = 1): Character {
	return {
		id: parseStoryId('character:lin-yue'),
		type: 'character',
		title: '林越',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision,
		role: 'protagonist',
		pronouns: '她',
		occupation: '记者',
		summary: '追查旧站失踪案。',
		factionIds: [],
		goals: ['找回笔记'],
		desires: ['查明真相'],
		fears: ['失去证据'],
		values: [],
		secrets: [],
		speechStyle: '简短直接',
		evidenceIds: []
	};
}

describe('CharacterEditor save lifecycle', () => {
	it('exposes distinct stable handles for all eleven form operations', () => {
		render(
			<CharacterEditor
				character={createCharacter()}
				saving={false}
				onDirtyChange={vi.fn()}
				onSave={vi.fn()}
			/>
		);

		expect(screen.getByTestId('character-editor-form')).toHaveAccessibleName('人物编辑表单');
		for (const testId of [
			'character-title',
			'character-role',
			'character-pronouns',
			'character-occupation',
			'character-summary',
			'character-goals',
			'character-desires',
			'character-fears',
			'character-speech-style',
			'character-save'
		]) {
			expect(screen.getByTestId(testId)).toHaveAccessibleName();
		}
	});

	it('starts one persistence request for one hundred same-frame submissions', async () => {
		let resolveSave: (() => void) | undefined;
		const pendingSave = new Promise<void>(resolve => {
			resolveSave = resolve;
		});
		const onSave = vi.fn(() => pendingSave);
		render(
			<CharacterEditor
				character={createCharacter()}
				saving={false}
				onDirtyChange={vi.fn()}
				onSave={onSave}
			/>
		);
		const form = document.querySelector('.character-editor');
		expect(form).not.toBeNull();

		act(() => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				fireEvent.submit(form as HTMLFormElement);
			}
		});

		expect(onSave).toHaveBeenCalledOnce();
		await act(async () => {
			resolveSave?.();
			await pendingSave;
		});
		await waitFor(() => expect(document.querySelector('.character-editor button[type="submit"]')).toBeEnabled());
	});
});
