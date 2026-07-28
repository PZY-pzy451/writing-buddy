import type { StoryConsistencyFactInput } from '@writing-buddy/ai';
import {
	storyResourceTypes,
	type StoryRepository,
	type StoryResource
} from '@writing-buddy/story-kernel';
import type { ReviewIssue } from '@writing-buddy/review';

const factResourceTypes = storyResourceTypes.filter(type => type !== 'chapter');

function compact(parts: readonly (string | undefined)[]): string | undefined {
	const statement = parts
		.map(part => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join('；')
		.slice(0, 4_000);
	return statement || undefined;
}

function statementFor(resource: StoryResource): string | undefined {
	switch (resource.type) {
		case 'chapter':
			return undefined;
		case 'character':
			return compact([
				resource.summary,
				resource.appearance,
				resource.occupation ? `职业：${resource.occupation}` : undefined,
				resource.goals.length ? `目标：${resource.goals.join('、')}` : undefined,
				resource.values.length ? `价值观：${resource.values.join('、')}` : undefined,
				resource.speechStyle ? `语言风格：${resource.speechStyle}` : undefined
			]);
		case 'scene':
			return compact([
				resource.summary,
				resource.goal ? `目标：${resource.goal}` : undefined,
				resource.conflict ? `冲突：${resource.conflict}` : undefined,
				resource.outcome ? `结果：${resource.outcome}` : undefined
			]);
		case 'location':
			return compact([
				resource.summary,
				resource.locationType ? `类型：${resource.locationType}` : undefined,
				resource.rules.length ? `规则：${resource.rules.join('、')}` : undefined
			]);
		case 'faction':
			return compact([
				resource.summary,
				resource.ideology ? `理念：${resource.ideology}` : undefined,
				resource.goals.length ? `目标：${resource.goals.join('、')}` : undefined
			]);
		case 'item':
			return compact([
				resource.summary,
				resource.description,
				resource.plotFunction ? `剧情作用：${resource.plotFunction}` : undefined,
				resource.restrictions.length ? `限制：${resource.restrictions.join('、')}` : undefined
			]);
		case 'worldRule':
			return compact([
				resource.statement,
				resource.summary,
				resource.scope ? `范围：${resource.scope}` : undefined,
				resource.exceptions.length ? `例外：${resource.exceptions.join('、')}` : undefined,
				resource.consequences.length ? `后果：${resource.consequences.join('、')}` : undefined
			]);
		case 'timelineEvent':
			return compact([
				resource.summary,
				`事件类型：${resource.eventType}`,
				resource.storyStart ? `开始：${resource.storyStart}` : undefined,
				resource.storyEnd ? `结束：${resource.storyEnd}` : undefined,
				resource.directResults.length ? `直接结果：${resource.directResults.join('、')}` : undefined,
				resource.impacts.length ? `影响：${resource.impacts.join('、')}` : undefined
			]);
		case 'relationship':
			if (resource.visibility === 'secret') return undefined;
			return compact([
				resource.summary,
				`关系：${resource.relationshipType}`,
				resource.description
			]);
		case 'plotThread':
			return compact([
				resource.summary,
				resource.premise,
				resource.stakes ? `风险：${resource.stakes}` : undefined,
				resource.dramaticQuestion ? `戏剧问题：${resource.dramaticQuestion}` : undefined
			]);
		case 'foreshadowing':
			// The hidden trueMeaning is deliberately excluded from the AI-safe fact.
			return compact([resource.summary, resource.surfaceMeaning]);
		case 'information':
			if (resource.authorSecret || resource.excludeFromAiByDefault) return undefined;
			return compact([resource.summary, resource.truthStatement]);
	}
}

export async function loadSafeStoryConsistencyFacts(
	repository: StoryRepository
): Promise<readonly StoryConsistencyFactInput[]> {
	const facts: StoryConsistencyFactInput[] = [];
	for (const type of factResourceTypes) {
		const resources = await repository.list(type);
		for (const resource of resources) {
			if (facts.length >= 500) return facts;
			const statement = statementFor(resource);
			if (!statement) continue;
			facts.push({
				resourceId: resource.id,
				title: resource.title,
				statement
			});
		}
	}
	return facts;
}

export function replaceStoryConsistencyIssues(
	current: readonly ReviewIssue[],
	next: readonly ReviewIssue[]
): readonly ReviewIssue[] {
	return [
		...current.filter(issue => !issue.id.startsWith('ai-continuity:')),
		...next
	];
}
