export const contextPriorities = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
export type ContextPriority = typeof contextPriorities[number];

export interface BudgetedContextItem {
	readonly id: string;
	readonly priority: ContextPriority;
	readonly content: string;
	readonly required: boolean;
	readonly included: boolean;
	readonly estimatedTokens: number;
	readonly excludedReason?: 'author-secret' | 'token-budget';
}

export function estimateContextTokens(value: string): number {
	const ascii = [...value].filter(character => character.codePointAt(0)! <= 0x7f).length;
	const nonAscii = [...value].length - ascii;
	return Math.max(1, Math.ceil(ascii / 4 + nonAscii / 1.6));
}

export class TokenBudgetPolicy {
	constructor(readonly budgetTokens: number) {
		if (!Number.isSafeInteger(budgetTokens) || budgetTokens < 256) {
			throw new Error('invalidContextTokenBudget');
		}
	}

	trim<T extends BudgetedContextItem>(items: readonly T[]): readonly T[] {
		const next: T[] = items.map(item => ({ ...item }));
		let total = next
			.filter(item => item.included)
			.reduce((sum, item) => sum + item.estimatedTokens, 0);
		for (const priority of [...contextPriorities].reverse()) {
			if (total <= this.budgetTokens || priority === 'P1' || priority === 'P0') {
				continue;
			}
			for (let index = next.length - 1; index >= 0 && total > this.budgetTokens; index -= 1) {
				const item = next[index];
				if (!item || item.priority !== priority || !item.included || item.required) {
					continue;
				}
				total -= item.estimatedTokens;
				next[index] = {
					...item,
					included: false,
					excludedReason: 'token-budget'
				};
			}
		}
		return next;
	}
}
