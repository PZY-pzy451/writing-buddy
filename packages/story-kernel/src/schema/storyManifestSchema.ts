import { z } from 'zod';
import { storyResourceTypes } from '../model/StoryResourceBase';
import { storyIdSchema, utcTimestampSchema } from './resourceSchemas';

export const storyManifestSchema = z.object({
	schemaVersion: z.literal(1),
	projectId: z.string().trim().min(1).max(160),
	createdAt: utcTimestampSchema,
	updatedAt: utcTimestampSchema,
	resources: z.partialRecord(
		z.enum(storyResourceTypes),
		z.array(storyIdSchema)
	)
}).strict();

export type StoryManifest = z.infer<typeof storyManifestSchema>;
