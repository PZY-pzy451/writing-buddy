import {
	AiProviderRegistry,
	DEFAULT_AI_PREFERENCES,
	aggregateAiUsage,
	buildChapterReviewMessages,
	buildCharacterAnalysisMessages,
	buildManuscriptContinuationMessages,
	buildRelationshipAnalysisMessages,
	buildScenePlanMessages,
	buildSelectionRewriteMessages,
	buildStoryExtractionMessages,
	buildStoryKernelGenerationMessages,
	canQueueAiJob,
	chooseDefaultModel,
	createDeepSeekProviderDefinition,
	nextAiJobState,
	normalizeAiPreferences,
	parseChapterReviewResponse,
	parseCharacterAnalysisResponse,
	parseManuscriptContinuationResponse,
	parseRelationshipAnalysisResponse,
	parseScenePlanResponse,
	parseSelectionRewriteResponse,
	parseStoryExtractionResponse,
	parseStoryKernelGenerationResponse,
	SELECTION_REWRITE_SYSTEM_PROMPT,
	CHARACTER_ANALYSIS_SYSTEM_PROMPT,
	MANUSCRIPT_CONTINUATION_SYSTEM_PROMPT,
	RELATIONSHIP_ANALYSIS_SYSTEM_PROMPT,
	SCENE_PLAN_SYSTEM_PROMPT,
	STORY_EXTRACTION_SYSTEM_PROMPT,
	STORY_KERNEL_GENERATION_SYSTEM_PROMPT,
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
});
