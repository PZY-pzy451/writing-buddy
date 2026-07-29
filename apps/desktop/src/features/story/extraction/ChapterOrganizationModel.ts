import {
	storyKernelGenerationResourceTypes,
	type StoryKernelGenerationResourceType
} from '@writing-buddy/ai';
import type {
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
	currentRevisions: ReadonlyMap<string, string>
): ReadonlySet<string> {
	return new Set(batches.flatMap(batch => {
		const current = currentRevisions.get(batch.sourceResourceId);
		return current !== undefined && current !== batch.sourceRevision
			? [batch.id]
			: [];
	}));
}
