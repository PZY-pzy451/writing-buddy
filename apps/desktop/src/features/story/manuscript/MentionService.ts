import {
	parseMentionLink,
	parseStoryId,
	type MentionLink,
	type MentionSaveEntry,
	type MentionStorageGateway
} from '@writing-buddy/story-kernel';

export interface LinkSelectionInput {
	readonly resourceId: string;
	readonly chapterId: string;
	readonly sceneId?: string;
	readonly manuscript: string;
	readonly start: number;
	readonly end: number;
	readonly textRevision: number;
}

function defaultMentionId(): string {
	return `mention:${globalThis.crypto.randomUUID()}`;
}

function currentUtc(): string {
	return new Date().toISOString();
}

function contextBefore(manuscript: string, start: number): string {
	return manuscript.slice(Math.max(0, start - 32), start);
}

function contextAfter(manuscript: string, end: number): string {
	return manuscript.slice(end, end + 32);
}

function occurrenceOffsets(manuscript: string, quote: string): readonly number[] {
	const offsets: number[] = [];
	let cursor = 0;
	while (cursor <= manuscript.length - quote.length) {
		const offset = manuscript.indexOf(quote, cursor);
		if (offset < 0) {
			break;
		}
		offsets.push(offset);
		cursor = offset + Math.max(1, quote.length);
	}
	return offsets;
}

export class MentionService {
	constructor(
		private readonly projectRoot: string,
		private readonly gateway: MentionStorageGateway,
		private readonly createId: () => string = defaultMentionId,
		private readonly now: () => string = currentUtc
	) {}

	async linkSelection(input: LinkSelectionInput): Promise<MentionLink> {
		if (!Number.isSafeInteger(input.start)
			|| !Number.isSafeInteger(input.end)
			|| !Number.isSafeInteger(input.textRevision)
			|| input.start < 0
			|| input.end <= input.start
			|| input.end > input.manuscript.length
			|| input.textRevision < 0) {
			throw new Error('invalidMentionSelection');
		}
		const quote = input.manuscript.slice(input.start, input.end);
		if (!quote || quote.length > 500) {
			throw new Error('invalidMentionSelection');
		}
		const timestamp = this.now();
		const mention = parseMentionLink({
			id: this.createId(),
			resourceId: parseStoryId(input.resourceId),
			chapterId: parseStoryId(input.chapterId),
			...(input.sceneId ? { sceneId: parseStoryId(input.sceneId) } : {}),
			anchor: {
				start: input.start,
				end: input.end,
				revision: input.textRevision,
				quote,
				before: contextBefore(input.manuscript, input.start),
				after: contextAfter(input.manuscript, input.end)
			},
			displayText: quote,
			status: 'active',
			revision: 0,
			createdAt: timestamp,
			updatedAt: timestamp
		});
		const [saved] = await this.gateway.saveMentionLinks(this.projectRoot, [{
			mention,
			expectedRevision: 0
		}]);
		if (!saved) {
			throw new Error('mentionSaveFailed');
		}
		return parseMentionLink(saved);
	}

	async rebaseMentions(
		chapterId: string,
		manuscript: string,
		textRevision: number
	): Promise<readonly MentionLink[]> {
		const mentions = (await this.listAll()).filter(mention => mention.chapterId === chapterId);
		const entries: MentionSaveEntry[] = mentions.map(mention => {
			const unchanged = manuscript.slice(
				mention.anchor.start,
				mention.anchor.end
			) === mention.anchor.quote;
			const offsets = unchanged
				? [mention.anchor.start]
				: occurrenceOffsets(manuscript, mention.anchor.quote);
			const offset = offsets.length === 1 ? offsets[0] : undefined;
			const rebased = offset === undefined
				? {
					...mention,
					status: 'stale' as const,
					anchor: { ...mention.anchor, revision: textRevision }
				}
				: {
					...mention,
					status: 'active' as const,
					anchor: {
						start: offset,
						end: offset + mention.anchor.quote.length,
						revision: textRevision,
						quote: mention.anchor.quote,
						before: contextBefore(manuscript, offset),
						after: contextAfter(manuscript, offset + mention.anchor.quote.length)
					}
				};
			return { mention: rebased, expectedRevision: mention.revision };
		});
		if (entries.length === 0) {
			return [];
		}
		return (await this.gateway.saveMentionLinks(this.projectRoot, entries))
			.map(parseMentionLink);
	}

	async listBacklinks(resourceId: string): Promise<readonly MentionLink[]> {
		parseStoryId(resourceId);
		return (await this.listAll())
			.filter(mention => mention.resourceId === resourceId)
			.sort((left, right) => (
				left.chapterId.localeCompare(right.chapterId)
					|| left.anchor.start - right.anchor.start
			));
	}

	async listMentionsForChapter(chapterId: string): Promise<readonly MentionLink[]> {
		parseStoryId(chapterId);
		return (await this.listAll())
			.filter(mention => mention.chapterId === chapterId)
			.sort((left, right) => left.anchor.start - right.anchor.start);
	}

	private async listAll(): Promise<readonly MentionLink[]> {
		return (await this.gateway.listMentionLinks(this.projectRoot)).map(parseMentionLink);
	}
}
