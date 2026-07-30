import {
	parseCreationJourneyResponse,
	type CreationJourneyAiInput,
	type CreationJourneyAiResponse
} from '@writing-buddy/ai';

export type GenreToOutlineAiInput = Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-from-genre' }
>;

export type GenreToOutlineAiResponse = Extract<
	CreationJourneyAiResponse,
	{ readonly operation: 'generate-from-genre' }
>;

export type GenreToOutlineJobRunner = (
	input: GenreToOutlineAiInput
) => Promise<string>;

export class GenreToOutlineGenerationService {
	private inFlight?: Promise<GenreToOutlineAiResponse>;

	constructor(private readonly run: GenreToOutlineJobRunner) {}

	generate(input: GenreToOutlineAiInput): Promise<GenreToOutlineAiResponse> {
		if (this.inFlight) return this.inFlight;
		const task = this.generateAndRepairOnce(input);
		this.inFlight = task;
		void task.finally(() => {
			if (this.inFlight === task) this.inFlight = undefined;
		}).catch(() => undefined);
		return task;
	}

	private async generateAndRepairOnce(
		input: GenreToOutlineAiInput
	): Promise<GenreToOutlineAiResponse> {
		const output = await this.run(input);
		try {
			const parsed = parseCreationJourneyResponse(output, input);
			if (parsed.operation !== 'generate-from-genre') {
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

		const repairInput: GenreToOutlineAiInput = {
			...input,
			repairAttempt: 1
		};
		const repairedOutput = await this.run(repairInput);
		const repaired = parseCreationJourneyResponse(repairedOutput, repairInput);
		if (repaired.operation !== 'generate-from-genre') {
			throw new Error('invalidCreationJourneyResponse');
		}
		return repaired;
	}
}
