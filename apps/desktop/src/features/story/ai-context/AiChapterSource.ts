import type { EvidenceRef } from '@writing-buddy/story-kernel';

export interface AiChapterSource {
	readonly resourceId: string;
	readonly chapterId: string;
	readonly title: string;
	readonly path: string;
	readonly narrativeOrder: number;
	readonly volumeId?: string;
	readonly volumeTitle?: string;
}

export type OpenAiEvidence = (evidence: Pick<
	EvidenceRef,
	'resourceId' | 'range' | 'quotePreview'
>) => void;
