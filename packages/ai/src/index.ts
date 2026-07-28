import { createTextAnchor, hashText, type ReviewIssue } from '@writing-buddy/review';
import { z } from 'zod';

export const DEEPSEEK_PROVIDER_ID = 'deepseek' as const;
export const DEEPSEEK_DEFAULT_MODEL_ID = 'deepseek-v4-flash';
export const DEEPSEEK_PRO_MODEL_ID = 'deepseek-v4-pro';
export const DEEPSEEK_RETIRED_MODEL_IDS = ['deepseek-chat', 'deepseek-reasoner'] as const;
export const AI_MAX_OUTPUT_PRESETS = [512, 1024, 2048, 4096, 8192] as const;
export const AI_JOB_QUEUE_LIMIT = 3;
export const AI_CHAPTER_REVIEW_MAX_CHARS = 100_000;
export const STORYFORGE_SYSTEM_PROMPT = [
	'你是 StoryForge 的测试生成器。',
	'只回答用户在本面板明确输入的写作指令。',
	'不要请求、推断或提及任何项目、章节、路径、账户或历史信息。',
	'输出纯文本候选内容，不执行修改。'
].join('');
export const CHAPTER_REVIEW_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的中文小说审校器。',
	'只分析用户 JSON 中 content 字段提供的当前章节，不请求、推断或提及项目、路径、账户或历史信息。',
	'找出明确的错别字、语病、标点、重复、指代、逻辑或表达问题；不要续写正文。',
	'仅返回 JSON 对象：{"issues":[{"start":0,"end":1,"target":"原文片段","severity":"info|suggestion|warning|error","title":"简短标题","message":"问题说明","replacement":"可选替换文本"}]}。',
	'start 和 end 使用 JavaScript UTF-16 字符索引；每条 target 必须与 content 中对应原文完全一致，最多返回 50 条。'
].join('');
export const STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的长篇小说一致性对照分析器。只使用用户 JSON 中明确提供的章节正文、作者指令和 Story Fact 摘要。',
	'不得请求或推断项目路径、密钥、账户、隐藏历史或未提供的作者秘密。不得改写正文或 Story Kernel。',
	'仅返回 JSON 对象：{"issues":[{"ruleId":"ai-continuity","severity":"info|suggestion|warning|error","title":"标题","message":"说明","evidence":[{"resourceId":"已知 chapter ID","start":0,"end":2,"quote":"精确原文","label":"证据 A"},{"resourceId":"已知 chapter ID","start":0,"end":2,"quote":"精确原文","label":"证据 B"}],"storyFact":{"resourceId":"已知 Story Fact ID","title":"标题","statement":"事实摘要"}或null}]}。',
	'每条问题必须包含 2 至 4 个互不重复的精确正文证据，并只引用用户提供的章节和 Story Fact。索引使用 JavaScript UTF-16 字符索引。',
	'结果仅为待确认 ReviewIssue，最多 50 条；不得返回 replacement、patch、操作指令或声称已修改内容。'
].join('');
export const SELECTION_REWRITE_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的选区改写助手。',
	'只改写用户 JSON 中 P1 当前选区，不补写整章，不推断未提供的故事事实。',
	'其余 context 只用于保持人物状态、世界规则、剧情线和信息权限一致。',
	'仅返回 JSON 对象：{"suggestion":"改写候选","rationale":"简短依据","potentialImpact":"对上下文的潜在影响"}。',
	'候选只是建议，不得声称已经修改正文。'
].join('');
export const MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT = [
	'You are Writing Buddy, an author-controlled Chinese fiction continuation assistant. ',
	'Use only the supplied JSON context. Never ask for or infer project paths, credentials, hidden history, or undisclosed story facts. ',
	'Return only a JSON object shaped as {"candidates":[{"title":"short direction","content":"continuation text","rationale":"brief grounded reason"}]}. ',
	'For three-directions return exactly three materially different candidates; for all other modes return exactly one. ',
	'Candidates are suggestions only and must never claim that the manuscript was modified.'
].join('');
export const SCENE_PLAN_SYSTEM_PROMPT = [
	'You are Writing Buddy, an author-controlled Chinese fiction scene-planning assistant. ',
	'Use only the supplied JSON context. Never ask for or infer project paths, credentials, hidden history, or undisclosed story facts. ',
	'Return only a JSON object with one or more of goal, conflict, turn, outcome, emotionBeats, plus rationale. ',
	'emotionBeats is an array of {"label":"beat","emotion":"emotion","intensity":0.0}. ',
	'Every field is an optional candidate for author review and must never be described as already saved.'
].join('');
export const CHARACTER_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的人物候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令和人物身份，不读取或推断路径、密钥、账户或隐藏历史。',
	'仅返回 JSON 对象：{"candidates":[{"title":"人物名","role":"protagonist|antagonist|supporting|minor 或省略","confidence":0.9,"rationale":"依据","fields":[{"key":"字段名","value":"字段值","evidence":{"start":0,"end":2,"quote":"原文"}或null}]}]}。',
	'字段名仅可为 aliases、summary、pronouns、birth、appearance、occupation、goals、desires、fears、values、speechStyle、state.location、state.lifeStatus、state.health、state.emotion、state.currentGoal、state.inventory、state.knowledge、state.misconception、state.ability。',
	'aliases/goals/desires/fears/values 与 state.inventory/state.knowledge 使用字符串数组；其余档案字段使用字符串；其他状态字段可使用字符串、数字、布尔或 null。',
	'generate-character 必须返回恰好 3 个不同候选；背景、人物弧、语言风格动作只返回 1 个候选；extract-from-chapter 最多返回 12 个候选且每个字段必须有精确正文证据。',
	'证据索引使用 JavaScript UTF-16 字符索引。所有字段仅供作者逐项确认，不得声称已经保存或覆盖人物。'
].join('');
export const RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的有向人物关系候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令、人物身份与既有关系身份，不读取或推断路径、密钥、账户或隐藏历史。',
	'仅返回 JSON 对象：{"candidates":[{"sourceCharacterId":"character:a","targetCharacterId":"character:b","relationshipType":"关系","strength":0.7,"visibility":"public|private|secret","description":"说明","confidence":0.9,"rationale":"依据","evidence":{"start":0,"end":2,"quote":"原文"}或null}]}。',
	'方向必须明确；A 指向 B 与 B 指向 A 可以返回不同候选。只能引用用户提供的人物 ID。',
	'extract-relationship-changes 的每条候选必须有精确正文证据；generate-relationship 可无证据。最多返回 24 条。',
	'证据索引使用 JavaScript UTF-16 字符索引。所有边仅供作者逐条确认，不得声称已经保存或改变正式关系图。'
].join('');
export const WORLD_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的结构化世界观候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令和世界资料身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。',
	'仅返回 JSON 对象 {"candidates":[候选]}。候选按 kind 使用严格结构：',
	'location 为 {"kind":"location","title":"名称","aliases":[],"summary":"说明","locationType":"类型","parentLocationId":"已知 location ID 或 null","rules":[],"confidence":0.9,"rationale":"依据","evidence":{"start":0,"end":2,"quote":"原文"}或null}；',
	'faction 为 {"kind":"faction","title":"名称","aliases":[],"summary":"说明","ideology":"纲领","goals":[],"territoryLocationIds":["已知 location ID"],"confidence":0.9,"rationale":"依据","evidence":...}；',
	'worldRule 为 {"kind":"worldRule","title":"名称","aliases":[],"category":"culture|religion|technology|magic|law|other","statement":"规则","scope":"适用范围","exceptions":[],"consequences":[],"conflicts":[{"resourceId":"已知 world-rule ID","reason":"冲突说明"}],"confidence":0.9,"rationale":"依据","evidence":...}。',
	'generate-world-entry 只返回 targetType 对应的候选；文化、宗教、科技、魔法和法律使用 worldRule 及对应 category。规则必须有明确 scope，exceptions 可为空但不可省略。',
	'extract-worldbuilding 最多返回 24 个独立条目，每条必须有精确正文证据；长设定拆分成可分别确认的候选，不推断未写出的事实。',
	'证据索引使用 JavaScript UTF-16 字符索引。不得声称已经保存、合并或覆盖世界资料。'
].join('');
export const ITEM_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的结构化物品候选分析器。只使用用户 JSON 中明确提供的章节正文、作者指令、物品和人物/地点身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。',
	'仅返回 JSON 对象 {"candidates":[{"title":"物品名","aliases":[],"itemType":"类型","unique":true,"quantityUnit":"单位或 null","description":"外观、来源与用途","restrictions":[],"plotFunction":"叙事作用","confidence":0.9,"rationale":"依据","evidence":{"start":0,"end":2,"quote":"原文"}或null,"states":[{"action":"acquired|transferred|used|lost|destroyed|adjusted","quantity":1,"holderCharacterId":"已知 character ID 或 null","locationId":"已知 location ID 或 null","condition":"状态或 null","evidence":{"start":0,"end":2,"quote":"原文"}或null}]}]}。',
	'generate-item 生成完整物品卡；generate-item-history 针对 selectedItemId 生成可分别确认的历史或流转事件；extract-items 最多返回 16 个物品候选。',
	'extract-items 的物品卡和每条状态事件都必须有精确正文证据。持有人和地点只能引用用户提供的 ID；不得为未识别人物或地点发明 ID。',
	'证据索引使用 JavaScript UTF-16 字符索引。所有卡片字段和状态事件仅供作者确认，不得声称已经保存、转移或覆盖物品。'
].join('');
export const TIMELINE_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的结构化故事进程候选分析器。只使用用户 JSON 中明确提供的章节、作者指令和资源身份，不读取或推断路径、密钥、账户、作者秘密或隐藏历史。',
	'仅返回 JSON 对象 {"candidates":[事件候选],"causalEdges":[因果边]}。事件候选严格为 {"clientCandidateId":"candidate:slug","sourceResourceId":"已知 chapter ID","title":"标题","aliases":[],"summary":"摘要","eventType":"类型","storyTimeKind":"exact|date|relative|range|unknown","storyStart":"时间或 null","storyEnd":"时间或 null","narrativeOrder":0,"participantIds":["已知 character ID"],"locationIds":["已知 location ID"],"itemIds":["已知 item ID"],"predecessorIds":["已知 timeline-event ID"],"consequenceIds":["已知 timeline-event ID"],"plotThreadIds":["已知 plot-thread ID"],"foreshadowingIds":["已知 foreshadowing ID"],"directResults":[],"impacts":[],"confidence":0.9,"rationale":"依据","evidence":{"start":0,"end":2,"quote":"原文"}或null}。',
	'因果边严格为 {"clientEdgeId":"edge:slug","from":{"kind":"existing|candidate","id":"对应 ID"},"to":{"kind":"existing|candidate","id":"对应 ID"},"relation":"precondition|causes|enables|blocks","confidence":0.9,"rationale":"依据"}；不得自连或引用未提供/未返回的端点。',
	'extract-events 的每个事件必须带来自其 sourceResourceId 的精确正文证据；generate-directions 必须返回恰好三个实质不同的候选；suggest-causality 必须返回至少一条因果边。',
	'最多返回 32 个事件和 64 条因果边。证据索引使用 JavaScript UTF-16 字符索引。候选与虚线边只供作者确认，不得声称已经写入时间线。'
].join('');
export const PLOT_ANALYSIS_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的结构化剧情线与伏笔候选分析器。只使用用户 JSON 中明确提供的章节、作者指令和资源身份，不读取或推断路径、密钥、账户或隐藏历史。',
	'仅返回 JSON 对象 {"candidates":[候选]}，候选按 kind 使用严格结构。',
	'plotThread 为 {"kind":"plotThread","sourceResourceId":"已知 chapter ID","title":"标题","aliases":[],"summary":"摘要","status":"planned|active|at-risk|resolved|abandoned","premise":"前提","stakes":"赌注","dramaticQuestion":"戏剧问题","startPosition":位置或null,"targetResolution":位置或null,"actualResolution":位置或null,"participantIds":["已知 character ID"],"sceneIds":["已知 scene ID"],"confidence":0.9,"rationale":"依据","evidence":{"start":0,"end":2,"quote":"原文"}或null}。',
	'foreshadowing 为 {"kind":"foreshadowing","sourceResourceId":"已知 chapter ID","title":"标题","aliases":[],"summary":"摘要","status":"planted|reminded|resolved|overdue|abandoned","plantedAt":位置或null,"surfaceMeaning":"表面含义","trueMeaning":"真实含义或 null","reminderPositions":[位置],"plannedPayoffAt":位置或null,"actualPayoffAt":位置或null,"readerVisibility":0.4,"plotThreadIds":["已知 plot-thread ID"],"confidence":0.9,"rationale":"依据","evidence":...}。位置严格为 {"chapterId":"已知 chapter ID","narrativeOrder":0}。',
	'extract-plot-progress 与 extract-foreshadowing 的每条候选必须有精确正文证据。只能引用用户提供的章节、人物、场景和剧情线 ID。',
	'includeAuthorSecrets 为 false 时，不得推断或声称知道既有伏笔的 trueMeaning；所有候选仅供作者确认，不得声称已经保存、推进或回收。最多返回 24 条。'
].join('');
export const STORY_EXTRACTION_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的结构化故事事实提取器。',
	'只从用户 JSON 中 content 字段的正文提取明确写出的事实，不推断、不补全、不确认事实。',
	'每条事实必须带有可在 content 中精确定位的 start、end、quote；索引使用 JavaScript UTF-16 字符索引。',
	'仅返回 JSON 对象：{"facts":[{"factType":"character-state|item-state|location-state|relationship|timeline-event|world-rule|story-information|plot-thread|foreshadowing","title":"简短标题","statement":"明确事实","confidence":0.8,"start":0,"end":1,"quote":"原文证据"}]}。',
	'提取结果全部处于待确认状态，最多返回 30 条，不得声称已经写入 Story Kernel。'
].join('');
export const STORY_KERNEL_GENERATION_SYSTEM_PROMPT = [
	'你是 Writing Buddy 的 Story Kernel 结构化资源生成器。',
	'只根据用户 JSON 中 instruction、source 和 existingResources 生成 targetTypes 指定的完整资源候选；不得请求或推断项目路径、账户、密钥或隐藏历史。',
	'仅返回 JSON 对象：{"candidates":[{"operation":"create|update","resource":{"id":"类型前缀:slug","type":"资源类型","title":"标题","aliases":[],"tags":[],"evidenceIds":[]},"confidence":0.9,"rationale":"生成依据","evidence":{"start":0,"end":1,"quote":"原文证据"}或null}]}。',
	'resource 禁止包含 schemaVersion、createdAt、updatedAt、revision；evidenceIds 必须为空，系统会生成证据与版本字段。',
	'支持 character、scene、location、faction、item、worldRule、timelineEvent、relationship、plotThread、foreshadowing、information。',
	'公共字段为 id、type、title、aliases、tags、可选 summary、evidenceIds。',
	'character 使用可选 role/pronouns/birth/appearance/occupation/speechStyle 和 factionIds/goals/desires/fears/values/secrets 数组。',
	'scene 使用 chapterId、manuscriptRange(start/end/revision/quote)、narrativeOrder、locationIds、participantIds、plotThreadIds、revealInformationIds、foreshadowingIds，以及可选 storyStart/storyEnd/povCharacterId/goal/conflict/turn/outcome。',
	'location 使用可选 parentLocationId/locationType/mapPoint 和 travelLinks/factionIds/rules 数组；faction 使用 goals/allyFactionIds/enemyFactionIds/territoryLocationIds 数组及可选 ideology。',
	'item 使用 unique、restrictions 及可选 itemType/quantityUnit/description/plotFunction；worldRule 使用 category、statement、exceptions、consequences 及可选 effectiveFrom。',
	'timelineEvent 使用 narrativePosition、eventType、participantIds/locationIds/itemIds/predecessorIds/consequenceIds/plotThreadIds/informationIds，以及可选故事时间字段。',
	'relationship 使用 sourceCharacterId、targetCharacterId、relationshipType、visibility、effectiveFrom、history 及可选 strength/description/effectiveUntil。',
	'plotThread 使用 status、participantIds、sceneIds 及可选 premise/stakes/dramaticQuestion/startPosition/targetResolution/actualResolution。',
	'foreshadowing 使用 status、reminderPositions、readerVisibility、plotThreadIds 及可选 plantedAt/surfaceMeaning/trueMeaning/plannedPayoffAt/actualPayoffAt。',
	'information 使用 truthStatement、truthStatus、authorSecret 及可选 excludeFromAiByDefault/truthEffectiveFrom/readerRevealAt。',
	'引用已有资源时必须使用 existingResources 中的 ID；同一批新资源可以互相引用。update 只能使用 existingResources 中的 ID。',
	'有正文依据时 evidence 必须精确匹配 source.content 的 JavaScript UTF-16 索引；纯作者设定可为 null。',
	'最多返回 24 个候选。所有候选仅供作者审核，不得声称已经写入 Story Kernel。'
].join('');

