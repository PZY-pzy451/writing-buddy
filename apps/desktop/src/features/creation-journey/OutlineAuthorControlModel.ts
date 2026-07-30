import {
	restoreStructuredOutlineSnapshot,
	updateStoryOutlineNode,
	type CreationJourneyState,
	type StoryOutlineNode
} from './CreationJourneyModel';

export const outlineCandidateFields = [
	'title',
	'summary',
	'purpose',
	'goal',
	'conflict',
	'outcome',
	'hook',
	'povHint'
] as const;

export type OutlineCandidateField = typeof outlineCandidateFields[number];
export type OutlineGenerationStrategy =
	| 'balanced'
	| 'strengthen-conflict'
	| 'character-driven'
	| 'replace-hook'
	| 'reduce-cliches'
	| 'tighten-pace';

export interface OutlineCandidateReplacement {
	readonly title: string;
	readonly summary: string;
	readonly purpose: string;
	readonly goal: string;
	readonly conflict: string;
	readonly outcome: string;
	readonly hook: string;
	readonly povHint: string;
}

export interface OutlineAlternative {
	readonly label: string;
	readonly rationale: string;
	readonly replacement: OutlineCandidateReplacement;
}

export interface OutlineCandidatePreview {
	readonly targetId: string;
	readonly baseJourneyRevision: number;
	readonly baseNodeRevision: number;
	readonly generatedAt: string;
	readonly alternatives: readonly [
		OutlineAlternative,
		OutlineAlternative,
		OutlineAlternative
	];
}

export interface OutlineFieldDiff {
	readonly field: OutlineCandidateField;
	readonly label: string;
	readonly before: string;
	readonly after: string;
	readonly changed: boolean;
}

export interface OutlineImpactNode {
	readonly id: string;
	readonly title: string;
	readonly locked: boolean;
}

export interface OutlineImpactReport {
	readonly targetId: string;
	readonly targetTitle: string;
	readonly changedFields: readonly OutlineCandidateField[];
	readonly downstreamNodes: readonly OutlineImpactNode[];
	readonly materializedChapterIds: readonly string[];
	readonly materializedSceneIds: readonly string[];
	readonly draftAnchorIds: readonly string[];
}

export interface OutlineCandidateUndoReceipt {
	readonly targetId: string;
	readonly before: CreationJourneyState;
	readonly appliedJourneyRevision: number;
	readonly appliedNodeRevision: number;
}

export interface OutlineCandidateApplyResult {
	readonly state: CreationJourneyState;
	readonly impact: OutlineImpactReport;
	readonly undo: OutlineCandidateUndoReceipt;
}

const fieldLabels: Readonly<Record<OutlineCandidateField, string>> = {
	title: '节点标题',
	summary: '一句话概要',
	purpose: '叙事作用',
	goal: '节点目标',
	conflict: '核心冲突',
	outcome: '节点结果',
	hook: '结尾钩子',
	povHint: 'POV'
};

function fieldValue(
	node: Pick<StoryOutlineNode, OutlineCandidateField> | OutlineCandidateReplacement,
	field: OutlineCandidateField
): string {
	return node[field] ?? '';
}

export function diffOutlineCandidate(
	current: StoryOutlineNode,
	replacement: OutlineCandidateReplacement
): readonly OutlineFieldDiff[] {
	return outlineCandidateFields.map(field => {
		const before = fieldValue(current, field);
		const after = fieldValue(replacement, field);
		return {
			field,
			label: fieldLabels[field],
			before,
			after,
			changed: before !== after
		};
	});
}

export function createOutlineCandidatePreview(
	state: CreationJourneyState,
	targetId: string,
	alternatives: readonly OutlineAlternative[],
	generatedAt = new Date().toISOString()
): OutlineCandidatePreview {
	const target = state.outline.find(node => node.id === targetId);
	if (!target) throw new Error('creationJourneyOutlineNodeNotFound');
	if (state.locks.outlineNodeIds.includes(targetId)) {
		throw new Error('creationJourneyTargetLocked');
	}
	if (alternatives.length !== 3) {
		throw new Error('outlineCandidateCountInvalid');
	}
	const fingerprints = alternatives.map(candidate => JSON.stringify(candidate.replacement));
	if (new Set(fingerprints).size !== 3) {
		throw new Error('outlineCandidateDuplicate');
	}
	return {
		targetId,
		baseJourneyRevision: state.revision,
		baseNodeRevision: target.revision ?? 0,
		generatedAt,
		alternatives: alternatives as [
			OutlineAlternative,
			OutlineAlternative,
			OutlineAlternative
		]
	};
}

