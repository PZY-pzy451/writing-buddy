import type { TextFile } from '@writing-buddy/domain';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import type { ReviewIssue } from '@writing-buddy/review';
import type {
	ContinuityCandidate,
	ContinuityIssue
} from '@writing-buddy/story-kernel';

export const CONTINUITY_REVIEW_PATH = '.writing-buddy/review/continuity.json';

export interface ReviewStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

function isContinuityIssue(value: unknown): value is ContinuityIssue {
	if (!value || typeof value !== 'object') return false;
	const issue = value as Partial<ContinuityIssue>;
	return typeof issue.id === 'string'
		&& typeof issue.ruleId === 'string'
		&& ['info', 'suggestion', 'warning', 'error'].includes(issue.severity ?? '')
		&& ['open', 'resolved', 'ignored', 'stale'].includes(issue.status ?? '')
		&& typeof issue.title === 'string'
		&& typeof issue.message === 'string'
		&& Array.isArray(issue.layers)
		&& Array.isArray(issue.sourceIds)
		&& Array.isArray(issue.evidence)
		&& typeof issue.createdAt === 'string'
		&& typeof issue.updatedAt === 'string';
}

function parseState(content: string): readonly ContinuityIssue[] {
	const value = JSON.parse(content) as { readonly schemaVersion?: unknown; readonly issues?: unknown };
	if (
		value.schemaVersion !== 1
		|| !Array.isArray(value.issues)
		|| !value.issues.every(isContinuityIssue)
	) {
		throw new Error('continuityReviewStateInvalid');
	}
	return value.issues;
}

export class ContinuityReviewRepository {
	private hash: string | undefined;
	private issues: readonly ContinuityIssue[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: ReviewStoragePort
	) {}

	async load(): Promise<readonly ContinuityIssue[]> {
		try {
			const file = await this.storage.readText(this.projectRoot, CONTINUITY_REVIEW_PATH);
			this.hash = file.hash;
			this.issues = parseState(file.content);
		} catch (reason) {
			if (reason instanceof SyntaxError || (reason instanceof Error && reason.message === 'continuityReviewStateInvalid')) {
				throw reason;
			}
			this.hash = '';
			this.issues = [];
		}
		return this.issues;
	}

	async save(issues: readonly ContinuityIssue[]): Promise<readonly ContinuityIssue[]> {
		if (this.hash === undefined) await this.load();
		const content = `${JSON.stringify({ schemaVersion: 1, issues }, null, 2)}\n`;
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: CONTINUITY_REVIEW_PATH,
			content,
			expectedHash: this.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
		this.hash = result.hash;
		this.issues = issues;
		return issues;
	}
}

export function reviewIssueToContinuityCandidate(issue: ReviewIssue): ContinuityCandidate {
	const manuscriptEvidence = issue.relatedEvidence?.length
		? issue.relatedEvidence.map((evidence, index) => ({
			id: `${issue.id}:evidence-${index + 1}`,
			resourceId: evidence.resourceId,
			start: evidence.anchor.start,
			end: evidence.anchor.end,
			quote: evidence.anchor.target,
			expectedRevision: evidence.anchor.sourceHash,
			kind: 'manuscript' as const,
			label: evidence.label
		}))
		: [{
			id: `${issue.id}:evidence`,
			resourceId: issue.resourceId,
			start: issue.anchor.start,
			end: issue.anchor.end,
			quote: issue.anchor.target,
			expectedRevision: issue.anchor.sourceHash,
			kind: 'manuscript' as const,
			label: issue.origin === 'ai' ? 'AI 审校证据' : '正文规则证据'
		}];
	return {
		sourceId: issue.id,
		layer: issue.origin === 'ai' ? 'ai' : 'text-rule',
		ruleId: issue.ruleId,
		severity: issue.severity,
		title: issue.title,
		message: issue.message,
		evidence: [
			...manuscriptEvidence,
			...(issue.storyFact ? [{
				id: `${issue.id}:story-fact`,
				resourceId: issue.storyFact.resourceId,
				quote: issue.storyFact.statement,
				kind: 'story-fact' as const,
				label: `Story Fact · ${issue.storyFact.title}`
			}] : [])
		]
	};
}
