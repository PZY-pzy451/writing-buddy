import type {
	StoryIndexGateway,
	StoryIndexQuery,
	StoryIndexQueryResult,
	StoryIndexStatus
} from '@writing-buddy/platform-ports';

export interface StoryIndexPreparation {
	readonly status: StoryIndexStatus;
	readonly rebuilt: boolean;
	readonly durationMs: number;
}

export class StoryIndexService {
	private readonly preparations = new Map<string, Promise<StoryIndexPreparation>>();

	constructor(private readonly gateway: StoryIndexGateway) {}

	prepare(projectRoot: string, allowRebuild = true): Promise<StoryIndexPreparation> {
		const current = this.preparations.get(projectRoot);
		if (current) return current;
		const startedAt = performance.now();
		const preparation = this.gateway.getStoryIndexStatus(projectRoot).then(async status => {
			if (status.ready || !allowRebuild) {
				return {
					status,
					rebuilt: false,
					durationMs: performance.now() - startedAt
				};
			}
			const rebuilt = await this.gateway.rebuildStoryIndex(projectRoot);
			return {
				status: rebuilt,
				rebuilt: true,
				durationMs: performance.now() - startedAt
			};
		}).finally(() => {
			this.preparations.delete(projectRoot);
		});
		this.preparations.set(projectRoot, preparation);
		return preparation;
	}

	async query(
		projectRoot: string,
		query: StoryIndexQuery
	): Promise<StoryIndexQueryResult> {
		const preparation = await this.prepare(projectRoot);
		if (!preparation.status.ready) {
			throw new Error('storyIndexUnavailable');
		}
		return this.gateway.queryStoryIndex(projectRoot, {
			...query,
			offset: Math.max(0, query.offset ?? 0),
			limit: Math.min(5_000, Math.max(1, query.limit ?? 200))
		});
	}

	async rebuild(projectRoot: string): Promise<StoryIndexPreparation> {
		const startedAt = performance.now();
		const status = await this.gateway.rebuildStoryIndex(projectRoot);
		return {
			status,
			rebuilt: true,
			durationMs: performance.now() - startedAt
		};
	}
}
