import { describe, expect, it } from 'vitest';
import {
	parseMentionLink,
	StorySchemaRegistry,
	type MentionLink,
	type StoryRepository,
	type StoryResource,
	type StoryResourceType,
	type StorySaveEntry
} from '@writing-buddy/story-kernel';
import { captureAnchorForEditor, createQuickCapture } from './QuickCaptureModel';
import { QuickCaptureConversionService } from './QuickCaptureConversionService';
import type { LinkSelectionInput } from '../story/manuscript/MentionService';

class ConversionRepository implements StoryRepository {
	readonly resources = new Map<string, StoryResource>();
	commits = 0;

	get<T extends StoryResource = StoryResource>(
		_type: StoryResourceType,
		id: string
	): Promise<T | undefined> {
		return Promise.resolve(this.resources.get(id) as T | undefined);
	}

	list<T extends StoryResource = StoryResource>(): Promise<readonly T[]> {
		return Promise.resolve([...this.resources.values()] as T[]);
	}

	save(): Promise<StoryResource> {
		throw new Error('not used');
	}

	commit(entries: readonly StorySaveEntry[]): Promise<readonly StoryResource[]> {
		this.commits += 1;
		const saved = entries.map(entry => {
			const value = entry.resource as { readonly type: StoryResourceType };
			const resource = StorySchemaRegistry.parse(value.type, entry.resource);
			this.resources.set(resource.id, resource);
			return resource;
		});
		return Promise.resolve(saved);
	}

	moveToTrash(): Promise<void> {
		throw new Error('not used');
	}

	restoreFromTrash(): Promise<StoryResource> {
		throw new Error('not used');
	}
}

describe('QuickCaptureConversionService', () => {
	it('creates one deterministic formal resource and one exact manuscript link', async () => {
		const manuscript = '夜雨落在旧车站的玻璃顶上。';
		const repository = new ConversionRepository();
		const links: MentionLink[] = [];
		const mentionService = {
			listBacklinks: () => Promise.resolve(links),
			linkSelection: vi.fn((input: LinkSelectionInput) => {
				const link = parseMentionLink({
					id: 'mention:from-capture-glass-roof',
					resourceId: input.resourceId,
					chapterId: input.chapterId,
					anchor: {
						start: input.start,
						end: input.end,
						revision: input.textRevision,
						quote: input.manuscript.slice(input.start, input.end),
						before: input.manuscript.slice(0, input.start),
						after: input.manuscript.slice(input.end)
					},
					displayText: input.manuscript.slice(input.start, input.end),
					status: 'active',
					revision: 1,
					createdAt: '2026-07-29T01:02:03.000Z',
					updatedAt: '2026-07-29T01:02:03.000Z'
				});
				links.push(link);
				return Promise.resolve(link);
			})
		};
		const service = new QuickCaptureConversionService(
			repository,
			mentionService,
			() => '2026-07-29T01:02:03.000Z'
		);
		const capture = createQuickCapture({
			projectId: 'novel-001',
			type: 'foreshadowing',
			text: '玻璃顶在终章再次出现',
			chapterId: 'chapter:chapter-001',
			anchor: captureAnchorForEditor(manuscript, 4, { start: 4, end: 7 })
		}, {
			id: () => 'capture:glass-roof',
			now: () => '2026-07-29T00:00:00.000Z'
		});

		const first = await service.convert(capture, 'foreshadowing', () => Promise.resolve({
			content: manuscript,
			textRevision: 2
		}));
		const second = await service.convert(capture, 'foreshadowing', () => Promise.resolve({
			content: manuscript,
			textRevision: 2
		}));

		expect(first.resource).toMatchObject({
			id: 'foreshadowing:from-capture-glass-roof',
			type: 'foreshadowing',
			title: '玻璃顶在终章再次出现',
			surfaceMeaning: '玻璃顶在终章再次出现',
			tags: ['快速记录', 'capture:glass-roof']
		});
		expect(second.resource.id).toBe(first.resource.id);
		expect(repository.commits).toBe(1);
		expect(mentionService.linkSelection).toHaveBeenCalledTimes(1);
		expect(mentionService.linkSelection).toHaveBeenCalledWith({
			resourceId: first.resource.id,
			chapterId: 'chapter:chapter-001',
			manuscript,
			start: 4,
			end: 7,
			textRevision: 2
		});
	});

	it('keeps the capture source when the old anchor can no longer resolve', async () => {
		const repository = new ConversionRepository();
		const mentionService = {
			listBacklinks: () => Promise.resolve([]),
			linkSelection: vi.fn()
		};
		const service = new QuickCaptureConversionService(repository, mentionService);
		const capture = createQuickCapture({
			projectId: 'novel-001',
			type: 'world',
			text: '机械钟会在 23:17 停止',
			chapterId: 'chapter:chapter-001',
			anchor: captureAnchorForEditor('机械钟停在 23:17。', 2)
		}, {
			id: () => 'capture:clock-rule',
			now: () => '2026-07-29T00:00:00.000Z'
		});

		const result = await service.convert(capture, 'worldRule', () => Promise.resolve({
			content: '这里已经改写。',
			textRevision: 3
		}));

		expect(result.sourceLinked).toBe(false);
		expect(result.resource.id).toBe('world-rule:from-capture-clock-rule');
		expect(mentionService.linkSelection).not.toHaveBeenCalled();
		expect(capture.anchor?.target).toBe('机械钟停在 23:17。');
	});
});
