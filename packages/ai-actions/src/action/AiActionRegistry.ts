import { z } from 'zod';
import {
	type AiActionCategory,
	type AiActionDefinition,
	type AiActionId,
	type AiActionScope
} from './AiActionDefinition';

export interface AiActionListEntry {
	readonly definition: AiActionDefinition;
	readonly available: boolean;
	readonly unavailableReason?: string;
}

export class AiActionRegistry {
	private readonly definitions = new Map<AiActionId, AiActionDefinition>();

	register<I, O>(definition: AiActionDefinition<I, O>): void {
		if (this.definitions.has(definition.id)) {
			throw new Error(`aiActionAlreadyRegistered:${definition.id}`);
		}
		this.definitions.set(definition.id, definition);
	}

	get(actionId: AiActionId): AiActionDefinition {
		const definition = this.definitions.get(actionId);
		if (!definition) {
			throw new Error(`aiActionNotFound:${actionId}`);
		}
		return definition;
	}

	list(category?: AiActionCategory): readonly AiActionDefinition[] {
		return [...this.definitions.values()]
			.filter(definition => !category || definition.category === category);
	}

	listAvailable(
		scope: AiActionScope,
		category?: AiActionCategory
	): readonly AiActionDefinition[] {
		return this.list(category)
			.filter(definition => definition.availability(scope).available);
	}

	listWithAvailability(
		scope: AiActionScope,
		category?: AiActionCategory
	): readonly AiActionListEntry[] {
		return this.list(category).map(definition => {
			const availability = definition.availability(scope);
			return {
				definition,
				available: availability.available,
				...(availability.available
					? {}
					: { unavailableReason: availability.reason })
			};
		});
	}
}

const consistencyInputSchema = z.object({
	instruction: z.string().trim().max(500).default('')
}).strict();

export const consistencyReviewOutputSchema = z.object({
	issues: z.array(z.object({
		start: z.number().int().nonnegative(),
		end: z.number().int().nonnegative(),
		target: z.string().min(1).max(4_000),
		severity: z.enum(['info', 'suggestion', 'warning', 'error']),
		title: z.string().min(1).max(80),
		message: z.string().min(1).max(500),
		replacement: z.string().max(4_000).optional()
	}).strict()).max(50)
}).strict();

export function createConsistencyReviewAction(): AiActionDefinition<
	z.infer<typeof consistencyInputSchema>,
	z.infer<typeof consistencyReviewOutputSchema>
> {
	return {
		id: 'review.consistency',
		title: '一致性审查',
		description: '复用现有章节审校任务，在统一抽屉中预览候选问题。',
		category: 'review',
		availability: scope => {
			if (!scope.hasProject) {
				return { available: false, reason: '请先打开作品' };
			}
			if (scope.currentResourceType !== 'chapter') {
				return { available: false, reason: '请先打开一个章节' };
			}
			return { available: true };
		},
		inputSchema: consistencyInputSchema,
		outputSchema: consistencyReviewOutputSchema,
		outputSchemaName: 'ChapterReviewResponse',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['current-resource'],
			optionalKinds: [],
			maximumTokens: 12_000
		},
		applyPolicy: { type: 'review_issues', maximumSeverity: 'warning' },
		promptTemplateId: 'review.consistency',
		defaultModelClass: 'reasoning'
	};
}

export function createDefaultAiActionRegistry(): AiActionRegistry {
	const registry = new AiActionRegistry();
	registry.register(createConsistencyReviewAction());
	return registry;
}
