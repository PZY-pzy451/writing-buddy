import { describe, expect, it, vi } from 'vitest';
import {
	StorySchemaRegistry,
	type Character,
	type StoryRepository
} from '@writing-buddy/story-kernel';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';
import {
	CharacterAiReviewService,
	CharacterStateFileStore,
	stageCharacterReviewBatch
} from './CharacterAiReviewService';

const now = '2026-07-27T12:00:00.000Z';

function character(overrides: Partial<Character> = {}): Character {
	return StorySchemaRegistry.parse('character', {
		id: 'character:lin-yue',
		type: 'character',
		title: '林越',
		aliases: ['阿越'],
		tags: [],
		schemaVersion: 1,
		createdAt: now,
		updatedAt: now,
		revision: 2,
		factionIds: [],
		goals: [],
		desires: [],
		fears: [],
		values: [],
		secrets: [],
		evidenceIds: [],
		...overrides
	}) as unknown as Character;
}

function repositoryFor(initial: readonly Character[]): {
	readonly repository: StoryRepository;
	readonly saved: Character[];
	readonly save: ReturnType<typeof vi.fn>;
} {
	const saved = [...initial];
	const save = vi.fn((resource: unknown, expectedRevision?: number) => {
		const parsed = StorySchemaRegistry.parse('character', resource) as unknown as Character;
		const index = saved.findIndex(item => item.id === parsed.id);
		if (index >= 0 && saved[index]?.revision !== expectedRevision) {
			throw new Error('revision conflict');
		}
		const next = { ...parsed, revision: (expectedRevision ?? -1) + 1 };
		if (index >= 0) saved[index] = next;
		else saved.push(next);
		return Promise.resolve(next);
	});
	const repository = {
		get: vi.fn((_type, id) => Promise.resolve(saved.find(item => item.id === id))),
		list: vi.fn(() => Promise.resolve(saved)),
		save,
		commit: vi.fn(),
		moveToTrash: vi.fn(),
		restoreFromTrash: vi.fn()
	} as unknown as StoryRepository;
	return { repository, saved, save };
}

function storage(): {
	readonly readText: (projectRoot: string, relativePath: string) => Promise<TextFile>;
	readonly writeTextAtomic: (request: AtomicWriteRequest) => Promise<AtomicWriteResult>;
} {
	let content = '[]';
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
			});
		})
	};
}

describe('CharacterAiReviewService', () => {
	it('deduplicates aliases, exposes existing-field conflicts, and blocks bad evidence', () => {
		const sourceContent = '林越在旧车站握紧钥匙。';
		const batch = stageCharacterReviewBatch({
			actionType: 'extract-from-chapter',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			existingCharacters: [character({ occupation: '记者' })],
			states: [],
			responses: [{
				title: '林越',
				confidence: 0.9,
				rationale: '正文点名。',
				fields: [{
					key: 'occupation',
					value: '侦探',
					evidence: { start: 0, end: 2, quote: '林越' }
				}, {
					key: 'state.inventory',
					value: ['钥匙'],
					evidence: { start: 7, end: 9, quote: '错误' }
				}]
			}, {
				title: '阿越',
				confidence: 0.8,
				rationale: '同一人物别名。',
				fields: [{
					key: 'aliases',
					value: ['阿越'],
					evidence: { start: 0, end: 2, quote: '林越' }
				}]
			}]
		});

		expect(batch.candidates).toHaveLength(1);
		expect(batch.candidates[0]).toMatchObject({
			matchedCharacterId: 'character:lin-yue',
			duplicateCount: 1
		});
		expect(batch.candidates[0]?.fields.find(field => field.key === 'occupation'))
			.toMatchObject({ selectedByDefault: false, blocking: false });
		expect(batch.candidates[0]?.fields.find(field => field.key === 'state.inventory'))
			.toMatchObject({ selectedByDefault: false, blocking: true });
	});

	it('snapshots and applies only selected dossier and state fields', async () => {
		const sourceContent = '林越在旧车站握紧钥匙。';
		const existing = character({ occupation: '记者' });
		const batch = stageCharacterReviewBatch({
			actionType: 'extract-from-chapter',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			existingCharacters: [existing],
			states: [],
			responses: [{
				title: '林越',
				confidence: 0.95,
				rationale: '正文明确。',
				fields: [{
					key: 'appearance',
					value: '穿深色雨衣',
					evidence: { start: 0, end: 2, quote: '林越' }
				}, {
					key: 'state.inventory',
					value: ['钥匙'],
					evidence: { start: 8, end: 10, quote: '钥匙' }
				}, {
					key: 'occupation',
					value: '侦探',
					evidence: { start: 0, end: 2, quote: '林越' }
				}]
			}]
		});
		const candidate = batch.candidates[0];
		const selected = candidate.fields
			.filter(field => field.key !== 'occupation')
			.map(field => field.id);
		const memory = repositoryFor([existing]);
		const createSnapshot = vi.fn(() => Promise.resolve('snapshot:character'));
		const service = new CharacterAiReviewService(
			memory.repository,
			new CharacterStateFileStore('P:/fixture', storage()),
			createSnapshot
		);

		const result = await service.apply({
			batch,
			candidateId: candidate.id,
			selectedFieldIds: selected,
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent,
			now: '2026-07-27T12:05:00.000Z'
		});

		expect(createSnapshot).toHaveBeenCalledBefore(memory.save);
		expect(result.character).toMatchObject({
			appearance: '穿深色雨衣',
			occupation: '记者',
			revision: 3
		});
		expect(result.states).toHaveLength(1);
		expect(result.states[0]).toMatchObject({
			characterId: 'character:lin-yue',
			kind: 'inventory',
			value: ['钥匙'],
			confirmation: 'confirmed'
		});
	});

	it('rejects stale source and stale matched-character revisions', async () => {
		const existing = character();
		const sourceContent = '林越回头。';
		const batch = stageCharacterReviewBatch({
			actionType: 'generate-background',
			sourceResourceId: 'chapter:one',
			sourceRevision: 'hash:7',
			sourceContent,
			narrativeOrder: 3,
			existingCharacters: [existing],
			states: [],
			responses: [{
				title: '林越',
				confidence: 0.8,
				rationale: '背景候选。',
				fields: [{ key: 'birth', value: '北方小城', evidence: null }]
			}]
		});
		const memory = repositoryFor([{ ...existing, revision: 3 }]);
		const service = new CharacterAiReviewService(
			memory.repository,
			new CharacterStateFileStore('P:/fixture', storage()),
			vi.fn()
		);
		await expect(service.apply({
			batch,
			candidateId: batch.candidates[0].id,
			selectedFieldIds: [batch.candidates[0].fields[0].id],
			currentSourceRevision: 'hash:7',
			currentSourceContent: sourceContent
		})).rejects.toThrow('staleCharacterCandidate');
	});
});
