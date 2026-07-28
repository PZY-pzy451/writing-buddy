import { flattenChapters, type TextFile } from '@writing-buddy/domain';
import type {
	DesktopBridge,
	MoveCommand,
	ProjectSnapshot,
	SceneMoveCommitRequest
} from '@writing-buddy/platform-ports';
import {
	parseMentionLink,
	planSceneMove,
	StorySchemaRegistry,
	storyResourceTypes,
	toStoryChapterId,
	type MentionLink,
	type StoryResource,
	type StoryScene
} from '@writing-buddy/story-kernel';

type ProjectSceneMoveGateway = Pick<
	DesktopBridge,
	| 'readText'
	| 'listStoryResources'
	| 'listMentionLinks'
	| 'commitSceneMove'
>;

export interface ProjectSceneMoveUndoReceipt {
	readonly command: MoveCommand;
	readonly request: SceneMoveCommitRequest;
	readonly description: string;
}

export interface ProjectSceneMoveResult {
	readonly scenes: readonly StoryScene[];
	readonly description: string;
	readonly affectedChapterIds: readonly string[];
	readonly wordCountContent: Readonly<Record<string, string>>;
	readonly undoReceipt: ProjectSceneMoveUndoReceipt;
}

export class ProjectSceneMoveGatewayError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProjectSceneMoveGatewayError';
	}
}

function gatewayCode(error: unknown): string {
	const message = typeof error === 'string'
		? error
		: error instanceof Error
			? error.message
			: 'sceneMoveFailed';
	const code = message.split(':')[0] ?? 'sceneMoveFailed';
	if (code === 'storyRevisionConflict') return 'sceneMoveStoryRevisionConflict';
	if (code === 'mentionRevisionConflict') return 'sceneMoveMentionRevisionConflict';
	if (code.startsWith('externalChange')) return 'sceneMoveTextConflict';
	return code;
}

function chapterFiles(snapshot: ProjectSnapshot): ReadonlyMap<string, {
	readonly projectChapterId: string;
	readonly relativePath: string;
}> {
	return new Map(flattenChapters(snapshot.project).map(chapter => [
		toStoryChapterId(chapter.id),
		{ projectChapterId: chapter.id, relativePath: chapter.file }
	]));
}

function replaceSavedScenes(
	scenes: readonly StoryScene[],
	resources: readonly StoryResource[]
): readonly StoryScene[] {
	const saved = new Map(
		resources
			.filter((resource): resource is StoryScene => resource.type === 'scene')
			.map(scene => [scene.id, scene])
	);
	return scenes
		.map(scene => saved.get(scene.id) ?? scene)
		.sort((left, right) => (
			left.chapterId.localeCompare(right.chapterId)
			|| left.narrativeOrder - right.narrativeOrder
			|| left.manuscriptRange.start - right.manuscriptRange.start
			|| left.id.localeCompare(right.id)
		));
}

