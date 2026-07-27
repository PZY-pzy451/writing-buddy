import { describe, expect, it } from 'vitest';
import {
	buildContextPack,
	serializeContextPackForAi,
	withContextItemIncluded,
	type ContextPackRequest
} from './ContextPackBuilder';

const baseRequest: ContextPackRequest = {
	actionType: 'polish',
	instruction: '保持人物语气，只润色当前选区。',
	selection: {
		text: '雨落在旧站的铁轨上。',
		resourceId: 'chapter:one',
		revision: 3,
		start: 12,
		end: 23
	},
	candidates: [],
	budgetTokens: 512
};

describe('ContextPackBuilder', () => {
	it('sorts deterministically, deduplicates resources and excludes author secrets by default', () => {
		const pack = buildContextPack({
			...baseRequest,
			candidates: [{
				id: 'context:plot',
				priority: 'P5',
				kind: 'plot-thread',
				title: '遗失笔记',
				content: '林墨正在寻找笔记。',
				resourceId: 'plot-thread:notebook'
			}, {
				id: 'context:character',
				priority: 'P3',
				kind: 'character',
				title: '林墨',
				content: '当前警觉，目标是找回笔记。',
				resourceId: 'character:lin'
			}, {
				id: 'context:character-duplicate',
				priority: 'P3',
				kind: 'character',
				title: '重复人物',
				content: '不应出现。',
				resourceId: 'character:lin'
			}, {
				id: 'context:secret',
				priority: 'P5',
				kind: 'information',
				title: '作者秘密',
				content: '沈青知道事故真相。',
				resourceId: 'information:secret',
				authorSecret: true
			}]
		});
		expect(pack.items.map(item => item.priority)).toEqual(['P0', 'P1', 'P3', 'P5', 'P5']);
		expect(pack.items.find(item => item.id === 'context:secret')).toMatchObject({
			included: false,
			excludedReason: 'author-secret'
		});
		expect(pack.items.some(item => item.id === 'context:character-duplicate')).toBe(false);
	});

	it('trims from P6 upward while preserving P0 and P1', () => {
		const pack = buildContextPack({
			...baseRequest,
			budgetTokens: 256,
			candidates: Array.from({ length: 8 }, (_, index) => ({
				id: `context:summary-${index}`,
				priority: 'P6' as const,
				kind: 'adjacent-summary' as const,
				title: `相邻摘要 ${index}`,
				content: '相邻章节摘要内容。'.repeat(35),
				resourceId: `chapter:adjacent-${index}`
			}))
		});
		expect(pack.items.find(item => item.priority === 'P0')?.included).toBe(true);
		expect(pack.items.find(item => item.priority === 'P1')?.included).toBe(true);
		expect(pack.items.filter(item => item.excludedReason === 'token-budget').length).toBeGreaterThan(0);
		expect(pack.estimatedTokens).toBeLessThanOrEqual(pack.budgetTokens);
	});

	it('serializes only explicitly included content without paths, keys or excluded secrets', () => {
		const pack = buildContextPack({
			...baseRequest,
			candidates: [{
				id: 'context:secret',
				priority: 'P5',
				kind: 'information',
				title: '秘密',
				content: '不得默认发送',
				authorSecret: true
			}]
		});
		const serialized = serializeContextPackForAi(pack);
		expect(serialized).not.toContain('不得默认发送');
		expect(serialized).not.toContain('projectRoot');
		expect(serialized).not.toContain('apiKey');
		const optedIn = withContextItemIncluded(pack, 'context:secret', true);
		expect(serializeContextPackForAi(optedIn)).toContain('不得默认发送');
	});

	it('rejects an adjacent full-chapter-sized candidate', () => {
		expect(() => buildContextPack({
			...baseRequest,
			candidates: [{
				id: 'context:full-chapter',
				priority: 'P6',
				kind: 'adjacent-summary',
				title: '错误整章',
				content: '正文'.repeat(700)
			}]
		})).toThrow('contextItemTooLarge');
	});
});
