import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	parseRelationship,
	parseStoryId,
	type Character
} from '@writing-buddy/story-kernel';
import {
	RelationshipGraphPage,
	type RelationshipPageData
} from './RelationshipGraphPage';

const timestamp = '2026-07-27T00:00:00.000Z';
const characters: readonly Character[] = ['林越', '沈青'].map((title, index) => ({
	id: parseStoryId(index === 0 ? 'character:lin-yue' : 'character:shen-qing'),
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
const data: RelationshipPageData = {
	characters,
	relationships: [
		parseRelationship({
			id: 'relationship:lin-doubts-shen',
			type: 'relationship',
			title: '林越怀疑沈青',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:lin-yue',
			targetCharacterId: 'character:shen-qing',
			relationshipType: '怀疑',
			strength: 0.7,
			visibility: 'private',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 3
			},
			evidenceIds: ['evidence:rain-dialogue']
		}),
		parseRelationship({
			id: 'relationship:shen-protects-lin',
			type: 'relationship',
			title: '沈青保护林越',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			sourceCharacterId: 'character:shen-qing',
			targetCharacterId: 'character:lin-yue',
			relationshipType: '保护',
			strength: 0.9,
			visibility: 'secret',
			effectiveFrom: {
				chapterId: 'chapter:chapter-001',
				narrativeOrder: 8
			},
			evidenceIds: ['evidence:station-rescue']
		})
	]
};

describe('RelationshipGraph load recovery', () => {
	it('TC-RELATIONSHIP-GRAPH-005 filters by narrative position, deduplicates retry and isolates late project loads', async () => {
		let resolveRetry: (value: RelationshipPageData | PromiseLike<RelationshipPageData>) => void
			= () => undefined;
		let resolveStale: (value: RelationshipPageData | PromiseLike<RelationshipPageData>) => void
			= () => undefined;
		const loadData = vi.fn((root: string) => {
			if (root === 'D:/Fixture' && loadData.mock.calls.length === 1) {
				return Promise.reject(new Error('C:\\private\\author\\relationships.json'));
			}
			if (root === 'D:/Fixture') {
				return new Promise<RelationshipPageData>(resolve => {
					resolveRetry = resolve;
				});
			}
			if (root === 'D:/Older') {
				return new Promise<RelationshipPageData>(resolve => {
					resolveStale = resolve;
				});
			}
			return Promise.resolve({ ...data, relationships: [] });
		});
		const view = render(
			<RelationshipGraphPage
				projectRoot="D:/Fixture"
				loadData={loadData}
			/>
		);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('关系资料读取失败，请重试。');
		expect(alert).not.toHaveTextContent(/private|relationships\.json/u);
		const retry = screen.getByRole('button', { name: '重试' });
		await act(async () => {
			for (let attempt = 0; attempt < 100; attempt += 1) {
				retry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}
			await Promise.resolve();
		});
		expect(loadData).toHaveBeenCalledTimes(2);
		await act(async () => {
			resolveRetry(data);
			await Promise.resolve();
		});

		fireEvent.click(await screen.findByRole('tab', { name: '关系矩阵' }));
		const narrativePosition = screen.getByRole('spinbutton', { name: '叙事位置' });
		expect(narrativePosition).toHaveAttribute(
			'data-testid',
			'relationship-graph-narrative-position'
		);
		fireEvent.change(narrativePosition, {
			target: { value: '4' }
		});

		expect(screen.getByText('怀疑')).toBeInTheDocument();
		expect(screen.queryByText('保护')).not.toBeInTheDocument();

		view.rerender(
			<RelationshipGraphPage projectRoot="D:/Older" loadData={loadData} />
		);
		await waitFor(() => expect(loadData).toHaveBeenCalledWith('D:/Older'));
		view.rerender(
			<RelationshipGraphPage projectRoot="D:/Latest" loadData={loadData} />
		);
		await screen.findByText(/0 条有效关系/u);
		await act(async () => {
			resolveStale(data);
			await Promise.resolve();
		});
		expect(screen.getByText(/0 条有效关系/u)).toBeInTheDocument();
		expect(screen.queryByText(/2 条有效关系/u)).not.toBeInTheDocument();
	});
});
