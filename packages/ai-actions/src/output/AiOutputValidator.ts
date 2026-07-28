import type { z } from 'zod';
import { AiOutputError, type AiOutputIssue } from './AiOutputError';

function unwrapSingleMarkdownFence(rawText: string): string {
	const trimmed = rawText.trim();
	if (!trimmed) {
		throw new AiOutputError(
			'empty_output',
			[{ path: '$', message: '模型没有返回内容。' }],
			'请仅返回符合输出 Schema 的 JSON。'
		);
	}
	const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(trimmed);
	if (fenced) {
		return fenced[1]?.trim() ?? '';
	}
	if (trimmed.includes('```')) {
		throw new AiOutputError(
			'unexpected_surrounding_text',
			[{ path: '$', message: 'JSON 代码块外包含额外文本。' }],
			'删除解释、标题和额外代码块，仅返回一个 JSON 值。'
		);
	}
	return trimmed;
}

function issuePath(path: readonly PropertyKey[]): string {
	if (path.length === 0) return '$';
	return path.reduce<string>((result, part) => (
		typeof part === 'number'
			? `${result}[${part}]`
			: `${result}.${String(part)}`
	), '$');
}

export function validateAiOutput<T>(schema: z.ZodType<T>, rawText: string): T {
	const normalized = unwrapSingleMarkdownFence(rawText);
	let value: unknown;
	try {
		value = JSON.parse(normalized);
	} catch {
		throw new AiOutputError(
			'invalid_json',
			[{ path: '$', message: '输出不是有效 JSON。' }],
			'请修复 JSON 语法，仅返回一个 JSON 值。'
		);
	}
	const parsed = schema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}
	const issues: readonly AiOutputIssue[] = parsed.error.issues.map(issue => ({
		path: issuePath(issue.path),
		message: issue.message
	}));
	throw new AiOutputError(
		'schema_validation_failed',
		issues,
		[
			'请仅返回满足 Schema 的 JSON，并修复以下字段：',
			...issues.map(issue => `${issue.path}: ${issue.message}`)
		].join('\n')
	);
}
