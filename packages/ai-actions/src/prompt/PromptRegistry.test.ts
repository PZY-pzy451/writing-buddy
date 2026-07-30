import {
	CHAPTER_REVIEW_SYSTEM_PROMPT,
	CREATION_JOURNEY_SYSTEM_PROMPT,
	STORYFORGE_SYSTEM_PROMPT
} from '@writing-buddy/ai';
import {
	PromptRegistry,
	createConsistencyReviewPromptTemplate,
	createDefaultPromptRegistry,
	createGenreOutlinePromptTemplate,
	createOutlineAuthorControlPromptTemplate,
	createPlaygroundPromptTemplate
} from './PromptRegistry';

describe('PromptRegistry', () => {
	it('resolves an explicit version and the latest registered version', () => {
		const registry = new PromptRegistry();
		const first = createPlaygroundPromptTemplate();
		registry.register(first);
		registry.register({ ...first, version: 2 });

		expect(registry.get(first.id, 1).version).toBe(1);
		expect(registry.get(first.id).version).toBe(2);
		expect(registry.get(first.id).buildSystemPrompt(undefined))
			.toBe(STORYFORGE_SYSTEM_PROMPT);
	});

	it('rejects missing templates and duplicate versions', () => {
		const registry = new PromptRegistry();
		const template = createPlaygroundPromptTemplate();
		registry.register(template);

		expect(() => registry.register(template))
			.toThrow('promptVersionAlreadyRegistered:storyforge.playground:1');
		expect(() => registry.get('missing')).toThrow('promptTemplateNotFound:missing');
		expect(() => registry.get(template.id, 3))
			.toThrow('promptVersionNotFound:storyforge.playground:3');
	});

	it('returns metadata without prompt bodies or builder functions', () => {
		const registry = new PromptRegistry();
		registry.register(createPlaygroundPromptTemplate());
		const metadata = registry.metadata('storyforge.playground');

		expect(metadata).toEqual({
			id: 'storyforge.playground',
			version: 1,
			schemaVersion: 1,
			outputSchemaName: 'PlainText'
		});
		expect(JSON.stringify(metadata)).not.toContain(STORYFORGE_SYSTEM_PROMPT);
		expect(JSON.stringify(metadata)).not.toContain('buildSystemPrompt');
	});

	it('keeps the existing chapter-review system contract byte-for-byte', () => {
		const template = createConsistencyReviewPromptTemplate();
		expect(template.buildSystemPrompt(undefined)).toBe(CHAPTER_REVIEW_SYSTEM_PROMPT);
		expect(template.buildUserPrompt(undefined, {
			actionId: 'review.consistency',
			currentResource: {
				key: 'current-resource:chapter-1',
				kind: 'current-resource',
				title: '第一章',
				summary: '桥下的雾缓慢散开。',
				resourceId: 'chapter-1',
				required: true,
				included: true,
				authorSecret: false,
				tokenEstimate: 8
			},
			entities: [],
			events: [],
			plotThreads: [],
			foreshadowing: [],
			worldRules: [],
			knowledgeRules: [],
			exclusions: [],
			tokenEstimate: 8,
			budgetTokens: 12_000
		})).toBe(JSON.stringify({
			schemaVersion: 1,
			content: '桥下的雾缓慢散开。'
		}));
	});

	it('registers the bounded genre-to-outline prompt on the existing registry', () => {
		const registry = createDefaultPromptRegistry();
		const template = createGenreOutlinePromptTemplate();
		const input = {
			genre: '都市悬疑',
			tones: ['克制'],
			protagonistHints: [],
			requiredElements: [],
			excludedElements: ['超能力']
		};

		expect(registry.get(template.id)).toBeDefined();
		expect(template.buildSystemPrompt(input)).toBe(CREATION_JOURNEY_SYSTEM_PROMPT);
		expect(JSON.parse(template.buildUserPrompt(input, {} as never))).toEqual({
			schemaVersion: 1,
			operation: 'generate-from-genre',
			...input
		});
		expect(template.outputSchemaName).toBe('GenerateOutlineResult');
	});

	it('registers the strict three-candidate outline author-control prompt', () => {
		const registry = createDefaultPromptRegistry();
		const template = createOutlineAuthorControlPromptTemplate();
		const input = {
			strategy: 'balanced',
			target: { id: 'journey-outline:node-1' },
			guidanceAnswers: [],
			lockedDecisions: []
		};
		expect(registry.get(template.id)).toBeDefined();
		expect(template.buildSystemPrompt(input)).toBe(CREATION_JOURNEY_SYSTEM_PROMPT);
		expect(JSON.parse(template.buildUserPrompt(input, {} as never))).toEqual({
			schemaVersion: 1,
			operation: 'generate-outline-alternatives',
			...input
		});
		expect(template.outputSchemaName).toBe('OutlineAlternativesResult');
	});
});
