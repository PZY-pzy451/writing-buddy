import { describe, expect, it, vi } from 'vitest';
import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	StorySchemaRegistry,
	parseItemState,
	type ItemState,
	type StoryItem,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import {
	ItemAiReviewService,
	ItemStateFileStore,
	stageItemReviewBatch
} from './ItemAiReviewService';

const now = '2026-07-27T12:00:00.000Z';
const sourceContent = '徐青在旧车站把褪色车票交给林墨。';

function item(revision = 2): StoryItem {
	return StorySchemaRegistry.parse('item', {
		id: 'item:faded-ticket',
		type: 'item',
		title: '褪色车票',
		aliases: [],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision,
		itemType: '线索',
		unique: true,
		quantityUnit: '张',
		description: '一张旧车票。',
		restrictions: [],
		plotFunction: '指向旧站事故。',
		evidenceIds: []
	}) as unknown as StoryItem;
}

function state(order = 1): ItemState {
	return parseItemState({
		id: 'item-state:ticket-xu',
		itemId: 'item:faded-ticket',
		action: 'acquired',
		quantity: 1,
		holderCharacterId: 'character:xu-qing',
		locationId: 'location:old-station',
		condition: '受潮',
		effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: order },
		evidenceIds: [],
		confirmation: 'confirmed',
		revision: 0
	});
}

function storage(initial: readonly ItemState[]) {
	let content = JSON.stringify(initial);
	let hash = 'states:0';
	return {
		readText: vi.fn(() => Promise.resolve({
			content,
			hash,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		} as TextFile)),
		writeTextAtomic: vi.fn((request: AtomicWriteRequest) => {
			if (request.expectedHash !== hash) throw new Error('hash conflict');
			content = request.content;
			hash = `states:${content.length}`;
			return Promise.resolve({
				hash,
				byteLength: new TextEncoder().encode(content).byteLength,
				modifiedAt: now
			} as AtomicWriteResult);
		})
	};
}

const characters = [
	{ id: 'character:xu-qing', title: '徐青' },
	{ id: 'character:lin-mo', title: '林墨' }
];
const locations = [{ id: 'location:old-station', title: '旧车站' }];

function response() {
	return {
		title: '褪色车票',
		aliases: [] as string[],
		itemType: '线索',
		unique: true,
		quantityUnit: '张',
		description: '边缘被雨水泡软的旧车票。',
		restrictions: ['票面编号只能辨认一次'],
		plotFunction: '连接失踪者与旧站事故。',
		confidence: 0.94,
		rationale: '正文明确发生转移。',
		evidence: { start: 7, end: 11, quote: '褪色车票' },
		states: [{
			action: 'transferred' as const,
			quantity: 1,
			holderCharacterId: 'character:lin-mo',
			locationId: 'location:old-station',
			condition: '受潮',
			evidence: { start: 0, end: sourceContent.length, quote: sourceContent }
		}]
	};
}

describe('ItemAiReviewService', () => {
	it('allows a later transfer but blocks overlapping holders at the same position', () => {
		const later = stageItemReviewBatch({
			actionType: 'extract-items',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			items: [item()],
			states: [state()],
			characters,
			locations,
			responses: [response()]
		});
		expect(later.candidates[0]?.states[0]).toMatchObject({
			holderTitle: '林墨',
			blocking: false,
			selectedByDefault: true
		});

		const overlapping = stageItemReviewBatch({
			actionType: 'extract-items',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 1,
			items: [item()],
			states: [state()],
			characters,
			locations,
			responses: [response()]
		});
		expect(overlapping.candidates[0]?.states[0]).toMatchObject({
			blocking: true
		});
		expect(overlapping.candidates[0]?.states[0]?.conflict).toContain('两个持有人');
	});

	it('snapshots, preserves unselected fields, closes prior state, and appends transfer', async () => {
		const current = item();
		const previous = state();
		const batch = stageItemReviewBatch({
			actionType: 'extract-items',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			items: [current],
			states: [previous],
			characters,
			locations,
			responses: [response()]
		});
		const candidate = batch.candidates[0];
		const save = vi.fn((resource: unknown) => Promise.resolve({
			...(resource as StoryItem),
			revision: 3
		}));
		const repository = {
			get: vi.fn(() => Promise.resolve(current)),
			save
		} as unknown as StoryRepository;
		const snapshot = vi.fn(() => Promise.resolve('snapshot:item'));
		const service = new ItemAiReviewService(
			repository,
			new ItemStateFileStore('P:/fixture', storage([previous])),
			snapshot
		);
		const selectedFields = candidate.fields
			.filter(field => field.key !== 'description')
			.map(field => field.id);

		const result = await service.apply({
			batch,
			candidateId: candidate.id,
			selectedFieldIds: selectedFields,
			selectedStateIds: [candidate.states[0].id],
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent,
			now: '2026-07-27T12:05:00.000Z'
		});

		expect(snapshot).toHaveBeenCalledBefore(save);
		expect(result.item.description).toBe('一张旧车票。');
		expect(result.states).toHaveLength(2);
		expect(result.states[0]?.effectiveUntil).toMatchObject({ narrativeOrder: 3 });
		expect(result.states[1]).toMatchObject({
			action: 'transferred',
			holderCharacterId: 'character:lin-mo',
			confirmation: 'confirmed'
		});
	});

	it('rejects stale matched item revisions', async () => {
		const current = item();
		const batch = stageItemReviewBatch({
			actionType: 'generate-item-history',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			items: [current],
			states: [],
			characters,
			locations,
			responses: [response()]
		});
		const service = new ItemAiReviewService({
			get: vi.fn(() => Promise.resolve(item(3)))
		} as unknown as StoryRepository, new ItemStateFileStore(
			'P:/fixture',
			storage([])
		), vi.fn());
		await expect(service.apply({
			batch,
			candidateId: batch.candidates[0].id,
			selectedFieldIds: [batch.candidates[0].fields[0].id],
			selectedStateIds: [],
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent
		})).rejects.toThrow('staleItemCandidate');
	});
});
