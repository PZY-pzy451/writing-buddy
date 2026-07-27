import type { EditTransaction, EditTransactionService } from '@writing-buddy/project';

export type ReviewSeverity = 'info' | 'suggestion' | 'warning' | 'error';
export type ReviewStatus = 'open' | 'accepted' | 'ignored' | 'resolved' | 'stale';

export interface TextAnchor {
	readonly start: number;
	readonly end: number;
	readonly before: string;
	readonly target: string;
	readonly after: string;
	readonly sourceHash: string;
}

export interface ReviewIssue {
	readonly id: string;
	readonly projectId: string;
	readonly resourceId: string;
	readonly ruleId: string;
	readonly severity: ReviewSeverity;
	readonly status: ReviewStatus;
	readonly title: string;
	readonly message: string;
	readonly anchor: TextAnchor;
	readonly replacement?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly origin: 'local' | 'ai';
}

export interface ReviewRunResult {
	readonly issues: readonly ReviewIssue[];
	readonly durationMs: number;
	readonly cancelled: boolean;
}

export function replaceReviewIssuesForResource(
	current: readonly ReviewIssue[],
	replacement: readonly ReviewIssue[],
	resourceId: string,
	origin: ReviewIssue['origin']
): readonly ReviewIssue[] {
	return [
		...current.filter(issue => issue.resourceId !== resourceId || issue.origin !== origin),
		...replacement
	];
}

