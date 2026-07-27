use std::time::Duration;

use reqwest::{Client, Response, redirect::Policy};
use serde::Deserialize;
use serde_json::json;

use crate::{
    ai::{
        AiBalance, AiBalanceEntry, AiGenerateRequest, AiModel, AiUsage, ResponseFormat,
        ThinkingMode,
        errors::{AiErrorCode, PublicAiError, network_error},
    },
    secrets::SecretValue,
};

const BASE_URL: &str = "https://api.deepseek.com";
const MODELS_URL: &str = "https://api.deepseek.com/models";
const BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
const CHAT_URL: &str = "https://api.deepseek.com/chat/completions";

pub struct DeepSeekClient {
    client: Client,
}

impl DeepSeekClient {
    pub fn new(connect_timeout_ms: u64) -> Result<Self, PublicAiError> {
        debug_assert!(MODELS_URL.starts_with(BASE_URL));
        debug_assert!(BALANCE_URL.starts_with(BASE_URL));
        debug_assert!(CHAT_URL.starts_with(BASE_URL));
        let client = Client::builder()
            .connect_timeout(Duration::from_millis(connect_timeout_ms))
            .redirect(Policy::none())
            .build()
            .map_err(|_| PublicAiError::new(AiErrorCode::InvalidConfiguration))?;
        Ok(Self { client })
    }

    pub async fn list_models(&self, key: &SecretValue) -> Result<Vec<AiModel>, PublicAiError> {
        let response = self
            .client
            .get(MODELS_URL)
            .bearer_auth(secret_text(key)?)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|error| network_error(&error))?;
        require_success(&response)?;
        let body: ModelListResponse = response
            .json()
            .await
            .map_err(|_| PublicAiError::new(AiErrorCode::StreamParseFailed))?;
        let mut models = body
            .data
            .into_iter()
            .map(|model| AiModel {
                id: model.id,
                owned_by: model.owned_by,
            })
            .collect::<Vec<_>>();
        models.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(models)
    }

    pub async fn get_balance(&self, key: &SecretValue) -> Result<AiBalance, PublicAiError> {
        let response = self
            .client
            .get(BALANCE_URL)
            .bearer_auth(secret_text(key)?)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|error| network_error(&error))?;
        require_success(&response)?;
        let body: BalanceResponse = response
            .json()
            .await
            .map_err(|_| PublicAiError::new(AiErrorCode::StreamParseFailed))?;
        Ok(AiBalance {
            available: body.is_available,
            balances: body
                .balance_infos
                .into_iter()
                .map(|balance| AiBalanceEntry {
                    currency: balance.currency,
                    total_balance: balance.total_balance,
                    granted_balance: balance.granted_balance,
                    topped_up_balance: balance.topped_up_balance,
                })
                .collect(),
        })
    }

    pub async fn open_stream(
        &self,
        key: &SecretValue,
        request: &AiGenerateRequest,
    ) -> Result<Response, PublicAiError> {
        let messages = request
            .messages
            .iter()
            .map(|message| {
                json!({
                    "role": message.role,
                    "content": message.content,
                })
            })
            .collect::<Vec<_>>();
        let mut body = json!({
            "model": request.model_id,
            "messages": messages,
            "stream": true,
            "stream_options": { "include_usage": true },
            "max_tokens": request.options.max_output_tokens,
            "thinking": {
                "type": match request.options.thinking_mode {
                    ThinkingMode::Enabled => "enabled",
                    ThinkingMode::Disabled => "disabled",
                }
            }
        });
        if matches!(request.options.response_format, ResponseFormat::JsonObject) {
            body["response_format"] = json!({ "type": "json_object" });
        }
        if matches!(request.options.thinking_mode, ThinkingMode::Enabled) {
            body["reasoning_effort"] = json!(
                request
                    .options
                    .reasoning_effort
                    .as_deref()
                    .unwrap_or("high")
            );
        }
        let response = self
            .client
            .post(CHAT_URL)
            .bearer_auth(secret_text(key)?)
            .header("Accept", "text/event-stream")
            .json(&body)
            .send()
            .await
            .map_err(|error| network_error(&error))?;
        require_success(&response)?;
        Ok(response)
    }
}

