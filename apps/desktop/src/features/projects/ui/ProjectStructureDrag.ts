import type { WritingProject } from '@writing-buddy/domain';
import type {
	DragPayload,
	DropTarget,
	MoveCommand
} from '@writing-buddy/platform-ports';
import { DropRuleRegistry } from '@writing-buddy/project';

export interface ProjectStructureDragItem {
	readonly entityType: MoveCommand['entityType'];
	readonly entityId: string;
	readonly title: string;
	readonly containerId: string;
	readonly index: number;
	readonly projectRevision: string;
}

export type ProjectStructureDropPlacement = 'before' | 'after';

export type ProjectStructureDropIntent =
	| {
		readonly allowed: true;
		readonly command: MoveCommand;
		readonly target: DropTarget;
		readonly label: string;
	}
	| {
		readonly allowed: false;
		readonly reason: string;
	};

function commandId(): string {
	return globalThis.crypto?.randomUUID?.()
		?? `project-move-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function volumeTitle(project: WritingProject, volumeId: string): string {
	return project.volumes.find(volume => volume.id === volumeId)?.title ?? '目标卷';
}

function indexAfterRemoval(
	sourceIndex: number,
	targetIndex: number,
	placement: ProjectStructureDropPlacement
): number {
	const slot = targetIndex + (placement === 'after' ? 1 : 0);
	return sourceIndex < slot ? slot - 1 : slot;
}

export function resolveProjectStructureDrop(
	project: WritingProject,
	active: ProjectStructureDragItem,
	over: ProjectStructureDragItem,
	placement: ProjectStructureDropPlacement
): ProjectStructureDropIntent {
	if (active.entityId === over.entityId) {
		return { allowed: false, reason: '项目已经在这个位置。' };
	}

	const payload: DragPayload = {
		entityType: active.entityType,
		entityIds: [active.entityId],
		sourceContainerId: active.containerId,
		sourceIndex: active.index,
		projectRevision: active.projectRevision
	};
	let target: DropTarget;
	let targetIndex: number;
	let label: string;

	if (active.entityType === 'volume') {
		if (over.entityType !== 'volume') {
			return { allowed: false, reason: '卷只能放在其他卷之前或之后。' };
		}
		target = {
			targetType: placement,
			containerId: project.projectId,
			targetEntityId: over.entityId
		};
		targetIndex = indexAfterRemoval(active.index, over.index, placement);
		label = `放到“${over.title}”${placement === 'before' ? '之前' : '之后'}`;
	} else if (over.entityType === 'volume') {
		const destination = project.volumes.find(volume => volume.id === over.entityId);
		if (!destination) {
			return { allowed: false, reason: '目标卷已经不存在。' };
		}
		target = {
			targetType: 'inside',
			containerId: over.entityId,
			targetEntityId: over.entityId
		};
		targetIndex = active.containerId === over.entityId
			? Math.max(0, destination.chapters.length - 1)
			: destination.chapters.length;
		label = `移到“${over.title}”末尾（第 ${targetIndex + 1} 位）`;
	} else {
		target = {
			targetType: placement,
			containerId: over.containerId,
			targetEntityId: over.entityId
		};
		targetIndex = active.containerId === over.containerId
			? indexAfterRemoval(active.index, over.index, placement)
			: over.index + (placement === 'after' ? 1 : 0);
		label = `移到“${volumeTitle(project, over.containerId)}”第 ${targetIndex + 1} 位`;
	}

	const decision = new DropRuleRegistry().evaluate(payload, target);
	if (!decision.allowed) {
		return { allowed: false, reason: decision.reason };
	}
	if (active.containerId === target.containerId && active.index === targetIndex) {
		return { allowed: false, reason: '项目已经在这个位置。' };
	}

	return {
		allowed: true,
		target,
		label,
		command: {
			commandId: commandId(),
			entityType: active.entityType,
			entityIds: [active.entityId],
			from: {
				containerId: active.containerId,
				index: active.index
			},
			to: {
				containerId: target.containerId,
				index: targetIndex
			},
			expectedProjectRevision: active.projectRevision
		}
	};
}