export function hashText(value: string): string {
	let hash = 2166136261;
	for (const character of value) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createTextAnchor(content: string, start: number, end: number): TextAnchor {
	return {
		start,
		end,
		before: content.slice(Math.max(0, start - 32), start),
		target: content.slice(start, end),
		after: content.slice(end, end + 32),
		sourceHash: hashText(content)
	};
}

interface MatchIssue {
	readonly ruleId: string;
	readonly severity: ReviewSeverity;
	readonly title: string;
	readonly message: string;
	readonly start: number;
	readonly end: number;
	readonly replacement?: string;
}

function collectMatches(content: string): readonly MatchIssue[] {
	const matches: MatchIssue[] = [];
	for (const match of content.matchAll(/[，。！？、；：]{2,}/gu)) {
		const start = match.index;
		const target = match[0];
		matches.push({
			ruleId: 'duplicate-punctuation',
			severity: 'warning',
			title: '重复标点',
			message: '这里连续出现了多个中文标点。',
			start,
			end: start + target.length,
			replacement: target[0]
		});
	}
	for (const match of content.matchAll(/[ \t]{2,}/gu)) {
		const start = match.index;
		matches.push({
			ruleId: 'suspicious-whitespace',
			severity: 'suggestion',
			title: '多余空格',
			message: '正文中出现了连续空格。',
			start,
			end: start + match[0].length,
			replacement: ' '
		});
	}
	for (const match of content.matchAll(/([^。！？\n]{4,}[。！？])\s*\1/gu)) {
		const start = match.index + match[1].length;
		matches.push({
			ruleId: 'duplicate-sentence',
			severity: 'warning',
			title: '重复句子',
			message: '相邻句子的内容完全相同。',
			start,
			end: start + match[1].length,
			replacement: ''
		});
	}
	const paragraphs = content.split(/\r?\n/);
	let offset = 0;
	for (const paragraph of paragraphs) {
		if (paragraph.length > 600) {
			matches.push({
				ruleId: 'long-paragraph',
				severity: 'suggestion',
				title: '段落过长',
				message: '这个段落较长，可以考虑拆分以改善阅读节奏。',
				start: offset,
				end: offset + paragraph.length
			});
		}
		offset += paragraph.length + 1;
	}
	return matches;
}

export function runLocalReview(projectId: string, resourceId: string, content: string): ReviewRunResult {
	const startedAt = performance.now();
	const now = new Date().toISOString();
	const issues = collectMatches(content).map((match, index): ReviewIssue => ({
		id: `${resourceId}:${match.ruleId}:${match.start}:${index}`,
		projectId,
		resourceId,
		ruleId: match.ruleId,
		severity: match.severity,
		status: 'open',
		title: match.title,
		message: match.message,
		anchor: createTextAnchor(content, match.start, match.end),
		...(match.replacement === undefined ? {} : { replacement: match.replacement }),
		createdAt: now,
		updatedAt: now,
		origin: 'local'
	}));
	return { issues, durationMs: performance.now() - startedAt, cancelled: false };
}

export function resolveAnchor(content: string, anchor: TextAnchor): { readonly start: number; readonly end: number } | undefined {
	if (hashText(content) === anchor.sourceHash && content.slice(anchor.start, anchor.end) === anchor.target) {
		return { start: anchor.start, end: anchor.end };
	}
	const composite = `${anchor.before}${anchor.target}${anchor.after}`;
	const compositeIndex = composite ? content.indexOf(composite) : -1;
	if (compositeIndex >= 0) {
		const start = compositeIndex + anchor.before.length;
		return { start, end: start + anchor.target.length };
	}
	const candidates: number[] = [];
	let offset = content.indexOf(anchor.target);
	while (offset >= 0) {
		candidates.push(offset);
		offset = content.indexOf(anchor.target, offset + Math.max(1, anchor.target.length));
	}
	return candidates.length === 1
		? { start: candidates[0], end: candidates[0] + anchor.target.length }
		: undefined;
}

export class ReviewResolutionService {
	private readonly transactions = new Map<string, EditTransaction>();

	constructor(private readonly edits: EditTransactionService) {}

	accept(issue: ReviewIssue, content: string): { readonly issue: ReviewIssue; readonly content: string } {
		const range = resolveAnchor(content, issue.anchor);
		if (!range || issue.replacement === undefined) {
			return { issue: { ...issue, status: 'stale', updatedAt: new Date().toISOString() }, content };
		}
		const next = `${content.slice(0, range.start)}${issue.replacement}${content.slice(range.end)}`;
		const transaction = this.edits.apply(issue.resourceId, content, next);
		this.transactions.set(issue.id, transaction);
		return { issue: { ...issue, status: 'accepted', updatedAt: new Date().toISOString() }, content: next };
	}

	ignore(issue: ReviewIssue): ReviewIssue {
		return { ...issue, status: 'ignored', updatedAt: new Date().toISOString() };
	}

	restore(issue: ReviewIssue, content: string): { readonly issue: ReviewIssue; readonly content: string } {
		if (issue.status === 'ignored') {
			return {
				issue: { ...issue, status: 'open', updatedAt: new Date().toISOString() },
				content
			};
		}
		const transaction = this.transactions.get(issue.id);
		if (transaction?.after === content) {
			return {
				issue: { ...issue, status: 'open', updatedAt: new Date().toISOString() },
				content: transaction.before
			};
		}
		if (issue.status !== 'accepted' || issue.replacement === undefined) {
			return { issue: { ...issue, status: 'stale', updatedAt: new Date().toISOString() }, content };
		}
		const composite = `${issue.anchor.before}${issue.replacement}${issue.anchor.after}`;
		const compositeIndex = composite ? content.indexOf(composite) : -1;
		let start = compositeIndex >= 0 ? compositeIndex + issue.anchor.before.length : -1;
		if (start < 0) {
			const first = content.indexOf(issue.replacement);
			const second = first >= 0
				? content.indexOf(issue.replacement, first + Math.max(1, issue.replacement.length))
				: -1;
			if (first >= 0 && second < 0) {
				start = first;
			}
		}
		if (start < 0) {
			return { issue: { ...issue, status: 'stale', updatedAt: new Date().toISOString() }, content };
		}
		const restored = `${content.slice(0, start)}${issue.anchor.target}${content.slice(start + issue.replacement.length)}`;
		return {
			issue: { ...issue, status: 'open', updatedAt: new Date().toISOString() },
			content: restored
		};
	}
}

export interface PersistedReviewState {
	readonly schemaVersion: 1;
	readonly issues: readonly ReviewIssue[];
}

function isTextAnchor(value: unknown): value is TextAnchor {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<TextAnchor>;
	return Number.isInteger(candidate.start)
		&& Number.isInteger(candidate.end)
		&& typeof candidate.before === 'string'
		&& typeof candidate.target === 'string'
		&& typeof candidate.after === 'string'
		&& typeof candidate.sourceHash === 'string';
}

function isReviewIssue(value: unknown): value is ReviewIssue {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<ReviewIssue>;
	return typeof candidate.id === 'string'
		&& typeof candidate.projectId === 'string'
		&& typeof candidate.resourceId === 'string'
		&& typeof candidate.ruleId === 'string'
		&& ['info', 'suggestion', 'warning', 'error'].includes(candidate.severity ?? '')
		&& ['open', 'accepted', 'ignored', 'resolved', 'stale'].includes(candidate.status ?? '')
		&& typeof candidate.title === 'string'
		&& typeof candidate.message === 'string'
		&& isTextAnchor(candidate.anchor)
		&& (candidate.replacement === undefined || typeof candidate.replacement === 'string')
		&& typeof candidate.createdAt === 'string'
		&& typeof candidate.updatedAt === 'string'
		&& (candidate.origin === 'local' || candidate.origin === 'ai');
}

export function parseReviewState(content: string): PersistedReviewState {
	const value: unknown = JSON.parse(content);
	if (!value || typeof value !== 'object') {
		throw new Error('reviewStateInvalid');
	}
	const candidate = value as { schemaVersion?: unknown; issues?: unknown };
	if (candidate.schemaVersion !== 1
		|| !Array.isArray(candidate.issues)
		|| !candidate.issues.every(isReviewIssue)) {
		throw new Error('reviewStateInvalid');
	}
	return { schemaVersion: 1, issues: candidate.issues };
}

export function serializeReviewState(issues: readonly ReviewIssue[]): string {
	return `${JSON.stringify({ schemaVersion: 1, issues }, undefined, 2)}\n`;
}