export type AiProviderId = typeof DEEPSEEK_PROVIDER_ID;
export type AiJobType =
	| 'storyforge-test'
	| 'chapter-review'
	| 'selection-rewrite'
	| 'manuscript-continuation'
	| 'scene-plan-generation'
	| 'character-analysis'
	| 'relationship-analysis'
	| 'world-analysis'
	| 'item-analysis'
	| 'timeline-analysis'
	| 'plot-analysis'
	| 'story-consistency-analysis'
	| 'story-extraction'
	| 'story-kernel-generation';
export type AiThinkingMode = 'disabled' | 'enabled';
export type AiReasoningEffort = 'high';
export type AiResponseFormat = 'text' | 'json_object';
export type AiJobState =
	| 'created'
	| 'queued'
	| 'connecting'
	| 'thinking'
	| 'streaming'
	| 'completed'
	| 'cancelled'
	| 'failed';

export type AiErrorCode =
	| 'invalid_configuration'
	| 'authentication_failed'
	| 'insufficient_balance'
	| 'invalid_request'
	| 'rate_limited'
	| 'provider_overloaded'
	| 'provider_server_error'
	| 'network_unavailable'
	| 'connection_timeout'
	| 'first_content_timeout'
	| 'stream_idle_timeout'
	| 'stream_parse_failed'
	| 'stream_incomplete'
	| 'empty_response'
	| 'cancelled'
	| 'secret_store_failed'
	| 'unknown';

export interface AiProviderCapabilities {
	readonly streaming: boolean;
	readonly modelDiscovery: boolean;
	readonly accountBalance: boolean;
	readonly thinkingMode: boolean;
	readonly jsonOutput: boolean;
	readonly toolCalls: boolean;
}

export interface AiProviderDefinition {
	readonly id: AiProviderId;
	readonly displayName: string;
	readonly capabilities: AiProviderCapabilities;
}

export class AiProviderRegistry {
	private readonly providers = new Map<AiProviderId, AiProviderDefinition>();

	register(provider: AiProviderDefinition): void {
		if (this.providers.has(provider.id)) {
			throw new Error('providerAlreadyRegistered');
		}
		this.providers.set(provider.id, provider);
	}

	get(providerId: AiProviderId): AiProviderDefinition {
		const provider = this.providers.get(providerId);
		if (!provider) {
			throw new Error('providerNotFound');
		}
		return provider;
	}

	list(): readonly AiProviderDefinition[] {
		return [...this.providers.values()];
	}
}

export function createDeepSeekProviderDefinition(): AiProviderDefinition {
	return {
		id: DEEPSEEK_PROVIDER_ID,
		displayName: 'DeepSeek',
		capabilities: {
			streaming: true,
			modelDiscovery: true,
			accountBalance: true,
			thinkingMode: true,
			jsonOutput: true,
			toolCalls: false
		}
	};
}

export interface AiProviderPreferences {
	readonly providerId: AiProviderId;
	readonly defaultModelId?: string;
	readonly thinkingMode: AiThinkingMode;
	readonly reasoningEffort?: AiReasoningEffort;
	readonly maxOutputTokens: typeof AI_MAX_OUTPUT_PRESETS[number];
	readonly connectionTimeoutMs: number;
	readonly firstContentTimeoutMs: number;
	readonly streamIdleTimeoutMs: number;
}

export const DEFAULT_AI_PREFERENCES: AiProviderPreferences = {
	providerId: DEEPSEEK_PROVIDER_ID,
	defaultModelId: DEEPSEEK_DEFAULT_MODEL_ID,
	thinkingMode: 'disabled',
	maxOutputTokens: 2048,
	connectionTimeoutMs: 15_000,
	firstContentTimeoutMs: 180_000,
	streamIdleTimeoutMs: 120_000
};

const preferencesSchema = z.object({
	providerId: z.literal(DEEPSEEK_PROVIDER_ID).optional(),
	defaultModelId: z.string().min(1).max(128).optional(),
	thinkingMode: z.enum(['disabled', 'enabled']).optional(),
	reasoningEffort: z.literal('high').optional(),
	maxOutputTokens: z.union([
		z.literal(512),
		z.literal(1024),
		z.literal(2048),
		z.literal(4096),
		z.literal(8192)
	]).optional(),
	connectionTimeoutMs: z.number().int().min(1_000).max(60_000).optional(),
	firstContentTimeoutMs: z.number().int().min(1_000).max(300_000).optional(),
	streamIdleTimeoutMs: z.number().int().min(1_000).max(300_000).optional()
});

export function normalizeAiPreferences(input: unknown): AiProviderPreferences {
	const parsed = preferencesSchema.parse(input);
	const defaultModelId = parsed.defaultModelId
		&& !(DEEPSEEK_RETIRED_MODEL_IDS as readonly string[]).includes(parsed.defaultModelId)
		? parsed.defaultModelId
		: DEEPSEEK_DEFAULT_MODEL_ID;
	const thinkingMode = parsed.thinkingMode ?? DEFAULT_AI_PREFERENCES.thinkingMode;
	return {
		...DEFAULT_AI_PREFERENCES,
		...parsed,
		defaultModelId,
		thinkingMode,
		reasoningEffort: thinkingMode === 'enabled' ? 'high' : undefined
	};
}

export interface AiModel {
	readonly id: string;
	readonly ownedBy: string;
}

export interface AiBalance {
	readonly available: boolean;
	readonly balances: readonly {
		readonly currency: string;
		readonly totalBalance: string;
		readonly grantedBalance: string;
		readonly toppedUpBalance: string;
	}[];
}

export interface SecretStatus {
	readonly configured: boolean;
	readonly providerId: AiProviderId;
	readonly updatedAt?: string;
	readonly fingerprint?: string;
}

export interface AiProviderStatus {
	readonly provider: AiProviderDefinition;
	readonly secret: SecretStatus;
	readonly preferences: AiProviderPreferences;
	readonly lastValidatedAt?: string;
}

export interface AiConnectionTestResult {
	readonly status: AiProviderStatus;
	readonly models: readonly AiModel[];
	readonly balance: AiBalance;
}

export function chooseDefaultModel(
	models: readonly AiModel[],
	savedModelId?: string
): string | undefined {
	if (savedModelId && models.some(model => model.id === savedModelId)) {
		return savedModelId;
	}
	if (models.some(model => model.id === DEEPSEEK_DEFAULT_MODEL_ID)) {
		return DEEPSEEK_DEFAULT_MODEL_ID;
	}
	return models[0]?.id;
}

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
	readonly role: AiRole;
	readonly content: string;
}

export interface AiGenerationOptions {
	readonly stream: true;
	readonly thinkingMode: AiThinkingMode;
	readonly reasoningEffort?: AiReasoningEffort;
	readonly maxOutputTokens: typeof AI_MAX_OUTPUT_PRESETS[number];
	readonly responseFormat: AiResponseFormat;
}

export interface AiGenerateRequest {
	readonly jobId: string;
	readonly jobType: AiJobType;
	readonly providerId: AiProviderId;
	readonly modelId: string;
	readonly messages: readonly AiMessage[];
	readonly options: AiGenerationOptions;
}

export interface AiUsage {
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly totalTokens?: number;
	readonly cachedInputTokens?: number;
}

export interface PublicAiError {
	readonly code: AiErrorCode;
	readonly message: string;
	readonly retryable: boolean;
	readonly httpStatus?: number;
}

