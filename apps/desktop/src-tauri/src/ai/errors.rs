use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AiErrorCode {
    InvalidConfiguration,
    AuthenticationFailed,
    InsufficientBalance,
    InvalidRequest,
    RateLimited,
    ProviderOverloaded,
    ProviderServerError,
    NetworkUnavailable,
    ConnectionTimeout,
    FirstContentTimeout,
    StreamIdleTimeout,
    StreamParseFailed,
    StreamIncomplete,
    EmptyResponse,
    #[allow(dead_code)]
    Cancelled,
    SecretStoreFailed,
    Unknown,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicAiError {
    pub code: AiErrorCode,
    pub message: &'static str,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
}

impl PublicAiError {
    pub fn new(code: AiErrorCode) -> Self {
        Self {
            code,
            message: message_for(code),
            retryable: matches!(
                code,
                AiErrorCode::RateLimited
                    | AiErrorCode::ProviderOverloaded
                    | AiErrorCode::ProviderServerError
                    | AiErrorCode::NetworkUnavailable
            ),
            http_status: None,
        }
    }

    pub fn http(status: u16) -> Self {
        let code = match status {
            400 | 404 | 409 | 422 => AiErrorCode::InvalidRequest,
            401 | 403 => AiErrorCode::AuthenticationFailed,
            402 => AiErrorCode::InsufficientBalance,
            429 => AiErrorCode::RateLimited,
            503 => AiErrorCode::ProviderOverloaded,
            500 => AiErrorCode::ProviderServerError,
            _ => AiErrorCode::Unknown,
        };
        let mut error = Self::new(code);
        error.http_status = Some(status);
        error
    }
}

pub fn message_for(code: AiErrorCode) -> &'static str {
    match code {
        AiErrorCode::InvalidConfiguration => "AI 配置不完整。",
        AiErrorCode::AuthenticationFailed => "API Key 无效或已经失效。",
        AiErrorCode::InsufficientBalance => "DeepSeek 余额不足。",
        AiErrorCode::InvalidRequest => "请求格式、模型或参数不受支持。",
        AiErrorCode::RateLimited => "请求过多，请稍后再试。",
        AiErrorCode::ProviderOverloaded => "DeepSeek 当前繁忙，请稍后重试。",
        AiErrorCode::ProviderServerError => "DeepSeek 服务异常。",
        AiErrorCode::NetworkUnavailable => "无法连接 DeepSeek，请检查网络。",
        AiErrorCode::ConnectionTimeout => "连接 DeepSeek 超时。",
        AiErrorCode::FirstContentTimeout => "等待首段内容超时。",
        AiErrorCode::StreamIdleTimeout => "生成流长时间没有新内容。",
        AiErrorCode::StreamParseFailed => "DeepSeek 返回了无法解析的流。",
        AiErrorCode::StreamIncomplete => "生成连接提前中断。",
        AiErrorCode::EmptyResponse => "DeepSeek 没有返回候选内容。",
        AiErrorCode::Cancelled => "生成已停止。",
        AiErrorCode::SecretStoreFailed => "Windows 凭据管理器操作失败。",
        AiErrorCode::Unknown => "AI 请求失败。",
    }
}

pub fn network_error(error: &reqwest::Error) -> PublicAiError {
    if error.is_timeout() {
        PublicAiError::new(AiErrorCode::ConnectionTimeout)
    } else {
        PublicAiError::new(AiErrorCode::NetworkUnavailable)
    }
}

#[cfg(test)]
mod tests {
    use super::{AiErrorCode, PublicAiError};

    #[test]
    fn retries_only_the_frozen_http_status_classes() {
        assert_eq!(PublicAiError::http(429).code, AiErrorCode::RateLimited);
        assert_eq!(
            PublicAiError::http(500).code,
            AiErrorCode::ProviderServerError
        );
        assert_eq!(
            PublicAiError::http(503).code,
            AiErrorCode::ProviderOverloaded
        );
        assert!(!PublicAiError::http(502).retryable);
        assert!(!PublicAiError::http(401).retryable);
    }
}
