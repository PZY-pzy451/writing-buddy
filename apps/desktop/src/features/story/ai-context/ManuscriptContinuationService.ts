import type {
	ManuscriptContinuationCandidateResponse,
	ManuscriptContinuationMode
} from '@writing-buddy/ai';
import type { EditTransaction, EditTransactionService } from '@writing-buddy/project';

export interface ContinuationCandidate extends ManuscriptContinuationCandidateResponse {
	readonly id: string;
}

export interface ContinuationCandidateBatch {
	readonly id: string;
	readonly mode: ManuscriptContinuationMode;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly cursorOffset: number;
	readonly anchorBefore: string;
	readonly anchorAfter: string;
	readonly candidates: readonly ContinuationCandidate[];
	readonly createdAt: string;
	readonly status: 'candidate' | 'accepted' | 'rejected' | 'stale';
}

export interface AppliedContinuation {
	readonly content: string;
	readonly insertion: string;
	readonly cursorOffset: number;
	readonly transaction: EditTransaction;
}

const ANCHOR_LENGTH = 64;

export function createContinuationCandidate(input: {
	readonly mode: ManuscriptContinuationMode;
	readonly resourceId: string;
	readonly sourceRevision: number;
	readonly cursorOffset: number;
	readonly currentContent: string;
	readonly response: {
		readonly candidates: readonly ManuscriptContinuationCandidateResponse[];
	};
}): ContinuationCandidateBatch {
	const cursorOffset = Math.min(
		Math.max(0, input.cursorOffset),
		input.currentContent.length
	);
	if (!input.resourceId || input.sourceRevision < 0 || input.response.candidates.length === 0) {
		throw new Error('invalidContinuationCandidate');
	}
	return {
		id: `continuation:${crypto.randomUUID()}`,
		mode: input.mode,
		resourceId: input.resourceId,
		sourceRevision: input.sourceRevision,
		cursorOffset,
		anchorBefore: input.currentContent.slice(
			Math.max(0, cursorOffset - ANCHOR_LENGTH),
			cursorOffset
		),
		anchorAfter: input.currentContent.slice(cursorOffset, cursorOffset + ANCHOR_LENGTH),
		candidates: input.response.candidates.map(candidate => {
			if (!candidate.title.trim() || !candidate.content.trim() || !candidate.rationale.trim()) {
				throw new Error('emptyContinuationCandidate');
			}
			return {
				id: `continuation-option:${crypto.randomUUID()}`,
				title: candidate.title,
				content: candidate.content,
				rationale: candidate.rationale
			};
		}),
		createdAt: new Date().toISOString(),
		status: 'candidate'
	};
}

export function isContinuationCandidateStale(
	candidate: ContinuationCandidateBatch,
	currentRevision: number,
	currentContent: string
): boolean {
	if (
		candidate.sourceRevision !== currentRevision
		|| candidate.cursorOffset > currentContent.length
	) {
		return true;
	}
	const beforeStart = Math.max(0, candidate.cursorOffset - candidate.anchorBefore.length);
	return currentContent.slice(beforeStart, candidate.cursorOffset) !== candidate.anchorBefore
		|| currentContent.slice(
			candidate.cursorOffset,
			candidate.cursorOffset + candidate.anchorAfter.length
		) !== candidate.anchorAfter;
}

function formatInsertion(currentContent: string, cursorOffset: number, content: string): string {
	const candidate = content.trim();
	const before = currentContent.slice(0, cursorOffset);
	const after = currentContent.slice(cursorOffset);
	const prefix = before.trim() && !before.endsWith('\n\n') ? '\n\n' : '';
	const suffix = after.trim() && !after.startsWith('\n\n') ? '\n\n' : '';
	return `${prefix}${candidate}${suffix}`;
}

export class ContinuationService {
	constructor(private readonly edits: EditTransactionService) {}

	accept(
		batch: ContinuationCandidateBatch,
		candidateId: string,
		currentRevision: number,
		currentContent: string
	): AppliedContinuation {
		if (
			batch.status !== 'candidate'
			|| isContinuationCandidateStale(batch, currentRevision, currentContent)
		) {
			throw new Error('staleContinuationCandidate');
		}
		const selected = batch.candidates.find(candidate => candidate.id === candidateId);
		if (!selected) {
			throw new Error('continuationCandidateNotFound');
		}
		const insertion = formatInsertion(currentContent, batch.cursorOffset, selected.content);
		const content = `${currentContent.slice(0, batch.cursorOffset)}${insertion}${currentContent.slice(batch.cursorOffset)}`;
		return {
			content,
			insertion,
			cursorOffset: batch.cursorOffset + insertion.length,
			transaction: this.edits.apply(batch.resourceId, currentContent, content)
		};
	}

	undo(currentContent: string): { readonly content: string; readonly transaction: EditTransaction } {
		const result = this.edits.undo(currentContent);
		if (!result) {
			throw new Error('continuationUndoUnavailable');
		}
		return result;
	}
}
