import {
	parseCreationJourneyState,
	type CreationJourneyState,
	type OutlineNodeType,
	type StoryOutlineNode
} from './CreationJourneyModel';

export type HierarchyExpansionTarget =
	| { readonly kind: 'story' }
	| { readonly kind: 'volume'; readonly id: string }
	| { readonly kind: 'chapter'; readonly id: string };

export interface HierarchyExpansionCandidate {
	readonly title: string;
	readonly summary: string;
	readonly goal?: string;
	readonly conflict?: string;
	readonly outcome?: string;
	readonly hook?: string;
	readonly povHint?: string;
	readonly locationHint?: string;
	readonly characterHints?: readonly string[];
	readonly sourceNodeIds?: readonly string[];
}

export interface HierarchyExpansionConflict {
	readonly code: 'duplicate-title' | 'duplicate-candidate' | 'invalid-parent';
	readonly title: string;
	readonly existingId?: string;
}

export interface HierarchyExpansionPreview {
	readonly target: HierarchyExpansionTarget;
	readonly childType: Extract<OutlineNodeType, 'volume' | 'chapter' | 'scene'>;
	readonly candidates: readonly StoryOutlineNode[];
	readonly createCount: number;
	readonly existingPreservedIds: readonly string[];
	readonly lockedPreservedIds: readonly string[];
	readonly conflicts: readonly HierarchyExpansionConflict[];
}

export interface WritableHierarchySummary {
	readonly volumeCount: number;
	readonly chapterCount: number;
	readonly sceneCount: number;
}

function normalizedTitle(value: string): string {
	return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

function targetType(target: HierarchyExpansionTarget): HierarchyExpansionPreview['childType'] {
	if (target.kind === 'story') return 'volume';
	if (target.kind === 'volume') return 'chapter';
	return 'scene';
}

function targetParentId(target: HierarchyExpansionTarget): string | undefined {
	return target.kind === 'story' ? undefined : target.id;
}

function assertTarget(
	state: CreationJourneyState,
	target: HierarchyExpansionTarget
): void {
	if (target.kind === 'story') {
		if (!state.storyOutline) throw new Error('creationJourneyStoryOutlineNotFound');
		return;
	}
	const node = state.outline.find(candidate => candidate.id === target.id);
	if (!node || node.type !== target.kind) {
		throw new Error('outlineHierarchyTargetInvalid');
	}
	if (node.resourceId) {
		throw new Error('outlineHierarchyAlreadyMaterialized');
	}
}

export function buildHierarchyExpansionPreview(
	state: CreationJourneyState,
	target: HierarchyExpansionTarget,
	candidates: readonly HierarchyExpansionCandidate[],
	createId: (type: HierarchyExpansionPreview['childType'], index: number) => string
): HierarchyExpansionPreview {
	assertTarget(state, target);
	if (candidates.length < 1 || candidates.length > 24) {
		throw new Error('outlineHierarchyCandidateCountInvalid');
	}
	const childType = targetType(target);
	const parentId = targetParentId(target);
	const existing = state.outline.filter(node => (
		node.type === childType && node.parentId === parentId
	));
	const existingByTitle = new Map(existing.map(node => [normalizedTitle(node.title), node]));
	const candidateTitles = new Set<string>();
	const conflicts: HierarchyExpansionConflict[] = [];
	const created = candidates.map((candidate, index): StoryOutlineNode => {
		const title = candidate.title.trim();
		const normalized = normalizedTitle(title);
		const existingNode = existingByTitle.get(normalized);
		if (existingNode) {
			conflicts.push({
				code: 'duplicate-title',
				title,
				existingId: existingNode.id
			});
		}
		if (candidateTitles.has(normalized)) {
			conflicts.push({ code: 'duplicate-candidate', title });
		}
		candidateTitles.add(normalized);
		return {
			id: createId(childType, index),
			type: childType,
			parentId,
			order: existing.length + index,
			title,
			summary: candidate.summary.trim(),
			purpose: (candidate.goal ?? candidate.summary).trim(),
			goal: candidate.goal?.trim() ?? '',
			conflict: candidate.conflict?.trim() ?? '',
			outcome: candidate.outcome?.trim() ?? '',
			hook: candidate.hook?.trim() ?? '',
			povHint: candidate.povHint?.trim() ?? '',
			locationHint: candidate.locationHint?.trim() ?? '',
			characterHints: candidate.characterHints?.map(value => value.trim()).filter(Boolean) ?? [],
			characterIds: [],
			plotThreadIds: [],
			foreshadowingIds: [],
			status: childType === 'scene' ? 'ready_to_write' : 'planned',
			source: 'ai_generated',
			revision: 1
		};
	});
	return {
		target,
		childType,
		candidates: created,
		createCount: created.length,
		existingPreservedIds: existing.map(node => node.id),
		lockedPreservedIds: existing
			.filter(node => state.locks.outlineNodeIds.includes(node.id))
			.map(node => node.id),
		conflicts
	};
}

export function applyHierarchyExpansionPreview(
	state: CreationJourneyState,
	preview: HierarchyExpansionPreview,
	now: () => string = () => new Date().toISOString()
): CreationJourneyState {
	assertTarget(state, preview.target);
	if (preview.conflicts.length > 0) {
		throw new Error('outlineHierarchyExpansionConflict');
	}
	const currentChildren = state.outline.filter(node => (
		node.type === preview.childType
		&& node.parentId === targetParentId(preview.target)
	));
	if (
		currentChildren.length !== preview.existingPreservedIds.length
		|| currentChildren.some(node => !preview.existingPreservedIds.includes(node.id))
		|| preview.lockedPreservedIds.some(id => !state.locks.outlineNodeIds.includes(id))
	) {
		throw new Error('outlineHierarchyPreviewStale');
	}
	const allIds = new Set(state.outline.map(node => node.id));
	if (preview.candidates.some(node => allIds.has(node.id))) {
		throw new Error('outlineHierarchyDuplicateId');
	}
	return parseCreationJourneyState(JSON.stringify({
		...state,
		outline: [...state.outline, ...preview.candidates],
		revision: state.revision + 1,
		updatedAt: now()
	}));
}

export function validateWritableHierarchy(
	state: CreationJourneyState
): WritableHierarchySummary {
	const volumes = state.outline.filter(node => node.type === 'volume');
	const chapters = state.outline.filter(node => node.type === 'chapter');
	const scenes = state.outline.filter(node => node.type === 'scene');
	if ([...volumes, ...chapters, ...scenes].some(node => node.resourceId)) {
		throw new Error('outlineHierarchyAlreadyMaterialized');
	}
	if (
		volumes.length < 1
		|| chapters.length < 1
		|| scenes.length < 1
		|| volumes.some(volume => !chapters.some(chapter => chapter.parentId === volume.id))
		|| chapters.some(chapter => !scenes.some(scene => scene.parentId === chapter.id))
	) {
		throw new Error('outlineHierarchyIncomplete');
	}
	if (
		state.locks.outlineNodeIds.some(id => {
			const node = state.outline.find(candidate => candidate.id === id);
			return node?.type !== undefined && node.type !== 'story_beat';
		})
	) {
		throw new Error('outlineHierarchyLocked');
	}
	return {
		volumeCount: volumes.length,
		chapterCount: chapters.length,
		sceneCount: scenes.length
	};
}
