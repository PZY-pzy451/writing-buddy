import {
	publicAiErrorMessage,
	type AiErrorCode,
	type PublicAiError
} from '@writing-buddy/ai';

const knownAiErrorCodes: readonly AiErrorCode[] = [
	'invalid_configuration',
	'authentication_failed',
	'insufficient_balance',
	'invalid_request',
	'rate_limited',
	'provider_overloaded',
	'provider_server_error',
	'network_unavailable',
	'connection_timeout',
	'first_content_timeout',
	'stream_idle_timeout',
	'stream_parse_failed',
	'stream_incomplete',
	'empty_response',
	'cancelled',
	'secret_store_failed',
	'unknown'
];

const retryableCodes = new Set<AiErrorCode>([
	'rate_limited',
	'provider_overloaded',
	'provider_server_error',
	'network_unavailable',
	'connection_timeout',
	'first_content_timeout',
	'stream_idle_timeout',
	'stream_parse_failed',
	'stream_incomplete',
	'empty_response'
]);

const settingsCodes = new Set<AiErrorCode>([
	'invalid_configuration',
	'authentication_failed',
	'insufficient_balance',
	'invalid_request',
	'secret_store_failed'
]);

function isAiErrorCode(value: unknown): value is AiErrorCode {
	return typeof value === 'string'
		&& knownAiErrorCodes.includes(value as AiErrorCode);
}

function codeInText(value: string): AiErrorCode | undefined {
	return knownAiErrorCodes.find(code => value.includes(code));
}

export function normalizeAiError(error: unknown): PublicAiError {
	if (error instanceof Error
		&& !isAiErrorCode((error as Error & { readonly code?: unknown }).code)) {
		const code = codeInText(error.message) ?? 'unknown';
		return {
			code,
			message: code === 'unknown' ? error.message : publicAiErrorMessage(code),
			retryable: retryableCodes.has(code)
		};
	}
	if (typeof error === 'object' && error !== null) {
		const candidate = error as {
			readonly code?: unknown;
			readonly message?: unknown;
			readonly retryable?: unknown;
			readonly httpStatus?: unknown;
		};
		const code = isAiErrorCode(candidate.code) ? candidate.code : 'unknown';
		const message = typeof candidate.message === 'string' && candidate.message.trim()
			? candidate.message
			: publicAiErrorMessage(code);
		const retryable = typeof candidate.retryable === 'boolean'
			? candidate.retryable
			: retryableCodes.has(code);
		return {
			code,
			message,
			retryable,
			...(typeof candidate.httpStatus === 'number'
				? { httpStatus: candidate.httpStatus }
				: {})
		};
	}
	const raw = String(error);
	const code = codeInText(raw) ?? 'unknown';
	const message = code === 'unknown' && raw && raw !== '[object Object]'
		? raw
		: publicAiErrorMessage(code);
	return {
		code,
		message,
		retryable: retryableCodes.has(code)
	};
}

export class AiRequestError extends Error {
	readonly code: AiErrorCode;
	readonly retryable: boolean;
	readonly httpStatus?: number;

	constructor(publicError: PublicAiError) {
		super(publicError.message);
		this.name = 'AiRequestError';
		this.code = publicError.code;
		this.retryable = publicError.retryable;
		if (publicError.httpStatus !== undefined) {
			this.httpStatus = publicError.httpStatus;
		}
	}
}

export function toAiRequestError(error: unknown): AiRequestError {
	return error instanceof AiRequestError
		? error
		: new AiRequestError(normalizeAiError(error));
}

export interface AiFailurePresentation extends PublicAiError {
	readonly title: string;
	readonly guidance: string;
	readonly recoveryAction: 'retry' | 'settings' | 'none';
}

const recoveryGuidance: Readonly<Record<AiErrorCode, string>> = {
	invalid_configuration: '请选择可用模型并保存 AI 设置，然后重新生成。',
	authentication_failed: '请在 AI 设置中重新保存 API Key，并先执行连接测试。',
	insufficient_balance: '请检查 DeepSeek 账户余额；充值或切换可用账户后再生成。',
	invalid_request: '请检查当前模型是否支持 JSON 输出与所选参数，必要时切换模型。',
	rate_limited: '请求频率已受限。等待片刻后可使用相同条件重试。',
	provider_overloaded: '服务当前繁忙。稍后可使用相同条件重试。',
	provider_server_error: 'DeepSeek 服务端暂时异常，正文和生成条件均已保留。',
	network_unavailable: '请检查网络、代理和防火墙后重试；本次没有写入项目。',
	connection_timeout: '连接超时，正文和生成条件均已保留，可直接重试。',
	first_content_timeout: '服务未及时返回首段内容，可直接重试。',
	stream_idle_timeout: '生成流中断前没有继续返回内容，可直接重试。',
	stream_parse_failed: '返回流无法解析，本次结果未进入候选区，可重新生成。',
	stream_incomplete: '连接提前结束，本次不完整结果不会写入项目。',
	empty_response: '服务没有返回候选内容，可调整要求或直接重试。',
	cancelled: '生成已停止；正文和项目数据均未改变。',
	secret_store_failed: 'Windows 凭据管理器不可用，请检查 AI 设置中的密钥状态。',
	unknown: '请先检查 AI 设置与连接状态；若设置正常，可使用相同条件再试一次。'
};

export function describeAiFailure(error: unknown): AiFailurePresentation {
	const normalized = normalizeAiError(error);
	const recoveryAction = normalized.code === 'cancelled'
		? 'none'
		: settingsCodes.has(normalized.code)
			? 'settings'
			: normalized.retryable || normalized.code === 'unknown'
				? 'retry'
				: 'none';
	return {
		...normalized,
		title: normalized.code === 'cancelled' ? '生成已停止' : '生成未完成',
		guidance: recoveryGuidance[normalized.code],
		recoveryAction
	};
}
