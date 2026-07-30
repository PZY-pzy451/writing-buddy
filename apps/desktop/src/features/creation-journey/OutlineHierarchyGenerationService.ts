import {
	parseCreationJourneyResponse,
	type CreationJourneyAiInput,
	type CreationJourneyAiResponse
} from '@writing-buddy/ai';

export type OutlineHierarchyAiInput = Extract<
	CreationJourneyAiInput,
	{
		readonly operation:
			| 'expand-to-volumes'
			| 'expand-volume-to-chapters'
			| 'expand-chapter-to-scenes';
	}
>;

export type OutlineHierarchyAiResponse = Extract<
	CreationJourneyAiResponse,
	{
		readonly operation:
			| 'expand-to-volumes'
			| 'expand-volume-to-chapters'
			| 'expand-chapter-to-scenes';
	}
>;

export type OutlineHierarchyJobRunner = (
	input: OutlineHierarchyAiInput
) => Promise<string>;

export class OutlineHierarchyGenerationService {
	private inFlight?: Promise<OutlineHierarchyAiResponse>;

	constructor(private readonly run: OutlineHierarchyJobRunner) {}

	generate(input: OutlineHierarchyAiInput): Promise<OutlineHierarchyAiResponse> {
		if (this.inFlight) return this.inFlight;
		const task = this.generateAndRepairOnce(input);
		this.inFlight = task;
		void task.finally(() => {
			if (this.inFlight === task) this.inFlight = undefined;
		}).catch(() => undefined);
		return task;
	}

	private parseForInput(
		output: string,
		input: OutlineHierarchyAiInput
	): OutlineHierarchyAiResponse {
		const parsed = parseCreationJourneyResponse(output, input);
		if (parsed.operation !== input.operation) {
			throw new Error('invalidCreationJourneyResponse');
		}
		return parsed;
	}

	private async generateAndRepairOnce(
		input: OutlineHierarchyAiInput
	): Promise<OutlineHierarchyAiResponse> {
		const output = await this.run(input);
		try {
			return this.parseForInput(output, input);
		} catch (error) {
			if (
				!(error instanceof Error)
				|| error.message !== 'invalidCreationJourneyResponse'
			) {
				throw error;
			}
		}
		const repairInput = {
			...input,
			repairAttempt: 1 as const
		} as OutlineHierarchyAiInput;
		return this.parseForInput(await this.run(repairInput), repairInput);
	}
}
