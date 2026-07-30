import { describe, expect, it, vi } from 'vitest';
import type { CreationJourneyAiInput } from '@writing-buddy/ai';
import { GenreToOutlineGenerationService } from './GenreToOutlineGenerationService';

const input: Extract<
	CreationJourneyAiInput,
	{ readonly operation: 'generate-from-genre' }
> = {
	schemaVersion: 1,
	operation: 'generate-from-genre',
	genre: '都市悬疑',
	tones: [],
	protagonistHints: [],
	requiredElements: [],
	excludedElements: []
};

function validOutput(): string {
	return JSON.stringify({
		operation: 'generate-from-genre',
		outline: {
			genre: '都市悬疑',
			premise: ''
		},
		storyBeats: Array.from({ length: 5 }, (_, index) => ({
			title: `节拍 ${index + 1}`,
			summary: `推进 ${index + 1}`
		})),
		suggestedCharacters: [],
		suggestedWorldRules: [],
		warnings: []
	});
}

describe('GenreToOutlineGenerationService', () => {
	it('admits rapid repeated generation only once', async () => {
		let resolve!: (output: string) => void;
		const runner = vi.fn(() => new Promise<string>(next => {
			resolve = next;
		}));
		const service = new GenreToOutlineGenerationService(runner);

		const first = service.generate(input);
		const second = service.generate(input);
		expect(runner).toHaveBeenCalledTimes(1);
		resolve(validOutput());

		await expect(first).resolves.toEqual(await second);
	});

	it('repairs a malformed structured response once with the same bounded brief', async () => {
		const runner = vi.fn()
			.mockResolvedValueOnce('not-json')
			.mockResolvedValueOnce(validOutput());
		const service = new GenreToOutlineGenerationService(runner);

		await expect(service.generate(input)).resolves.toMatchObject({
			operation: 'generate-from-genre'
		});
		expect(runner).toHaveBeenCalledTimes(2);
		expect(runner).toHaveBeenNthCalledWith(1, input);
		expect(runner).toHaveBeenNthCalledWith(2, {
			...input,
			repairAttempt: 1
		});
	});

	it('never loops, and does not repair cancellation or connection failures', async () => {
		const malformedRunner = vi.fn().mockResolvedValue('still-not-json');
		await expect(new GenreToOutlineGenerationService(malformedRunner).generate(input))
			.rejects.toThrow('invalidCreationJourneyResponse');
		expect(malformedRunner).toHaveBeenCalledTimes(2);

		const cancelledRunner = vi.fn().mockRejectedValue(new Error('cancelled'));
		await expect(new GenreToOutlineGenerationService(cancelledRunner).generate(input))
			.rejects.toThrow('cancelled');
		expect(cancelledRunner).toHaveBeenCalledTimes(1);
	});
});

