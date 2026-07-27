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
pub const MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT: &str = concat!(
    "You are Writing Buddy, an author-controlled Chinese fiction continuation assistant. ",
    "Use only the supplied JSON context. Never ask for or infer project paths, credentials, hidden history, or undisclosed story facts. ",
    "Return only a JSON object shaped as {\"candidates\":[{\"title\":\"short direction\",\"content\":\"continuation text\",\"rationale\":\"brief grounded reason\"}]}. ",
    "For three-directions return exactly three materially different candidates; for all other modes return exactly one. ",
    "Candidates are suggestions only and must never claim that the manuscript was modified."
);
pub const SCENE_PLAN_SYSTEM_PROMPT: &str = concat!(
    "You are Writing Buddy, an author-controlled Chinese fiction scene-planning assistant. ",
    "Use only the supplied JSON context. Never ask for or infer project paths, credentials, hidden history, or undisclosed story facts. ",
    "Return only a JSON object with one or more of goal, conflict, turn, outcome, emotionBeats, plus rationale. ",
    "emotionBeats is an array of {\"label\":\"beat\",\"emotion\":\"emotion\",\"intensity\":0.0}. ",
    "Every field is an optional candidate for author review and must never be described as already saved."
);
pub const CHARACTER_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的人物候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令和人物身份，不读取或推断路径、密钥、账户或隐藏历史。",
    "仅返回 JSON 对象：{\"candidates\":[{\"title\":\"人物名\",\"role\":\"protagonist|antagonist|supporting|minor 或省略\",\"confidence\":0.9,\"rationale\":\"依据\",\"fields\":[{\"key\":\"字段名\",\"value\":\"字段值\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}]}]}。",
    "字段名仅可为 aliases、summary、pronouns、birth、appearance、occupation、goals、desires、fears、values、speechStyle、state.location、state.lifeStatus、state.health、state.emotion、state.currentGoal、state.inventory、state.knowledge、state.misconception、state.ability。",
    "aliases/goals/desires/fears/values 与 state.inventory/state.knowledge 使用字符串数组；其余档案字段使用字符串；其他状态字段可使用字符串、数字、布尔或 null。",
    "generate-character 必须返回恰好 3 个不同候选；背景、人物弧、语言风格动作只返回 1 个候选；extract-from-chapter 最多返回 12 个候选且每个字段必须有精确正文证据。",
    "证据索引使用 JavaScript UTF-16 字符索引。所有字段仅供作者逐项确认，不得声称已经保存或覆盖人物。"
);
pub const RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的有向人物关系候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令、人物身份与既有关系身份，不读取或推断路径、密钥、账户或隐藏历史。",
    "仅返回 JSON 对象：{\"candidates\":[{\"sourceCharacterId\":\"character:a\",\"targetCharacterId\":\"character:b\",\"relationshipType\":\"关系\",\"strength\":0.7,\"visibility\":\"public|private|secret\",\"description\":\"说明\",\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}]}。",
    "方向必须明确；A 指向 B 与 B 指向 A 可以返回不同候选。只能引用用户提供的人物 ID。",
    "extract-relationship-changes 的每条候选必须有精确正文证据；generate-relationship 可无证据。最多返回 24 条。",
    "证据索引使用 JavaScript UTF-16 字符索引。所有边仅供作者逐条确认，不得声称已经保存或改变正式关系图。"
);
pub const WORLD_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的结构化世界观候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令和世界资料身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。",
    "仅返回 JSON 对象 {\"candidates\":[候选]}。候选按 kind 使用严格结构：",
    "location 为 {\"kind\":\"location\",\"title\":\"名称\",\"aliases\":[],\"summary\":\"说明\",\"locationType\":\"类型\",\"parentLocationId\":\"已知 location ID 或 null\",\"rules\":[],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}；",
    "faction 为 {\"kind\":\"faction\",\"title\":\"名称\",\"aliases\":[],\"summary\":\"说明\",\"ideology\":\"纲领\",\"goals\":[],\"territoryLocationIds\":[\"已知 location ID\"],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":...}；",
    "worldRule 为 {\"kind\":\"worldRule\",\"title\":\"名称\",\"aliases\":[],\"category\":\"culture|religion|technology|magic|law|other\",\"statement\":\"规则\",\"scope\":\"适用范围\",\"exceptions\":[],\"consequences\":[],\"conflicts\":[{\"resourceId\":\"已知 world-rule ID\",\"reason\":\"冲突说明\"}],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":...}。",
    "generate-world-entry 只返回 targetType 对应的候选；文化、宗教、科技、魔法和法律使用 worldRule 及对应 category。规则必须有明确 scope，exceptions 可为空但不可省略。",
    "extract-worldbuilding 最多返回 24 个独立条目，每条必须有精确正文证据；长设定拆分成可分别确认的候选，不推断未写出的事实。",
    "证据索引使用 JavaScript UTF-16 字符索引。不得声称已经保存、合并或覆盖世界资料。"
);
pub const ITEM_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的结构化物品候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令、物品和人物/地点身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。",
    "仅返回 JSON 对象 {\"candidates\":[{\"title\":\"物品名\",\"aliases\":[],\"itemType\":\"类型\",\"unique\":true,\"quantityUnit\":\"单位或 null\",\"description\":\"外观、来源与用途\",\"restrictions\":[],\"plotFunction\":\"叙事作用\",\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null,\"states\":[{\"action\":\"acquired|transferred|used|lost|destroyed|adjusted\",\"quantity\":1,\"holderCharacterId\":\"已知 character ID 或 null\",\"locationId\":\"已知 location ID 或 null\",\"condition\":\"状态或 null\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}]}]}。",
    "generate-item 生成完整物品卡；generate-item-history 针对 selectedItemId 生成可分别确认的历史或流转事件；extract-items 最多返回 16 个物品候选。",
    "extract-items 的物品卡和每条状态事件都必须有精确正文证据。持有人和地点只能引用用户提供的 ID；不得为未识别人物或地点发明 ID。",
    "证据索引使用 JavaScript UTF-16 字符索引。所有卡片字段和状态事件仅供作者确认，不得声称已经保存、转移或覆盖物品。"
);
pub const TIMELINE_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的结构化故事进程候选分析器。只使用用户 JSON 中明确提供的章节、作者指令和资源身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。",
    "仅返回 JSON 对象 {\"candidates\":[事件候选],\"causalEdges\":[因果边]}。事件候选严格为 {\"clientCandidateId\":\"candidate:slug\",\"sourceResourceId\":\"已知 chapter ID\",\"title\":\"标题\",\"aliases\":[],\"summary\":\"摘要\",\"eventType\":\"类型\",\"storyTimeKind\":\"exact|date|relative|range|unknown\",\"storyStart\":\"时间或 null\",\"storyEnd\":\"时间或 null\",\"narrativeOrder\":0,\"participantIds\":[\"已知 character ID\"],\"locationIds\":[\"已知 location ID\"],\"itemIds\":[\"已知 item ID\"],\"predecessorIds\":[\"已知 timeline-event ID\"],\"consequenceIds\":[\"已知 timeline-event ID\"],\"plotThreadIds\":[\"已知 plot-thread ID\"],\"foreshadowingIds\":[\"已知 foreshadowing ID\"],\"directResults\":[],\"impacts\":[],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}。",
    "因果边严格为 {\"clientEdgeId\":\"edge:slug\",\"from\":{\"kind\":\"existing|candidate\",\"id\":\"对应 ID\"},\"to\":{\"kind\":\"existing|candidate\",\"id\":\"对应 ID\"},\"relation\":\"precondition|causes|enables|blocks\",\"confidence\":0.9,\"rationale\":\"依据\"}；不得自连或引用未提供/未返回的端点。",
    "extract-events 的每个事件必须带来自其 sourceResourceId 的精确正文证据；generate-directions 必须返回恰好三个实质不同的候选；suggest-causality 必须返回至少一条因果边。",
    "最多返回 32 个事件和 64 条因果边。证据索引使用 JavaScript UTF-16 字符索引。候选与虚线边只供作者确认，不得声称已经写入时间线。"
);
pub const PLOT_ANALYSIS_SYSTEM_PROMPT: &str = concat!(
    "你是 Writing Buddy 的结构化剧情线与伏笔候选分析器。只使用用户 JSON 中明确提供的章节、作者指令和资源身份，不读取或推断路径、密钥、账户或隐藏历史。",
    "仅返回 JSON 对象 {\"candidates\":[候选]}，候选按 kind 使用严格结构。",
    "plotThread 为 {\"kind\":\"plotThread\",\"sourceResourceId\":\"已知 chapter ID\",\"title\":\"标题\",\"aliases\":[],\"summary\":\"摘要\",\"status\":\"planned|active|at-risk|resolved|abandoned\",\"premise\":\"前提\",\"stakes\":\"赌注\",\"dramaticQuestion\":\"戏剧问题\",\"startPosition\":位置或null,\"targetResolution\":位置或null,\"actualResolution\":位置或null,\"participantIds\":[\"已知 character ID\"],\"sceneIds\":[\"已知 scene ID\"],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":{\"start\":0,\"end\":2,\"quote\":\"原文\"}或null}。",
    "foreshadowing 为 {\"kind\":\"foreshadowing\",\"sourceResourceId\":\"已知 chapter ID\",\"title\":\"标题\",\"aliases\":[],\"summary\":\"摘要\",\"status\":\"planted|reminded|resolved|overdue|abandoned\",\"plantedAt\":位置或null,\"surfaceMeaning\":\"表面含义\",\"trueMeaning\":\"真实含义或 null\",\"reminderPositions\":[位置],\"plannedPayoffAt\":位置或null,\"actualPayoffAt\":位置或null,\"readerVisibility\":0.4,\"plotThreadIds\":[\"已知 plot-thread ID\"],\"confidence\":0.9,\"rationale\":\"依据\",\"evidence\":...}。位置严格为 {\"chapterId\":\"已知 chapter ID\",\"narrativeOrder\":0}。",
    "extract-plot-progress 与 extract-foreshadowing 的每条候选必须有精确正文证据。只能引用用户提供的章节、人物、场景和剧情线 ID。",
    "includeAuthorSecrets 为 false 时，不得推断或声称知道既有伏笔的 trueMeaning；所有候选仅供作者确认，不得声称已经保存、推进或回收。最多返回 24 条。"
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
            AiJobType::ManuscriptContinuation => {
                self.messages[0].content == MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_manuscript_continuation_input(&self.messages[1].content)
            }
            AiJobType::ScenePlanGeneration => {
                self.messages[0].content == SCENE_PLAN_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_scene_plan_input(&self.messages[1].content)
            }
            AiJobType::CharacterAnalysis => {
                self.messages[0].content == CHARACTER_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_character_analysis_input(&self.messages[1].content)
            }
            AiJobType::RelationshipAnalysis => {
                self.messages[0].content == RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_relationship_analysis_input(&self.messages[1].content)
            }
            AiJobType::WorldAnalysis => {
                self.messages[0].content == WORLD_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_world_analysis_input(&self.messages[1].content)
            }
            AiJobType::ItemAnalysis => {
                self.messages[0].content == ITEM_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_item_analysis_input(&self.messages[1].content)
            }
            AiJobType::TimelineAnalysis => {
                self.messages[0].content == TIMELINE_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_timeline_analysis_input(&self.messages[1].content)
            }
            AiJobType::PlotAnalysis => {
                self.messages[0].content == PLOT_ANALYSIS_SYSTEM_PROMPT
                    && matches!(self.options.response_format, ResponseFormat::JsonObject)
                    && validate_plot_analysis_input(&self.messages[1].content)
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
    ManuscriptContinuation,
    ScenePlanGeneration,
    CharacterAnalysis,
    RelationshipAnalysis,
    WorldAnalysis,
    ItemAnalysis,
    TimelineAnalysis,
    PlotAnalysis,
    StoryExtraction,
    StoryKernelGeneration,
}

impl AiJobType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::StoryforgeTest => "storyforge-test",
            Self::ChapterReview => "chapter-review",
            Self::SelectionRewrite => "selection-rewrite",
            Self::ManuscriptContinuation => "manuscript-continuation",
            Self::ScenePlanGeneration => "scene-plan-generation",
            Self::CharacterAnalysis => "character-analysis",
            Self::RelationshipAnalysis => "relationship-analysis",
            Self::WorldAnalysis => "world-analysis",
            Self::ItemAnalysis => "item-analysis",
            Self::TimelineAnalysis => "timeline-analysis",
            Self::PlotAnalysis => "plot-analysis",
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
                "polish" | "concise" | "expand" | "grammar" | "dialogue" | "pacing"
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

fn contains_forbidden_context_key(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    ["projectroot", "apikey", "credential", "absolutepath"]
        .iter()
        .any(|key| normalized.contains(key))
}

fn valid_grounded_context_item(item: &SelectionContextItem) -> bool {
    matches!(
        item.priority.as_str(),
        "P0" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6"
    ) && matches!(
        item.kind.as_str(),
        "instruction"
            | "selection"
            | "manuscript-excerpt"
            | "scene-manuscript"
            | "scene"
            | "character"
            | "location"
            | "item"
            | "world-rule"
            | "plot-thread"
            | "foreshadowing"
            | "information"
            | "adjacent-summary"
    ) && !item.title.trim().is_empty()
        && item.title.len() <= 160
        && !item.content.trim().is_empty()
        && item.content.len() <= 12_000
}

fn validate_manuscript_continuation_input(value: &str) -> bool {
    if value.len() > 40_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<SelectionRewriteInput>(value).is_ok_and(|input| {
        let source = input.context.iter().find(|item| item.priority == "P1");
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "continue-paragraph" | "finish-scene" | "three-directions"
            )
            && (2..=64).contains(&input.context.len())
            && input.context.iter().all(valid_grounded_context_item)
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P0" && item.kind == "instruction")
                .count()
                == 1
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P1")
                .count()
                == 1
            && source.is_some_and(|item| {
                matches!(
                    item.kind.as_str(),
                    "manuscript-excerpt" | "scene-manuscript"
                ) && (input.action_type != "finish-scene" || item.kind == "scene-manuscript")
            })
    })
}

fn validate_scene_plan_input(value: &str) -> bool {
    if value.len() > 40_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<SelectionRewriteInput>(value).is_ok_and(|input| {
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "generate-goal" | "generate-outline" | "extract-outline" | "generate-emotion-beats"
            )
            && (2..=64).contains(&input.context.len())
            && input.context.iter().all(valid_grounded_context_item)
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P0" && item.kind == "instruction")
                .count()
                == 1
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P1" && item.kind == "scene-manuscript")
                .count()
                == 1
            && input
                .context
                .iter()
                .filter(|item| item.priority == "P1")
                .count()
                == 1
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CharacterAnalysisInput {
    schema_version: u8,
    action_type: String,
    instruction: String,
    source: CharacterAnalysisSource,
    selected_character_id: Option<String>,
    existing_characters: Vec<CharacterIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CharacterAnalysisSource {
    resource_id: String,
    source_revision: String,
    narrative_order: u64,
    content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CharacterIdentity {
    id: String,
    title: String,
    aliases: Vec<String>,
    revision: u64,
}

fn valid_character_identity(value: &CharacterIdentity) -> bool {
    value.id.starts_with("character:")
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && value.aliases.len() <= 40
        && value
            .aliases
            .iter()
            .all(|alias| !alias.trim().is_empty() && alias.chars().count() <= 160)
        && value.revision <= u32::MAX as u64
}

fn valid_character_source(source: &CharacterAnalysisSource) -> bool {
    source.resource_id.starts_with("chapter:")
        && valid_story_id(&source.resource_id)
        && !source.source_revision.trim().is_empty()
        && source.source_revision.len() <= 128
        && source.narrative_order <= u32::MAX as u64
        && !source.content.trim().is_empty()
        && source.content.chars().count() <= CHAPTER_REVIEW_MAX_CHARS
}

fn validate_character_analysis_input(value: &str) -> bool {
    if value.len() > 140_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<CharacterAnalysisInput>(value).is_ok_and(|input| {
        let ids = input
            .existing_characters
            .iter()
            .map(|character| character.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "generate-character"
                    | "generate-background"
                    | "generate-arc"
                    | "generate-speech-style"
                    | "extract-from-chapter"
            )
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_character_source(&input.source)
            && input.existing_characters.len() <= 500
            && ids.len() == input.existing_characters.len()
            && input
                .existing_characters
                .iter()
                .all(valid_character_identity)
            && input
                .selected_character_id
                .as_ref()
                .is_none_or(|id| ids.contains(id.as_str()))
            && (matches!(
                input.action_type.as_str(),
                "generate-character" | "extract-from-chapter"
            ) || input.selected_character_id.is_some())
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RelationshipAnalysisInput {
    schema_version: u8,
    action_type: String,
    instruction: String,
    source: CharacterAnalysisSource,
    source_character_id: Option<String>,
    target_character_id: Option<String>,
    characters: Vec<CharacterIdentity>,
    existing_relationships: Vec<RelationshipIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RelationshipIdentity {
    id: String,
    source_character_id: String,
    target_character_id: String,
    relationship_type: String,
    revision: u64,
}

fn validate_relationship_analysis_input(value: &str) -> bool {
    if value.len() > 180_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<RelationshipAnalysisInput>(value).is_ok_and(|input| {
        let character_ids = input
            .characters
            .iter()
            .map(|character| character.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let relationship_ids = input
            .existing_relationships
            .iter()
            .map(|relationship| relationship.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let selected_pair_is_valid = input.action_type != "generate-relationship"
            || input
                .source_character_id
                .as_ref()
                .zip(input.target_character_id.as_ref())
                .is_some_and(|(source, target)| {
                    source != target
                        && character_ids.contains(source.as_str())
                        && character_ids.contains(target.as_str())
                });
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "generate-relationship" | "extract-relationship-changes"
            )
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_character_source(&input.source)
            && (2..=500).contains(&input.characters.len())
            && character_ids.len() == input.characters.len()
            && input.characters.iter().all(valid_character_identity)
            && input.existing_relationships.len() <= 1_000
            && relationship_ids.len() == input.existing_relationships.len()
            && input.existing_relationships.iter().all(|relationship| {
                relationship.id.starts_with("relationship:")
                    && valid_story_id(&relationship.id)
                    && relationship.source_character_id != relationship.target_character_id
                    && character_ids.contains(relationship.source_character_id.as_str())
                    && character_ids.contains(relationship.target_character_id.as_str())
                    && !relationship.relationship_type.trim().is_empty()
                    && relationship.relationship_type.chars().count() <= 160
                    && relationship.revision <= u32::MAX as u64
            })
            && selected_pair_is_valid
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorldAnalysisInput {
    schema_version: u8,
    action_type: String,
    target_type: Option<String>,
    instruction: String,
    source: CharacterAnalysisSource,
    existing_resources: Vec<WorldResourceIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorldResourceIdentity {
    id: String,
    #[serde(rename = "type")]
    resource_type: String,
    title: String,
    aliases: Vec<String>,
    revision: u64,
    category: Option<String>,
    statement: Option<String>,
    scope: Option<String>,
}

fn valid_world_identity(value: &WorldResourceIdentity) -> bool {
    let prefix = match value.resource_type.as_str() {
        "location" => "location:",
        "faction" => "faction:",
        "worldRule" => "world-rule:",
        _ => return false,
    };
    value.id.starts_with(prefix)
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && value.aliases.len() <= 40
        && value
            .aliases
            .iter()
            .all(|alias| !alias.trim().is_empty() && alias.chars().count() <= 160)
        && value.revision <= u32::MAX as u64
        && (value.resource_type != "worldRule"
            || value.category.as_ref().is_some_and(|category| {
                matches!(
                    category.as_str(),
                    "culture" | "religion" | "technology" | "magic" | "law" | "other"
                )
            }))
        && value
            .statement
            .as_ref()
            .is_none_or(|statement| statement.chars().count() <= 10_000)
        && value
            .scope
            .as_ref()
            .is_none_or(|scope| scope.chars().count() <= 2_000)
}

fn validate_world_analysis_input(value: &str) -> bool {
    if value.len() > 180_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<WorldAnalysisInput>(value).is_ok_and(|input| {
        let ids = input
            .existing_resources
            .iter()
            .map(|resource| resource.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let target_is_valid = match input.action_type.as_str() {
            "generate-world-entry" => input.target_type.as_ref().is_some_and(|target| {
                matches!(
                    target.as_str(),
                    "location"
                        | "faction"
                        | "culture"
                        | "religion"
                        | "technology"
                        | "magic"
                        | "law"
                        | "world-rule"
                )
            }),
            "extract-worldbuilding" => input.target_type.is_none(),
            _ => false,
        };
        input.schema_version == 1
            && target_is_valid
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_character_source(&input.source)
            && input.existing_resources.len() <= 1_000
            && ids.len() == input.existing_resources.len()
            && input.existing_resources.iter().all(valid_world_identity)
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ItemAnalysisInput {
    schema_version: u8,
    action_type: String,
    instruction: String,
    source: CharacterAnalysisSource,
    selected_item_id: Option<String>,
    existing_items: Vec<ItemIdentity>,
    characters: Vec<SimpleEntityIdentity>,
    locations: Vec<SimpleEntityIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ItemIdentity {
    id: String,
    title: String,
    aliases: Vec<String>,
    #[serde(rename = "unique")]
    _unique: bool,
    revision: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SimpleEntityIdentity {
    id: String,
    title: String,
    revision: u64,
}

fn valid_simple_entity(value: &SimpleEntityIdentity, prefix: &str) -> bool {
    value.id.starts_with(prefix)
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && value.revision <= u32::MAX as u64
}

fn validate_item_analysis_input(value: &str) -> bool {
    if value.len() > 200_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<ItemAnalysisInput>(value).is_ok_and(|input| {
        let item_ids = input
            .existing_items
            .iter()
            .map(|item| item.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let character_ids = input
            .characters
            .iter()
            .map(|entity| entity.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let location_ids = input
            .locations
            .iter()
            .map(|entity| entity.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let selection_is_valid = match input.action_type.as_str() {
            "generate-item-history" => input
                .selected_item_id
                .as_ref()
                .is_some_and(|id| item_ids.contains(id.as_str())),
            "generate-item" | "extract-items" => input.selected_item_id.is_none(),
            _ => false,
        };
        input.schema_version == 1
            && selection_is_valid
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_character_source(&input.source)
            && input.existing_items.len() <= 1_000
            && item_ids.len() == input.existing_items.len()
            && input.existing_items.iter().all(|item| {
                item.id.starts_with("item:")
                    && valid_story_id(&item.id)
                    && !item.title.trim().is_empty()
                    && item.title.chars().count() <= 160
                    && item.aliases.len() <= 40
                    && item
                        .aliases
                        .iter()
                        .all(|alias| !alias.trim().is_empty() && alias.chars().count() <= 160)
                    && item.revision <= u32::MAX as u64
            })
            && input.characters.len() <= 500
            && character_ids.len() == input.characters.len()
            && input
                .characters
                .iter()
                .all(|entity| valid_simple_entity(entity, "character:"))
            && input.locations.len() <= 1_000
            && location_ids.len() == input.locations.len()
            && input
                .locations
                .iter()
                .all(|entity| valid_simple_entity(entity, "location:"))
    })
}

fn valid_gate_f_sources(sources: &[CharacterAnalysisSource]) -> bool {
    let ids = sources
        .iter()
        .map(|source| source.resource_id.as_str())
        .collect::<std::collections::HashSet<_>>();
    (1..=12).contains(&sources.len())
        && ids.len() == sources.len()
        && sources.iter().all(valid_character_source)
        && sources
            .iter()
            .map(|source| source.content.chars().count())
            .sum::<usize>()
            <= 160_000
}

fn valid_aliases(aliases: &[String]) -> bool {
    aliases.len() <= 40
        && aliases
            .iter()
            .all(|alias| !alias.trim().is_empty() && alias.chars().count() <= 160)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TimelineAnalysisInput {
    schema_version: u8,
    action_type: String,
    instruction: String,
    sources: Vec<CharacterAnalysisSource>,
    existing_events: Vec<NamedRevisionIdentity>,
    characters: Vec<SimpleEntityIdentity>,
    locations: Vec<SimpleEntityIdentity>,
    items: Vec<SimpleEntityIdentity>,
    plot_threads: Vec<SimpleEntityIdentity>,
    foreshadowing: Vec<SimpleEntityIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NamedRevisionIdentity {
    id: String,
    title: String,
    aliases: Vec<String>,
    revision: u64,
}

fn valid_named_identity(value: &NamedRevisionIdentity, prefix: &str) -> bool {
    value.id.starts_with(prefix)
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && valid_aliases(&value.aliases)
        && value.revision <= u32::MAX as u64
}

fn unique_simple_entities(values: &[SimpleEntityIdentity], prefix: &str) -> bool {
    values.len() <= 1_000
        && values
            .iter()
            .map(|value| value.id.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len()
            == values.len()
        && values
            .iter()
            .all(|value| valid_simple_entity(value, prefix))
}

fn validate_timeline_analysis_input(value: &str) -> bool {
    if value.len() > 240_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<TimelineAnalysisInput>(value).is_ok_and(|input| {
        let event_ids = input
            .existing_events
            .iter()
            .map(|event| event.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        input.schema_version == 1
            && matches!(
                input.action_type.as_str(),
                "extract-events" | "generate-events" | "generate-directions" | "suggest-causality"
            )
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_gate_f_sources(&input.sources)
            && input.existing_events.len() <= 1_000
            && event_ids.len() == input.existing_events.len()
            && input
                .existing_events
                .iter()
                .all(|event| valid_named_identity(event, "timeline-event:"))
            && unique_simple_entities(&input.characters, "character:")
            && unique_simple_entities(&input.locations, "location:")
            && unique_simple_entities(&input.items, "item:")
            && unique_simple_entities(&input.plot_threads, "plot-thread:")
            && unique_simple_entities(&input.foreshadowing, "foreshadowing:")
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlotAnalysisInput {
    schema_version: u8,
    action_type: String,
    instruction: String,
    sources: Vec<CharacterAnalysisSource>,
    include_author_secrets: bool,
    selected_plot_thread_id: Option<String>,
    selected_foreshadowing_id: Option<String>,
    plot_threads: Vec<PlotThreadIdentity>,
    foreshadowing: Vec<ForeshadowingIdentity>,
    characters: Vec<SimpleEntityIdentity>,
    scenes: Vec<SimpleEntityIdentity>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlotThreadIdentity {
    id: String,
    title: String,
    aliases: Vec<String>,
    status: String,
    revision: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ForeshadowingIdentity {
    id: String,
    title: String,
    aliases: Vec<String>,
    status: String,
    surface_meaning: Option<String>,
    true_meaning: Option<String>,
    revision: u64,
}

fn valid_plot_thread_identity(value: &PlotThreadIdentity) -> bool {
    value.id.starts_with("plot-thread:")
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && valid_aliases(&value.aliases)
        && matches!(
            value.status.as_str(),
            "planned" | "active" | "at-risk" | "resolved" | "abandoned"
        )
        && value.revision <= u32::MAX as u64
}

fn valid_foreshadowing_identity(value: &ForeshadowingIdentity) -> bool {
    value.id.starts_with("foreshadowing:")
        && valid_story_id(&value.id)
        && !value.title.trim().is_empty()
        && value.title.chars().count() <= 160
        && valid_aliases(&value.aliases)
        && matches!(
            value.status.as_str(),
            "planted" | "reminded" | "resolved" | "overdue" | "abandoned"
        )
        && value
            .surface_meaning
            .as_ref()
            .is_none_or(|meaning| meaning.chars().count() <= 5_000)
        && value
            .true_meaning
            .as_ref()
            .is_none_or(|meaning| meaning.chars().count() <= 5_000)
        && value.revision <= u32::MAX as u64
}

fn validate_plot_analysis_input(value: &str) -> bool {
    if value.len() > 240_000 || contains_forbidden_context_key(value) {
        return false;
    }
    serde_json::from_str::<PlotAnalysisInput>(value).is_ok_and(|input| {
        let plot_ids = input
            .plot_threads
            .iter()
            .map(|thread| thread.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let clue_ids = input
            .foreshadowing
            .iter()
            .map(|clue| clue.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        let selection_is_valid = match input.action_type.as_str() {
            "generate-plot-consequences" => {
                input
                    .selected_plot_thread_id
                    .as_ref()
                    .is_some_and(|id| plot_ids.contains(id.as_str()))
                    && input.selected_foreshadowing_id.is_none()
            }
            "generate-foreshadowing-payoff" => {
                input
                    .selected_foreshadowing_id
                    .as_ref()
                    .is_some_and(|id| clue_ids.contains(id.as_str()))
                    && input.selected_plot_thread_id.is_none()
            }
            "generate-plot-thread"
            | "extract-plot-progress"
            | "generate-foreshadowing"
            | "extract-foreshadowing" => {
                input.selected_plot_thread_id.is_none() && input.selected_foreshadowing_id.is_none()
            }
            _ => false,
        };
        input.schema_version == 1
            && selection_is_valid
            && !input.instruction.trim().is_empty()
            && input.instruction.chars().count() <= 2_000
            && valid_gate_f_sources(&input.sources)
            && input.plot_threads.len() <= 1_000
            && plot_ids.len() == input.plot_threads.len()
            && input.plot_threads.iter().all(valid_plot_thread_identity)
            && input.foreshadowing.len() <= 1_000
            && clue_ids.len() == input.foreshadowing.len()
            && input.foreshadowing.iter().all(valid_foreshadowing_identity)
            && (input.include_author_secrets
                || input
                    .foreshadowing
                    .iter()
                    .all(|clue| clue.true_meaning.is_none()))
            && unique_simple_entities(&input.characters, "character:")
            && unique_simple_entities(&input.scenes, "scene:")
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
        CHAPTER_REVIEW_SYSTEM_PROMPT, CHARACTER_ANALYSIS_SYSTEM_PROMPT,
        ITEM_ANALYSIS_SYSTEM_PROMPT, MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT,
        PLOT_ANALYSIS_SYSTEM_PROMPT, RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT, ResponseFormat,
        SCENE_PLAN_SYSTEM_PROMPT, SELECTION_REWRITE_SYSTEM_PROMPT, STORY_EXTRACTION_SYSTEM_PROMPT,
        STORY_KERNEL_GENERATION_SYSTEM_PROMPT, STORYFORGE_SYSTEM_PROMPT,
        TIMELINE_ANALYSIS_SYSTEM_PROMPT, ThinkingMode, WORLD_ANALYSIS_SYSTEM_PROMPT,
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
            "actionType": "expand",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "作者指令",
                "content": "扩展感官和动作细节"
            }, {
                "priority": "P1",
                "kind": "selection",
                "title": "当前选区",
                "content": "夜雨落下。"
            }]
        })
        .to_string();
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
    fn continuation_requires_a_bounded_cursor_or_scene_source() {
        let mut request = valid_request();
        request.job_type = AiJobType::ManuscriptContinuation;
        request.messages[0].content = MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "three-directions",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "Author instruction",
                "content": "Return three directions."
            }, {
                "priority": "P1",
                "kind": "manuscript-excerpt",
                "title": "Before cursor",
                "content": "The rain stopped."
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "finish-scene",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "Author instruction",
                "content": "Finish the scene."
            }, {
                "priority": "P1",
                "kind": "manuscript-excerpt",
                "title": "Wrong source",
                "content": "The rain stopped."
            }]
        })
        .to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn scene_plan_requires_current_scene_without_sensitive_keys() {
        let mut request = valid_request();
        request.job_type = AiJobType::ScenePlanGeneration;
        request.messages[0].content = SCENE_PLAN_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-outline",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "Author instruction",
                "content": "Generate an outline."
            }, {
                "priority": "P1",
                "kind": "scene-manuscript",
                "title": "Current scene",
                "content": "The rain stopped."
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-outline",
            "context": [{
                "priority": "P0",
                "kind": "instruction",
                "title": "Author instruction",
                "content": "Generate an outline."
            }, {
                "priority": "P1",
                "kind": "scene-manuscript",
                "title": "Current scene",
                "content": "credential should not be sent"
            }]
        })
        .to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn character_analysis_requires_bounded_chapter_and_known_selected_character() {
        let mut request = valid_request();
        request.job_type = AiJobType::CharacterAnalysis;
        request.messages[0].content = CHARACTER_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-background",
            "instruction": "补充人物背景。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "沈青把钥匙交给林越。"
            },
            "selectedCharacterId": "character:lin-yue",
            "existingCharacters": [{
                "id": "character:lin-yue",
                "title": "林越",
                "aliases": ["阿越"],
                "revision": 2
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-background",
            "instruction": "补充人物背景。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "沈青把钥匙交给林越。"
            },
            "selectedCharacterId": "character:unknown",
            "existingCharacters": []
        })
        .to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn relationship_analysis_requires_known_directed_endpoints() {
        let mut request = valid_request();
        request.job_type = AiJobType::RelationshipAnalysis;
        request.messages[0].content = RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-relationship",
            "instruction": "设计双向认知。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "沈青把钥匙交给林越。"
            },
            "sourceCharacterId": "character:lin-yue",
            "targetCharacterId": "character:shen-qing",
            "characters": [{
                "id": "character:lin-yue",
                "title": "林越",
                "aliases": [],
                "revision": 2
            }, {
                "id": "character:shen-qing",
                "title": "沈青",
                "aliases": [],
                "revision": 1
            }],
            "existingRelationships": []
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = request.messages[1]
            .content
            .replace("character:shen-qing", "character:lin-yue");
        assert!(request.validate().is_err());
    }

    #[test]
    fn world_analysis_requires_typed_target_and_sanitized_identities() {
        let mut request = valid_request();
        request.job_type = AiJobType::WorldAnalysis;
        request.messages[0].content = WORLD_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-world-entry",
            "targetType": "magic",
            "instruction": "生成有范围和例外的规则。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "雨夜的旧车站没有钟声。"
            },
            "existingResources": [{
                "id": "world-rule:rain-clock",
                "type": "worldRule",
                "title": "雨夜停钟",
                "aliases": [],
                "revision": 2,
                "category": "magic",
                "statement": "雨夜钟表停摆。",
                "scope": "旧车站"
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        let mut missing_target: serde_json::Value =
            serde_json::from_str(&request.messages[1].content).expect("valid world request");
        missing_target
            .as_object_mut()
            .expect("world request object")
            .remove("targetType");
        request.messages[1].content = missing_target.to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn item_analysis_requires_known_history_target_and_entity_ids() {
        let mut request = valid_request();
        request.job_type = AiJobType::ItemAnalysis;
        request.messages[0].content = ITEM_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-item-history",
            "instruction": "生成物品流转候选。",
            "source": {
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "徐青把车票交给林墨。"
            },
            "selectedItemId": "item:faded-ticket",
            "existingItems": [{
                "id": "item:faded-ticket",
                "title": "褪色车票",
                "aliases": [],
                "unique": true,
                "revision": 1
            }],
            "characters": [{
                "id": "character:lin-mo",
                "title": "林墨",
                "revision": 1
            }],
            "locations": [{
                "id": "location:old-station",
                "title": "旧车站",
                "revision": 1
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        request.messages[1].content = request.messages[1].content.replace(
            "\"selectedItemId\":\"item:faded-ticket\"",
            "\"selectedItemId\":\"item:missing\"",
        );
        assert!(request.validate().is_err());
    }

    #[test]
    fn timeline_analysis_requires_bounded_sources_and_sanitized_identities() {
        let mut request = valid_request();
        request.job_type = AiJobType::TimelineAnalysis;
        request.messages[0].content = TIMELINE_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "extract-events",
            "instruction": "提取本章事件。",
            "sources": [{
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "徐青把车票交给林墨。"
            }],
            "existingEvents": [{
                "id": "timeline-event:arrival",
                "title": "抵达旧站",
                "aliases": [],
                "revision": 1
            }],
            "characters": [{
                "id": "character:lin-mo",
                "title": "林墨",
                "revision": 1
            }],
            "locations": [{
                "id": "location:old-station",
                "title": "旧车站",
                "revision": 1
            }],
            "items": [{
                "id": "item:faded-ticket",
                "title": "褪色车票",
                "revision": 1
            }],
            "plotThreads": [{
                "id": "plot-thread:notebook",
                "title": "遗失笔记",
                "revision": 1
            }],
            "foreshadowing": [{
                "id": "foreshadowing:clock",
                "title": "停摆时钟",
                "revision": 1
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        let mut unsafe_request: serde_json::Value =
            serde_json::from_str(&request.messages[1].content).expect("valid timeline request");
        unsafe_request["projectRoot"] = serde_json::json!("C:/secret");
        request.messages[1].content = unsafe_request.to_string();
        assert!(request.validate().is_err());
    }

    #[test]
    fn plot_analysis_keeps_author_secrets_explicitly_opt_in() {
        let mut request = valid_request();
        request.job_type = AiJobType::PlotAnalysis;
        request.messages[0].content = PLOT_ANALYSIS_SYSTEM_PROMPT.to_owned();
        request.messages[1].content = serde_json::json!({
            "schemaVersion": 1,
            "actionType": "generate-foreshadowing",
            "instruction": "生成伏笔候选。",
            "sources": [{
                "resourceId": "chapter:one",
                "sourceRevision": "7",
                "narrativeOrder": 3,
                "content": "墙上的钟停在二十三点十七分。"
            }],
            "includeAuthorSecrets": false,
            "plotThreads": [{
                "id": "plot-thread:notebook",
                "title": "遗失笔记",
                "aliases": [],
                "status": "active",
                "revision": 1
            }],
            "foreshadowing": [{
                "id": "foreshadowing:clock",
                "title": "停摆时钟",
                "aliases": [],
                "status": "planted",
                "surfaceMeaning": "旧钟故障",
                "revision": 1
            }],
            "characters": [{
                "id": "character:lin-mo",
                "title": "林墨",
                "revision": 1
            }],
            "scenes": [{
                "id": "scene:station",
                "title": "车站相遇",
                "revision": 1
            }]
        })
        .to_string();
        request.options.response_format = ResponseFormat::JsonObject;
        assert!(request.validate().is_ok());

        let mut leaked: serde_json::Value =
            serde_json::from_str(&request.messages[1].content).expect("valid plot request");
        leaked["foreshadowing"][0]["trueMeaning"] = serde_json::json!("事故真相");
        request.messages[1].content = leaked.to_string();
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