export type AiStreamEvent =
	| { readonly type: 'job_started'; readonly jobId: string }
	| { readonly type: 'connection_opened'; readonly jobId: string }
	| { readonly type: 'thinking_started'; readonly jobId: string }
	| { readonly type: 'content_delta'; readonly jobId: string; readonly text: string }
	| { readonly type: 'usage'; readonly jobId: string; readonly usage: AiUsage }
	| { readonly type: 'completed'; readonly jobId: string; readonly finishReason?: string }
	| { readonly type: 'cancelled'; readonly jobId: string }
	| { readonly type: 'failed'; readonly jobId: string; readonly error: PublicAiError };

const terminalStates: readonly AiJobState[] = ['completed', 'cancelled', 'failed'];

export function nextAiJobState(current: AiJobState, event: AiStreamEvent): AiJobState {
	const requested: AiJobState = (() => {
		switch (event.type) {
			case 'job_started':
			case 'connection_opened':
				return 'connecting';
			case 'thinking_started':
				return 'thinking';
			case 'content_delta':
				return 'streaming';
			case 'completed':
				return 'completed';
			case 'cancelled':
				return 'cancelled';
			case 'failed':
				return 'failed';
			case 'usage':
				return current;
		}
	})();
	if (requested === current) {
		return current;
	}
	const allowed: Readonly<Record<AiJobState, readonly AiJobState[]>> = {
		created: ['queued', 'connecting', 'cancelled', 'failed'],
		queued: ['connecting', 'cancelled', 'failed'],
		connecting: ['thinking', 'streaming', 'completed', 'cancelled', 'failed'],
		thinking: ['streaming', 'completed', 'cancelled', 'failed'],
		streaming: ['completed', 'cancelled', 'failed'],
		completed: [],
		cancelled: [],
		failed: []
	};
	if (terminalStates.includes(current) || !allowed[current].includes(requested)) {
		throw new Error('invalidJobTransition');
	}
	return requested;
}

export function shouldRetryAiFailure(input: {
	readonly errorCode: AiErrorCode;
	readonly retryCount: number;
	readonly receivedContent: boolean;
}): boolean {
	return !input.receivedContent
		&& input.retryCount < 2
		&& ['network_unavailable', 'rate_limited', 'provider_server_error', 'provider_overloaded']
			.includes(input.errorCode);
}

export function canQueueAiJob(queuedJobs: number): boolean {
	return Number.isInteger(queuedJobs)
		&& queuedJobs >= 0
		&& queuedJobs < AI_JOB_QUEUE_LIMIT;
}

export interface AiUsageRecord extends AiUsage {
	readonly timestamp: string;
	readonly providerId: AiProviderId;
	readonly modelId: string;
	readonly jobType: AiJobType;
	readonly durationMs: number;
	readonly status: 'completed' | 'cancelled' | 'failed';
}

export interface AiUsageSummary {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly totalTokens: number;
	readonly requests: number;
}

export function aggregateAiUsage(records: readonly AiUsageRecord[]): AiUsageSummary {
	return records.reduce<AiUsageSummary>((summary, record) => ({
		inputTokens: summary.inputTokens + (record.inputTokens ?? 0),
		outputTokens: summary.outputTokens + (record.outputTokens ?? 0),
		totalTokens: summary.totalTokens + (record.totalTokens
			?? (record.inputTokens ?? 0) + (record.outputTokens ?? 0)),
		requests: summary.requests + 1
	}), { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 });
}

const chapterReviewResponseSchema = z.object({
	issues: z.array(z.object({
		start: z.number().int().nonnegative(),
		end: z.number().int().nonnegative(),
		target: z.string().min(1).max(4_000),
		severity: z.enum(['info', 'suggestion', 'warning', 'error']),
		title: z.string().min(1).max(80),
		message: z.string().min(1).max(500),
		replacement: z.string().max(4_000).optional()
	}).strict()).max(50)
}).strict();

const storyConsistencyEvidenceSchema = z.object({
	resourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1).max(4_000),
	label: z.string().min(1).max(80)
}).strict().refine(evidence => evidence.end > evidence.start, {
	message: 'invalidStoryConsistencyEvidence'
});

const storyConsistencyFactSchema = z.object({
	resourceId: z.string().regex(/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u),
	title: z.string().min(1).max(160),
	statement: z.string().min(1).max(4_000)
}).strict();

const storyConsistencyResponseSchema = z.object({
	issues: z.array(z.object({
		ruleId: z.string().regex(/^ai-[a-z0-9][a-z0-9-]*$/u),
		severity: z.enum(['info', 'suggestion', 'warning', 'error']),
		title: z.string().min(1).max(120),
		message: z.string().min(1).max(2_000),
		evidence: z.array(storyConsistencyEvidenceSchema).min(2).max(4),
		storyFact: storyConsistencyFactSchema.nullable()
	}).strict()).max(50)
}).strict();

const selectionRewriteResponseSchema = z.object({
	suggestion: z.string().min(1).max(12_000),
	rationale: z.string().min(1).max(1_000),
	potentialImpact: z.string().max(1_000).optional().default('')
}).strict();

const manuscriptContinuationResponseSchema = z.object({
	candidates: z.array(z.object({
		title: z.string().min(1).max(120),
		content: z.string().min(1).max(16_000),
		rationale: z.string().min(1).max(1_000)
	}).strict()).min(1).max(3)
}).strict();

const sceneEmotionBeatSchema = z.object({
	label: z.string().min(1).max(120),
	emotion: z.string().min(1).max(120),
	intensity: z.number().min(0).max(1)
}).strict();

const scenePlanResponseSchema = z.object({
	goal: z.string().min(1).max(2_000).optional(),
	conflict: z.string().min(1).max(2_000).optional(),
	turn: z.string().min(1).max(2_000).optional(),
	outcome: z.string().min(1).max(2_000).optional(),
	emotionBeats: z.array(sceneEmotionBeatSchema).min(1).max(24).optional(),
	rationale: z.string().min(1).max(2_000)
}).strict().refine(value => (
	value.goal !== undefined
	|| value.conflict !== undefined
	|| value.turn !== undefined
	|| value.outcome !== undefined
	|| value.emotionBeats !== undefined
), { message: 'emptyScenePlanResponse' });

const groundedEvidenceSchema = z.object({
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1).max(4_000)
}).strict().refine(value => value.end > value.start, {
	message: 'invalidGroundedEvidence'
});

export const characterAnalysisFieldKeys = [
	'aliases',
	'summary',
	'pronouns',
	'birth',
	'appearance',
	'occupation',
	'goals',
	'desires',
	'fears',
	'values',
	'speechStyle',
	'state.location',
	'state.lifeStatus',
	'state.health',
	'state.emotion',
	'state.currentGoal',
	'state.inventory',
	'state.knowledge',
	'state.misconception',
	'state.ability'
] as const;

const characterArrayFields = new Set([
	'aliases',
	'goals',
	'desires',
	'fears',
	'values',
	'state.inventory',
	'state.knowledge'
]);
const characterStringFields = new Set([
	'summary',
	'pronouns',
	'birth',
	'appearance',
	'occupation',
	'speechStyle'
]);

const characterAnalysisFieldSchema = z.object({
	key: z.enum(characterAnalysisFieldKeys),
	value: z.union([
		z.string().min(1).max(10_000),
		z.array(z.string().min(1).max(1_000)).min(1).max(40),
		z.number().finite(),
		z.boolean(),
		z.null()
	]),
	evidence: groundedEvidenceSchema.nullable()
}).strict().superRefine((field, context) => {
	if (
		(characterArrayFields.has(field.key) && !Array.isArray(field.value))
		|| (characterStringFields.has(field.key) && typeof field.value !== 'string')
	) {
		context.addIssue({ code: 'custom', message: 'invalidCharacterFieldValue' });
	}
});

const characterAnalysisCandidateSchema = z.object({
	title: z.string().trim().min(1).max(160),
	role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
	confidence: z.number().min(0).max(1),
	rationale: z.string().min(1).max(2_000),
	fields: z.array(characterAnalysisFieldSchema).min(1).max(24)
}).strict();

const characterAnalysisResponseSchema = z.object({
	candidates: z.array(characterAnalysisCandidateSchema).max(12)
}).strict();

const relationshipAnalysisCandidateSchema = z.object({
	sourceCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u),
	targetCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u),
	relationshipType: z.string().trim().min(1).max(160),
	strength: z.number().min(0).max(1).optional(),
	visibility: z.enum(['public', 'private', 'secret']),
	description: z.string().max(10_000).optional(),
	confidence: z.number().min(0).max(1),
	rationale: z.string().min(1).max(2_000),
	evidence: groundedEvidenceSchema.nullable()
}).strict().refine(value => value.sourceCharacterId !== value.targetCharacterId, {
	message: 'relationshipEndpointsMustDiffer'
});

const relationshipAnalysisResponseSchema = z.object({
	candidates: z.array(relationshipAnalysisCandidateSchema).max(24)
}).strict();

export const worldAnalysisTargetTypes = [
	'location',
	'faction',
	'culture',
	'religion',
	'technology',
	'magic',
	'law',
	'world-rule'
] as const;

const worldCandidateBaseShape = {
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	confidence: z.number().min(0).max(1),
	rationale: z.string().min(1).max(2_000),
	evidence: groundedEvidenceSchema.nullable()
};

const worldLocationCandidateSchema = z.object({
	kind: z.literal('location'),
	...worldCandidateBaseShape,
	summary: z.string().trim().min(1).max(10_000),
	locationType: z.string().trim().min(1).max(160),
	parentLocationId: z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u).nullable(),
	rules: z.array(z.string().trim().min(1).max(2_000)).max(40)
}).strict();

const worldFactionCandidateSchema = z.object({
	kind: z.literal('faction'),
	...worldCandidateBaseShape,
	summary: z.string().trim().min(1).max(10_000),
	ideology: z.string().trim().min(1).max(5_000),
	goals: z.array(z.string().trim().min(1).max(1_000)).max(40),
	territoryLocationIds: z.array(
		z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u)
	).max(100)
}).strict();

const worldRuleCandidateSchema = z.object({
	kind: z.literal('worldRule'),
	...worldCandidateBaseShape,
	category: z.enum(['culture', 'religion', 'technology', 'magic', 'law', 'other']),
	statement: z.string().trim().min(1).max(10_000),
	scope: z.string().trim().min(1).max(2_000),
	exceptions: z.array(z.string().trim().min(1).max(2_000)).max(40),
	consequences: z.array(z.string().trim().min(1).max(2_000)).max(40),
	conflicts: z.array(z.object({
		resourceId: z.string().regex(/^world-rule:[a-z0-9][a-z0-9-]*$/u),
		reason: z.string().trim().min(1).max(2_000)
	}).strict()).max(24)
}).strict();

const worldAnalysisCandidateSchema = z.discriminatedUnion('kind', [
	worldLocationCandidateSchema,
	worldFactionCandidateSchema,
	worldRuleCandidateSchema
]);

const worldAnalysisResponseSchema = z.object({
	candidates: z.array(worldAnalysisCandidateSchema).max(24)
}).strict();

const itemStateCandidateSchema = z.object({
	action: z.enum(['acquired', 'transferred', 'used', 'lost', 'destroyed', 'adjusted']),
	quantity: z.number().finite().nonnegative(),
	holderCharacterId: z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u).nullable(),
	locationId: z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u).nullable(),
	condition: z.string().trim().min(1).max(1_000).nullable(),
	evidence: groundedEvidenceSchema.nullable()
}).strict();

const itemAnalysisCandidateSchema = z.object({
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	itemType: z.string().trim().min(1).max(160),
	unique: z.boolean(),
	quantityUnit: z.string().trim().min(1).max(160).nullable(),
	description: z.string().trim().min(1).max(10_000),
	restrictions: z.array(z.string().trim().min(1).max(1_000)).max(40),
	plotFunction: z.string().trim().min(1).max(5_000),
	confidence: z.number().min(0).max(1),
	rationale: z.string().min(1).max(2_000),
	evidence: groundedEvidenceSchema.nullable(),
	states: z.array(itemStateCandidateSchema).max(12)
}).strict();

const itemAnalysisResponseSchema = z.object({
	candidates: z.array(itemAnalysisCandidateSchema).max(16)
}).strict();

const gateFStoryPositionSchema = z.object({
	chapterId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	narrativeOrder: z.number().int().nonnegative()
}).strict();

