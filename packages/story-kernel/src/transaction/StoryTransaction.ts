import type { StoryRepository, StorySaveEntry } from '../repository/StoryRepository';
import type { StoryResource } from '../schema/resourceSchemas';

export class StoryTransaction {
	private readonly entries: StorySaveEntry[] = [];

	constructor(private readonly repository: StoryRepository) {}

	stage(resource: unknown, expectedRevision?: number): this {
		this.entries.push({
			resource,
			...(expectedRevision === undefined ? {} : { expectedRevision })
		});
		return this;
	}

	commit(): Promise<readonly StoryResource[]> {
		return this.repository.commit(this.entries);
	}
}
