import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	parseRelationship,
	parseStoryId,
	type Character,
	type Relationship
} from '@writing-buddy/story-kernel';
import { RelationshipInspector } from './RelationshipInspector';

const timestamp = '2026-08-04T00:00:00.000Z';

const characters: readonly Character[] = ['Lin', 'Shen'].map((title, index) => ({
	id: parseStoryId(index === 0 ? 'character:lin' : 'character:shen'),
	type: 'character',
	title,
	aliases: [],
	tags: [],
	schemaVersion: 1,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 0,
	factionIds: [],
	goals: [],
	desires: [],
	fears: [],
	values: [],
	secrets: [],
	evidenceIds: []
}));

function relationshipFixture(
	revision = 0,
	relationshipType = 'doubts'
): Relationship {
	return parseRelationship({
		id: 'relationship:lin-doubts-shen',
		type: 'relationship',
		title: `Lin ${relationshipType} Shen`,
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision,
		sourceCharacterId: 'character:lin',
		targetCharacterId: 'character:shen',
		relationshipType,
		strength: 0.7,
		visibility: 'private',
		effectiveFrom: {
			chapterId: 'chapter:chapter-001',
			narrativeOrder: 3
		},
		evidenceIds: []
	});
}

function inspectorElement(input: {
	readonly relationship?: Relationship;
	readonly saving?: boolean;
	readonly onSave?: (relationship: Relationship) => Promise<void>;
} = {}) {
	return (
		<RelationshipInspector
			relationship={input.relationship ?? relationshipFixture()}
			characters={characters}
			saving={input.saving ?? false}
			onSave={input.onSave ?? (() => Promise.resolve())}
		/>
	);
}

describe('RelationshipInspector', () => {
	it('renders four accessible stable controls and disables an invalid save', () => {
		render(inspectorElement());

		for (const selector of [
			'relationship-inspector-type',
			'relationship-inspector-strength',
			'relationship-inspector-visibility',
			'relationship-inspector-save'
		]) {
			expect(screen.getByTestId(selector)).toBeInTheDocument();
		}

		fireEvent.change(screen.getByTestId('relationship-inspector-type'), {
			target: { value: '   ' }
		});
		expect(screen.getByTestId('relationship-inspector-save')).toBeDisabled();
	});

	it('deduplicates 100 repeated pointer saves while loading and completes once', async () => {
		let finishSave: (() => void) | undefined;
		const onSave = vi.fn(() => new Promise<void>(resolve => {
			finishSave = resolve;
		}));
		render(inspectorElement({ onSave }));
		const save = screen.getByTestId('relationship-inspector-save');

		for (let attempt = 0; attempt < 100; attempt += 1) {
			fireEvent.click(save);
		}

		expect(onSave).toHaveBeenCalledOnce();
		expect(save).toBeDisabled();
		await act(async () => {
			finishSave?.();
			await Promise.resolve();
		});
	});

	it('shows a localized failure and releases the save guard for retry', async () => {
		const onSave = vi.fn()
			.mockRejectedValueOnce(new Error('D:/private/project/story.json failed'))
			.mockResolvedValueOnce(undefined);
		render(inspectorElement({ onSave }));
		const save = screen.getByTestId('relationship-inspector-save');

		fireEvent.click(save);
		expect(await screen.findByRole('alert')).toHaveTextContent('关系保存失败，请重试。');
		expect(screen.queryByText(/private\/project/u)).not.toBeInTheDocument();
		fireEvent.click(save);
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

		expect(onSave).toHaveBeenCalledTimes(2);
	});

	it('restores the authoritative revision before a later successful save', async () => {
		const onSave = vi.fn(() => Promise.resolve());
		const view = render(inspectorElement({
			relationship: relationshipFixture(0),
			onSave
		}));

		fireEvent.change(screen.getByTestId('relationship-inspector-type'), {
			target: { value: 'ally' }
		});
		fireEvent.click(screen.getByTestId('relationship-inspector-save'));
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

		view.rerender(inspectorElement({
			relationship: relationshipFixture(1, 'ally'),
			onSave
		}));
		fireEvent.change(screen.getByTestId('relationship-inspector-type'), {
			target: { value: 'rival' }
		});
		fireEvent.click(screen.getByTestId('relationship-inspector-save'));
		await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

		expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
			relationshipType: 'rival',
			revision: 1
		}));
	});
});