const timelineAnalysisCandidateSchema = z.object({
	clientCandidateId: z.string().regex(/^candidate:[a-z0-9][a-z0-9-]*$/u),
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	summary: z.string().trim().min(1).max(10_000),
	eventType: z.string().trim().min(1).max(160),
	storyTimeKind: z.enum(['exact', 'date', 'relative', 'range', 'unknown']),
	storyStart: z.string().trim().min(1).max(160).nullable(),
	storyEnd: z.string().trim().min(1).max(160).nullable(),
	narrativeOrder: z.number().int().nonnegative(),
	participantIds: z.array(z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u)).max(100),
	locationIds: z.array(z.string().regex(/^location:[a-z0-9][a-z0-9-]*$/u)).max(100),
	itemIds: z.array(z.string().regex(/^item:[a-z0-9][a-z0-9-]*$/u)).max(100),
	predecessorIds: z.array(z.string().regex(/^timeline-event:[a-z0-9][a-z0-9-]*$/u)).max(100),
	consequenceIds: z.array(z.string().regex(/^timeline-event:[a-z0-9][a-z0-9-]*$/u)).max(100),
	plotThreadIds: z.array(z.string().regex(/^plot-thread:[a-z0-9][a-z0-9-]*$/u)).max(100),
	foreshadowingIds: z.array(z.string().regex(/^foreshadowing:[a-z0-9][a-z0-9-]*$/u)).max(100),
	directResults: z.array(z.string().trim().min(1).max(2_000)).max(40),
	impacts: z.array(z.string().trim().min(1).max(2_000)).max(40),
	confidence: z.number().min(0).max(1),
	rationale: z.string().trim().min(1).max(2_000),
	evidence: groundedEvidenceSchema.nullable()
}).strict();

const timelineEndpointSchema = z.object({
	kind: z.enum(['existing', 'candidate']),
	id: z.string().trim().min(1).max(160)
}).strict();

const timelineCausalEdgeSchema = z.object({
	clientEdgeId: z.string().regex(/^edge:[a-z0-9][a-z0-9-]*$/u),
	from: timelineEndpointSchema,
	to: timelineEndpointSchema,
	relation: z.enum(['precondition', 'causes', 'enables', 'blocks']),
	confidence: z.number().min(0).max(1),
	rationale: z.string().trim().min(1).max(2_000)
}).strict().refine(edge => !(edge.from.kind === edge.to.kind && edge.from.id === edge.to.id), {
	message: 'causalEdgeSelfLink'
});

const timelineAnalysisResponseSchema = z.object({
	candidates: z.array(timelineAnalysisCandidateSchema).max(32),
	causalEdges: z.array(timelineCausalEdgeSchema).max(64)
}).strict();

const plotCandidateBaseShape = {
	sourceResourceId: z.string().regex(/^chapter:[a-z0-9][a-z0-9-]*$/u),
	title: z.string().trim().min(1).max(160),
	aliases: z.array(z.string().trim().min(1).max(160)).max(40),
	summary: z.string().trim().min(1).max(10_000),
	confidence: z.number().min(0).max(1),
	rationale: z.string().trim().min(1).max(2_000),
	evidence: groundedEvidenceSchema.nullable()
};

const plotThreadAnalysisCandidateSchema = z.object({
	kind: z.literal('plotThread'),
	...plotCandidateBaseShape,
	status: z.enum(['planned', 'active', 'at-risk', 'resolved', 'abandoned']),
	premise: z.string().trim().min(1).max(10_000),
	stakes: z.string().trim().min(1).max(5_000),
	dramaticQuestion: z.string().trim().min(1).max(5_000),
	startPosition: gateFStoryPositionSchema.nullable(),
	targetResolution: gateFStoryPositionSchema.nullable(),
	actualResolution: gateFStoryPositionSchema.nullable(),
	participantIds: z.array(z.string().regex(/^character:[a-z0-9][a-z0-9-]*$/u)).max(100),
	sceneIds: z.array(z.string().regex(/^scene:[a-z0-9][a-z0-9-]*$/u)).max(100)
}).strict();

const foreshadowingAnalysisCandidateSchema = z.object({
	kind: z.literal('foreshadowing'),
	...plotCandidateBaseShape,
	status: z.enum(['planted', 'reminded', 'resolved', 'overdue', 'abandoned']),
	plantedAt: gateFStoryPositionSchema.nullable(),
	surfaceMeaning: z.string().trim().min(1).max(5_000),
	trueMeaning: z.string().trim().min(1).max(5_000).nullable(),
	reminderPositions: z.array(gateFStoryPositionSchema).max(40),
	plannedPayoffAt: gateFStoryPositionSchema.nullable(),
	actualPayoffAt: gateFStoryPositionSchema.nullable(),
	readerVisibility: z.number().min(0).max(1),
	plotThreadIds: z.array(z.string().regex(/^plot-thread:[a-z0-9][a-z0-9-]*$/u)).max(100)
}).strict();

const plotAnalysisCandidateSchema = z.discriminatedUnion('kind', [
	plotThreadAnalysisCandidateSchema,
	foreshadowingAnalysisCandidateSchema
]);

const plotAnalysisResponseSchema = z.object({
	candidates: z.array(plotAnalysisCandidateSchema).max(24)
}).strict();

const storyExtractionResponseSchema = z.object({
	facts: z.array(z.object({
		factType: z.enum([
			'character-state',
			'item-state',
			'location-state',
			'relationship',
			'timeline-event',
			'world-rule',
			'story-information',
			'plot-thread',
			'foreshadowing'
		]),
		title: z.string().min(1).max(120),
		statement: z.string().min(1).max(4_000),
		confidence: z.number().min(0).max(1),
		start: z.number().int().nonnegative(),
		end: z.number().int().positive(),
		quote: z.string().min(1).max(4_000)
	}).strict()).max(30)
}).strict();

export const storyKernelGenerationResourceTypes = [
	'character',
	'scene',
	'location',
	'faction',
	'item',
	'worldRule',
	'timelineEvent',
	'relationship',
	'plotThread',
	'foreshadowing',
	'information'
] as const;

export type StoryKernelGenerationResourceType =
	typeof storyKernelGenerationResourceTypes[number];

const storyKernelGenerationEvidenceSchema = z.object({
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1).max(4_000)
}).strict().refine(value => value.end > value.start, {
	message: 'invalidStoryKernelGenerationEvidence'
});

const storyKernelGenerationResourceSchema = z.record(z.string(), z.unknown())
	.superRefine((resource, context) => {
		if (
			typeof resource.id !== 'string'
			|| !/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(resource.id)
			|| typeof resource.type !== 'string'
			|| !storyKernelGenerationResourceTypes.includes(
				resource.type as StoryKernelGenerationResourceType
			)
			|| typeof resource.title !== 'string'
			|| !resource.title.trim()
			|| resource.title.length > 160
			|| !Array.isArray(resource.aliases)
			|| !Array.isArray(resource.tags)
			|| !Array.isArray(resource.evidenceIds)
			|| resource.evidenceIds.length > 0
		) {
			context.addIssue({
				code: 'custom',
				message: 'invalidStoryKernelGenerationResource'
			});
		}
		for (const field of ['schemaVersion', 'createdAt', 'updatedAt', 'revision']) {
			if (field in resource) {
				context.addIssue({
					code: 'custom',
					message: `forbiddenStoryKernelSystemField:${field}`
				});
			}
		}
	});

const storyKernelGenerationResponseSchema = z.object({
	candidates: z.array(z.object({
		operation: z.enum(['create', 'update']),
		resource: storyKernelGenerationResourceSchema,
		confidence: z.number().min(0).max(1),
		rationale: z.string().min(1).max(2_000),
		evidence: storyKernelGenerationEvidenceSchema.nullable()
	}).strict()).max(24)
}).strict();

export interface SelectionRewriteResponse {
	readonly suggestion: string;
	readonly rationale: string;
	readonly potentialImpact: string;
}

export type ManuscriptContinuationMode =
	| 'continue-paragraph'
	| 'finish-scene'
	| 'three-directions';

export interface ManuscriptContinuationCandidateResponse {
	readonly title: string;
	readonly content: string;
	readonly rationale: string;
}

export type ScenePlanActionType =
	| 'generate-goal'
	| 'generate-outline'
	| 'extract-outline'
	| 'generate-emotion-beats';

export interface SceneEmotionBeat {
	readonly label: string;
	readonly emotion: string;
	readonly intensity: number;
}

export interface ScenePlanResponse {
	readonly goal?: string;
	readonly conflict?: string;
	readonly turn?: string;
	readonly outcome?: string;
	readonly emotionBeats?: readonly SceneEmotionBeat[];
	readonly rationale: string;
}

export type CharacterAnalysisActionType =
	| 'generate-character'
	| 'generate-background'
	| 'generate-arc'
	| 'generate-speech-style'
	| 'extract-from-chapter';

export type CharacterAnalysisFieldKey = typeof characterAnalysisFieldKeys[number];
export type CharacterAnalysisFieldValue =
	| string
	| readonly string[]
	| number
	| boolean
	| null;

export interface GroundedCandidateEvidence {
	readonly start: number;
	readonly end: number;
	readonly quote: string;
}

export interface CharacterAnalysisFieldResponse {
	readonly key: CharacterAnalysisFieldKey;
	readonly value: CharacterAnalysisFieldValue;
	readonly evidence: GroundedCandidateEvidence | null;
}

export interface CharacterAnalysisCandidateResponse {
	readonly title: string;
	readonly role?: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
	readonly confidence: number;
	readonly rationale: string;
	readonly fields: readonly CharacterAnalysisFieldResponse[];
}

export type RelationshipAnalysisActionType =
	| 'generate-relationship'
	| 'extract-relationship-changes';

export interface RelationshipAnalysisCandidateResponse {
	readonly sourceCharacterId: string;
	readonly targetCharacterId: string;
	readonly relationshipType: string;
	readonly strength?: number;
	readonly visibility: 'public' | 'private' | 'secret';
	readonly description?: string;
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence: GroundedCandidateEvidence | null;
}

export type WorldAnalysisActionType =
	| 'generate-world-entry'
	| 'extract-worldbuilding';
export type WorldAnalysisTargetType = typeof worldAnalysisTargetTypes[number];
export type WorldRuleCandidateCategory =
	| 'culture'
	| 'religion'
	| 'technology'
	| 'magic'
	| 'law'
	| 'other';
export type WorldAnalysisCandidateResponse =
	| {
		readonly kind: 'location';
		readonly title: string;
		readonly aliases: readonly string[];
		readonly summary: string;
		readonly locationType: string;
		readonly parentLocationId: string | null;
		readonly rules: readonly string[];
		readonly confidence: number;
		readonly rationale: string;
		readonly evidence: GroundedCandidateEvidence | null;
	}
	| {
		readonly kind: 'faction';
		readonly title: string;
		readonly aliases: readonly string[];
		readonly summary: string;
		readonly ideology: string;
		readonly goals: readonly string[];
		readonly territoryLocationIds: readonly string[];
		readonly confidence: number;
		readonly rationale: string;
		readonly evidence: GroundedCandidateEvidence | null;
	}
	| {
		readonly kind: 'worldRule';
		readonly title: string;
		readonly aliases: readonly string[];
		readonly category: WorldRuleCandidateCategory;
		readonly statement: string;
		readonly scope: string;
		readonly exceptions: readonly string[];
		readonly consequences: readonly string[];
		readonly conflicts: readonly {
			readonly resourceId: string;
			readonly reason: string;
		}[];
		readonly confidence: number;
		readonly rationale: string;
		readonly evidence: GroundedCandidateEvidence | null;
	};

export type ItemAnalysisActionType =
	| 'generate-item'
	| 'generate-item-history'
	| 'extract-items';

export interface ItemAnalysisStateCandidateResponse {
	readonly action: 'acquired' | 'transferred' | 'used' | 'lost' | 'destroyed' | 'adjusted';
	readonly quantity: number;
	readonly holderCharacterId: string | null;
	readonly locationId: string | null;
	readonly condition: string | null;
	readonly evidence: GroundedCandidateEvidence | null;
}

export interface ItemAnalysisCandidateResponse {
	readonly title: string;
	readonly aliases: readonly string[];
	readonly itemType: string;
	readonly unique: boolean;
	readonly quantityUnit: string | null;
	readonly description: string;
	readonly restrictions: readonly string[];
	readonly plotFunction: string;
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence: GroundedCandidateEvidence | null;
	readonly states: readonly ItemAnalysisStateCandidateResponse[];
}