function restoreRequest(input: {
	readonly snapshot: ProjectSnapshot;
	readonly command: MoveCommand;
	readonly plan: ReturnType<typeof planSceneMove>;
	readonly files: ReadonlyMap<string, {
		readonly projectChapterId: string;
		readonly relativePath: string;
	}>;
	readonly textByChapter: ReadonlyMap<string, TextFile>;
	readonly savedResources: readonly StoryResource[];
	readonly savedMentions: readonly MentionLink[];
	readonly committedManuscripts: readonly {
		readonly chapterId: string;
		readonly hash: string;
	}[];
}): SceneMoveCommitRequest {
	const savedResourceById = new Map(input.savedResources.map(resource => [resource.id, resource]));
	const savedMentionById = new Map(input.savedMentions.map(mention => [mention.id, mention]));
	const committedHashByChapter = new Map(
		input.committedManuscripts.map(manuscript => [manuscript.chapterId, manuscript.hash])
	);
	return {
		projectRoot: input.snapshot.root,
		commandId: `undo:${input.command.commandId}`,
		sceneId: input.command.entityIds[0] ?? '',
		fromChapterId: input.command.to.containerId,
		toChapterId: input.command.from.containerId,
		expectedProjectRevision: input.snapshot.projectRevision,
		manuscripts: input.plan.manuscripts.map(change => {
			const chapter = input.files.get(change.chapterId);
			const text = input.textByChapter.get(change.chapterId);
			const expectedHash = committedHashByChapter.get(change.chapterId);
			if (!chapter || !text || !expectedHash) {
				throw new Error('sceneMoveVerificationFailed');
			}
			return {
				chapterId: change.chapterId,
				relativePath: chapter.relativePath,
				content: change.before,
				expectedHash,
				eol: text.eol,
				hasBom: text.hasBom
			};
		}),
		storyEntries: input.plan.beforeResources.map(resource => {
			const saved = savedResourceById.get(resource.id);
			if (!saved) throw new Error('sceneMoveVerificationFailed');
			return { resource, expectedRevision: saved.revision };
		}),
		mentionEntries: input.plan.beforeMentions.map(mention => {
			const saved = savedMentionById.get(mention.id);
			if (!saved) throw new Error('sceneMoveVerificationFailed');
			return { mention, expectedRevision: saved.revision };
		})
	};
}

export class ProjectSceneMoveService {
	constructor(private readonly gateway: ProjectSceneMoveGateway) {}

	async listScenes(projectRoot: string): Promise<readonly StoryScene[]> {
		return (await this.gateway.listStoryResources(projectRoot, 'scene'))
			.map(value => StorySchemaRegistry.parse('scene', value) as StoryScene);
	}

