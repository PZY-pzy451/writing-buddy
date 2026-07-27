import { z } from 'zod';
import type { AiActionDefinition } from '../action/AiActionDefinition';
import {
	buildAiContextPack,
	serializeAiContextPackForAi,
	withAiContextRecordIncluded
} from './AiContextBuilder';

function action(maximumTokens = 500): AiActionDefinition {
	return {
		id: 'character.generateProfile',
		title: '生成人物档案',
		description: 'test',
		category: 'character',
		availability: () => ({ available: true }),
		inputSchema: z.object({}),
		outputSchema: z.object({}),
		outputSchemaName: 'CharacterCandidate',
		outputSchemaVersion: 1,
		contextPolicy: {
			requiredKinds: ['project'],
			optionalKinds: ['current-resource', 'entity', 'world-rule'],
			maximumTokens
		},
		applyPolicy: { type: 'create_resources', selectableItems: true },
		promptTemplateId: 'character.generateProfile',
		defaultModelClass: 'reasoning'
	};
}

describe('buildAiContextPack', () => {
	it('builds minimum context and explains missing optional sources', () => {
		const pack = buildAiContextPack(action(), {
			project: { id: 'project-1', title: '阴间旅店', summary: '悬疑长篇' }
		});

		expect(pack.project).toMatchObject({ required: true, included: true });
		expect(pack.entities).toEqual([]);
		expect(pack.exclusions).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'entity:missing', reason: 'missing-source' }),
			expect.objectContaining({ key: 'world-rule:missing', reason: 'missing-source' })
		]));
	});

	it('keeps author secrets visible for consent but excludes them by default', () => {
		const pack = buildAiContextPack(action(), {
			project: { id: 'project-1', title: '作品', summary: '悬疑长篇' },
			entities: [{
				id: 'character:secret',
				title: '真实身份',
				summary: '画师就是失踪的继承人',
				authorSecret: true
			}]
		});

		expect(pack.entities[0]).toMatchObject({
			authorSecret: true,
			included: false
		});
		expect(serializeAiContextPackForAi(pack)).not.toContain('失踪的继承人');
		const consented = withAiContextRecordIncluded(pack, 'entity:character:secret', true);
		expect(serializeAiContextPackForAi(consented)).toContain('失踪的继承人');
	});

	it('redacts local paths and trims optional context to the token budget', () => {
		const pack = buildAiContextPack(action(20), {
			project: { id: 'project-1', title: '作品', summary: 'D:\\authors\\secret\\novel' },
			entities: [
				{ id: 'character:1', title: '人物一', summary: '甲'.repeat(40) },
				{ id: 'character:2', title: '人物二', summary: '乙'.repeat(40) }
			]
		});

		expect(pack.project?.summary).toContain('[本地路径已省略]');
		expect(pack.entities.some(entity => !entity.included)).toBe(true);
		expect(pack.exclusions.some(exclusion => exclusion.reason === 'token-budget')).toBe(true);
		expect(pack.tokenEstimate).toBeLessThanOrEqual(pack.budgetTokens);
	});
});
