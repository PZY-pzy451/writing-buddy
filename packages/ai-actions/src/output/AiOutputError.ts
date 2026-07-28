export type AiOutputErrorCode =
	| 'empty_output'
	| 'invalid_json'
	| 'unexpected_surrounding_text'
	| 'schema_validation_failed';

export interface AiOutputIssue {
	readonly path: string;
	readonly message: string;
}

export const MAX_AI_OUTPUT_REPAIR_ATTEMPTS = 1;

export class AiOutputError extends Error {
	readonly name = 'AiOutputError';

	constructor(
		readonly code: AiOutputErrorCode,
		readonly issues: readonly AiOutputIssue[],
		readonly repairInstruction: string
	) {
		super(code);
	}
}
