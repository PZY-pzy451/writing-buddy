import {
	parseCreationJourneyResponse,
	type CreationJourneyAiInput,
	type CreationJourneyAiResponse
} from '@writing-buddy/ai';

export type OutlineAlternativeAiInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-outline-alternatives' }
>;

export type OutlineAlternativeAiResponse = Extract<
	CreationJourneyAiResponse,
	{ readonly operation: 'generate-outline-alternatives' }
>;

export type OutlineAlternativeJobRunner = (
	input: OutlineAlternativeAiInput
) => Promise<string>;

export class OutlineAlternativeGenerationService {
	private inFlight?: Promise<OutlineAlternativeAiResponse>;

	constructor(private readonly run: OutlineAlternativeJobRunner) {}

	generate(input: OutlineAlternativeAiInput): Promise<OutlineAlternativeAiResponse> {
		if (this.inFlight) return this.inFlight;
		const task = this.generateAndRepairOnce(input);
		this.inFlight = task;
		void task.finally(() => {
			if (this.inFlight === task) this.inFlight = undefined;
		}).catch(() => undefined);
		return task;
	}

	private async generateAndRepairOnce(
		input: OutlineAlternativeAiInput
	): Promise<OutlineAlternativeAiResponse> {
		const output = await this.run(input);
		try {
			const parsed = parseCreationJourneyResponse(output, input);
			if (parsed.operation !== 'generate-outline-alternatives') {
				throw new Error('invalidCreationJourneyResponse');
			}
			return parsed;
		} catch (error) {
			if (
				!(error instanceof Error)
				|| error.message !== 'invalidCreationJourneyResponse'
			) {
				throw error;
			}
		}

		const repairInput: OutlineAlternativeAiInput = {
			...input,
			repairAttempt: 1
		};
		const repairedOutput = await this.run(repairInput);
		const repaired = parseCreationJourneyResponse(repairedOutput, repairInput);
		if (repaired.operation !== 'generate-outline-alternatives') {
			throw new Error('invalidCreationJourneyResponse');
		}
		return repaired;
	}
}
