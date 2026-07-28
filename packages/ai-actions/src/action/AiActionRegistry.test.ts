import { z } from 'zod';
import {
	AiActionRegistry,
	createCharacterAiActions,
	createDefaultAiActionRegistry,
	createItemAiActions,
	createPlotAiActions,
	createRelationshipAiActions,
	createTimelineAiActions,
	createWorldAiActions,
	createConsistencyReviewAction,
	createGateGAiActions
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

	it('registers Gate E world and item actions only on their dedicated surfaces', () => {
		const registry = createDefaultAiActionRegistry();
		expect(registry.list('world').map(action => action.id)).toEqual(
			createWorldAiActions().map(action => action.id)
		);
		expect(registry.list('item').map(action => action.id)).toEqual(
			createItemAiActions().map(action => action.id)
		);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'worldbuilding-center'
		}, 'world')).toHaveLength(5);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'story-assets'
		}, 'item')).toHaveLength(3);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'chapter'
		}, 'world')).toHaveLength(0);
	});

	it('registers Gate F timeline, plot, and foreshadowing actions on dedicated surfaces', () => {
		const registry = createDefaultAiActionRegistry();
		expect(registry.list('timeline').map(action => action.id)).toEqual(
			createTimelineAiActions().map(action => action.id)
		);
		expect([
			...registry.list('plot'),
			...registry.list('foreshadowing')
		].map(action => action.id)).toEqual(createPlotAiActions().map(action => action.id));
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'story-progress'
		}, 'timeline')).toHaveLength(4);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'plot-board'
		}, 'plot')).toHaveLength(3);
		expect(registry.listAvailable({
			hasProject: true,
			currentResourceType: 'plot-board'
		}, 'foreshadowing')).toHaveLength(3);
		expect(createPlotAiActions().every(action => (
			action.contextPolicy.includeAuthorSecretsByDefault === false
		))).toBe(true);
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

	it('registers Gate G orchestration and cross-chapter review actions', () => {
		const registry = createDefaultAiActionRegistry();
		expect(createGateGAiActions().map(action => action.id)).toEqual([
			'manuscript.organize',
			'review.crossChapterConsistency'
		]);
		expect(registry.list('manuscript').map(action => action.id)).toEqual([
			'manuscript.organize'
		]);
		expect(registry.listAvailable({
			hasProject: true,
			selectedChapterCount: 2
		}, 'review').map(action => action.id)).toContain(
			'review.crossChapterConsistency'
		);
		expect(createGateGAiActions().every(action => (
			action.contextPolicy.includeAuthorSecretsByDefault === false
		))).toBe(true);
	});
});
