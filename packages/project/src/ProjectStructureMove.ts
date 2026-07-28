import type { WritingProject } from '@writing-buddy/domain';
import type {
	DragPayload,
	DropTarget,
	MoveCommand
} from '@writing-buddy/platform-ports';

export type DropRuleDecision =
	| {
		readonly allowed: true;
		readonly action: 'reorder' | 'move';
		readonly confirmationRequired: false;
		readonly label: string;
	}
	| {
		readonly allowed: false;
		readonly code: string;
		readonly reason: string;
	};

export class ProjectStructureMoveError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = 'ProjectStructureMoveError';
	}
}

export class DropRuleRegistry {
	evaluate(payload: DragPayload, target: DropTarget): DropRuleDecision {
		if (payload.entityIds.length !== 1) {
			return {
				allowed: false,
				code: 'projectMoveMultipleUnsupported',
				reason: '当前仅支持一次移动一个项目结构项。'
			};
		}
		if (payload.entityType === 'volume') {
			return ['before', 'after'].includes(target.targetType)
				? {
					allowed: true,
					action: 'reorder',
					confirmationRequired: false,
					label: '调整卷顺序'
				}
				: {
					allowed: false,
					code: 'projectMoveVolumeTargetInvalid',
					reason: '卷只能放在其他卷之前或之后。'
				};
		}
		if (payload.entityType === 'chapter') {
			return ['before', 'after', 'inside'].includes(target.targetType)
				? {
					allowed: true,
					action: payload.sourceContainerId === target.containerId ? 'reorder' : 'move',
					confirmationRequired: false,
					label: payload.sourceContainerId === target.containerId
						? '调整章节顺序'
						: '移动章节到其他卷'
				}
				: {
					allowed: false,
					code: 'projectMoveChapterTargetInvalid',
					reason: '章节只能放在卷内或其他章节之前、之后。'
				};
		}
		if (payload.entityType === 'scene') {
			return {
				allowed: false,
				code: 'projectMoveSceneRequiresManuscriptPlan',
				reason: '场景跨章需要同时迁移正文锚点，本门禁暂不开放。'
			};
		}
		return {
			allowed: false,
			code: 'projectMoveAssociationDeferred',
			reason: '资料关联拖拽将在后续门禁中实现。'
		};
	}
}

export interface AppliedProjectStructureMove {
	readonly project: WritingProject;
	readonly inverseCommand: MoveCommand;
	readonly description: string;
}

function moveError(code: string): never {
	throw new ProjectStructureMoveError(code);
}

function assertIndex(index: number, maxInclusive: number, code: string): void {
	if (!Number.isInteger(index) || index < 0 || index > maxInclusive) {
		moveError(code);
	}
}

export function applyProjectStructureMove(
	project: WritingProject,
	command: MoveCommand
): AppliedProjectStructureMove {
	if (command.entityIds.length !== 1) {
		moveError('projectMoveMultipleUnsupported');
	}
	const entityId = command.entityIds[0];
	if (!entityId) {
		moveError('projectMoveEntityMissing');
	}

	if (command.entityType === 'volume') {
		if (command.from.containerId !== project.projectId || command.to.containerId !== project.projectId) {
			moveError('projectMoveContainerInvalid');
		}
		assertIndex(command.from.index, project.volumes.length - 1, 'projectMoveSourceIndexInvalid');
		assertIndex(command.to.index, project.volumes.length - 1, 'projectMoveTargetIndexInvalid');
		const source = project.volumes[command.from.index];
		if (!source || source.id !== entityId) {
			moveError('projectMoveSourceChanged');
		}
		if (command.from.index === command.to.index) {
			moveError('projectMoveNoChange');
		}
		const volumes = [...project.volumes];
		volumes.splice(command.from.index, 1);
		volumes.splice(command.to.index, 0, source);
		return {
			project: { ...project, volumes },
			inverseCommand: {
				...command,
				commandId: `undo:${command.commandId}`,
				from: command.to,
				to: command.from
			},
			description: `已将“${source.title}”移动到第 ${command.to.index + 1} 位。`
		};
	}

	const sourceVolumeIndex = project.volumes.findIndex(
		volume => volume.id === command.from.containerId
	);
	const targetVolumeIndex = project.volumes.findIndex(
		volume => volume.id === command.to.containerId
	);
	if (sourceVolumeIndex < 0 || targetVolumeIndex < 0) {
		moveError('projectMoveContainerInvalid');
	}
	const sourceVolume = project.volumes[sourceVolumeIndex];
	const targetVolume = project.volumes[targetVolumeIndex];
	if (!sourceVolume || !targetVolume) {
		moveError('projectMoveContainerInvalid');
	}
	assertIndex(command.from.index, sourceVolume.chapters.length - 1, 'projectMoveSourceIndexInvalid');
	const source = sourceVolume.chapters[command.from.index];
	if (!source || source.id !== entityId) {
		moveError('projectMoveSourceChanged');
	}
	const sameVolume = sourceVolume.id === targetVolume.id;
	assertIndex(
		command.to.index,
		sameVolume ? targetVolume.chapters.length - 1 : targetVolume.chapters.length,
		'projectMoveTargetIndexInvalid'
	);
	if (sameVolume && command.from.index === command.to.index) {
		moveError('projectMoveNoChange');
	}

	const volumeCopies = project.volumes.map(volume => ({
		...volume,
		chapters: [...volume.chapters]
	}));
	const sourceCopy = volumeCopies[sourceVolumeIndex];
	const targetCopy = volumeCopies[targetVolumeIndex];
	if (!sourceCopy || !targetCopy) {
		moveError('projectMoveContainerInvalid');
	}
	sourceCopy.chapters.splice(command.from.index, 1);
	targetCopy.chapters.splice(command.to.index, 0, source);
	return {
		project: { ...project, volumes: volumeCopies },
		inverseCommand: {
			...command,
			commandId: `undo:${command.commandId}`,
			from: {
				containerId: command.to.containerId,
				index: command.to.index
			},
			to: {
				containerId: command.from.containerId,
				index: command.from.index
			}
		},
		description: `已将“${source.title}”移动到${targetVolume.title}第 ${command.to.index + 1} 位。`
	};
}