export type TimelineAnalysisActionType =
	| 'extract-events'
	| 'generate-events'
	| 'generate-directions'
	| 'suggest-causality';

export interface TimelineAnalysisCandidateResponse {
	readonly clientCandidateId: string;
	readonly sourceResourceId: string;
	readonly title: string;
	readonly aliases: readonly string[];
	readonly summary: string;
	readonly eventType: string;
	readonly storyTimeKind: 'exact' | 'date' | 'relative' | 'range' | 'unknown';
	readonly storyStart: string | null;
	readonly storyEnd: string | null;
	readonly narrativeOrder: number;
	readonly participantIds: readonly string[];
	readonly locationIds: readonly string[];
	readonly itemIds: readonly string[];
	readonly predecessorIds: readonly string[];
	readonly consequenceIds: readonly string[];
	readonly plotThreadIds: readonly string[];
	readonly foreshadowingIds: readonly string[];
	readonly directResults: readonly string[];
	readonly impacts: readonly string[];
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence: GroundedCandidateEvidence | null;
}

export interface TimelineAnalysisEndpointResponse {
	readonly kind: 'existing' | 'candidate';
	readonly id: string;
}

export interface TimelineAnalysisCausalEdgeResponse {
	readonly clientEdgeId: string;
	readonly from: TimelineAnalysisEndpointResponse;
	readonly to: TimelineAnalysisEndpointResponse;
	readonly relation: 'precondition' | 'causes' | 'enables' | 'blocks';
	readonly confidence: number;
	readonly rationale: string;
}

export interface TimelineAnalysisResponse {
	readonly candidates: readonly TimelineAnalysisCandidateResponse[];
	readonly causalEdges: readonly TimelineAnalysisCausalEdgeResponse[];
}

export type PlotAnalysisActionType =
	| 'generate-plot-thread'
	| 'generate-plot-consequences'
	| 'extract-plot-progress'
	| 'generate-foreshadowing'
	| 'generate-foreshadowing-payoff'
	| 'extract-foreshadowing';

export interface PlotAnalysisPositionResponse {
	readonly chapterId: string;
	readonly narrativeOrder: number;
}

export type PlotAnalysisCandidateResponse =
	| {
		readonly kind: 'plotThread';
		readonly sourceResourceId: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly summary: string;
		readonly status: 'planned' | 'active' | 'at-risk' | 'resolved' | 'abandoned';
		readonly premise: string;
		readonly stakes: string;
		readonly dramaticQuestion: string;
		readonly startPosition: PlotAnalysisPositionResponse | null;
		readonly targetResolution: PlotAnalysisPositionResponse | null;
		readonly actualResolution: PlotAnalysisPositionResponse | null;
		readonly participantIds: readonly string[];
		readonly sceneIds: readonly string[];
		readonly confidence: number;
		readonly rationale: string;
		readonly evidence: GroundedCandidateEvidence | null;
	}
	| {
		readonly kind: 'foreshadowing';
		readonly sourceResourceId: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly summary: string;
		readonly status: 'planted' | 'reminded' | 'resolved' | 'overdue' | 'abandoned';
		readonly plantedAt: PlotAnalysisPositionResponse | null;
		readonly surfaceMeaning: string;
		readonly trueMeaning: string | null;
		readonly reminderPositions: readonly PlotAnalysisPositionResponse[];
		readonly plannedPayoffAt: PlotAnalysisPositionResponse | null;
		readonly actualPayoffAt: PlotAnalysisPositionResponse | null;
		readonly readerVisibility: number;
		readonly plotThreadIds: readonly string[];
		readonly confidence: number;
		readonly rationale: string;
		readonly evidence: GroundedCandidateEvidence | null;
	};

export interface StoryExtractionCandidate {
	readonly factType:
		| 'character-state'
		| 'item-state'
		| 'location-state'
		| 'relationship'
		| 'timeline-event'
		| 'world-rule'
		| 'story-information'
		| 'plot-thread'
		| 'foreshadowing';
	readonly title: string;
	readonly statement: string;
	readonly confidence: number;
	readonly start: number;
	readonly end: number;
	readonly quote: string;
}

export interface StoryKernelExistingResourceIdentity {
	readonly id: string;
	readonly type: StoryKernelGenerationResourceType;
	readonly title: string;
	readonly revision: number;
}

export interface StoryKernelGenerationCandidateResponse {
	readonly operation: 'create' | 'update';
	readonly resource: Readonly<Record<string, unknown>>;
	readonly confidence: number;
	readonly rationale: string;
	readonly evidence: {
		readonly start: number;
		readonly end: number;
		readonly quote: string;
	} | null;
}

const groundedContextItemSchema = z.object({
	priority: z.enum(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']),
	kind: z.enum([
		'instruction',
		'selection',
		'manuscript-excerpt',
		'scene-manuscript',
		'scene',
		'character',
		'location',
		'item',
		'world-rule',
		'plot-thread',
		'foreshadowing',
		'information',
		'adjacent-summary'
	]),
	title: z.string().min(1).max(160),
	content: z.string().min(1).max(12_000)
}).strict();

const continuationContextSchema = z.object({
	schemaVersion: z.literal(1),
	actionType: z.enum(['continue-paragraph', 'finish-scene', 'three-directions']),
	context: z.array(groundedContextItemSchema).min(2).max(64)
}).strict().superRefine((value, context) => {
	const instructions = value.context.filter(item => (
		item.priority === 'P0' && item.kind === 'instruction'
	));
	const sources = value.context.filter(item => (
		item.priority === 'P1'
		&& (item.kind === 'manuscript-excerpt' || item.kind === 'scene-manuscript')
	));
	if (instructions.length !== 1 || sources.length !== 1) {
		context.addIssue({ code: 'custom', message: 'invalidContinuationContext' });
	}
	if (value.actionType === 'finish-scene' && sources[0]?.kind !== 'scene-manuscript') {
		context.addIssue({ code: 'custom', message: 'finishSceneRequiresSceneContext' });
	}
});

const scenePlanContextSchema = z.object({
	schemaVersion: z.literal(1),
	actionType: z.enum([
		'generate-goal',
		'generate-outline',
		'extract-outline',
		'generate-emotion-beats'
	]),
	context: z.array(groundedContextItemSchema).min(2).max(64)
}).strict().superRefine((value, context) => {
	const instructions = value.context.filter(item => (
		item.priority === 'P0' && item.kind === 'instruction'
	));
	const sources = value.context.filter(item => (
		item.priority === 'P1' && item.kind === 'scene-manuscript'
	));
	if (instructions.length !== 1 || sources.length !== 1) {
		context.addIssue({ code: 'custom', message: 'invalidScenePlanContext' });
	}
});

function parseBoundedGroundedPayload<T>(
	contextPackJson: string,
	schema: z.ZodType<T>,
	errorCode: string
): T {
	if (
		!contextPackJson.trim()
		|| contextPackJson.length > 40_000
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(contextPackJson)
	) {
		throw new Error(errorCode);
	}
	try {
		return schema.parse(JSON.parse(contextPackJson));
	} catch {
		throw new Error(errorCode);
	}
}

export function buildManuscriptContinuationMessages(
	contextPackJson: string
): readonly AiMessage[] {
	parseBoundedGroundedPayload(
		contextPackJson,
		continuationContextSchema,
		'invalidManuscriptContinuationContext'
	);
	return [
		{ role: 'system', content: MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT },
		{ role: 'user', content: contextPackJson }
	];
}

export function parseManuscriptContinuationResponse(
	response: string,
	mode: ManuscriptContinuationMode
): readonly ManuscriptContinuationCandidateResponse[] {
	const parsed = manuscriptContinuationResponseSchema.parse(JSON.parse(response));
	const expectedCount = mode === 'three-directions' ? 3 : 1;
	if (parsed.candidates.length !== expectedCount) {
		throw new Error('invalidContinuationCandidateCount');
	}
	return parsed.candidates;
}

export function buildScenePlanMessages(contextPackJson: string): readonly AiMessage[] {
	parseBoundedGroundedPayload(
		contextPackJson,
		scenePlanContextSchema,
		'invalidScenePlanContext'
	);
	return [
		{ role: 'system', content: SCENE_PLAN_SYSTEM_PROMPT },
		{ role: 'user', content: contextPackJson }
	];
}

export function parseScenePlanResponse(response: string): ScenePlanResponse {
	return scenePlanResponseSchema.parse(JSON.parse(response));
}

interface CharacterAnalysisRequestInput {
	readonly actionType: CharacterAnalysisActionType;
	readonly instruction: string;
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly narrativeOrder: number;
	readonly selectedCharacterId?: string;
	readonly existingCharacters: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly revision: number;
	}[];
}

function isValidCharacterIdentity(value: CharacterAnalysisRequestInput['existingCharacters'][number]): boolean {
	return /^character:[a-z0-9][a-z0-9-]*$/u.test(value.id)
		&& Boolean(value.title.trim())
		&& value.title.length <= 160
		&& value.aliases.length <= 40
		&& value.aliases.every(alias => Boolean(alias.trim()) && alias.length <= 160)
		&& Number.isSafeInteger(value.revision)
		&& value.revision >= 0;
}

