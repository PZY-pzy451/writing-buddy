import { z } from 'zod';
import { AiOutputError, MAX_AI_OUTPUT_REPAIR_ATTEMPTS } from './AiOutputError';
import { validateAiOutput } from './AiOutputValidator';

const schema = z.object({
	title: z.string().min(1),
	count: z.number().int()
}).strict();

describe('validateAiOutput', () => {
	it('accepts strict JSON and one complete Markdown JSON fence', () => {
		expect(validateAiOutput(schema, '{"title":"桥下","count":2}'))
			.toEqual({ title: '桥下', count: 2 });
		expect(validateAiOutput(schema, '```json\n{"title":"桥下","count":2}\n```'))
			.toEqual({ title: '桥下', count: 2 });
	});

	it('reports field paths for missing fields and wrong types', () => {
		expect(() => validateAiOutput(schema, '{"title":2}')).toThrow(AiOutputError);
		try {
			validateAiOutput(schema, '{"title":2}');
		} catch (error) {
			expect(error).toBeInstanceOf(AiOutputError);
			if (!(error instanceof AiOutputError)) throw error;
			expect(error.code).toBe('schema_validation_failed');
			expect(error.issues.map(issue => issue.path))
				.toEqual(expect.arrayContaining(['$.title', '$.count']));
		}
	});

	it('rejects invalid JSON and any surrounding prose', () => {
		expect(() => validateAiOutput(schema, '{"title":}'))
			.toThrow('invalid_json');
		expect(() => validateAiOutput(
			schema,
			'结果如下：\n```json\n{"title":"桥下","count":2}\n```'
		)).toThrow('unexpected_surrounding_text');
		expect(MAX_AI_OUTPUT_REPAIR_ATTEMPTS).toBe(1);
	});
});
