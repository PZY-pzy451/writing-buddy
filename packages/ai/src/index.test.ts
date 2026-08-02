import {
	AI_MAX_OUTPUT_PRESETS,
	AiProviderRegistry,
	DEFAULT_AI_PREFERENCES,
	aggregateAiUsage,
	buildChapterReviewMessages,
	buildInlineLanguageCheckMessages,
	buildCharacterAnalysisMessages,
	buildItemAnalysisMessages,
	buildManuscriptContinuationMessages,
	buildPlotAnalysisMessages,
	buildRelationshipAnalysisMessages,
	buildScenePlanMessages,
	buildSelectionRewriteMessages,
	buildStoryExtractionMessages,
	buildStoryKernelGenerationMessages,
	buildStoryConsistencyAnalysisMessages,
	buildTimelineAnalysisMessages,
	buildWorldAnalysisMessages,
	canQueueAiJob,
	chooseDefaultModel,
	createDeepSeekProviderDefinition,
	nextAiJobState,
	normalizeAiPreferences,
	parseChapterReviewResponse,
	parseInlineLanguageCheckResponse,
	parseCharacterAnalysisResponse,
	parseItemAnalysisResponse,
	parseManuscriptContinuationResponse,
	parsePlotAnalysisResponse,
	parseRelationshipAnalysisResponse,
	parseScenePlanResponse,
	parseSelectionRewriteResponse,
	parseStoryExtractionResponse,
	parseStoryKernelGenerationResponse,
	parseStoryKernelGenerationResponseWithDiagnostics,
	parseStoryConsistencyAnalysisResponse,
	parseTimelineAnalysisResponse,
	parseWorldAnalysisResponse,
	SELECTION_REWRITE_SYSTEM_PROMPT,
	CHARACTER_ANALYSIS_SYSTEM_PROMPT,
	ITEM_ANALYSIS_SYSTEM_PROMPT,
	MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT,
	PLOT_ANALYSIS_SYSTEM_PROMPT,
	RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT,
	SCENE_PLAN_SYSTEM_PROMPT,
	STORY_EXTRACTION_SYSTEM_PROMPT,
	STORY_KERNEL_GENERATION_SYSTEM_PROMPT,
	STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT,
	TIMELINE_ANALYSIS_SYSTEM_PROMPT,
	WORLD_ANALYSIS_SYSTEM_PROMPT,
	shouldRetryAiFailure
} from './index';

