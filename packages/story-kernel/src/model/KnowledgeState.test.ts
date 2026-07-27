import { describe, expect, it } from 'vitest';
import { getKnowledgeAt, parseKnowledgeState } from './KnowledgeState';

const states = [
	parseKnowledgeState({
		id: 'knowledge-state:lin-before',
		informationId: 'information:clock',
		subject: 'character:lin',
		status: 'unknown',
		effectiveFrom: { chapterId: 'chapter:one', narrativeOrder: 1 },
		effectiveUntil: { chapterId: 'chapter:three', narrativeOrder: 8 },
		evidenceIds: [],
		confirmation: 'confirmed',
		revision: 0
	}),
	parseKnowledgeState({
		id: 'knowledge-state:lin-after',
		informationId: 'information:clock',
		subject: 'character:lin',
		status: 'knows',
		effectiveFrom: { chapterId: 'chapter:three', narrativeOrder: 8 },
		evidenceIds: ['evidence:clock-note'],
		confirmation: 'confirmed',
		revision: 0
	})
];

describe('knowledge time slices', () => {
	it('resolves character knowledge at the requested narrative chapter', () => {
		expect(getKnowledgeAt(states, 'information:clock', 'character:lin', 3)?.status).toBe('unknown');
		expect(getKnowledgeAt(states, 'information:clock', 'character:lin', 8)?.status).toBe('knows');
	});

	it('does not leak a future knowledge state into an earlier slice', () => {
		expect(getKnowledgeAt(states, 'information:clock', 'character:lin', 0)).toBeUndefined();
	});
});