fn secret_text(secret: &SecretValue) -> Result<&str, PublicAiError> {
    secret
        .as_str()
        .map_err(|_| PublicAiError::new(AiErrorCode::SecretStoreFailed))
}

fn require_success(response: &Response) -> Result<(), PublicAiError> {
    if response.status().is_success() {
        Ok(())
    } else {
        Err(PublicAiError::http(response.status().as_u16()))
    }
}

#[derive(Deserialize)]
struct ModelListResponse {
    data: Vec<ModelResponse>,
}

#[derive(Deserialize)]
struct ModelResponse {
    id: String,
    owned_by: String,
}

#[derive(Deserialize)]
struct BalanceResponse {
    is_available: bool,
    balance_infos: Vec<BalanceEntryResponse>,
}

#[derive(Deserialize)]
struct BalanceEntryResponse {
    currency: String,
    total_balance: String,
    granted_balance: String,
    topped_up_balance: String,
}

#[derive(Debug, Eq, PartialEq)]
pub enum ParsedChunk {
    Thinking,
    Content(String),
    Usage(AiUsage),
    Finish(Option<String>),
    Empty,
}

pub fn parse_stream_json(data: &str) -> Result<Vec<ParsedChunk>, PublicAiError> {
    let body: StreamChunk = serde_json::from_str(data)
        .map_err(|_| PublicAiError::new(AiErrorCode::StreamParseFailed))?;
    let mut events = Vec::new();
    for choice in body.choices {
        if choice
            .delta
            .reasoning_content
            .as_deref()
            .is_some_and(|value| !value.is_empty())
        {
            events.push(ParsedChunk::Thinking);
        }
        if let Some(content) = choice.delta.content
            && !content.is_empty()
        {
            events.push(ParsedChunk::Content(content));
        }
        if choice.finish_reason.is_some() {
            events.push(ParsedChunk::Finish(choice.finish_reason));
        }
    }
    if let Some(usage) = body.usage {
        events.push(ParsedChunk::Usage(AiUsage {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            cached_input_tokens: usage.prompt_cache_hit_tokens,
        }));
    }
    if events.is_empty() {
        events.push(ParsedChunk::Empty);
    }
    Ok(events)
}

#[derive(Deserialize)]
struct StreamChunk {
    #[serde(default)]
    choices: Vec<StreamChoice>,
    usage: Option<StreamUsage>,
}

#[derive(Deserialize)]
struct StreamChoice {
    #[serde(default)]
    delta: StreamDelta,
    finish_reason: Option<String>,
}

#[derive(Default, Deserialize)]
struct StreamDelta {
    content: Option<String>,
    reasoning_content: Option<String>,
}

#[derive(Deserialize)]
struct StreamUsage {
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
    total_tokens: Option<u64>,
    prompt_cache_hit_tokens: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::{ParsedChunk, parse_stream_json};
    use crate::ai::AiUsage;

    #[test]
    fn parses_content_finish_and_usage_without_exposing_reasoning() {
        let events = parse_stream_json(
            r#"{
                "choices": [{
                    "delta": {"reasoning_content": "private chain", "content": "正文"},
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 2,
                    "completion_tokens": 3,
                    "total_tokens": 5,
                    "prompt_cache_hit_tokens": 1
                }
            }"#,
        )
        .expect("valid chunk");
        assert_eq!(
            events,
            vec![
                ParsedChunk::Thinking,
                ParsedChunk::Content("正文".to_owned()),
                ParsedChunk::Finish(Some("stop".to_owned())),
                ParsedChunk::Usage(AiUsage {
                    input_tokens: Some(2),
                    output_tokens: Some(3),
                    total_tokens: Some(5),
                    cached_input_tokens: Some(1),
                }),
            ]
        );
        assert!(!format!("{events:?}").contains("private chain"));
    }
}
