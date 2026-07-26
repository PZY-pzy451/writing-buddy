import { projectSchemaVersion } from '@writing-buddy/domain';

/**
 * Portable JSON Schema for the current Legacy-compatible manifest.
 *
 * Runtime parsing remains in `@writing-buddy/compatibility`; this artifact is
 * deliberately dependency-free so migration tooling can publish and compare it.
 */
export const writingBuddyProjectJsonSchema = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://writing-buddy.local/schema/project-v1.json',
	title: 'Writing Buddy project manifest',
	type: 'object',
	additionalProperties: false,
	required: ['schemaVersion', 'projectId', 'title', 'volumes'],
	properties: {
		schemaVersion: { const: projectSchemaVersion },
		projectId: { type: 'string', pattern: '^project-[0-9a-fA-F]{8}$' },
		title: { type: 'string', minLength: 1, maxLength: 120 },
		volumes: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['id', 'title', 'chapters'],
				properties: {
					id: { type: 'string', pattern: '^volume-[0-9a-fA-F]{8}$' },
					title: { type: 'string', minLength: 1, maxLength: 120 },
					chapters: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['id', 'title', 'file'],
							properties: {
								id: { type: 'string', pattern: '^chapter-[0-9a-fA-F]{8}$' },
								title: { type: 'string', minLength: 1, maxLength: 120 },
								file: { type: 'string', minLength: 1 },
								status: { enum: ['draft', 'revision', 'completed'] },
								targetWords: { type: 'integer', minimum: 100, maximum: 200000 },
								scene: {
									type: 'object',
									additionalProperties: false,
									properties: {
										location: { type: 'string' },
										time: { type: 'string' },
										pov: { type: 'string' },
										characters: { type: 'array', items: { type: 'string' } },
										goal: { type: 'string' },
										note: { type: 'string' }
									}
								}
							}
						}
					}
				}
			}
		}
	}
} as const;
