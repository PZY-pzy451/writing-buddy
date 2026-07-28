import {
	CHAPTER_REVIEW_SYSTEM_PROMPT,
	STORYFORGE_SYSTEM_PROMPT
} from '@writing-buddy/ai';
import {
	PromptRegistry,
	createConsistencyReviewPromptTemplate,
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
});
