import { describe, expect, it } from 'vitest';
import { emptySceneMetadata } from '@writing-buddy/domain';
import type {
	MoveCommand,
	ProjectSnapshot,
	SceneMoveCommitRequest,
	SceneMoveCommitResult
} from '@writing-buddy/platform-ports';
import {
	parseMentionLink,
	type MentionSaveEntry,
	type StoryResourceType,
	type StorySaveEntry
} from '@writing-buddy/story-kernel';
import { ProjectSceneMoveService } from './ProjectSceneMoveService';

const timestamp = '2026-07-28T00:00:00.000Z';
const hash = (content: string) => `hash:${content}`;

function snapshot(): ProjectSnapshot {
	return {
		root: 'C:\\sanitized\\scene-move',
		project: {
			schemaVersion: 1,
			projectId: 'project-scene-move',
			title: 'Sanitized',
			volumes: [{
				id: 'volume-one',
				title: 'Volume',
				chapters: [{
					id: 'chapter-one',
					title: 'One',
					file: 'chapters/one.md',
					scene: emptySceneMetadata()
				}, {
					id: 'chapter-two',
					title: 'Two',
					file: 'chapters/two.md',
					scene: emptySceneMetadata()
				}]
			}]
		},
		projectRevision: 'project-revision',
		resources: [],
		wordCounts: {},
		integrityIssues: [],
		readOnly: false
	};
}

function sourceScene() {
	return {
		id: 'scene:first',
		type: 'scene' as const,
		title: 'First',
		aliases: [],
		tags: [],
		schemaVersion: 1 as const,
		createdAt: timestamp,
		updatedAt: timestamp,
		revision: 1,
		chapterId: 'chapter:chapter-one',
		manuscriptRange: {
			start: 0,
			end: 3,
			revision: 1,
			quote: 'AAA'
		},
		narrativeOrder: 0,
		locationIds: [],
		participantIds: [],
		plotThreadIds: [],
		revealInformationIds: [],
		foreshadowingIds: [],
		evidenceIds: []
	};
}

class SceneMoveGateway {
	readonly files = new Map([
		['chapters/one.md', 'AAA--tail'],
		['chapters/two.md', 'TARGET']
	]);
	readonly resources = new Map<string, unknown>([[sourceScene().id, sourceScene()]]);
	readonly mentions = new Map<string, unknown>();

	async readText(_root: string, relativePath: string) {
		await Promise.resolve();
		const content = this.files.get(relativePath);
		if (content === undefined) throw new Error('missing');
		return {
			content,
			encoding: 'utf-8' as const,
			eol: 'lf' as const,
			hasBom: false,
			hash: hash(content)
		};
	}

	async listStoryResources(_root: string, type: StoryResourceType) {
		await Promise.resolve();
		return [...this.resources.values()].filter(value => (
			(value as { readonly type?: string }).type === type
		));
	}

	async listMentionLinks() {
		await Promise.resolve();
		return [...this.mentions.values()];
	}

	async commitSceneMove(request: SceneMoveCommitRequest): Promise<SceneMoveCommitResult> {
		await Promise.resolve();
		for (const manuscript of request.manuscripts) {
			const current = this.files.get(manuscript.relativePath);
			if (current === undefined || hash(current) !== manuscript.expectedHash) {
				throw new Error('sceneMoveTextConflict');
			}
		}
		const savedResources = request.storyEntries.map((entry: StorySaveEntry) => {
			const resource = entry.resource as Readonly<Record<string, unknown>> & {
				readonly id: string;
				readonly revision: number;
			};
			const current = this.resources.get(resource.id) as {
				readonly revision: number;
			} | undefined;
			if (current?.revision !== entry.expectedRevision) {
				throw new Error('sceneMoveStoryRevisionConflict');
			}
			return {
				...resource,
				revision: (current?.revision ?? 0) + 1,
				updatedAt: timestamp
			};
		});
		const savedMentions = request.mentionEntries.map((entry: MentionSaveEntry) => {
			const mention = parseMentionLink(entry.mention);
			const current = this.mentions.get(mention.id);
			if (current && parseMentionLink(current).revision !== entry.expectedRevision) {
				throw new Error('sceneMoveMentionRevisionConflict');
			}
			return {
				...mention,
				revision: mention.revision + 1,
				updatedAt: timestamp
			};
		});
		for (const manuscript of request.manuscripts) {
			this.files.set(manuscript.relativePath, manuscript.content);
		}
		for (const resource of savedResources) {
			this.resources.set((resource as { readonly id: string }).id, resource);
		}
		for (const mention of savedMentions) {
			this.mentions.set(mention.id, mention);
		}
		return {
			storyResources: savedResources,
			mentions: savedMentions,
			manuscripts: request.manuscripts.map(manuscript => ({
				chapterId: manuscript.chapterId,
				relativePath: manuscript.relativePath,
				hash: hash(manuscript.content),
				byteLength: manuscript.content.length
			}))
		};
	}
}

describe('ProjectSceneMoveService', () => {
	it('moves and exactly restores manuscript bytes through its Undo receipt', async () => {
		const gateway = new SceneMoveGateway();
		const service = new ProjectSceneMoveService(gateway);
		const command: MoveCommand = {
			commandId: 'move:first',
			entityType: 'scene',
			entityIds: ['scene:first'],
			from: { containerId: 'chapter:chapter-one', index: 0 },
			to: { containerId: 'chapter:chapter-two', index: 0 },
			expectedProjectRevision: 'project-revision'
		};

		const moved = await service.execute(snapshot(), command);
		expect(gateway.files.get('chapters/one.md')).toBe('--tail');
		expect(gateway.files.get('chapters/two.md')).toBe('TARGETAAA');
		expect(moved.scenes[0]).toMatchObject({
			id: 'scene:first',
			chapterId: 'chapter:chapter-two',
			manuscriptRange: { start: 6, end: 9 }
		});

		const restored = await service.undo(snapshot(), moved.undoReceipt);
		expect(gateway.files.get('chapters/one.md')).toBe('AAA--tail');
		expect(gateway.files.get('chapters/two.md')).toBe('TARGET');
		expect(restored.scenes[0]).toMatchObject({
			id: 'scene:first',
			chapterId: 'chapter:chapter-one',
			manuscriptRange: { start: 0, end: 3 }
		});
	});

	it('rejects a dirty project revision before reading manuscripts', async () => {
		const gateway = new SceneMoveGateway();
		const service = new ProjectSceneMoveService(gateway);
		await expect(service.execute(snapshot(), {
			commandId: 'move:stale',
			entityType: 'scene',
			entityIds: ['scene:first'],
			from: { containerId: 'chapter:chapter-one', index: 0 },
			to: { containerId: 'chapter:chapter-two', index: 0 },
			expectedProjectRevision: 'stale'
		})).rejects.toMatchObject({ code: 'sceneMoveProjectRevisionConflict' });
	});
});