describe('AI core contracts', () => {
	it('registers DeepSeek once and exposes frozen capabilities', () => {
		const registry = new AiProviderRegistry();
		const provider = createDeepSeekProviderDefinition();
		registry.register(provider);

		expect(registry.get('deepseek')).toEqual(provider);
		expect(registry.list()).toEqual([provider]);
		expect(() => registry.register(provider)).toThrow('providerAlreadyRegistered');
		expect(provider.capabilities.toolCalls).toBe(false);
	});

	it('selects a saved model, then V4 Flash, then the first runtime model', () => {
		const models = [
			{ id: 'deepseek-v4-pro', ownedBy: 'deepseek' },
			{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' }
		];
		expect(chooseDefaultModel(models, 'deepseek-v4-pro')).toBe('deepseek-v4-pro');
		expect(chooseDefaultModel(models, 'missing')).toBe('deepseek-v4-flash');
		expect(chooseDefaultModel([{ id: 'future-model', ownedBy: 'deepseek' }])).toBe('future-model');
		expect(chooseDefaultModel([])).toBeUndefined();
	});

	it('normalizes preferences and rejects retired model defaults', () => {
		expect(normalizeAiPreferences({ maxOutputTokens: 8192 })).toMatchObject({
			...DEFAULT_AI_PREFERENCES,
			maxOutputTokens: 8192
		});
		expect(AI_MAX_OUTPUT_PRESETS.at(-1)).toBe(384_000);
		expect(normalizeAiPreferences({ maxOutputTokens: 384_000 })).toMatchObject({
			...DEFAULT_AI_PREFERENCES,
			maxOutputTokens: 384_000
		});
		expect(() => normalizeAiPreferences({ maxOutputTokens: 384_001 })).toThrow();
		expect(normalizeAiPreferences({ defaultModelId: 'deepseek-chat' }).defaultModelId)
			.toBe('deepseek-v4-flash');
	});

	it('enforces job transitions and retry boundaries', () => {
		expect(nextAiJobState('created', { type: 'job_started', jobId: 'job-1' })).toBe('connecting');
		expect(nextAiJobState('connecting', { type: 'thinking_started', jobId: 'job-1' })).toBe('thinking');
		expect(nextAiJobState('thinking', { type: 'content_delta', jobId: 'job-1', text: '雨' })).toBe('streaming');
		expect(nextAiJobState('streaming', { type: 'completed', jobId: 'job-1' })).toBe('completed');
		expect(() => nextAiJobState('completed', { type: 'content_delta', jobId: 'job-1', text: '重复' }))
			.toThrow('invalidJobTransition');

		expect(shouldRetryAiFailure({ errorCode: 'rate_limited', retryCount: 0, receivedContent: false })).toBe(true);
		expect(shouldRetryAiFailure({ errorCode: 'provider_server_error', retryCount: 1, receivedContent: false })).toBe(true);
		expect(shouldRetryAiFailure({ errorCode: 'network_unavailable', retryCount: 2, receivedContent: false })).toBe(false);
		expect(shouldRetryAiFailure({ errorCode: 'rate_limited', retryCount: 0, receivedContent: true })).toBe(false);
		expect(shouldRetryAiFailure({ errorCode: 'authentication_failed', retryCount: 0, receivedContent: false })).toBe(false);
		expect(canQueueAiJob(2)).toBe(true);
		expect(canQueueAiJob(3)).toBe(false);
	});

	it('aggregates only anonymous usage fields', () => {
		const summary = aggregateAiUsage([
			{
				timestamp: '2026-07-26T01:00:00.000Z',
				providerId: 'deepseek',
				modelId: 'deepseek-v4-flash',
				jobType: 'storyforge-test',
				inputTokens: 12,
				outputTokens: 8,
				totalTokens: 20,
				durationMs: 400,
				status: 'completed'
			},
			{
				timestamp: '2026-07-26T02:00:00.000Z',
				providerId: 'deepseek',
				modelId: 'deepseek-v4-flash',
				jobType: 'storyforge-test',
				inputTokens: 3,
				outputTokens: 2,
				totalTokens: 5,
				durationMs: 80,
				status: 'cancelled'
			}
		]);
		expect(summary).toEqual({
			inputTokens: 15,
			outputTokens: 10,
			totalTokens: 25,
			requests: 2
		});
	});

	it('builds an isolated chapter-review request and anchors validated AI issues', () => {
		const content = '林墨推开门。。雨声突然停了。';
		const messages = buildChapterReviewMessages(content);
		expect(messages).toHaveLength(2);
		expect(messages[1]?.content).toContain(content);
		expect(messages[1]?.content).not.toContain('projectId');

		const issues = parseChapterReviewResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content,
			response: JSON.stringify({
				issues: [{
					start: 4,
					end: 7,
					target: '门。。',
					severity: 'warning',
					title: '重复标点',
					message: '句末标点重复。',
					replacement: '门。'
				}]
			})
		});
		expect(issues).toMatchObject([{
			resourceId: 'chapter',
			origin: 'ai',
			anchor: { target: '门。。' },
			replacement: '门。'
		}]);
	});

	it('drops AI review candidates that cannot be uniquely anchored', () => {
		const content = '雨声。雨声。';
		expect(parseChapterReviewResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content,
			response: JSON.stringify({
				issues: [{
					start: 99,
					end: 101,
					target: '雨声',
					severity: 'suggestion',
					title: '重复',
					message: '可能重复。'
				}]
			})
		})).toEqual([]);
	});

	it('builds a bounded inline-language request and keeps only exact minimal targets', () => {
		const content = 'He typed somthing in the rain.';
		const messages = buildInlineLanguageCheckMessages(content);
		expect(messages).toHaveLength(2);
		expect(messages[0]?.content).toContain('只报告明确的拼写');
		expect(messages[1]?.content).toContain(content);
		expect(messages[1]?.content).not.toContain('projectId');

		const issues = parseInlineLanguageCheckResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content,
			response: JSON.stringify({
				issues: [{
					start: 9,
					end: 17,
					target: 'somthing',
					severity: 'warning',
					title: '英文拼写错误',
					message: 'something 缺少字母 e。',
					replacement: 'something'
				}]
			})
		});
		expect(issues).toMatchObject([{
			ruleId: 'ai-inline-language-check',
			anchor: { start: 9, end: 17, target: 'somthing' },
			replacement: 'something'
		}]);
	});

	it('rejects oversized inline slices and ambiguous fallback targets', () => {
		expect(() => buildInlineLanguageCheckMessages('字'.repeat(2_401)))
			.toThrow('invalidInlineLanguageCheckContent');
		expect(parseInlineLanguageCheckResponse({
			projectId: 'project',
			resourceId: 'chapter',
			content: 'somthing and somthing',
			response: JSON.stringify({
				issues: [{
					start: 99,
					end: 107,
					target: 'somthing',
					severity: 'warning',
					title: '英文拼写错误',
					message: '拼写错误。',
					replacement: 'something'
				}]
			})
		})).toEqual([]);
	});

	it('builds and validates the grounded selection rewrite contract', () => {
		const messages = buildSelectionRewriteMessages(JSON.stringify({
			schemaVersion: 1,
			actionType: 'polish',
			context: [{ priority: 'P1', kind: 'selection', title: '当前选区', content: '雨落在站台。' }]
		}));
		expect(messages[0]?.content).toBe(SELECTION_REWRITE_SYSTEM_PROMPT);
		expect(parseSelectionRewriteResponse(JSON.stringify({
			suggestion: '雨丝落上寂静的站台。',
			rationale: '收紧意象。',
			potentialImpact: '不改变情节。'
		})).suggestion).toContain('站台');
		expect(() => buildSelectionRewriteMessages(JSON.stringify({
			schemaVersion: 1,
			context: [],
			projectRoot: 'D:\\private'
		}))).toThrow('invalidSelectionRewriteContext');
	});

	it('repairs equivalent selection rewrite output and rejects missing prose', () => {
		expect(parseSelectionRewriteResponse([
			'```json',
			JSON.stringify({
				data: {
					result: {
						rewrite: { text: '雨丝落上寂静的站台。' },
						reason: '删除重复表达。',
						impact: '不改变情节。'
					}
				}
			}),
			'```'
		].join('\n'))).toEqual({
			suggestion: '雨丝落上寂静的站台。',
			rationale: '删除重复表达。',
			potentialImpact: '不改变情节。'
		});
		expect(parseSelectionRewriteResponse(JSON.stringify({
			text: '雨停了。'
		}))).toEqual({
			suggestion: '雨停了。',
			rationale: 'AI 未提供改写依据，请在写入前核对候选。',
			potentialImpact: ''
		});
		expect(() => parseSelectionRewriteResponse(JSON.stringify({
			result: { tokens: [1, 2, 3] }
		}))).toThrow('invalidSelectionRewriteResponse:candidate');
	});

	it('builds bounded continuation requests and enforces three distinct directions', () => {
		const context = JSON.stringify({
			schemaVersion: 1,
			actionType: 'three-directions',
			context: [
				{ priority: 'P0', kind: 'instruction', title: '作者指令', content: '生成三种不同走向。' },
				{ priority: 'P1', kind: 'manuscript-excerpt', title: '光标前文', content: '雨停了。' }
			]
		});
		const messages = buildManuscriptContinuationMessages(context);
		expect(messages[0]?.content).toBe(MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT);
		expect(messages[1]?.content).not.toContain('projectRoot');
		expect(parseManuscriptContinuationResponse(JSON.stringify({
			candidates: [
				{ title: '追出去', content: '林越冲进雨幕。', rationale: '推进追踪。' },
				{ title: '留下来', content: '林越关上了门。', rationale: '积累悬念。' },
				{ title: '转向真相', content: '钟声从地下传来。', rationale: '揭开新线索。' }
			]
		}), 'three-directions')).toHaveLength(3);
		expect(() => parseManuscriptContinuationResponse(JSON.stringify({
			candidates: [{ title: '唯一走向', content: '林越离开。', rationale: '不足三种。' }]
		}), 'three-directions')).toThrow('invalidContinuationCandidateCount');
	});

	it('repairs equivalent continuation response wrappers without changing manuscript text', () => {
		const parsed = parseManuscriptContinuationResponse([
			'```json',
			JSON.stringify({
				result: {
					data: {
						candidate: {
							direction: '追随钟声',
							text: ['林越抬起头。', '他循着钟声走向站台尽头。'],
							reason: '延续当前场景线索。'
						}
					}
				}
			}),
			'```'
		].join('\n'), 'continue-paragraph');

		expect(parsed).toEqual([{
			title: '追随钟声',
			content: '林越抬起头。\n\n他循着钟声走向站台尽头。',
			rationale: '延续当前场景线索。'
		}]);
	});

	it('adds only neutral review metadata when structured output contains manuscript text', () => {
		expect(parseManuscriptContinuationResponse(JSON.stringify([
			{ continuation: { text: '林越推开了站台尽头的门。' } }
		]), 'continue-paragraph')).toEqual([{
			title: '续写候选 1',
			content: '林越推开了站台尽头的门。',
			rationale: 'AI 未提供生成依据，请在写入前核对正文。'
		}]);
	});

	it('rejects malformed continuation structures before draft creation', () => {
		expect(() => parseManuscriptContinuationResponse(
			'```json\n{"candidates":[{"content":{"tokens":[1,2]}}]}\n```',
			'continue-paragraph'
		)).toThrow('invalidManuscriptContinuationResponse:candidate');
		expect(() => parseManuscriptContinuationResponse(
			'not structured JSON',
			'continue-paragraph'
		)).toThrow('invalidManuscriptContinuationResponse:json');
	});

	it('builds and validates selectable scene-plan fields', () => {
		const messages = buildScenePlanMessages(JSON.stringify({
			schemaVersion: 1,
			actionType: 'generate-outline',
			context: [
				{ priority: 'P0', kind: 'instruction', title: '作者指令', content: '生成场景细纲。' },
				{ priority: 'P1', kind: 'scene-manuscript', title: '当前场景正文', content: '雨落在旧车站。' }
			]
		}));
		expect(messages[0]?.content).toBe(SCENE_PLAN_SYSTEM_PROMPT);
		expect(parseScenePlanResponse(JSON.stringify({
			goal: '找到失踪者留下的线索。',
			conflict: '站务员拒绝开门。',
			turn: '停摆的钟突然恢复。',
			outcome: '林越发现地下通道。',
			emotionBeats: [
				{ label: '迟疑', emotion: '不安', intensity: 0.4 },
				{ label: '逼近', emotion: '警觉', intensity: 0.8 }
			],
			rationale: '依据当前场景冲突。'
		})).emotionBeats).toHaveLength(2);
		expect(() => buildScenePlanMessages(JSON.stringify({
			schemaVersion: 1,
			actionType: 'generate-outline',
			projectRoot: 'D:\\private',
			context: []
		}))).toThrow('invalidScenePlanContext');
	});

	it('validates character candidates, exact generation counts, and extraction evidence', () => {
		const messages = buildCharacterAnalysisMessages({
			actionType: 'generate-character',
			instruction: '设计三个能推动悬疑线的人物。',
			content: '夜雨落在旧车站。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			narrativeOrder: 3,
			existingCharacters: [{
				id: 'character:lin-yue',
				title: '林越',
				aliases: ['阿越'],
				revision: 2
			}]
		});
		expect(messages[0]?.content).toBe(CHARACTER_ANALYSIS_SYSTEM_PROMPT);
		expect(messages[1]?.content).not.toContain('projectRoot');
		const candidate = (title: string) => ({
			title,
			role: 'supporting',
			confidence: 0.9,
			rationale: '补足冲突。',
			fields: [{
				key: 'goals',
				value: ['找到失踪的列车员'],
				evidence: null
			}]
		});
		expect(parseCharacterAnalysisResponse(JSON.stringify({
			candidates: [candidate('沈青'), candidate('周岚'), candidate('顾北')]
		}), 'generate-character')).toHaveLength(3);
		expect(() => parseCharacterAnalysisResponse(JSON.stringify({
			candidates: [candidate('沈青')]
		}), 'generate-character')).toThrow('invalidCharacterCandidateCount');
		expect(() => parseCharacterAnalysisResponse(JSON.stringify({
			candidates: [candidate('沈青')]
		}), 'extract-from-chapter')).toThrow('missingCharacterExtractionEvidence');
	});

	it('validates directed relationship candidates and grounded changes', () => {
		const characters = [{
			id: 'character:lin-yue',
			title: '林越',
			aliases: [],
			revision: 1
		}, {
			id: 'character:shen-qing',
			title: '沈青',
			aliases: [],
			revision: 2
		}];
		const messages = buildRelationshipAnalysisMessages({
			actionType: 'generate-relationship',
			instruction: '设计两人的双向认知。',
			content: '沈青把钥匙交给林越。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			narrativeOrder: 3,
			sourceCharacterId: 'character:lin-yue',
			targetCharacterId: 'character:shen-qing',
			characters,
			existingRelationships: []
		});
		expect(messages[0]?.content).toBe(RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT);
		expect(parseRelationshipAnalysisResponse(JSON.stringify({
			candidates: [{
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '戒备',
				strength: 0.7,
				visibility: 'private',
				description: '林越尚未信任沈青。',
				confidence: 0.9,
				rationale: '作者设定。',
				evidence: null
			}, {
				sourceCharacterId: 'character:shen-qing',
				targetCharacterId: 'character:lin-yue',
				relationshipType: '保护',
				visibility: 'secret',
				confidence: 0.8,
				rationale: '反向认知。',
				evidence: null
			}]
		}), 'generate-relationship', new Set(characters.map(item => item.id)))).toHaveLength(2);
		expect(() => parseRelationshipAnalysisResponse(JSON.stringify({
			candidates: [{
				sourceCharacterId: 'character:lin-yue',
				targetCharacterId: 'character:shen-qing',
				relationshipType: '信任',
				visibility: 'private',
				confidence: 0.9,
				rationale: '正文变化。',
				evidence: null
			}]
		}), 'extract-relationship-changes')).toThrow('missingRelationshipExtractionEvidence');
	});

	it('validates type-specific world candidates, rule scope, and extraction evidence', () => {
		const existingResources = [{
			id: 'location:old-station',
			type: 'location' as const,
			title: '旧车站',
			aliases: [],
			revision: 1
		}, {
			id: 'world-rule:rain-clock',
			type: 'worldRule' as const,
			title: '雨夜停钟',
			aliases: [],
			revision: 2,
			category: 'magic' as const,
			statement: '雨夜钟表停摆。',
			scope: '旧车站'
		}];
		const messages = buildWorldAnalysisMessages({
			actionType: 'generate-world-entry',
			targetType: 'magic',
			instruction: '设计三条有例外的魔法规则。',
			content: '雨夜的旧车站没有钟声。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			narrativeOrder: 3,
			existingResources
		});
		expect(messages[0]?.content).toBe(WORLD_ANALYSIS_SYSTEM_PROMPT);
		expect(messages[1]?.content).not.toContain('projectRoot');
		expect(parseWorldAnalysisResponse(JSON.stringify({
			candidates: [{
				kind: 'worldRule',
				title: '停钟规则',
				aliases: [],
				category: 'magic',
				statement: '进入旧站的机械钟在雨夜停摆。',
				scope: '旧车站内的雨夜',
				exceptions: ['由站长手动上弦的钟'],
				consequences: ['无法依靠钟表判断时间'],
				conflicts: [{
					resourceId: 'world-rule:rain-clock',
					reason: '适用范围重叠但例外不同。'
				}],
				confidence: 0.9,
				rationale: '作者设定候选。',
				evidence: null
			}]
		}), 'generate-world-entry', 'magic', new Set(existingResources.map(item => item.id))))
			.toHaveLength(1);
		expect(() => parseWorldAnalysisResponse(JSON.stringify({
			candidates: [{
				kind: 'location',
				title: '旧车站',
				aliases: [],
				summary: '废弃站房。',
				locationType: '车站',
				parentLocationId: null,
				rules: [],
				confidence: 0.9,
				rationale: '正文提取。',
				evidence: null
			}]
		}), 'extract-worldbuilding')).toThrow('missingWorldExtractionEvidence');
	});

	it('validates structured item cards, state references, and extraction evidence', () => {
		const messages = buildItemAnalysisMessages({
			actionType: 'generate-item-history',
			instruction: '为车票生成流转历史候选。',
			content: '徐青把褪色车票交给林墨。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			narrativeOrder: 3,
			selectedItemId: 'item:faded-ticket',
			existingItems: [{
				id: 'item:faded-ticket',
				title: '褪色车票',
				aliases: [],
				unique: true,
				revision: 1
			}],
			characters: [{
				id: 'character:lin-mo',
				title: '林墨',
				revision: 1
			}],
			locations: [{
				id: 'location:old-station',
				title: '旧车站',
				revision: 1
			}]
		});
		expect(messages[0]?.content).toBe(ITEM_ANALYSIS_SYSTEM_PROMPT);
		expect(parseItemAnalysisResponse(JSON.stringify({
			candidates: [{
				title: '褪色车票',
				aliases: [],
				itemType: '线索',
				unique: true,
				quantityUnit: '张',
				description: '边缘被雨水泡软的旧车票。',
				restrictions: ['票面编号只能辨认一次'],
				plotFunction: '连接失踪者与旧车站。',
				confidence: 0.92,
				rationale: '为现有物品补全历史。',
				evidence: null,
				states: [{
					action: 'transferred',
					quantity: 1,
					holderCharacterId: 'character:lin-mo',
					locationId: 'location:old-station',
					condition: '受潮',
					evidence: null
				}]
			}]
		}), 'generate-item-history', new Set(['character:lin-mo']), new Set(['location:old-station'])))
			.toHaveLength(1);
		expect(() => parseItemAnalysisResponse(JSON.stringify({
			candidates: [{
				title: '褪色车票',
				aliases: [],
				itemType: '线索',
				unique: true,
				quantityUnit: '张',
				description: '旧车票。',
				restrictions: [],
				plotFunction: '线索。',
				confidence: 0.9,
				rationale: '正文提取。',
				evidence: null,
				states: []
			}]
		}), 'extract-items')).toThrow('missingItemExtractionEvidence');
	});

	it('validates bounded timeline candidates, exact extraction, and typed causality', () => {
		const sources = [{
			resourceId: 'chapter:one',
			sourceRevision: '7',
			narrativeOrder: 3,
			content: '徐青把车票交给林墨，墙上的钟停在二十三点十七分。'
		}];
		const messages = buildTimelineAnalysisMessages({
			actionType: 'suggest-causality',
			instruction: '补全车站事件的因果链。',
			sources,
			existingEvents: [{
				id: 'timeline-event:arrival',
				title: '抵达旧站',
				aliases: [],
				revision: 1
			}],
			characters: [{ id: 'character:lin-mo', title: '林墨', revision: 1 }],
			locations: [{ id: 'location:old-station', title: '旧车站', revision: 1 }],
			items: [{ id: 'item:faded-ticket', title: '褪色车票', revision: 1 }],
			plotThreads: [{ id: 'plot-thread:notebook', title: '遗失笔记', revision: 1 }],
			foreshadowing: [{ id: 'foreshadowing:clock', title: '停摆时钟', revision: 1 }]
		});
		expect(messages[0]?.content).toBe(TIMELINE_ANALYSIS_SYSTEM_PROMPT);
		const candidate = {
			clientCandidateId: 'candidate:ticket-transfer',
			sourceResourceId: 'chapter:one',
			title: '车票转交',
			aliases: [],
			summary: '徐青把褪色车票交给林墨。',
			eventType: '线索交接',
			storyTimeKind: 'unknown',
			storyStart: null,
			storyEnd: null,
			narrativeOrder: 3,
			participantIds: ['character:lin-mo'],
			locationIds: ['location:old-station'],
			itemIds: ['item:faded-ticket'],
			predecessorIds: ['timeline-event:arrival'],
			consequenceIds: [],
			plotThreadIds: ['plot-thread:notebook'],
			foreshadowingIds: ['foreshadowing:clock'],
			directResults: ['林墨取得车票'],
			impacts: ['调查转向票面时间'],
			confidence: 0.96,
			rationale: '正文行动明确。',
			evidence: { start: 0, end: 9, quote: '徐青把车票交给林墨' }
		};
		const parsed = parseTimelineAnalysisResponse(JSON.stringify({
			candidates: [candidate],
			causalEdges: [{
				clientEdgeId: 'edge:arrival-transfer',
				from: { kind: 'existing', id: 'timeline-event:arrival' },
				to: { kind: 'candidate', id: 'candidate:ticket-transfer' },
				relation: 'enables',
				confidence: 0.9,
				rationale: '到站后才发生交接。'
			}]
		}), 'suggest-causality', {
			sourceIds: new Set(['chapter:one']),
			eventIds: new Set(['timeline-event:arrival']),
			characterIds: new Set(['character:lin-mo']),
			locationIds: new Set(['location:old-station']),
			itemIds: new Set(['item:faded-ticket']),
			plotThreadIds: new Set(['plot-thread:notebook']),
			foreshadowingIds: new Set(['foreshadowing:clock'])
		});
		expect(parsed.causalEdges).toHaveLength(1);
		expect(() => parseTimelineAnalysisResponse(JSON.stringify({
			candidates: [{ ...candidate, evidence: null }],
			causalEdges: []
		}), 'extract-events')).toThrow('invalidTimelineAnalysisResponse');
	});

	it('keeps plot author secrets opt-in and validates typed plot candidates', () => {
		const common = {
			sources: [{
				resourceId: 'chapter:one',
				sourceRevision: '7',
				narrativeOrder: 3,
				content: '墙上的钟停在二十三点十七分。'
			}],
			plotThreads: [{
				id: 'plot-thread:notebook',
				title: '遗失笔记',
				aliases: [],
				status: 'active',
				revision: 1
			}],
			characters: [{ id: 'character:lin-mo', title: '林墨', revision: 1 }],
			scenes: [{ id: 'scene:station', title: '车站相遇', revision: 1 }]
		};
		const messages = buildPlotAnalysisMessages({
			...common,
			actionType: 'generate-foreshadowing',
			instruction: '生成一个受控伏笔。',
			includeAuthorSecrets: false,
			foreshadowing: [{
				id: 'foreshadowing:clock',
				title: '停摆时钟',
				aliases: [],
				status: 'planted',
				surfaceMeaning: '旧钟故障',
				revision: 1
			}]
		});
		expect(messages[0]?.content).toBe(PLOT_ANALYSIS_SYSTEM_PROMPT);
		expect(messages[1]?.content).not.toContain('列车事故真相');
		expect(() => buildPlotAnalysisMessages({
			...common,
			actionType: 'generate-foreshadowing',
			instruction: '生成一个受控伏笔。',
			includeAuthorSecrets: false,
			foreshadowing: [{
				id: 'foreshadowing:clock',
				title: '停摆时钟',
				aliases: [],
				status: 'planted',
				trueMeaning: '列车事故真相',
				revision: 1
			}]
		})).toThrow('invalidPlotAnalysisInput');
		expect(parsePlotAnalysisResponse(JSON.stringify({
			candidates: [{
				kind: 'foreshadowing',
				sourceResourceId: 'chapter:one',
				title: '停摆时钟',
				aliases: [],
				summary: '时钟反复指向同一时刻。',
				status: 'planted',
				plantedAt: { chapterId: 'chapter:one', narrativeOrder: 3 },
				surfaceMeaning: '旧钟故障',
				trueMeaning: null,
				reminderPositions: [],
				plannedPayoffAt: null,
				actualPayoffAt: null,
				readerVisibility: 0.35,
				plotThreadIds: ['plot-thread:notebook'],
				confidence: 0.94,
				rationale: '正文明确出现异常。',
				evidence: { start: 0, end: 14, quote: '墙上的钟停在二十三点十七分' }
			}]
		}), 'extract-foreshadowing', {
			sourceIds: new Set(['chapter:one']),
			plotThreadIds: new Set(['plot-thread:notebook'])
		})).toHaveLength(1);
	});

	it('builds a JSON-only story extraction request without auto-confirming facts', () => {
		const messages = buildStoryExtractionMessages({
			content: '沈青把铜钥匙交给林越。',
			resourceId: 'chapter:one',
			sourceRevision: '7'
		});
		expect(messages[0]?.content).toBe(STORY_EXTRACTION_SYSTEM_PROMPT);
		expect(messages[1]?.content).not.toContain('projectRoot');
		expect(parseStoryExtractionResponse(JSON.stringify({
			facts: [{
				factType: 'item-state',
				title: '铜钥匙转移',
				statement: '铜钥匙由沈青交给林越。',
				confidence: 0.98,
				start: 0,
				end: 12,
				quote: '沈青把铜钥匙交给林越。'
			}]
		}))).toHaveLength(1);
		expect(() => buildStoryExtractionMessages({
			content: '',
			resourceId: 'chapter:one',
			sourceRevision: '7'
		})).toThrow('invalidStoryExtractionInput');
	});

	it('builds and validates complete Story Kernel generation candidates', () => {
		const messages = buildStoryKernelGenerationMessages({
			instruction: '根据正文创建人物和地点。',
			content: '林越在旧车站等候沈青。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			targetTypes: ['character', 'location'],
			existingResources: [{
				id: 'character:shen-qing',
				type: 'character',
				title: '沈青',
				revision: 2
			}]
		});
		expect(messages[0]?.content).toBe(STORY_KERNEL_GENERATION_SYSTEM_PROMPT);
		expect(messages[0]?.content).toContain('readerVisibility 必须是 0 到 1 之间的数字');
		expect(messages[0]?.content).toContain('禁止返回 hidden/public 等文字');
		expect(messages[1]?.content).not.toContain('projectRoot');
		const [candidate] = parseStoryKernelGenerationResponse(JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'character:lin-yue',
					type: 'character',
					title: '林越',
					aliases: [],
					tags: [],
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: [],
					evidenceIds: []
				},
				confidence: 0.94,
				rationale: '正文明确出现。',
				evidence: { start: 0, end: 2, quote: '林越' }
			}]
		}));
		expect(candidate).toMatchObject({
			operation: 'create',
			resource: { id: 'character:lin-yue', type: 'character' }
		});

		expect(() => parseStoryKernelGenerationResponse(JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'character:lin-yue',
					type: 'character',
					title: '林越',
					aliases: [],
					tags: [],
					evidenceIds: [],
					revision: 99
				},
				confidence: 1,
				rationale: '越权版本。',
				evidence: null
			}]
		}))).toThrow();
		expect(() => buildStoryKernelGenerationMessages({
			instruction: '读取 projectRoot 后生成。',
			content: '林越。',
			resourceId: 'chapter:one',
			sourceRevision: '7',
			targetTypes: ['character'],
			existingResources: []
		})).toThrow('invalidStoryKernelGenerationInput');
	});

	it('bounds a materialized chapter plan and parses evidence-backed reconciliation', () => {
		const messages = buildStoryKernelGenerationMessages({
			instruction: '整理本章并提取有正文依据的资料。',
			content: '画师只展示了车票，没有把它交给林越。',
			resourceId: 'chapter:chapter-one',
			sourceRevision: 'hash:chapter-one',
			targetTypes: ['timelineEvent', 'item'],
			existingResources: [],
			chapterPlan: {
				nodeId: 'journey-outline:chapter-one',
				revision: 4,
				locked: false,
				title: '取得褪色车票',
				summary: '林越从画师手中取得褪色车票。',
				goal: '取得车票',
				conflict: '画师拒绝交谈',
				outcome: '林越获得车票',
				hook: '车票背面出现失踪者名字'
			}
		});
		const payload = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;
		expect(payload.chapterPlan).toMatchObject({
			nodeId: 'journey-outline:chapter-one',
			revision: 4,
			locked: false
		});
		expect(messages[1]?.content).not.toMatch(/projectRoot|apiKey|authorSecret/iu);

		const parsed = parseStoryKernelGenerationResponseWithDiagnostics(JSON.stringify({
			candidates: [],
			reconciliation: {
				actual: {
					summary: '画师展示车票，但没有交给林越。',
					goal: '取得车票',
					conflict: '画师拒绝交出车票',
					outcome: '林越只看到了车票',
					hook: '车票仍留在画师手中'
				},
				differences: [{
					field: 'outcome',
					planned: '林越获得车票',
					actual: '林越只看到了车票',
					evidence: {
						start: 0,
						end: 20,
						quote: '画师只展示了车票，没有把它交给林越。'
					}
				}]
			}
		}));
		expect(parsed.reconciliation?.differences).toHaveLength(1);
		expect(parsed.reconciliation?.differences[0]).toMatchObject({
			field: 'outcome',
			actual: '林越只看到了车票'
		});

		expect(() => buildStoryKernelGenerationMessages({
			instruction: '整理本章。',
			content: '正文。',
			resourceId: 'chapter:chapter-one',
			sourceRevision: 'hash:chapter-one',
			targetTypes: ['timelineEvent'],
			existingResources: [],
			chapterPlan: {
				nodeId: 'journey-outline:chapter-one',
				revision: 4,
				locked: false,
				title: '标题',
				summary: '包含 apiKey 的越界计划',
				goal: '',
				conflict: '',
				outcome: '',
				hook: ''
			}
		})).toThrow('invalidStoryKernelGenerationInput');
	});

	it('repairs omitted common empty arrays and isolates only malformed candidates', () => {
		const result = parseStoryKernelGenerationResponseWithDiagnostics(JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'character:lin-yue',
					type: 'character',
					title: '林越',
					factionIds: [],
					goals: [],
					desires: [],
					fears: [],
					values: [],
					secrets: []
				},
				confidence: 0.94,
				rationale: '正文明确出现。',
				evidence: { start: 0, end: 2, quote: '林越' }
			}, {
				operation: 'create',
				resource: {
					id: 'location:old-station',
					type: 'location',
					title: null,
					aliases: [],
					tags: [],
					evidenceIds: []
				},
				confidence: 0.8,
				rationale: '第三方结构缺失。',
				evidence: null
			}]
		}));

		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]?.resource).toMatchObject({
			aliases: [],
			tags: [],
			evidenceIds: []
		});
		expect(result.diagnostics).toEqual([{
			candidateIndex: 1,
			path: 'candidates.1.resource',
			code: 'invalidStoryKernelGenerationResource'
		}]);
		expect(() => parseStoryKernelGenerationResponse(JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'location:old-station',
					type: 'location',
					title: null
				},
				confidence: 0.8,
				rationale: '缺少标题。',
				evidence: null
			}]
		}))).toThrow(
			'invalidStoryKernelGenerationResource:candidates.0.resource'
		);
	});

	it('repairs neutral Story Kernel type fields without overwriting explicit semantics', () => {
		const result = parseStoryKernelGenerationResponseWithDiagnostics(JSON.stringify({
			candidates: [{
				operation: 'create',
				resource: {
					id: 'item:blue-envelope',
					type: 'item',
					title: '蓝色信封',
					description: '一只等待开启的蓝色信封。'
				},
				confidence: 0.95,
				rationale: '正文明确出现物品。',
				evidence: null
			}, {
				operation: 'create',
				resource: {
					id: 'item:only-key',
					type: 'item',
					title: '唯一钥匙',
					unique: true,
					restrictions: ['不可复制']
				},
				confidence: 0.9,
				rationale: '正文明确说明只有一把。',
				evidence: null
			}, {
				operation: 'create',
				resource: {
					id: 'scene:quiet-room',
					type: 'scene',
					title: '静室'
				},
				confidence: 0.85,
				rationale: '正文形成一个场景。',
				evidence: null
			}, {
				operation: 'create',
				resource: {
					id: 'timeline-event:alarm',
					type: 'timelineEvent',
					title: '警报响起'
				},
				confidence: 0.82,
				rationale: '正文出现警报。',
				evidence: null
			}]
		}));

		expect(result.diagnostics).toEqual([]);
		expect(result.candidates[0]?.resource).toMatchObject({
			aliases: [],
			tags: [],
			evidenceIds: [],
			unique: false,
			restrictions: []
		});
		expect(result.candidates[1]?.resource).toMatchObject({
			unique: true,
			restrictions: ['不可复制']
		});
		expect(result.candidates[2]?.resource).toMatchObject({
			locationIds: [],
			participantIds: [],
			plotThreadIds: [],
			revealInformationIds: [],
			foreshadowingIds: []
		});
		expect(result.candidates[3]?.resource).toMatchObject({
			participantIds: [],
			locationIds: [],
			itemIds: [],
			predecessorIds: [],
			consequenceIds: []
		});
	});

	it('canonicalizes character role aliases and omits unknown optional text', () => {
		const roles: readonly unknown[] = [
			' 配角 ',
			'SUPPORTING_CHARACTER',
			'反派',
			'退休检修组长',
			42
		];
		const result = parseStoryKernelGenerationResponseWithDiagnostics(JSON.stringify({
			candidates: roles.map((role, index) => ({
				operation: 'create',
				resource: {
					id: `character:role-${index}`,
					type: 'character',
					title: `人物 ${index}`,
					role
				},
				confidence: 0.9,
				rationale: '正文明确出现人物。',
				evidence: null
			}))
		}));

		expect(result.diagnostics).toEqual([]);
		expect(result.candidates.map(candidate => candidate.resource.role)).toEqual([
			'supporting',
			'supporting',
			'antagonist',
			undefined,
			42
		]);
	});

	it('unwraps fenced Story Kernel transport output without weakening resource validation', () => {
		const result = parseStoryKernelGenerationResponseWithDiagnostics([
			'```json',
			JSON.stringify({
				result: {
					candidate: {
						operation: 'create',
						resource: {
							id: 'location:old-station-roof',
							type: 'location',
							title: '旧车站玻璃顶',
							travelLinks: [],
							factionIds: [],
							rules: []
						},
						confidence: 0.9,
						rationale: '原文明确出现地点。',
						evidence: null
					}
				}
			}),
			'```'
		].join('\n'));

		expect(result.diagnostics).toEqual([]);
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]?.resource).toMatchObject({
			id: 'location:old-station-roof',
			aliases: [],
			tags: [],
			evidenceIds: []
		});

		expect(() => parseStoryKernelGenerationResponse(
			'```json\n{"result":{"candidate":{"operation":"create","resource":{"id":"location:bad","type":"location","title":null},"confidence":0.9,"rationale":"缺少标题。","evidence":null}}}\n```'
		)).toThrow('invalidStoryKernelGenerationResource');
	});
});