	async execute(
		snapshot: ProjectSnapshot,
		command: MoveCommand
	): Promise<ProjectSceneMoveResult> {
		if (snapshot.readOnly) throw new ProjectSceneMoveGatewayError('projectReadOnly');
		if (command.entityType !== 'scene' || command.entityIds.length !== 1) {
			throw new ProjectSceneMoveGatewayError('sceneMoveTargetInvalid');
		}
		if (command.expectedProjectRevision !== snapshot.projectRevision) {
			throw new ProjectSceneMoveGatewayError('sceneMoveProjectRevisionConflict');
		}
		const files = chapterFiles(snapshot);
		const source = files.get(command.from.containerId);
		const target = files.get(command.to.containerId);
		if (!source || !target) {
			throw new ProjectSceneMoveGatewayError('sceneMoveTargetInvalid');
		}
		const affectedChapterIds = [...new Set([
			command.from.containerId,
			command.to.containerId
		])];
		const textEntries = await Promise.all(affectedChapterIds.map(async chapterId => {
			const chapter = files.get(chapterId);
			if (!chapter) throw new Error('sceneMoveTargetInvalid');
			return [chapterId, await this.gateway.readText(
				snapshot.root,
				chapter.relativePath
			)] as const;
		}));
		const textByChapter = new Map(textEntries);
		try {
			const [resourceLists, rawMentions] = await Promise.all([
				Promise.all(storyResourceTypes.map(async type => (
					await this.gateway.listStoryResources(snapshot.root, type)
				).map(value => StorySchemaRegistry.parse(type, value)))),
				this.gateway.listMentionLinks(snapshot.root)
			]);
			const resources = resourceLists.flat() as readonly StoryResource[];
			const scenes = resources.filter(
				(resource): resource is StoryScene => resource.type === 'scene'
			);
			const mentions = rawMentions.map(parseMentionLink);
			const plan = planSceneMove({
				intent: {
					sceneId: command.entityIds[0] ?? '',
					from: command.from,
					to: command.to
				},
				manuscripts: affectedChapterIds.map(chapterId => ({
					chapterId,
					content: textByChapter.get(chapterId)?.content ?? ''
				})),
				scenes,
				mentions,
				resources
			});
			const request: SceneMoveCommitRequest = {
				projectRoot: snapshot.root,
				commandId: command.commandId,
				sceneId: command.entityIds[0] ?? '',
				fromChapterId: command.from.containerId,
				toChapterId: command.to.containerId,
				expectedProjectRevision: snapshot.projectRevision,
				manuscripts: plan.manuscripts.map(change => {
					const chapter = files.get(change.chapterId);
					const text = textByChapter.get(change.chapterId);
					if (!chapter || !text) throw new Error('sceneMoveTargetInvalid');
					return {
						chapterId: change.chapterId,
						relativePath: chapter.relativePath,
						content: change.after,
						expectedHash: text.hash,
						eol: text.eol,
						hasBom: text.hasBom
					};
				}),
				storyEntries: plan.afterResources.map((resource, index) => ({
					resource,
					expectedRevision: plan.beforeResources[index]?.revision
				})),
				mentionEntries: plan.afterMentions.map((mention, index) => ({
					mention,
					expectedRevision: plan.beforeMentions[index]?.revision
				}))
			};
			const committed = await this.gateway.commitSceneMove(request);
			const savedResources = committed.storyResources.map(value => {
				if (!value || typeof value !== 'object' || !('type' in value)) {
					throw new Error('sceneMoveVerificationFailed');
				}
				const type = (value as { readonly type: StoryResource['type'] }).type;
				return StorySchemaRegistry.parse(type, value);
			});
			const savedMentions = committed.mentions.map(parseMentionLink);
			const undoRequest = restoreRequest({
				snapshot,
				command,
				plan,
				files,
				textByChapter,
				savedResources,
				savedMentions,
				committedManuscripts: committed.manuscripts
			});
			return {
				scenes: replaceSavedScenes(scenes, savedResources),
				description: plan.description,
				affectedChapterIds,
				wordCountContent: Object.fromEntries(plan.manuscripts.map(change => {
					const projectId = files.get(change.chapterId)?.projectChapterId;
					if (!projectId) throw new Error('sceneMoveVerificationFailed');
					return [projectId, change.after];
				})),
				undoReceipt: {
					command: {
						...command,
						commandId: `undo:${command.commandId}`,
						from: command.to,
						to: command.from
					},
					request: undoRequest,
					description: plan.description
				}
			};
		} catch (error) {
			throw new ProjectSceneMoveGatewayError(gatewayCode(error));
		}
	}

	async undo(
		snapshot: ProjectSnapshot,
		receipt: ProjectSceneMoveUndoReceipt
	): Promise<ProjectSceneMoveResult> {
		try {
			const committed = await this.gateway.commitSceneMove(receipt.request);
			const resources = committed.storyResources.map(value => {
				if (!value || typeof value !== 'object' || !('type' in value)) {
					throw new Error('sceneMoveVerificationFailed');
				}
				const type = (value as { readonly type: StoryResource['type'] }).type;
				return StorySchemaRegistry.parse(type, value);
			});
			const allScenes = await this.listScenes(snapshot.root);
			const files = chapterFiles(snapshot);
			const wordCountContent = Object.fromEntries(
				await Promise.all(committed.manuscripts.map(async manuscript => {
					const projectId = files.get(manuscript.chapterId)?.projectChapterId;
					if (!projectId) throw new Error('sceneMoveVerificationFailed');
					const text = await this.gateway.readText(snapshot.root, manuscript.relativePath);
					return [projectId, text.content] as const;
				}))
			);
			return {
				scenes: replaceSavedScenes(allScenes, resources),
				description: `已撤销：${receipt.description}`,
				affectedChapterIds: committed.manuscripts.map(item => item.chapterId),
				wordCountContent,
				undoReceipt: receipt
			};
		} catch (error) {
			throw new ProjectSceneMoveGatewayError(gatewayCode(error));
		}
	}
}
