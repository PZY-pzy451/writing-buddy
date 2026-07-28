import { describe, expect, it } from 'vitest';
import type {
	StoryRepository,
	StoryResource,
	StoryResourceType
} from '@writing-buddy/story-kernel';
import type { ReviewIssue } from '@writing-buddy/review';
import {
	loadSafeStoryConsistencyFacts,
	replaceStoryConsistencyIssues
} from './StoryConsistencyReviewService';

describe('StoryConsistencyReviewService', () => {
	it('builds bounded Story Facts without author secrets or hidden meanings', async () => {
		const resources: Partial<Record<StoryResourceType, readonly StoryResource[]>> = {
			character: [{
				type: 'character',
				id: 'character:keeper',
				title: '守门人',
				summary: '负责守卫旧站。',
				appearance: undefined,
				occupation: '管理员',
				goals: ['保持秩序'],
				values: ['承诺'],
				speechStyle: undefined,
				secrets: ['SECRET_CHARACTER_TRUTH']
			} as unknown as StoryResource],
			foreshadowing: [{
				type: 'foreshadowing',
				id: 'foreshadowing:clock',
				title: '停摆的时钟',
				summary: '表面看似机械故障。',
				surfaceMeaning: '时钟在雨夜停摆。',
				trueMeaning: 'SECRET_FORESHADOWING_TRUTH'
			} as unknown as StoryResource],
			information: [{
				type: 'information',
				id: 'information:private',
				title: '隐藏真相',
				summary: 'SECRET_INFORMATION_SUMMARY',
				truthStatement: 'SECRET_INFORMATION_TRUTH',
				authorSecret: true,
				excludeFromAiByDefault: true
			}, {
				type: 'information',
				id: 'information:public',
				title: '公开事实',
				summary: '读者已经知道。',
				truthStatement: '旧站在七年前停运。',
				authorSecret: false,
				excludeFromAiByDefault: false
			}] as unknown as readonly StoryResource[],
			relationship: [{
				type: 'relationship',
				id: 'relationship:hidden',
				title: '隐藏关系',
				visibility: 'secret',
				relationshipType: '保护',
				description: 'SECRET_RELATIONSHIP'
			} as unknown as StoryResource]
		};
		const repository = {
			list: (type: StoryResourceType) => Promise.resolve(resources[type] ?? [])
		} as unknown as StoryRepository;

		const facts = await loadSafeStoryConsistencyFacts(repository);
		const serialized = JSON.stringify(facts);

		expect(facts.map(fact => fact.resourceId)).toContain('information:public');
		expect(facts.map(fact => fact.resourceId)).not.toContain('information:private');
		expect(facts.map(fact => fact.resourceId)).not.toContain('relationship:hidden');
		expect(serialized).not.toMatch(/SECRET_/u);
		expect(facts.find(fact => fact.resourceId === 'foreshadowing:clock')?.statement)
			.toContain('时钟在雨夜停摆');
	});

	it('replaces only earlier cross-chapter AI findings', () => {
		const issue = (id: string): ReviewIssue => ({ id } as ReviewIssue);
		expect(replaceStoryConsistencyIssues(
			[issue('text:one'), issue('ai-continuity:old'), issue('chapter-ai:two')],
			[issue('ai-continuity:new')]
		).map(candidate => candidate.id)).toEqual([
			'text:one',
			'chapter-ai:two',
			'ai-continuity:new'
		]);
	});
});