describe('story consistency analysis contract', () => {
	const firstContent = '林墨在雨夜抵达旧站，墙上的时钟停在二十三点十七分。';
	const secondContent = '清晨的港口记录写着：林墨整夜未曾离开码头。';
	const sources = [{
		resourceId: 'chapter:chapter-0001',
		sourceRevision: 'hash:one',
		content: firstContent
	}, {
		resourceId: 'chapter:chapter-0002',
		sourceRevision: 'hash:two',
		content: secondContent
	}];
	const storyFacts = [{
		resourceId: 'timeline-event:arrival',
		title: '抵达旧站',
		statement: '林墨在雨夜抵达旧站。'
	}];

	it('builds a bounded two-source request without accepting secret-shaped fields', () => {
		const messages = buildStoryConsistencyAnalysisMessages({
			instruction: '对照人物位置和时间。',
			sources,
			storyFacts
		});
		expect(messages[0]?.content).toBe(STORY_CONSISTENCY_ANALYSIS_SYSTEM_PROMPT);
		const payload = JSON.parse(messages[1]?.content ?? '{}') as {
			sources: readonly unknown[];
		};
		expect(payload.sources).toHaveLength(2);
		expect(() => buildStoryConsistencyAnalysisMessages({
			instruction: '对照人物位置和时间。',
			sources,
			storyFacts: [{
				...storyFacts[0],
				authorSecret: true
			} as never]
		})).toThrow('invalidStoryConsistencyAnalysisInput');
	});

	it('creates warning-capped ReviewIssues with evidence A/B and Story Fact', () => {
		const firstQuote = '林墨在雨夜抵达旧站';
		const secondQuote = '林墨整夜未曾离开码头';
		const issues = parseStoryConsistencyAnalysisResponse({
			projectId: 'project:test',
			sources,
			storyFacts,
			response: JSON.stringify({
				issues: [{
					ruleId: 'ai-location-conflict',
					severity: 'error',
					title: '人物位置可能冲突',
					message: '两个章节对同一时段的位置描述不一致，需要作者确认。',
					evidence: [{
						resourceId: sources[0].resourceId,
						start: firstContent.indexOf(firstQuote),
						end: firstContent.indexOf(firstQuote) + firstQuote.length,
						quote: firstQuote,
						label: '证据 A'
					}, {
						resourceId: sources[1].resourceId,
						start: secondContent.indexOf(secondQuote),
						end: secondContent.indexOf(secondQuote) + secondQuote.length,
						quote: secondQuote,
						label: '证据 B'
					}],
					storyFact: storyFacts[0]
				}]
			})
		});

		expect(issues[0]).toMatchObject({
			severity: 'warning',
			origin: 'ai',
			relatedEvidence: [{ label: '证据 A' }, { label: '证据 B' }],
			storyFact: { title: '抵达旧站' }
		});
		expect(issues[0]?.replacement).toBeUndefined();
	});

	it('rejects non-exact, duplicate, or unknown evidence and facts', () => {
		const response = (secondQuote: string, factId = storyFacts[0].resourceId) => JSON.stringify({
			issues: [{
				ruleId: 'ai-location-conflict',
				severity: 'warning',
				title: '人物位置可能冲突',
				message: '需要作者确认。',
				evidence: [{
					resourceId: sources[0].resourceId,
					start: 0,
					end: 2,
					quote: '林墨',
					label: '证据 A'
				}, {
					resourceId: sources[1].resourceId,
					start: 0,
					end: secondQuote.length,
					quote: secondQuote,
					label: '证据 B'
				}],
				storyFact: { ...storyFacts[0], resourceId: factId }
			}]
		});
		expect(() => parseStoryConsistencyAnalysisResponse({
			projectId: 'project:test',
			sources,
			storyFacts,
			response: response('不存在的引文')
		})).toThrow('invalidStoryConsistencyEvidence');
		expect(() => parseStoryConsistencyAnalysisResponse({
			projectId: 'project:test',
			sources,
			storyFacts,
			response: response('清晨', 'timeline-event:unknown')
		})).toThrow('unknownStoryConsistencyFact');
	});
});