export function analyzeOutlineCandidateImpact(
	state: CreationJourneyState,
	targetId: string,
	changedFields: readonly OutlineCandidateField[]
): OutlineImpactReport {
	const targetIndex = state.outline.findIndex(node => node.id === targetId);
	const target = state.outline[targetIndex];
	if (!target) throw new Error('creationJourneyOutlineNodeNotFound');
	const affectedNodeIds = new Set([
		targetId,
		...state.outline.slice(targetIndex + 1).map(node => node.id)
	]);
	return {
		targetId,
		targetTitle: target.title,
		changedFields: [...changedFields],
		downstreamNodes: state.outline.slice(targetIndex + 1).map(node => ({
			id: node.id,
			title: node.title,
			locked: state.locks.outlineNodeIds.includes(node.id)
		})),
		materializedChapterIds: state.chapters
			.filter(chapter => chapter.resourceId && chapter.sourceNodeIds.some(id => (
				affectedNodeIds.has(id)
			)))
			.map(chapter => chapter.resourceId!),
		materializedSceneIds: [],
		draftAnchorIds: []
	};
}

export function applyOutlineCandidateSelection(
	state: CreationJourneyState,
	preview: OutlineCandidatePreview,
	alternativeIndex: number,
	selectedFields: readonly OutlineCandidateField[],
	now?: () => string
): OutlineCandidateApplyResult {
	if (state.revision !== preview.baseJourneyRevision) {
		throw new Error('outlineCandidateStale');
	}
	const target = state.outline.find(node => node.id === preview.targetId);
	if (!target || (target.revision ?? 0) !== preview.baseNodeRevision) {
		throw new Error('outlineCandidateStale');
	}
	if (state.locks.outlineNodeIds.includes(preview.targetId)) {
		throw new Error('creationJourneyTargetLocked');
	}
	const alternative = preview.alternatives[alternativeIndex];
	if (!alternative) throw new Error('outlineCandidateNotFound');
	const uniqueFields = [...new Set(selectedFields)];
	if (uniqueFields.length === 0) {
		throw new Error('outlineCandidateSelectionRequired');
	}
	const allowed = new Set<OutlineCandidateField>(outlineCandidateFields);
	if (uniqueFields.some(field => !allowed.has(field))) {
		throw new Error('outlineCandidateFieldInvalid');
	}
	const diffs = new Map(
		diffOutlineCandidate(target, alternative.replacement)
			.map(diff => [diff.field, diff])
	);
	if (uniqueFields.some(field => !diffs.get(field)?.changed)) {
		throw new Error('outlineCandidateFieldUnchanged');
	}
	const patch = Object.fromEntries(uniqueFields.map(field => [
		field,
		alternative.replacement[field]
	])) as Partial<Omit<StoryOutlineNode, 'id'>>;
	const next = updateStoryOutlineNode(state, preview.targetId, {
		...patch,
		source: 'ai_revised'
	}, now);
	const appliedNode = next.outline.find(node => node.id === preview.targetId);
	if (!appliedNode) throw new Error('creationJourneyOutlineNodeNotFound');
	return {
		state: next,
		impact: analyzeOutlineCandidateImpact(next, preview.targetId, uniqueFields),
		undo: {
			targetId: preview.targetId,
			before: state,
			appliedJourneyRevision: next.revision,
			appliedNodeRevision: appliedNode.revision ?? 0
		}
	};
}

export function undoOutlineCandidateApply(
	state: CreationJourneyState,
	receipt: OutlineCandidateUndoReceipt,
	now?: () => string
): CreationJourneyState {
	const target = state.outline.find(node => node.id === receipt.targetId);
	if (
		state.revision !== receipt.appliedJourneyRevision
		|| !target
		|| (target.revision ?? 0) !== receipt.appliedNodeRevision
	) {
		throw new Error('outlineCandidateUndoStale');
	}
	return restoreStructuredOutlineSnapshot(state, receipt.before, now);
}
