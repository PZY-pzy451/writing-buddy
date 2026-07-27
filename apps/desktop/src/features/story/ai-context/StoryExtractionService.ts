import {
	acceptPendingFact,
	createPendingFact,
	parsePendingFact,
	rejectPendingFact,
	type EvidenceRef,
	type PendingFact,
	type StoryPosition
} from '@writing-buddy/story-kernel';
import { parseStoryExtractionResponse } from '@writing-buddy/ai';
import type {
	AtomicWriteRequest,
	AtomicWriteResult
} from '@writing-buddy/platform-ports';
import type { TextFile } from '@writing-buddy/domain';

export const PENDING_FACTS_PATH = '.writing-buddy/ai/pending-facts/index.json';

interface PendingFactsFile {
	readonly schemaVersion: 1;
	readonly updatedAt: string;
	readonly facts: readonly PendingFact[];
}

export interface PendingFactStoragePort {
	readText(projectRoot: string, relativePath: string): Promise<TextFile>;
	writeTextAtomic(request: AtomicWriteRequest): Promise<AtomicWriteResult>;
}

function parsePendingFactsFile(content: string): PendingFactsFile {
	const decoded = JSON.parse(content) as Partial<PendingFactsFile>;
	if (decoded.schemaVersion !== 1 || !Array.isArray(decoded.facts)) {
		throw new Error('invalidPendingFactsFile');
	}
	return {
		schemaVersion: 1,
		updatedAt: decoded.updatedAt ?? new Date(0).toISOString(),
		facts: decoded.facts.map(parsePendingFact)
	};
}

function serializePendingFactsFile(facts: readonly PendingFact[]): string {
	return `${JSON.stringify({
		schemaVersion: 1,
		updatedAt: new Date().toISOString(),
		facts
	}, null, 2)}\n`;
}

export class PendingFactStore {
	private hash: string | undefined;
	private facts: readonly PendingFact[] = [];

	constructor(
		private readonly projectRoot: string,
		private readonly storage: PendingFactStoragePort
	) {}

	async load(): Promise<readonly PendingFact[]> {
		try {
			const file = await this.storage.readText(this.projectRoot, PENDING_FACTS_PATH);
			const parsed = parsePendingFactsFile(file.content);
			this.hash = file.hash;
			this.facts = parsed.facts;
		} catch (reason) {
			if (reason instanceof SyntaxError || (reason instanceof Error && reason.message === 'invalidPendingFactsFile')) {
				throw reason;
			}
			this.hash = '';
			this.facts = [];
		}
		return this.facts;
	}

	async save(facts: readonly PendingFact[]): Promise<readonly PendingFact[]> {
		if (this.hash === undefined) await this.load();
		const content = serializePendingFactsFile(facts);
		const result = await this.storage.writeTextAtomic({
			projectRoot: this.projectRoot,
			relativePath: PENDING_FACTS_PATH,
			content,
			expectedHash: this.hash ?? '',
			eol: 'lf',
			hasBom: false
		});
		this.hash = result.hash;
		this.facts = facts;
		return facts;
	}

	async append(nextFacts: readonly PendingFact[]): Promise<readonly PendingFact[]> {
		const current = this.hash === undefined ? await this.load() : this.facts;
		const signatures = new Set(current.map(fact => (
			`${fact.sourceResourceId}:${fact.sourceRevision}:${fact.suggestedRange?.start ?? -1}:${fact.statement}`
		)));
		const unique = nextFacts.filter(fact => {
			const signature = `${fact.sourceResourceId}:${fact.sourceRevision}:${fact.suggestedRange?.start ?? -1}:${fact.statement}`;
			if (signatures.has(signature)) return false;
			signatures.add(signature);
			return true;
		});
		return this.save([...current, ...unique]);
	}
}

function anchorCandidate(input: {
	readonly content: string;
	readonly start: number;
	readonly end: number;
	readonly quote: string;
}): { readonly start: number; readonly end: number } | undefined {
	if (input.end > input.start && input.content.slice(input.start, input.end) === input.quote) {
		return { start: input.start, end: input.end };
	}
	const first = input.content.indexOf(input.quote);
	const second = first < 0 ? -1 : input.content.indexOf(input.quote, first + Math.max(1, input.quote.length));
	if (first < 0 || second >= 0) return undefined;
	return { start: first, end: first + input.quote.length };
}

export class StoryExtractionService {
	constructor(private readonly store: PendingFactStore) {}

	async stageFromResponse(input: {
		readonly resourceId: string;
		readonly sourceRevision: string;
		readonly content: string;
		readonly baseOffset?: number;
		readonly response: string;
	}): Promise<readonly PendingFact[]> {
		const baseOffset = input.baseOffset ?? 0;
		const facts = parseStoryExtractionResponse(input.response).flatMap(candidate => {
			const range = anchorCandidate({
				content: input.content,
				start: candidate.start,
				end: candidate.end,
				quote: candidate.quote
			});
			if (!range) return [];
			return [createPendingFact({
				factType: candidate.factType,
				title: candidate.title,
				statement: candidate.statement,
				confidence: candidate.confidence,
				sourceResourceId: input.resourceId,
				sourceRevision: input.sourceRevision,
				suggestedRange: {
					start: baseOffset + range.start,
					end: baseOffset + range.end
				},
				suggestedQuote: candidate.quote
			})];
		});
		if (facts.length === 0) return [];
		const stored = await this.store.append(facts);
		const ids = new Set(facts.map(fact => fact.id));
		return stored.filter(fact => ids.has(fact.id));
	}

	async accept(input: {
		readonly fact: PendingFact;
		readonly title: string;
		readonly statement: string;
		readonly evidence: EvidenceRef;
		readonly storyPosition: StoryPosition;
	}): Promise<PendingFact> {
		const facts = await this.store.load();
		const accepted = acceptPendingFact(input);
		await this.store.save(facts.map(fact => fact.id === accepted.id ? accepted : fact));
		return accepted;
	}

	async reject(fact: PendingFact): Promise<PendingFact> {
		const facts = await this.store.load();
		const rejected = rejectPendingFact(fact);
		await this.store.save(facts.map(candidate => candidate.id === rejected.id ? rejected : candidate));
		return rejected;
	}
}
