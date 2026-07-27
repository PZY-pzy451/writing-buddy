import { z } from 'zod';
import {
	AiActionRegistry,
	createCharacterAiActions,
	createDefaultAiActionRegistry,
	createRelationshipAiActions,
	createConsistencyReviewAction
} from './AiActionRegistry';

describe('AiActionRegistry', () => {
	it('rejects duplicate and unknown action ids', () => {
		const registry = new AiActionRegistry();
		registry.register(createConsistencyReviewAction());
		expect(() => registry.register(createConsistencyReviewAction()))
			.toThrow('aiActionAlreadyRegistered:review.consistency');
		expect(() => registry.get('editor.polish'))
			.toThrow('aiActionNotFound:editor.polish');
	});

	it('registers Gate D character and relationship actions for their dedicated surfaces', () => {
		const registry = createDefaultAiActionRegistry();
		expect(registry.list('character').map(action => action.id)).toEqual(
			createCharacterAiActions().map(action => action.id)
		);
		expect(registry.list('relationship').map(action => action.id)).toEqual(
			createRelationshipAiActions().map(action => action.id)
		);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'character-center'
		}, 'character')).toHaveLength(5);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'relationship-graph'
		}, 'relationship')).toHaveLength(2);
	});

	it('filters by category and availability while retaining explicit reasons', () => {
		const registry = new AiActionRegistry();
		registry.register(createConsistencyReviewAction());
		registry.register({
			...createConsistencyReviewAction(),
			id: 'editor.polish',
			title: '润色',
			category: 'editor',
			inputSchema: z.object({ text: z.string() }),
			outputSchema: z.object({ suggestion: z.string() }),
			availability: scope => scope.selectionLength
				? { available: true }
				: { available: false, reason: '请先选择一段正文' }
		});

		expect(registry.list('review').map(action => action.id))
			.toEqual(['review.consistency']);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'chapter',
			selectionLength: 0
		}).map(action => action.id)).toEqual(['review.consistency']);
		expect(registry.listWithAvailability({
			hasProject: true,
			currentResourceType: 'chapter',
			selectionLength: 0
		}, 'editor')).toMatchObject([{
			available: false,
			unavailableReason: '请先选择一段正文'
		}]);
	});
});
