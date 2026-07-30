import {
	chapterReconciliationFields,
	storyKernelGenerationResourceTypes,
	type ChapterPlanInput,
	type ChapterReconciliationField,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import type { StoryOutlineNode } from '../../creation-journey/CreationJourneyModel';
import type {
	ChapterReconciliationRecord,
	StoryKernelGenerationBatch,
	StoryKernelGenerationCandidate
} from '../ai-context/StoryKernelGenerationService';

export interface ChapterOrganizationCandidateEntry {
	readonly batch: StoryKernelGenerationBatch;
	readonly candidate: StoryKernelGenerationCandidate;
	readonly defaultSelected: false;
}

export interface ChapterOrganizationCandidateGroup {
	readonly type: StoryKernelGenerationResourceType;
	readonly entries: readonly ChapterOrganizationCandidateEntry[];
	readonly pendingCount: number;
	readonly conflictCount: number;
	readonly resolvedCount: number;
	readonly lowConfidenceCount: number;
}

export function groupChapterOrganizationCandidates(
	batches: readonly StoryKernelGenerationBatch[]
): readonly ChapterOrganizationCandidateGroup[] {
	const entries = batches.flatMap(batch => batch.candidates.map(candidate => ({
		batch,
		candidate,
		defaultSelected: false as const
	})));
	return storyKernelGenerationResourceTypes.flatMap(type => {
		const typed = entries.filter(entry => entry.candidate.resourceType === type);
		if (typed.length === 0) return [];
		return [{
			type,
			entries: typed,
			pendingCount: typed.filter(entry => entry.candidate.status === 'pending').length,
			conflictCount: typed.filter(entry => entry.candidate.conflicts.length > 0).length,
			resolvedCount: typed.filter(entry => entry.candidate.status !== 'pending').length,
			lowConfidenceCount: typed.filter(entry => entry.candidate.confidence < 0.6).length
		}];
	});
}

export function findStaleExtractionBatchIds(
	batches: readonly StoryKernelGenerationBatch[],
	currentRevisions: ReadonlyMap<string, string>,
	currentPlanRevisions?: ReadonlyMap<string, number>
): ReadonlySet<string> {
	return new Set(batches.flatMap(batch => {
		const current = currentRevisions.get(batch.sourceResourceId);
		const plan = batch.chapterReconciliation;
		const stalePlan = plan?.status === 'pending' && currentPlanRevisions
			? currentPlanRevisions.get(plan.planNodeId) !== plan.planRevision
			: false;
		return (current !== undefined && current !== batch.sourceRevision) || stalePlan
			? [batch.id]
			: [];
	}));
}

export interface MaterializedChapterPlan extends ChapterPlanInput {
	readonly resourceId: string;
}

function canonicalChapterId(value: string): string {
	return value.startsWith('chapter:') ? value.slice('chapter:'.length) : value;
}

export function findMaterializedChapterPlan(
	nodes: readonly StoryOutlineNode[],
	lockedNodeIds: readonly string[],
	resourceId: string
): MaterializedChapterPlan | undefined {
	const canonicalResourceId = canonicalChapterId(resourceId);
	const node = nodes.find(candidate => (
		candidate.type === 'chapter'
		&& candidate.resourceId !== undefined
		&& canonicalChapterId(candidate.resourceId) === canonicalResourceId
	));
	if (!node) return undefined;
	return {
		nodeId: node.id,
		revision: node.revision ?? 1,
		locked: lockedNodeIds.includes(node.id),
		title: node.title,
		summary: node.summary,
		goal: node.goal ?? '',
		conflict: node.conflict ?? '',
		outcome: node.outcome ?? '',
		hook: node.hook ?? '',
		resourceId
	};
}

export function buildChapterReconciliationPatch(
	plan: MaterializedChapterPlan,
	reconciliation: {
		readonly planNodeId: ChapterReconciliationRecord['planNodeId'];
		readonly planRevision: ChapterReconciliationRecord['planRevision'];
		readonly actual: ChapterReconciliationRecord['actual'];
		readonly differences: readonly Pick<
			ChapterReconciliationRecord['differences'][number],
			'field' | 'planned' | 'actual'
		>[];
		readonly status: ChapterReconciliationRecord['status'];
	},
	fields: readonly ChapterReconciliationField[]
): Partial<Pick<
	StoryOutlineNode,
	'summary' | 'goal' | 'conflict' | 'outcome' | 'hook' | 'source' | 'status'
>> {
	if (plan.locked) throw new Error('lockedChapterReconciliationPlan');
	if (
		reconciliation.planNodeId !== plan.nodeId
		|| reconciliation.planRevision !== plan.revision
	) {
		throw new Error('staleChapterReconciliationPlan');
	}
	if (
		reconciliation.status !== 'pending'
		|| fields.length === 0
		|| new Set(fields).size !== fields.length
		|| fields.some(field => !chapterReconciliationFields.includes(field))
	) {
		throw new Error('invalidChapterReconciliationSelection');
	}
	const differences = new Map(
		reconciliation.differences.map(difference => [difference.field, difference])
	);
	if (fields.some(field => !differences.has(field))) {
		throw new Error('invalidChapterReconciliationSelection');
	}
	return {
		...Object.fromEntries(fields.map(field => [field, reconciliation.actual[field]])),
		source: 'extracted_from_draft',
		status: 'drafted'
	};
}
