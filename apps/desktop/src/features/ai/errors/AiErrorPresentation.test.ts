import { describe, expect, it } from 'vitest';
import {
	AiRequestError,
	describeAiFailure,
	normalizeAiError,
	toAiRequestError
} from './AiErrorPresentation';

describe('AI error presentation', () => {
	it('preserves a structured native authentication failure and routes to settings', () => {
		const failure = describeAiFailure({
			code: 'authentication_failed',
			message: 'API Key 无效或已经失效。',
			retryable: false,
			httpStatus: 401
		});

		expect(failure).toMatchObject({
			code: 'authentication_failed',
			message: 'API Key 无效或已经失效。',
			retryable: false,
			httpStatus: 401,
			recoveryAction: 'settings'
		});
		expect(failure.guidance).toContain('连接测试');
	});

	it('keeps retryability for a structured rate-limit failure', () => {
		const failure = describeAiFailure({
			code: 'rate_limited',
			message: '请求过多，请稍后再试。',
			retryable: true,
			httpStatus: 429
		});

		expect(failure.recoveryAction).toBe('retry');
		expect(failure.retryable).toBe(true);
	});

	it('localizes string error codes and preserves safe unknown messages', () => {
		expect(normalizeAiError(new Error('authentication_failed')).message)
			.toBe('API Key 无效或已经失效。');
		expect(normalizeAiError({ message: '模型暂时不可用' })).toMatchObject({
			code: 'unknown',
			message: '模型暂时不可用'
		});
	});

	it('converts structured rejections into an Error without losing metadata', () => {
		const error = toAiRequestError({
			code: 'network_unavailable',
			message: '无法连接 DeepSeek，请检查网络。',
			retryable: true
		});

		expect(error).toBeInstanceOf(AiRequestError);
		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({
			code: 'network_unavailable',
			message: '无法连接 DeepSeek，请检查网络。',
			retryable: true
		});
	});

	it('treats cancellation as a neutral terminal state without a recovery action', () => {
		expect(describeAiFailure('cancelled')).toMatchObject({
			code: 'cancelled',
			title: '生成已停止',
			recoveryAction: 'none'
		});
	});
});
