import type { StoryResourceType } from '../model/StoryResourceBase';
import { resourceSchemas, type StoryResource } from './resourceSchemas';

/**
 * Formal Story Kernel files are strict at schemaVersion 1.
 *
 * The legacy compatibility reader may strip unknown fields while importing old
 * manifests, but author-owned formal story files reject unknown fields so a
 * future writer cannot silently lose data when an older client saves them.
 */
export class StorySchemaRegistry {
	static parse(type: StoryResourceType, json: unknown): StoryResource {
		return resourceSchemas[type].parse(json);
	}
}
