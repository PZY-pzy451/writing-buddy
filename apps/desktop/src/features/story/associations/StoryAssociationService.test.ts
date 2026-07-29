import { describe, expect, it } from 'vitest';
import type { TextFile } from '@writing-buddy/domain';
import {
	parseStoryItem,
	StorySchemaRegistry,
	type Character,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import {
	ItemStateFileStore,
	type ItemStateStoragePort
} from '../assets/ItemAiReviewService';
import {
	resolveAssociationDrop,
	StoryAssociationService
} from './StoryAssociationService';

class MemoryItemStateStorage implements ItemStateStoragePort {
	private content = '[]\n';
	private hash = 'initial';

	readText(): Promise<TextFile> {
		return Promise.resolve({
			content: this.content,
			hash: this.hash,
			encoding: 'utf-8',
			eol: 'lf',
			hasBom: false
		});
	}

	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult> {
		if (request.expectedHash !== this.hash) throw new Error('externalChange');
		this.content = request.content;
		this.hash = `hash-${this.content.length}`;
		return Promise.resolve({
			hash: this.hash,
			modifiedAt: '2026-07-28T00:00:01.000Z',
			byteLength: new TextEncoder().encode(this.content).byteLength
		});
	}
}

const timestamp = '2026-07-28T00:00:00.000Z';

describe('StoryAssociationService', () => {
	it('only allows semantically meaningful source and target pairs', () => {
		const character = { type: 'character', id: 'character:lin', title: '林夏' } as const;
		const scene = { type: 'scene', id: 'scene:station', title: '旧车站' } as const;
		const holder = { type: 'character', id: 'character:zhou', title: '周屿' } as const;

		expect(resolveAssociationDrop(character, scene)).toMatchObject({
			allowed: true,
			label: '关联为当前场景出场人物'
		});
		expect(resolveAssociationDrop(character, holder)).toEqual({
			allowed: false,
			source: character,
			target: holder,
			reason: '人物不能移动到卷结构中；只能关联到章节或场景'
		});
		const foreshadowingIntent = resolveAssociationDrop(
			{ type: 'foreshadowing', id: 'foreshadowing:clock', title: '停摆时钟' },
			scene
		);
		expect(foreshadowingIntent.allowed).toBe(true);
		expect(foreshadowingIntent.allowed && foreshadowingIntent.label)
			.toContain('标记为伏笔回收');
	});

	it('records a confirmed holder transfer and restores the prior state on undo', async () => {
		const storage = new MemoryItemStateStorage();
		const store = new ItemStateFileStore('fixture', storage);
		const service = new StoryAssociationService(
			{} as StoryRepository,
			store
		);
		const item = parseStoryItem({
			id: 'item:umbrella',
			type: 'item',
			title: '旧伞',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			unique: true,
			restrictions: [],
			evidenceIds: []
		});
		const character = StorySchemaRegistry.parse('character', {
			id: 'character:lin',
			type: 'character',
			title: '林夏',
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			evidenceIds: []
		}) as unknown as Character;
		const receipt = await service.transferItem({
			item,
			character,
			position: {
				chapterId: 'chapter:opening',
				sceneId: 'scene:station',
				narrativeOrder: 10
			},
			quantity: 1
		});
		const saved = await store.load();

		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({
			itemId: item.id,
			holderCharacterId: character.id,
			confirmation: 'confirmed',
			effectiveFrom: {
				chapterId: 'chapter:opening',
				sceneId: 'scene:station',
				narrativeOrder: 10
			}
		});
		expect(receipt.kind === 'item-states' && receipt.description).toContain('创建转交状态事件');
		expect(receipt.kind === 'item-states' && receipt.description).toContain('未改变章节顺序或父级');
		await service.undo(receipt);
		expect(await store.load()).toEqual([]);
	});
});