export function buildCharacterAnalysisMessages(
	input: CharacterAnalysisRequestInput
): readonly AiMessage[] {
	const ids = new Set(input.existingCharacters.map(character => character.id));
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^chapter:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| input.sourceRevision.length > 128
		|| !Number.isSafeInteger(input.narrativeOrder)
		|| input.narrativeOrder < 0
		|| input.existingCharacters.length > 500
		|| ids.size !== input.existingCharacters.length
		|| input.existingCharacters.some(character => !isValidCharacterIdentity(character))
		|| (input.selectedCharacterId !== undefined && !ids.has(input.selectedCharacterId))
		|| (input.actionType !== 'generate-character'
			&& input.actionType !== 'extract-from-chapter'
			&& !input.selectedCharacterId)
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(
			`${input.instruction}\n${input.content}`
		)
	) {
		throw new Error('invalidCharacterAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		instruction: input.instruction.trim(),
		source: {
			resourceId: input.resourceId,
			sourceRevision: input.sourceRevision,
			narrativeOrder: input.narrativeOrder,
			content: input.content
		},
		...(input.selectedCharacterId
			? { selectedCharacterId: input.selectedCharacterId }
			: {}),
		existingCharacters: input.existingCharacters
	});
	if (payload.length > 140_000) throw new Error('invalidCharacterAnalysisInput');
	return [
		{ role: 'system', content: CHARACTER_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parseCharacterAnalysisResponse(
	response: string,
	actionType: CharacterAnalysisActionType
): readonly CharacterAnalysisCandidateResponse[] {
	const candidates = characterAnalysisResponseSchema.parse(JSON.parse(response)).candidates;
	const expectedCount = actionType === 'generate-character' ? 3 : 1;
	if (actionType !== 'extract-from-chapter' && candidates.length !== expectedCount) {
		throw new Error('invalidCharacterCandidateCount');
	}
	if (
		actionType === 'extract-from-chapter'
		&& candidates.some(candidate => candidate.fields.some(field => field.evidence === null))
	) {
		throw new Error('missingCharacterExtractionEvidence');
	}
	return candidates;
}

interface RelationshipAnalysisRequestInput {
	readonly actionType: RelationshipAnalysisActionType;
	readonly instruction: string;
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly narrativeOrder: number;
	readonly sourceCharacterId?: string;
	readonly targetCharacterId?: string;
	readonly characters: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly revision: number;
	}[];
	readonly existingRelationships: readonly {
		readonly id: string;
		readonly sourceCharacterId: string;
		readonly targetCharacterId: string;
		readonly relationshipType: string;
		readonly revision: number;
	}[];
}

export function buildRelationshipAnalysisMessages(
	input: RelationshipAnalysisRequestInput
): readonly AiMessage[] {
	const characterIds = new Set(input.characters.map(character => character.id));
	const relationshipIds = new Set(input.existingRelationships.map(relationship => relationship.id));
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^chapter:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| input.sourceRevision.length > 128
		|| !Number.isSafeInteger(input.narrativeOrder)
		|| input.narrativeOrder < 0
		|| input.characters.length < 2
		|| input.characters.length > 500
		|| characterIds.size !== input.characters.length
		|| input.characters.some(character => !isValidCharacterIdentity(character))
		|| input.existingRelationships.length > 1_000
		|| relationshipIds.size !== input.existingRelationships.length
		|| input.existingRelationships.some(relationship => (
			!/^relationship:[a-z0-9][a-z0-9-]*$/u.test(relationship.id)
			|| !characterIds.has(relationship.sourceCharacterId)
			|| !characterIds.has(relationship.targetCharacterId)
			|| relationship.sourceCharacterId === relationship.targetCharacterId
			|| !relationship.relationshipType.trim()
			|| relationship.relationshipType.length > 160
			|| !Number.isSafeInteger(relationship.revision)
			|| relationship.revision < 0
		))
		|| (input.actionType === 'generate-relationship' && (
			!input.sourceCharacterId
			|| !input.targetCharacterId
			|| input.sourceCharacterId === input.targetCharacterId
			|| !characterIds.has(input.sourceCharacterId)
			|| !characterIds.has(input.targetCharacterId)
		))
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(
			`${input.instruction}\n${input.content}`
		)
	) {
		throw new Error('invalidRelationshipAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		instruction: input.instruction.trim(),
		source: {
			resourceId: input.resourceId,
			sourceRevision: input.sourceRevision,
			narrativeOrder: input.narrativeOrder,
			content: input.content
		},
		...(input.sourceCharacterId ? { sourceCharacterId: input.sourceCharacterId } : {}),
		...(input.targetCharacterId ? { targetCharacterId: input.targetCharacterId } : {}),
		characters: input.characters,
		existingRelationships: input.existingRelationships
	});
	if (payload.length > 180_000) throw new Error('invalidRelationshipAnalysisInput');
	return [
		{ role: 'system', content: RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parseRelationshipAnalysisResponse(
	response: string,
	actionType: RelationshipAnalysisActionType,
	allowedCharacterIds?: ReadonlySet<string>
): readonly RelationshipAnalysisCandidateResponse[] {
	const candidates = relationshipAnalysisResponseSchema.parse(JSON.parse(response)).candidates;
	if (
		actionType === 'extract-relationship-changes'
		&& candidates.some(candidate => candidate.evidence === null)
	) {
		throw new Error('missingRelationshipExtractionEvidence');
	}
	if (allowedCharacterIds && candidates.some(candidate => (
		!allowedCharacterIds.has(candidate.sourceCharacterId)
		|| !allowedCharacterIds.has(candidate.targetCharacterId)
	))) {
		throw new Error('unknownRelationshipCharacter');
	}
	return candidates;
}

interface WorldAnalysisRequestInput {
	readonly actionType: WorldAnalysisActionType;
	readonly targetType?: WorldAnalysisTargetType;
	readonly instruction: string;
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly narrativeOrder: number;
	readonly existingResources: readonly {
		readonly id: string;
		readonly type: 'location' | 'faction' | 'worldRule';
		readonly title: string;
		readonly aliases: readonly string[];
		readonly revision: number;
		readonly category?: 'culture' | 'religion' | 'technology' | 'magic' | 'law' | 'other';
		readonly statement?: string;
		readonly scope?: string;
	}[];
}

function isValidWorldIdentity(
	value: WorldAnalysisRequestInput['existingResources'][number]
): boolean {
	const prefix = value.type === 'worldRule' ? 'world-rule' : value.type;
	return value.id.startsWith(`${prefix}:`)
		&& /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(value.id)
		&& Boolean(value.title.trim())
		&& value.title.length <= 160
		&& value.aliases.length <= 40
		&& value.aliases.every(alias => Boolean(alias.trim()) && alias.length <= 160)
		&& Number.isSafeInteger(value.revision)
		&& value.revision >= 0
		&& (value.type !== 'worldRule' || value.category !== undefined);
}

export function buildWorldAnalysisMessages(
	input: WorldAnalysisRequestInput
): readonly AiMessage[] {
	const ids = new Set(input.existingResources.map(resource => resource.id));
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^chapter:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| input.sourceRevision.length > 128
		|| !Number.isSafeInteger(input.narrativeOrder)
		|| input.narrativeOrder < 0
		|| input.existingResources.length > 1_000
		|| ids.size !== input.existingResources.length
		|| input.existingResources.some(resource => !isValidWorldIdentity(resource))
		|| (input.actionType === 'generate-world-entry'
			&& (!input.targetType || !worldAnalysisTargetTypes.includes(input.targetType)))
		|| (input.actionType === 'extract-worldbuilding' && input.targetType !== undefined)
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(
			`${input.instruction}\n${input.content}`
		)
	) {
		throw new Error('invalidWorldAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		...(input.targetType ? { targetType: input.targetType } : {}),
		instruction: input.instruction.trim(),
		source: {
			resourceId: input.resourceId,
			sourceRevision: input.sourceRevision,
			narrativeOrder: input.narrativeOrder,
			content: input.content
		},
		existingResources: input.existingResources
	});
	if (payload.length > 180_000) throw new Error('invalidWorldAnalysisInput');
	return [
		{ role: 'system', content: WORLD_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

const worldTargetCategory: Readonly<Partial<Record<
	WorldAnalysisTargetType,
	WorldRuleCandidateCategory
>>> = {
	culture: 'culture',
	religion: 'religion',
	technology: 'technology',
	magic: 'magic',
	law: 'law'
};

export function parseWorldAnalysisResponse(
	response: string,
	actionType: WorldAnalysisActionType,
	targetType?: WorldAnalysisTargetType,
	allowedResourceIds?: ReadonlySet<string>
): readonly WorldAnalysisCandidateResponse[] {
	const candidates = worldAnalysisResponseSchema.parse(JSON.parse(response)).candidates;
	if (
		actionType === 'extract-worldbuilding'
		&& candidates.some(candidate => candidate.evidence === null)
	) {
		throw new Error('missingWorldExtractionEvidence');
	}
	if (actionType === 'generate-world-entry') {
		if (!targetType || candidates.length === 0 || candidates.length > 6) {
			throw new Error('invalidWorldCandidateCount');
		}
		const expectedKind = targetType === 'location'
			? 'location'
			: targetType === 'faction'
				? 'faction'
				: 'worldRule';
		if (candidates.some(candidate => (
			candidate.kind !== expectedKind
			|| (
				candidate.kind === 'worldRule'
				&& worldTargetCategory[targetType] !== undefined
				&& candidate.category !== worldTargetCategory[targetType]
			)
		))) {
			throw new Error('worldCandidateTypeMismatch');
		}
	}
	if (allowedResourceIds && candidates.some(candidate => {
		if (
			candidate.kind === 'location'
			&& candidate.parentLocationId
			&& !allowedResourceIds.has(candidate.parentLocationId)
		) return true;
		if (
			candidate.kind === 'faction'
			&& candidate.territoryLocationIds.some(id => !allowedResourceIds.has(id))
		) return true;
		return candidate.kind === 'worldRule'
			&& candidate.conflicts.some(conflict => !allowedResourceIds.has(conflict.resourceId));
	})) {
		throw new Error('unknownWorldReference');
	}
	return candidates;
}

interface ItemAnalysisRequestInput {
	readonly actionType: ItemAnalysisActionType;
	readonly instruction: string;
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly narrativeOrder: number;
	readonly selectedItemId?: string;
	readonly existingItems: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly unique: boolean;
		readonly revision: number;
	}[];
	readonly characters: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly locations: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
}

function validSimpleIdentity(
	value: { readonly id: string; readonly title: string; readonly revision: number },
	prefix: string
): boolean {
	return value.id.startsWith(`${prefix}:`)
		&& /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(value.id)
		&& Boolean(value.title.trim())
		&& value.title.length <= 160
		&& Number.isSafeInteger(value.revision)
		&& value.revision >= 0;
}

export function buildItemAnalysisMessages(
	input: ItemAnalysisRequestInput
): readonly AiMessage[] {
	const itemIds = new Set(input.existingItems.map(item => item.id));
	const characterIds = new Set(input.characters.map(character => character.id));
	const locationIds = new Set(input.locations.map(location => location.id));
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^chapter:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| input.sourceRevision.length > 128
		|| !Number.isSafeInteger(input.narrativeOrder)
		|| input.narrativeOrder < 0
		|| input.existingItems.length > 1_000
		|| itemIds.size !== input.existingItems.length
		|| input.existingItems.some(item => (
			!validSimpleIdentity(item, 'item')
			|| item.aliases.length > 40
			|| item.aliases.some(alias => !alias.trim() || alias.length > 160)
		))
		|| input.characters.length > 500
		|| characterIds.size !== input.characters.length
		|| input.characters.some(character => !validSimpleIdentity(character, 'character'))
		|| input.locations.length > 1_000
		|| locationIds.size !== input.locations.length
		|| input.locations.some(location => !validSimpleIdentity(location, 'location'))
		|| (input.actionType === 'generate-item-history'
			&& (!input.selectedItemId || !itemIds.has(input.selectedItemId)))
		|| (input.actionType !== 'generate-item-history' && input.selectedItemId !== undefined)
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(
			`${input.instruction}\n${input.content}`
		)
	) {
		throw new Error('invalidItemAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		instruction: input.instruction.trim(),
		source: {
			resourceId: input.resourceId,
			sourceRevision: input.sourceRevision,
			narrativeOrder: input.narrativeOrder,
			content: input.content
		},
		...(input.selectedItemId ? { selectedItemId: input.selectedItemId } : {}),
		existingItems: input.existingItems,
		characters: input.characters,
		locations: input.locations
	});
	if (payload.length > 200_000) throw new Error('invalidItemAnalysisInput');
	return [
		{ role: 'system', content: ITEM_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parseItemAnalysisResponse(
	response: string,
	actionType: ItemAnalysisActionType,
	allowedCharacterIds?: ReadonlySet<string>,
	allowedLocationIds?: ReadonlySet<string>
): readonly ItemAnalysisCandidateResponse[] {
	const candidates = itemAnalysisResponseSchema.parse(JSON.parse(response)).candidates;
	if (
		actionType !== 'extract-items'
		&& (candidates.length === 0 || candidates.length > 6)
	) {
		throw new Error('invalidItemCandidateCount');
	}
	if (
		actionType === 'extract-items'
		&& candidates.some(candidate => (
			candidate.evidence === null
			|| candidate.states.some(state => state.evidence === null)
		))
	) {
		throw new Error('missingItemExtractionEvidence');
	}
	if (candidates.some(candidate => candidate.states.some(state => (
		(state.holderCharacterId !== null
			&& allowedCharacterIds !== undefined
			&& !allowedCharacterIds.has(state.holderCharacterId))
		|| (state.locationId !== null
			&& allowedLocationIds !== undefined
			&& !allowedLocationIds.has(state.locationId))
	)))) {
		throw new Error('unknownItemStateReference');
	}
	return candidates;
}

interface GateFChapterSourceInput {
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly narrativeOrder: number;
	readonly content: string;
}

function validGateFSources(sources: readonly GateFChapterSourceInput[]): boolean {
	const ids = new Set(sources.map(source => source.resourceId));
	return sources.length >= 1
		&& sources.length <= 12
		&& ids.size === sources.length
		&& sources.reduce((total, source) => total + source.content.length, 0) <= 160_000
		&& sources.every(source => (
			/^chapter:[a-z0-9][a-z0-9-]*$/u.test(source.resourceId)
			&& Boolean(source.sourceRevision.trim())
			&& source.sourceRevision.length <= 128
			&& Number.isSafeInteger(source.narrativeOrder)
			&& source.narrativeOrder >= 0
			&& Boolean(source.content.trim())
			&& source.content.length <= AI_CHAPTER_REVIEW_MAX_CHARS
		));
}

interface TimelineAnalysisRequestInput {
	readonly actionType: TimelineAnalysisActionType;
	readonly instruction: string;
	readonly sources: readonly GateFChapterSourceInput[];
	readonly existingEvents: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly revision: number;
	}[];
	readonly characters: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly locations: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly items: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly plotThreads: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly foreshadowing: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
}

export function buildTimelineAnalysisMessages(
	input: TimelineAnalysisRequestInput
): readonly AiMessage[] {
	const collections = [
		[input.existingEvents, 'timeline-event'],
		[input.characters, 'character'],
		[input.locations, 'location'],
		[input.items, 'item'],
		[input.plotThreads, 'plot-thread'],
		[input.foreshadowing, 'foreshadowing']
	] as const;
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !validGateFSources(input.sources)
		|| collections.some(([values, prefix]) => (
			values.length > 1_000
			|| new Set(values.map(value => value.id)).size !== values.length
			|| values.some(value => !validSimpleIdentity(value, prefix))
		))
		|| input.existingEvents.some(event => (
			event.aliases.length > 40
			|| event.aliases.some(alias => !alias.trim() || alias.length > 160)
		))
		|| /projectRoot|apiKey|credential|absolutePath/iu.test([
			input.instruction,
			...input.sources.map(source => source.content)
		].join('\n'))
	) {
		throw new Error('invalidTimelineAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		instruction: input.instruction.trim(),
		sources: input.sources,
		existingEvents: input.existingEvents,
		characters: input.characters,
		locations: input.locations,
		items: input.items,
		plotThreads: input.plotThreads,
		foreshadowing: input.foreshadowing
	});
	if (payload.length > 240_000) throw new Error('invalidTimelineAnalysisInput');
	return [
		{ role: 'system', content: TIMELINE_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

function idsAreKnown(ids: readonly string[], allowed?: ReadonlySet<string>): boolean {
	return allowed === undefined || ids.every(id => allowed.has(id));
}

export function parseTimelineAnalysisResponse(
	response: string,
	actionType: TimelineAnalysisActionType,
	allowed: {
		readonly sourceIds?: ReadonlySet<string>;
		readonly eventIds?: ReadonlySet<string>;
		readonly characterIds?: ReadonlySet<string>;
		readonly locationIds?: ReadonlySet<string>;
		readonly itemIds?: ReadonlySet<string>;
		readonly plotThreadIds?: ReadonlySet<string>;
		readonly foreshadowingIds?: ReadonlySet<string>;
	} = {}
): TimelineAnalysisResponse {
	const parsed = timelineAnalysisResponseSchema.parse(JSON.parse(response));
	const candidateIds = new Set(parsed.candidates.map(candidate => candidate.clientCandidateId));
	const edgeIds = new Set(parsed.causalEdges.map(edge => edge.clientEdgeId));
	if (
		candidateIds.size !== parsed.candidates.length
		|| edgeIds.size !== parsed.causalEdges.length
		|| (actionType === 'generate-directions' && parsed.candidates.length !== 3)
		|| (actionType === 'suggest-causality' && parsed.causalEdges.length === 0)
		|| (actionType !== 'suggest-causality'
			&& actionType !== 'extract-events'
			&& parsed.candidates.length === 0)
		|| (actionType === 'extract-events'
			&& parsed.candidates.some(candidate => candidate.evidence === null))
	) {
		throw new Error('invalidTimelineAnalysisResponse');
	}
	if (parsed.candidates.some(candidate => (
		!idsAreKnown([candidate.sourceResourceId], allowed.sourceIds)
		|| !idsAreKnown(candidate.participantIds, allowed.characterIds)
		|| !idsAreKnown(candidate.locationIds, allowed.locationIds)
		|| !idsAreKnown(candidate.itemIds, allowed.itemIds)
		|| !idsAreKnown(candidate.predecessorIds, allowed.eventIds)
		|| !idsAreKnown(candidate.consequenceIds, allowed.eventIds)
		|| !idsAreKnown(candidate.plotThreadIds, allowed.plotThreadIds)
		|| !idsAreKnown(candidate.foreshadowingIds, allowed.foreshadowingIds)
	))) {
		throw new Error('unknownTimelineReference');
	}
	const endpointIsKnown = (endpoint: z.infer<typeof timelineEndpointSchema>) => (
		endpoint.kind === 'candidate'
			? candidateIds.has(endpoint.id)
			: (allowed.eventIds?.has(endpoint.id) ?? true)
	);
	const causalPairs = new Set<string>();
	for (const edge of parsed.causalEdges) {
		if (!endpointIsKnown(edge.from) || !endpointIsKnown(edge.to)) {
			throw new Error('unknownTimelineCausalEndpoint');
		}
		const left = `${edge.from.kind}:${edge.from.id}`;
		const right = `${edge.to.kind}:${edge.to.id}`;
		const pair = [left, right].sort().join('|');
		if (causalPairs.has(pair)) throw new Error('duplicateTimelineCausalPair');
		causalPairs.add(pair);
	}
	return parsed;
}

interface PlotAnalysisRequestInput {
	readonly actionType: PlotAnalysisActionType;
	readonly instruction: string;
	readonly sources: readonly GateFChapterSourceInput[];
	readonly includeAuthorSecrets: boolean;
	readonly selectedPlotThreadId?: string;
	readonly selectedForeshadowingId?: string;
	readonly plotThreads: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly status: string;
		readonly revision: number;
	}[];
	readonly foreshadowing: readonly {
		readonly id: string;
		readonly title: string;
		readonly aliases: readonly string[];
		readonly status: string;
		readonly surfaceMeaning?: string;
		readonly trueMeaning?: string;
		readonly revision: number;
	}[];
	readonly characters: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
	readonly scenes: readonly {
		readonly id: string;
		readonly title: string;
		readonly revision: number;
	}[];
}

export function buildPlotAnalysisMessages(
	input: PlotAnalysisRequestInput
): readonly AiMessage[] {
	const plotIds = new Set(input.plotThreads.map(thread => thread.id));
	const clueIds = new Set(input.foreshadowing.map(clue => clue.id));
	const collections = [
		[input.plotThreads, 'plot-thread'],
		[input.foreshadowing, 'foreshadowing'],
		[input.characters, 'character'],
		[input.scenes, 'scene']
	] as const;
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !validGateFSources(input.sources)
		|| collections.some(([values, prefix]) => (
			values.length > 1_000
			|| new Set(values.map(value => value.id)).size !== values.length
			|| values.some(value => !validSimpleIdentity(value, prefix))
		))
		|| [...input.plotThreads, ...input.foreshadowing].some(value => (
			value.aliases.length > 40
			|| value.aliases.some(alias => !alias.trim() || alias.length > 160)
		))
		|| (!input.includeAuthorSecrets
			&& input.foreshadowing.some(clue => clue.trueMeaning !== undefined))
		|| (input.actionType === 'generate-plot-consequences'
			&& (!input.selectedPlotThreadId || !plotIds.has(input.selectedPlotThreadId)))
		|| (input.actionType !== 'generate-plot-consequences'
			&& input.selectedPlotThreadId !== undefined)
		|| (input.actionType === 'generate-foreshadowing-payoff'
			&& (!input.selectedForeshadowingId || !clueIds.has(input.selectedForeshadowingId)))
		|| (input.actionType !== 'generate-foreshadowing-payoff'
			&& input.selectedForeshadowingId !== undefined)
		|| /projectRoot|apiKey|credential|absolutePath/iu.test([
			input.instruction,
			...input.sources.map(source => source.content)
		].join('\n'))
	) {
		throw new Error('invalidPlotAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		actionType: input.actionType,
		instruction: input.instruction.trim(),
		sources: input.sources,
		includeAuthorSecrets: input.includeAuthorSecrets,
		...(input.selectedPlotThreadId
			? { selectedPlotThreadId: input.selectedPlotThreadId }
			: {}),
		...(input.selectedForeshadowingId
			? { selectedForeshadowingId: input.selectedForeshadowingId }
			: {}),
		plotThreads: input.plotThreads,
		foreshadowing: input.foreshadowing,
		characters: input.characters,
		scenes: input.scenes
	});
	if (payload.length > 240_000) throw new Error('invalidPlotAnalysisInput');
	return [
		{ role: 'system', content: PLOT_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parsePlotAnalysisResponse(
	response: string,
	actionType: PlotAnalysisActionType,
	allowed: {
		readonly sourceIds?: ReadonlySet<string>;
		readonly characterIds?: ReadonlySet<string>;
		readonly sceneIds?: ReadonlySet<string>;
		readonly plotThreadIds?: ReadonlySet<string>;
	} = {}
): readonly PlotAnalysisCandidateResponse[] {
	const candidates = plotAnalysisResponseSchema.parse(JSON.parse(response)).candidates;
	const expectedKind = actionType.startsWith('generate-plot')
		|| actionType === 'extract-plot-progress'
		? 'plotThread'
		: 'foreshadowing';
	const extraction = actionType === 'extract-plot-progress'
		|| actionType === 'extract-foreshadowing';
	const positionKnown = (position: PlotAnalysisPositionResponse | null) => (
		position === null || idsAreKnown([position.chapterId], allowed.sourceIds)
	);
	if (
		candidates.some(candidate => candidate.kind !== expectedKind)
		|| (!extraction && candidates.length === 0)
		|| (extraction && candidates.some(candidate => candidate.evidence === null))
		|| candidates.some(candidate => (
			!idsAreKnown([candidate.sourceResourceId], allowed.sourceIds)
			|| (candidate.kind === 'plotThread'
				? (
					!idsAreKnown(candidate.participantIds, allowed.characterIds)
					|| !idsAreKnown(candidate.sceneIds, allowed.sceneIds)
					|| !positionKnown(candidate.startPosition)
					|| !positionKnown(candidate.targetResolution)
					|| !positionKnown(candidate.actualResolution)
				)
				: (
					!idsAreKnown(candidate.plotThreadIds, allowed.plotThreadIds)
					|| !positionKnown(candidate.plantedAt)
					|| !positionKnown(candidate.plannedPayoffAt)
					|| !positionKnown(candidate.actualPayoffAt)
					|| candidate.reminderPositions.some(position => !positionKnown(position))
				))
		))
	) {
		throw new Error('invalidPlotAnalysisResponse');
	}
	return candidates;
}

export function buildSelectionRewriteMessages(contextPackJson: string): readonly AiMessage[] {
	const payload = JSON.parse(contextPackJson) as unknown;
	if (
		!payload
		|| typeof payload !== 'object'
		|| !('schemaVersion' in payload)
		|| payload.schemaVersion !== 1
		|| !('context' in payload)
		|| !Array.isArray(payload.context)
		|| contextPackJson.length > 40_000
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(contextPackJson)
	) {
		throw new Error('invalidSelectionRewriteContext');
	}
	return [
		{ role: 'system', content: SELECTION_REWRITE_SYSTEM_PROMPT },
		{ role: 'user', content: contextPackJson }
	];
}

export function parseSelectionRewriteResponse(response: string): SelectionRewriteResponse {
	return selectionRewriteResponseSchema.parse(JSON.parse(response));
}

export function buildStoryExtractionMessages(input: {
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
}): readonly AiMessage[] {
	if (
		!input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(input.content)
	) {
		throw new Error('invalidStoryExtractionInput');
	}
	return [
		{ role: 'system', content: STORY_EXTRACTION_SYSTEM_PROMPT },
		{
			role: 'user',
			content: JSON.stringify({
				schemaVersion: 1,
				resourceId: input.resourceId,
				sourceRevision: input.sourceRevision,
				content: input.content
			})
		}
	];
}

export function parseStoryExtractionResponse(response: string): readonly StoryExtractionCandidate[] {
	return storyExtractionResponseSchema.parse(JSON.parse(response)).facts;
}

export function buildStoryKernelGenerationMessages(input: {
	readonly instruction: string;
	readonly content: string;
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly targetTypes: readonly StoryKernelGenerationResourceType[];
	readonly existingResources: readonly StoryKernelExistingResourceIdentity[];
}): readonly AiMessage[] {
	const targetTypes = [...new Set(input.targetTypes)];
	const existingIds = new Set<string>();
	if (
		!input.instruction.trim()
		|| input.instruction.length > 2_000
		|| !input.content.trim()
		|| input.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		|| !/^chapter:[a-z0-9][a-z0-9-]*$/u.test(input.resourceId)
		|| !input.sourceRevision.trim()
		|| input.sourceRevision.length > 128
		|| targetTypes.length === 0
		|| targetTypes.length !== input.targetTypes.length
		|| targetTypes.some(type => !storyKernelGenerationResourceTypes.includes(type))
		|| input.existingResources.length > 500
		|| /projectRoot|apiKey|credential|absolutePath/iu.test(
			`${input.instruction}\n${input.content}`
		)
	) {
		throw new Error('invalidStoryKernelGenerationInput');
	}
	for (const resource of input.existingResources) {
		if (
			existingIds.has(resource.id)
			|| !/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(resource.id)
			|| !storyKernelGenerationResourceTypes.includes(resource.type)
			|| !resource.title.trim()
			|| resource.title.length > 160
			|| !Number.isSafeInteger(resource.revision)
			|| resource.revision < 0
		) {
			throw new Error('invalidStoryKernelGenerationInput');
		}
		existingIds.add(resource.id);
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		instruction: input.instruction.trim(),
		source: {
			resourceId: input.resourceId,
			sourceRevision: input.sourceRevision,
			content: input.content
		},
		targetTypes,
		existingResources: input.existingResources
	});
	if (payload.length > 140_000) {
		throw new Error('invalidStoryKernelGenerationInput');
	}
	return [
		{ role: 'system', content: STORY_KERNEL_GENERATION_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parseStoryKernelGenerationResponse(
	response: string
): readonly StoryKernelGenerationCandidateResponse[] {
	return storyKernelGenerationResponseSchema.parse(JSON.parse(response)).candidates;
}

export function buildChapterReviewMessages(content: string): readonly AiMessage[] {
	if (!content.trim() || content.length > AI_CHAPTER_REVIEW_MAX_CHARS) {
		throw new Error('invalidReviewContent');
	}
	return [
		{ role: 'system', content: CHAPTER_REVIEW_SYSTEM_PROMPT },
		{
			role: 'user',
			content: JSON.stringify({ schemaVersion: 1, content })
		}
	];
}

export function parseChapterReviewResponse(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly content: string;
	readonly response: string;
}): readonly ReviewIssue[] {
	const parsed = chapterReviewResponseSchema.parse(JSON.parse(input.response));
	const now = new Date().toISOString();
	return parsed.issues.flatMap((candidate, index): readonly ReviewIssue[] => {
		let start = candidate.start;
		let end = candidate.end;
		if (end < start || input.content.slice(start, end) !== candidate.target) {
			const first = input.content.indexOf(candidate.target);
			const second = first >= 0
				? input.content.indexOf(candidate.target, first + Math.max(1, candidate.target.length))
				: -1;
			if (first < 0 || second >= 0) {
				return [];
			}
			start = first;
			end = first + candidate.target.length;
		}
		return [{
			id: `ai-review:${input.resourceId}:${start}:${hashText(`${candidate.title}:${candidate.target}:${index}`)}`,
			projectId: input.projectId,
			resourceId: input.resourceId,
			ruleId: 'ai-chapter-review',
			severity: candidate.severity,
			status: 'open',
			title: candidate.title,
			message: candidate.message,
			anchor: createTextAnchor(input.content, start, end),
			...(candidate.replacement === undefined ? {} : { replacement: candidate.replacement }),
			createdAt: now,
			updatedAt: now,
			origin: 'ai'
		}];
	});
}

export interface StoryConsistencySourceInput {
	readonly resourceId: string;
	readonly sourceRevision: string;
	readonly content: string;
}

export interface StoryConsistencyFactInput {
	readonly resourceId: string;
	readonly title: string;
	readonly statement: string;
}

export function buildStoryConsistencyAnalysisMessages(input: {
	readonly instruction: string;
	readonly sources: readonly StoryConsistencySourceInput[];
	readonly storyFacts: readonly StoryConsistencyFactInput[];
}): readonly AiMessage[] {
	const instruction = input.instruction.trim();
	const sourceIds = new Set(input.sources.map(source => source.resourceId));
	const factIds = new Set(input.storyFacts.map(fact => fact.resourceId));
	if (!instruction
		|| instruction.length > 2_000
		|| input.sources.length < 2
		|| input.sources.length > 12
		|| sourceIds.size !== input.sources.length
		|| input.sources.reduce((total, source) => total + source.content.length, 0) > 160_000
		|| input.sources.some(source => (
			Object.keys(source).some(key => ![
				'resourceId',
				'sourceRevision',
				'content'
			].includes(key))
			||
			!/^chapter:[a-z0-9][a-z0-9-]*$/u.test(source.resourceId)
			|| !source.sourceRevision.trim()
			|| source.sourceRevision.length > 128
			|| !source.content.trim()
			|| source.content.length > AI_CHAPTER_REVIEW_MAX_CHARS
		))
		|| input.storyFacts.length > 500
		|| factIds.size !== input.storyFacts.length
		|| input.storyFacts.some(fact => (
			Object.keys(fact).some(key => ![
				'resourceId',
				'title',
				'statement'
			].includes(key))
			||
			!/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/u.test(fact.resourceId)
			|| !fact.title.trim()
			|| fact.title.length > 160
			|| !fact.statement.trim()
			|| fact.statement.length > 4_000
		))
		|| /projectRoot|apiKey|credential|absolutePath/iu.test([
			instruction,
			...input.sources.map(source => source.content),
			...input.storyFacts.flatMap(fact => [fact.title, fact.statement])
		].join('\n'))
	) {
		throw new Error('invalidStoryConsistencyAnalysisInput');
	}
	const payload = JSON.stringify({
		schemaVersion: 1,
		instruction,
		sources: input.sources,
		storyFacts: input.storyFacts
	});
	if (payload.length > 220_000) {
		throw new Error('invalidStoryConsistencyAnalysisInput');
	}
	return [
		{ role: 'system', content: STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT },
		{ role: 'user', content: payload }
	];
}

export function parseStoryConsistencyAnalysisResponse(input: {
	readonly projectId: string;
	readonly sources: readonly StoryConsistencySourceInput[];
	readonly storyFacts: readonly StoryConsistencyFactInput[];
	readonly response: string;
}): readonly ReviewIssue[] {
	const parsed = storyConsistencyResponseSchema.parse(JSON.parse(input.response));
	const sourceById = new Map(input.sources.map(source => [source.resourceId, source]));
	const factById = new Map(input.storyFacts.map(fact => [fact.resourceId, fact]));
	const now = new Date().toISOString();
	return parsed.issues.map((candidate, index): ReviewIssue => {
		const evidenceKeys = new Set<string>();
		const relatedEvidence = candidate.evidence.map((evidence, evidenceIndex) => {
			const source = sourceById.get(evidence.resourceId);
			const key = `${evidence.resourceId}:${evidence.start}:${evidence.end}:${evidence.quote}`;
			if (!source
				|| evidenceKeys.has(key)
				|| source.content.slice(evidence.start, evidence.end) !== evidence.quote
			) {
				throw new Error('invalidStoryConsistencyEvidence');
			}
			evidenceKeys.add(key);
			return {
				resourceId: evidence.resourceId,
				label: evidence.label || `证据 ${String.fromCharCode(65 + evidenceIndex)}`,
				anchor: createTextAnchor(source.content, evidence.start, evidence.end)
			};
		});
		const primary = relatedEvidence[0];
		if (!primary) throw new Error('invalidStoryConsistencyEvidence');
		let storyFact: StoryConsistencyFactInput | undefined;
		if (candidate.storyFact) {
			const known = factById.get(candidate.storyFact.resourceId);
			if (!known
				|| known.title !== candidate.storyFact.title
				|| known.statement !== candidate.storyFact.statement
			) {
				throw new Error('unknownStoryConsistencyFact');
			}
			storyFact = known;
		}
		return {
			id: `ai-continuity:${hashText([
				candidate.ruleId,
				...relatedEvidence.map(evidence => (
					`${evidence.resourceId}:${evidence.anchor.start}:${evidence.anchor.end}`
				)),
				String(index)
			].join('|'))}`,
			projectId: input.projectId,
			resourceId: primary.resourceId,
			ruleId: candidate.ruleId,
			severity: candidate.severity === 'error' ? 'warning' : candidate.severity,
			status: 'open',
			title: candidate.title,
			message: candidate.message,
			anchor: primary.anchor,
			relatedEvidence,
			...(storyFact ? { storyFact } : {}),
			createdAt: now,
			updatedAt: now,
			origin: 'ai'
		};
	});
}

export function publicAiErrorMessage(code: AiErrorCode): string {
	const messages: Readonly<Record<AiErrorCode, string>> = {
		invalid_configuration: 'AI 配置不完整。',
		authentication_failed: 'API Key 无效或已经失效。',
		insufficient_balance: 'DeepSeek 余额不足。',
		invalid_request: '请求格式、模型或参数不受支持。',
		rate_limited: '请求过多，请稍后再试。',
		provider_overloaded: 'DeepSeek 当前繁忙，请稍后重试。',
		provider_server_error: 'DeepSeek 服务异常。',
		network_unavailable: '无法连接 DeepSeek，请检查网络。',
		connection_timeout: '连接 DeepSeek 超时。',
		first_content_timeout: '等待首段内容超时。',
		stream_idle_timeout: '生成流长时间没有新内容。',
		stream_parse_failed: 'DeepSeek 返回了无法解析的流。',
		stream_incomplete: '生成连接提前中断。',
		empty_response: 'DeepSeek 没有返回候选内容。',
		cancelled: '生成已停止。',
		secret_store_failed: 'Windows 凭据管理器操作失败。',
		unknown: 'AI 请求失败。'
	};
	return messages[code];
}

// Existing local-only selection workflow. Phase 1.0A keeps this fake provider
// but deliberately removes its network bridge.
export interface AiRequest {
	readonly requestId: string;
	readonly model: string;
	readonly messages: readonly AiMessage[];
	readonly task: 'polish' | 'shorten' | 'grammar' | 'dialogue' | 'rhythm' | 'review';
}

export interface AiSuggestion {
	readonly original: string;
	readonly replacement: string;
	readonly reason: string;
	readonly scope: string;
}

export interface AiProvider {
	readonly id: string;
	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion>;
}

const responseSchema = z.object({
	replacement: z.string(),
	reason: z.string().min(1),
	scope: z.string().min(1).default('当前选区')
});

export function buildSelectionContext(input: {
	readonly projectTitle: string;
	readonly chapterTitle: string;
	readonly selection: string;
	readonly before: string;
	readonly after: string;
}): readonly AiMessage[] {
	return [
		{
			role: 'system',
			content: '你是 Writing Buddy 的写作助手。只针对作者明确选择的文字提出建议，不扩展、泄露或虚构未提供的全文。返回 JSON。'
		},
		{
			role: 'user',
			content: JSON.stringify({
				project: input.projectTitle,
				chapter: input.chapterTitle,
				selection: input.selection,
				localContext: { before: input.before, after: input.after },
				responseSchema: { replacement: 'string', reason: 'string', scope: 'string' }
			})
		}
	];
}

export function parseAiSuggestion(original: string, response: string): AiSuggestion {
	const parsed = responseSchema.parse(JSON.parse(response));
	return { original, ...parsed };
}

export class FakeAiProvider implements AiProvider {
	readonly id = 'fake';

	complete(request: AiRequest, signal?: AbortSignal): Promise<AiSuggestion> {
		if (signal?.aborted) {
			return Promise.reject(new DOMException('Cancelled', 'AbortError'));
		}
		let selectionMessage = '';
		for (let index = request.messages.length - 1; index >= 0; index--) {
			const message = request.messages[index];
			if (message?.role === 'user') {
				selectionMessage = message.content;
				break;
			}
		}
		let original = '';
		try {
			const decoded = JSON.parse(selectionMessage) as { selection?: string };
			original = decoded.selection ?? '';
		} catch {
			original = selectionMessage;
		}
		return Promise.resolve({
			original,
			replacement: original
				.replace(/非常非常/gu, '格外')
				.replace(/然后然后/gu, '随后')
				.replace(/[ \t]{2,}/gu, ' '),
			reason: '减少重复表达，让句子更紧凑。',
			scope: '当前选区'
		});
	}
}

export function suggestionToReviewIssue(input: {
	readonly projectId: string;
	readonly resourceId: string;
	readonly start: number;
	readonly end: number;
	readonly content: string;
	readonly suggestion: AiSuggestion;
}): ReviewIssue {
	const now = new Date().toISOString();
	return {
		id: `ai:${input.resourceId}:${input.start}:${crypto.randomUUID()}`,
		projectId: input.projectId,
		resourceId: input.resourceId,
		ruleId: 'ai-suggestion',
		severity: 'suggestion',
		status: 'open',
		title: 'AI 润色建议',
		message: input.suggestion.reason,
		anchor: createTextAnchor(input.content, input.start, input.end),
		replacement: input.suggestion.replacement,
		createdAt: now,
		updatedAt: now,
		origin: 'ai'
	};
}
