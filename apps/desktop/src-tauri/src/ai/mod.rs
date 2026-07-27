pub mod commands;
pub mod errors;
pub mod job_registry;
pub mod provider;
pub mod runtime;
pub mod sse_parser;
pub mod storage;

use serde::{Deserialize, Serialize};

pub const PROVIDER_ID: &str = "deepseek";
pub const DEFAULT_MODEL_ID: &str = "deepseek-v4-flash";
pub const STORYFORGE_SYSTEM_PROMPT: &str = concat!(
    "你是 StoryForge 的测试生成器。",
    "只回答用户在本面板明确输入的写作指令。",
    "不要请求、推断或提及任何项目、章节、路径、账户或历史信息。",
    "输出纯文本候选内容，不执行修改。"
);
pub const CHAPTER_REVIEW_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的中文小说审校器。",
    "只分析用户 JSON 中 content 字段提供的当前章节，不请求、推断或提及项目、路径、账户或历史信息。",
    "找出明确的错别字、语病、标点、重复、指代、逻辑或表达问题；不要续写正文。",
    "仅返回 JSON 对象：{\"issues\":[{\"start\":0,\"end\":1,\"target\":\"原文片段\",\"severity\":\"info|suggestion|warning|error\",\"title\":\"简短标题\",\"message\":\"问题说明\",\"replacement\":\"可选替换文本\"}]}。",
    "start 和 end 使用 JavaScript UTF-16 字符索引；每条 target 必须与 content 中对应原文完全一致，最多返回 50 条。"
);
pub const SELECTION_REWRITE_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的选区改写助手。",
    "只改写用户 JSON 中 P1 当前选区，不补写整章，不推断未提供的故事事实。",
    "其余 context 只用于保持人物状态、世界规则、剧情线和信息权限一致。",
    "仅返回 JSON 对象：{\"suggestion\":\"改写候选\",\"rationale\":\"简短依据\",\"potentialImpact\":\"对上下文的潜在影响\"}。",
    "候选只是建议，不得声称已经修改正文。"
);
pub const STORY_EXTRACTION_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的结构化故事事实提取器。",
    "只从用户 JSON 中 content 字段的正文提取明确写出的事实，不推断、不补全、不确认事实。",
    "每条事实必须带有可在 content 中精确定位的 start、end、quote；索引使用 JavaScript UTF-16 字符索引。",
    "仅返回 JSON 对象：{\"facts\":[{\"factType\":\"character-state|item-state|location-state|relationship|timeline-event|world-rule|story-information|plot-thread|foreshadowing\",\"title\":\"简短标题\",\"statement\":\"明确事实\",\"confidence\":0.8,\"start\":0,\"end\":1,\"quote\":\"原文证据\"}]}。",
    "提取结果全部处于待确认状态，最多返回 30 条，不得声称已经写入 Story Kernel。"
);
pub const STORY_KERNEL_GENERATION_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的 Story Kernel 结构化资源生成器。",
    "只根据用户 JSON 中 instruction、source 和 existingResources 生成 targetTypes 指定的完整资源候选；不得请求或推断项目路径、账户、密钥或隐藏历史。",
    "仅返回 JSON 对象：{\"candidates\":[{\"operation\":\"create|update\",\"resource\":{\"id\":\"类型前缀:slug\",\"type\":\"资源类型\",\"title\":\"标题\",\"aliases\":[],\"tags\":[],\"evidenceIds\":[]},\"confidence\":0.9,\"rationale\":\"生成依据\",\"evidence\":{\"start\":0,\"end\":1,\"quote\":\"原文证据\"}或null}]}。",
    "resource 禁止包含 schemaVersion、createdAt、updatedAt、revision；evidenceIds 必须为空，系统会生成证据与版本字段。",
    "支持 character、scene、location、faction、item、worldRule、timelineEvent、relationship、plotThread、foreshadowing、information。",
    "公共字段为 id、type、title、aliases、tags、可选 summary、evidenceIds。",
    "character 使用可选 role/pronouns/birth/appearance/occupation/speechStyle 和 factionIds/goals/desires/fears/values/secrets 数组。",
    "scene 使用 chapterId、manuscriptRange(start/end/revision/quote)、narrativeOrder、locationIds、participantIds、plotThreadIds、revealInformationIds、foreshadowingIds，以及可选 storyStart/storyEnd/povCharacterId/goal/conflict/turn/outcome。",
    "location 使用可选 parentLocationId/locationType/mapPoint 和 travelLinks/factionIds/rules 数组；faction 使用 goals/allyFactionIds/enemyFactionIds/territoryLocationIds 数组及可选 ideology。",
    "item 使用 unique、restrictions 及可选 itemType/quantityUnit/description/plotFunction；worldRule 使用 category、statement、exceptions、consequences 及可选 effectiveFrom。",
    "timelineEvent 使用 narrativePosition、eventType、participantIds/locationIds/itemIds/predecessorIds/consequenceIds/plotThreadIds/informationIds，以及可选故事时间字段。",
    "relationship 使用 sourceCharacterId、targetCharacterId、relationshipType、visibility、effectiveFrom、history 及可选 strength/description/effectiveUntil。",
    "plotThread 使用 status、participantIds、sceneIds 及可选 premise/stakes/dramaticQuestion/startPosition/targetResolution/actualResolution。",
    "foreshadowing 使用 status、reminderPositions、readerVisibility、plotThreadIds 及可选 plantedAt/surfaceMeaning/trueMeaning/plannedPayoffAt/actualPayoffAt。",
    "information 使用 truthStatement、truthStatus、authorSecret 及可选 excludeFromAiByDefault/truthEffectiveFrom/readerRevealAt。",
    "引用已有资源时必须使用 existingResources 中的 ID；同一批新资源可以互相引用。update 只能使用 existingResources 中的 ID。",
    "有正文依据时 evidence 必须精确匹配 source.content 的 JavaScript UTF-16 索引；纯作者设定可为 null。",
    "最多返回 24 个候选。所有候选仅供作者审核，不得声称已经写入 Story Kernel。"
);
const CHAPTER_REVIEW_MAX_CHARS: usize = 100_000;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderCapabilities {
    pub streaming: bool,
    pub model_discovery: bool,
    pub account_balance: bool,
    pub thinking_mode: bool,
    pub json_output: bool,
    pub tool_calls: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderDefinition {
    pub id: &'static str,
    pub display_name: &'static str,
    pub capabilities: AiProviderCapabilities,
}

pub fn provider_definition() -> AiProviderDefinition {
    AiProviderDefinition {
        id: PROVIDER_ID,
        display_name: "DeepSeek",
        capabilities: AiProviderCapabilities {
            streaming: true,
            model_discovery: true,
            account_balance: true,
            thinking_mode: true,
            json_output: true,
            tool_calls: false,
        },
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderPreferences {
    pub provider_id: String,
    pub default_model_id: Option<String>,
    pub thinking_mode: ThinkingMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: u32,
    pub connection_timeout_ms: u64,
    pub first_content_timeout_ms: u64,
    pub stream_idle_timeout_ms: u64,
}

impl Default for AiProviderPreferences {
    fn default() -> Self {
        Self {
            provider_id: PROVIDER_ID.to_owned(),
            default_model_id: Some(DEFAULT_MODEL_ID.to_owned()),
            thinking_mode: ThinkingMode::Disabled,
            reasoning_effort: None,
            max_output_tokens: 2048,
            connection_timeout_ms: 15_000,
            first_content_timeout_ms: 180_000,
            stream_idle_timeout_ms: 120_000,
        }
    }
}

impl AiProviderPreferences {
    pub fn validate_and_normalize(mut self) -> Result<Self, errors::PublicAiError> {
        if self.provider_id != PROVIDER_ID
            || !matches!(self.max_output_tokens, 512 | 1024 | 2048 | 4096 | 8192)
            || !(1_000..=60_000).contains(&self.connection_timeout_ms)
            || !(1_000..=300_000).contains(&self.first_content_timeout_ms)
            || !(1_000..=300_000).contains(&self.stream_idle_timeout_ms)
        {
            return Err(errors::PublicAiError::new(
                errors::AiErrorCode::InvalidConfiguration,
            ));
        }
        if self.default_model_id.as_deref().is_some_and(|model| {
            model.is_empty()
                || model.len() > 128
                || matches!(model, "deepseek-chat" | "deepseek-reasoner")
        }) {
            self.default_model_id = Some(DEFAULT_MODEL_ID.to_owned());
        }
        self.reasoning_effort = match self.thinking_mode {
            ThinkingMode::Enabled => Some("high".to_owned()),
            ThinkingMode::Disabled => None,
        };
        Ok(self)
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ThinkingMode {
    Disabled,
    Enabled,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateRequest {
    pub job_id: String,
    pub job_type: AiJobType,
    pub provider_id: String,
    pub model_id: String,
    pub messages: Vec<AiMessage>,
    pub options: AiGenerationOptions,
}

impl AiGenerateRequest {
    pub fn validate(&self) -> Result<(), errors::PublicAiError> {
        if self.provider_id != PROVIDER_ID
            || self.job_id.is_empty()
            || self.job_id.len() > 128
            || !self
                .job_id
                .chars()
                .all(|value| value.is_ascii_alphanumeric() || value == '-')
            || self.model_id.is_empty()
            || self.model_id.len() > 128
            || matches!(
                self.model_id.as_str(),
                "deepseek-chat" | "deepseek-reasoner"
            )
            || self.messages.len() != 2
            || !matches!(self.messages[0].role, AiRole::System)
            || !matches!(self.messages[1].role, AiRole::User)
            || !self.options.stream
            || !matches!(
                self.options.max_output_tokens,
                512 | 1024 | 2048 | 4096 | 8192
            )
            || match self.options.thinking_mode {
                ThinkingMode::Enabled => self.options.reasoning_effort.as_deref() != Some("high"),
                ThinkingMode::Disabled => self.options.reasoning_effort.is_some(),
            }
        {
            return Err(errors::PublicAiError::new(
                errors::AiErrorCode::InvalidConfiguration,
            ));
        }
        let contract_valid = match self.job_type {
            AiJobType::StoryforgeTest => {
                self.messages[0].content == STORYFORGE_SYSTEM_PROMPT
                    && self.messages[1].content.chars().count() <= 10_000
                    && matches!(self.options.response_format, ResponseFormat::Text)
            }
            AiJobType::ChapterReview => {
                self.messages[0].content == CHAPTER_REVIEW_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_chapter_review_input(&self.messages[1].content)
            }
            AiJobType::SelectionRewrite => {
                self.messages[0].content == SELECTION_REWRITE_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_selection_rewrite_input(&self.messages[1].content)
            }
            AiJobType::StoryExtraction => {
                self.messages[0].content == STORY_EXTRACTION_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_story_extraction_input(&self.messages[1].content)
            }
            AiJobType::StoryKernelGeneration => {
                self.messages[0].content == STORY_KERNEL_GENERATION_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_story_kernel_generation_input(&self.messages[1].content)
            }
        };
        if !contract_valid {
            return Err(errors::PublicAiError::new(
                errors::AiErrorCode::InvalidConfiguration,
            ));
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AiJobType {
    StoryforgeTest,
    ChapterReview,
    SelectionRewrite,
    StoryExtraction,
    StoryKernelGeneration,
}

impl AiJobType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::StoryforgeTest => "storyforge-test",
            Self::ChapterReview => "chapter-review",
            Self::SelectionRewrite => "selection-rewrite",
            Self::StoryExtraction => "story-extraction",
            Self::StoryKernelGeneration => "story-kernel-generation",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessage {
    pub role: AiRole,
    pub content: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AiRole {
    System,
    User,
    Assistant,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerationOptions {
    pub stream: bool,
    pub thinking_mode: ThinkingMode,
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: u32,
    pub response_format: ResponseFormat,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResponseFormat {
    Text,
    JsonObject,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ChapterReviewInput {
    schema_version: u8,
    content: String,
}

fn validate_chapter_review_input(value: &str) -> bool {
    serde_json::from_str::<ChapterReviewInput>(value).is_ok_and(|input| {
        input.schema_version == 1
            && !input.content.trim().is_empty()
            && input.content.chars().count() <= CHAPTER_REVIEW_MAX_CHARS
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SelectionRewriteInput {
    schema_version: u8,
    action_type: String,
    context: Vec<SelectionContextItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SelectionContextItem {
    priority: String,
    kind: String,
    title: String,
    content: String,
}

fn validate_selection_rewrite_input(value: &str) -> bool {
    if value.len() > 40_000 {
        return false;
    }
    serde_json::from_str::<SelectionRewriteInput>(value).is_ok_and(|input| {
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "polish" | "concise" | "grammar" | "dialogue" | "pacing"
            )
            && (2..=64).contains(&input.context.len())
            && input.context.iter().all(|item| {
                matches!(
                    item.priority.as_str(),
                    "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6"
                ) && !item.kind.is_empty()
                    && item.kind.len() <= 64
                    && !item.title.trim().is_empty()
                    && item.title.len() <= 160
                    && !item.content.trim().is_empty()
                    && item.content.len() <= 12_000
            })
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P0" && item.kind == "instruction")
                .count()
                == 1
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P1" && item.kind == "selection")
                .count()
                == 1
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoryExtractionInput {
    schema_version: u8,
    resource_id: String,
    source_revision: String,
    content: String,
}

fn validate_story_extraction_input(value: &str) -> bool {
    serde_json::from_str::<StoryExtractionInput>(value).is_ok_and(|input| {
        input.schema_version == 1
            && input.resource_id.starts_with("chapter:")
            && input.resource_id.len() <= 160
            && !input.source_revision.trim().is_empty()
            && input.source_revision.len() <= 128
            && !input.content.trim().is_empty()
            && input.content.chars().count() <= CHAPTER_REVIEW_MAX_CHARS
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoryKernelGenerationInput {
    schema_version: u8,
    instruction: String,
    source: StoryKernelGenerationSource,
    target_types: Vec<String>,
    existing_resources: Vec<StoryKernelExistingResource>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoryKernelGenerationSource {
    resource_id: String,
    source_revision: String,
    content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoryKernelExistingResource {
    id: String,
    #[serde(rename = "type")]
    resource_type: String,
    title: String,
    revision: u64,
}

fn valid_story_kernel_generation_type(value: &str) -> bool {
    matches!(
        value,
        "character"
            | "scene"
            | "location"
            | "faction"
            | "item"
            | "worldRule"
            | "timelineEvent"
            | "relationship"
            | "plotThread"
            | "foreshadowing"
            | "information"
    )
}

fn valid_story_id(value: &str) -> bool {
    let mut parts = value.split(':');
    let prefix = parts.next().unwrap_or_default();
    let leaf = parts.next().unwrap_or_default();
    parts.next().is_none()
        && !prefix.is_empty()
        && !leaf.is_empty()
        && prefix
            .chars()
            .all(|value| value.is_ascii_lowercase() || value.is_ascii_digit() || value == '-')
        && leaf
            .chars()
            .all(|value| value.is_ascii_lowercase() || value.is_ascii_digit() || value == '-')
}

fn validate_story_kernel_generation_input(value: &str) -> bool {
    if value.len() > 140_000 {
        return false;
    }
    serde_json::from_str::<StoryKernelGenerationInput>(value).is_ok_and(|input| {
        let target_types = input
            .target_types
            .iter()
            .collect::<std::collections::HashSet<_>>();
        let existing_ids = input
            .existing_resources
            .iter()
            .map(|resource| resource.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        input.schema_version == 1
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && input.source.resource_id.starts_with("chapter:")
            && valid_story_id(&input.source.resource_id)
            && !input.source.source_revision.trim().is_empty()
            && input.source.source_revision.len() <= 128
            && !input.source.content.trim().is_empty()
            && input.source.content.chars().count() <= CHAPTER_REVIEW_MAX_CHARS
            && (1..=11).contains(&input.target_types.len())
            && target_types.len() == input.target_types.len()
            && input
                .target_types
                .iter()
                .all(|resource_type| valid_story_kernel_generation_type(resource_type))
            && input.existing_resources.len() <= 500
            && existing_ids.len() == input.existing_resources.len()
            && input.existing_resources.iter().all(|resource| {
                valid_story_id(&resource.id)
                    && valid_story_kernel_generation_type(&resource.resource_type)
                    && !resource.title.trim().is_empty()
                    && resource.title.chars().count() <= 160
                    && resource.revision <= u32::MAX as u64
            })
    })
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiUsage {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_input_tokens: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum AiStreamEvent {
    JobStarted {
        job_id: String,
    },
    ConnectionOpened {
        job_id: String,
    },
    ThinkingStarted {
        job_id: String,
    },
    ContentDelta {
        job_id: String,
        text: String,
    },
    Usage {
        job_id: String,
        usage: AiUsage,
    },
    Completed {
        job_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        finish_reason: Option<String>,
    },
    Cancelled {
        job_id: String,
    },
    Failed {
        job_id: String,
        error: errors::PublicAiError,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    pub id: String,
    pub owned_by: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBalanceEntry {
    pub currency: String,
    pub total_balance: String,
    pub granted_balance: String,
    pub topped_up_balance: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBalance {
    pub available: bool,
    pub balances: Vec<AiBalanceEntry>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStatus {
    pub configured: bool,
    pub provider_id: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStatus {
    pub provider: AiProviderDefinition,
    pub secret: SecretStatus,
    pub preferences: AiProviderPreferences,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_validated_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResult {
    pub status: AiProviderStatus,
    pub models: Vec<AiModel>,
    pub balance: AiBalance,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiUsageSummary {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub requests: u64,
}

#[cfg(test)]
mod tests {
    use super::{
        AiGenerateRequest, AiGenerationOptions, AiJobType, AiMessage, AiRole,
        CHAPTER_REVIEW_SYSTEM_PROMPT, ResponseFormat, SELECTION_REWRITE_SYSTEM_PROMPT,
        STORY_EXTRACTION_SYSTEM_PROMPT, STORY_KERNEL_GENERATION_SYSTEM_PROMPT,
        STORYFORGE_SYSTEM_PROMPT, ThinkingMode,
    };

    fn valid_request() -> AiGenerateRequest {
        AiGenerateRequest {
            job_id: "job-123".to_owned(),
            job_type: AiJobType::StoryforgeTest,
            provider_id: "deepseek".to_owned(),
            model_id: "deepseek-v4-flash".to_owned(),
            messages: vec![
                AiMessage {
                    role: AiRole::System,
                    content: STORYFORGE_SYSTEM_PROMPT.to_owned(),
                },
                AiMessage {
                    role: AiRole::User,
                    content: "写一段雨夜场景。".to_owned(),
                },
            ],
            options: AiGenerationOptions {
                stream: true,
                thinking_mode: ThinkingMode::Disabled,
                reasoning_effort: None,
                max_output_tokens: 2048,
                response_format: ResponseFormat::Text,
            },
        }
    }

    #[test]
    fn generation_requires_the_isolated_storyforge_contract() {
        assert!(valid_request().validate().is_ok());

        let mut wrong_system = valid_request();
        wrong_system.messages[0].content = "读取当前项目后续写".to_owned();
        assert!(wrong_system.validate().is_err());

        let mut retired_model = valid_request();
        retired_model.model_id = "deepseek-chat".to_owned();
        assert!(retired_model.validate().is_err());

        let mut invalid_reasoning = valid_request();
        invalid_reasoning.options.thinking_mode = ThinkingMode::Enabled;
        assert!(invalid_reasoning.validate().is_err());
    }

    #[test]
    fn chapter_review_accepts_only_the_fixed_content_contract() {
        let mut request = valid_request();
        request.job_type = AiJobType::ChapterReview;
        request.messages[0].content = CHAPTER_REVIEW_SYSTEM_PROMPT.to_owned();
        request.messages[1].content =
            serde_json::json!({"schemaVersion": 1, "content": "夜雨落下。。"}).to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "content": "夜雨落下。。",
            "projectPath": "C:/secret"
        })
        .to_string();
        assert!(request.validate().is_err());

        request.messages[1].content =
            serde_json::json!({"schemaVersion": 1, "content": ""}).to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn selection_rewrite_requires_grounded_context_without_paths() {
        let mut request = valid_request();
        request.job_type = AiJobType::SelectionRewrite;
        request.messages[0].content = SELECTION_REWRITE_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "polish",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "作者指令",
                "content": "只润色"
            }, {
                "priority": "P1",
                "kind": "selection",
                "title": "当前选区",
                "content": "夜雨落下。"
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "polish",
            "projectRoot": "C:/secret",
            "context": []
        })
        .to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn story_extraction_accepts_only_isolated_manuscript_content() {
        let mut request = valid_request();
        request.job_type = AiJobType::StoryExtraction;
        request.messages[0].content = STORY_EXTRACTION_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "resourceId": "chapter:one",
            "sourceRevision": "7",
            "content": "沈青把铜钥匙交给林越。"
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "resourceId": "chapter:one",
            "sourceRevision": "7",
            "content": "沈青把铜钥匙交给林越。",
            "projectRoot": "C:/secret"
        })
        .to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn story_kernel_generation_requires_bounded_structured_context() {
        let mut request = valid_request();
        request.job_type = AiJobType::StoryKernelGeneration;
        request.messages[0].content = STORY_KERNEL_GENERATION_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "instruction": "根据正文创建人物和地点。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "content": "林越在旧车站等候沈青。"
            },
            "targetTypes": ["character", "location"],
            "existingResources": [{
                "id": "character:shen-qing",
                "type": "character",
                "title": "沈青",
                "revision": 2
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "instruction": "生成",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "content": "林越。"
            },
            "targetTypes": ["character", "character"],
            "existingResources": [],
            "projectRoot": "C:/secret"
        })
        .to_string();
        assert!(request.validate().is_err());
    }
}
