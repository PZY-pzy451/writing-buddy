import {
	CHAPTER_REVIEW_SYSTEM_PROMPT,
	STORYFORGE_SYSTEM_PROMPT,
	type AiMessage
} from '@writing-buddy/ai';
import type { AiActionId } from '../action/AiActionDefinition';
import type { AiContextPack } from '../context/AiContextPack';

export interface PromptTemplate {
	readonly id: string;
	readonly version: number;
	readonly schemaVersion: number;
	readonly outputSchemaName: string;
	readonly buildSystemPrompt: (input: unknown) => string;
	readonly buildUserPrompt: (input: unknown, context: AiContextPack) => string;
}

export interface PromptTemplateMetadata {
	readonly id: string;
	readonly version: number;
	readonly schemaVersion: number;
	readonly outputSchemaName: string;
}

export interface AiActionJobMetadata extends PromptTemplateMetadata {
	readonly actionId: AiActionId;
	readonly modelId: string;
}

export class PromptRegistry {
	private readonly templates = new Map<string, Map<number, PromptTemplate>>();

	register(template: PromptTemplate): void {
		if (!template.id.trim() || !Number.isSafeInteger(template.version) || template.version < 1) {
			throw new Error('invalidPromptTemplate');
		}
		const versions = this.templates.get(template.id) ?? new Map<number, PromptTemplate>();
		if (versions.has(template.version)) {
			throw new Error(`promptVersionAlreadyRegistered:${template.id}:${template.version}`);
		}
		versions.set(template.version, template);
		this.templates.set(template.id, versions);
	}

	get(templateId: string, version?: number): PromptTemplate {
		const versions = this.templates.get(templateId);
		if (!versions || versions.size === 0) {
			throw new Error(`promptTemplateNotFound:${templateId}`);
		}
		const resolvedVersion = version ?? Math.max(...versions.keys());
		const template = versions.get(resolvedVersion);
		if (!template) {
			throw new Error(`promptVersionNotFound:${templateId}:${resolvedVersion}`);
		}
		return template;
	}

	metadata(templateId: string, version?: number): PromptTemplateMetadata {
		const template = this.get(templateId, version);
		return {
			id: template.id,
			version: template.version,
			schemaVersion: template.schemaVersion,
			outputSchemaName: template.outputSchemaName
		};
	}
}

export function createPlaygroundPromptTemplate(): PromptTemplate {
	return {
		id: 'storyforge.playground',
		version: 1,
		schemaVersion: 1,
		outputSchemaName: 'PlainText',
		buildSystemPrompt: () => STORYFORGE_SYSTEM_PROMPT,
		buildUserPrompt: input => String(input)
	};
}

export function createConsistencyReviewPromptTemplate(): PromptTemplate {
	return {
		id: 'review.consistency',
		version: 1,
		schemaVersion: 1,
		outputSchemaName: 'ChapterReviewResponse',
		buildSystemPrompt: () => CHAPTER_REVIEW_SYSTEM_PROMPT,
		buildUserPrompt: (_input, context) => {
			const content = context.currentResource?.included
				? context.currentResource.summary
				: '';
			if (!content.trim()) {
				throw new Error('missingConsistencyReviewContent');
			}
			return JSON.stringify({ schemaVersion: 1, content });
		}
	};
}

export function createDefaultPromptRegistry(): PromptRegistry {
	const registry = new PromptRegistry();
	registry.register(createPlaygroundPromptTemplate());
	registry.register(createConsistencyReviewPromptTemplate());
	return registry;
}

export function buildPromptMessages(
	template: PromptTemplate,
	input: unknown,
	context: AiContextPack
): readonly AiMessage[] {
	return [{
		role: 'system',
		content: template.buildSystemPrompt(input)
	}, {
		role: 'user',
		content: template.buildUserPrompt(input, context)
	}];
}
