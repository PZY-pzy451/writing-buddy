import { describe, expect, it } from 'vitest';
import {
	createCreationJourneyState,
	parseCreationJourneyState,
	setGeneratedGenreOutline,
	updateGenreToOutlineInput
} from './CreationJourneyModel';

const now = () => '2026-07-30T03:04:05.000Z';

describe('Creation Journey genre draft', () => {
	it('creates a project-owned genre route without a phantom chapter', () => {
		const state = createCreationJourneyState('novel-genre', {
			startRoute: 'genre',
			now
		});

		expect(state).toMatchObject({
			projectId: 'novel-genre',
			startRoute: 'genre',
			stage: 'outline',
			genreInput: {
				projectId: 'novel-genre',
				genre: '',
				mode: 'quick',
				tones: [],
				protagonistHints: [],
				requiredElements: [],
				excludedElements: []
			},
			chapters: []
		});
		expect(state.storyOutline).toBeUndefined();
	});

	it('persists bounded quick/deep inputs and rejects a foreign project draft', () => {
		const initial = createCreationJourneyState('novel-genre', {
			startRoute: 'genre',
			now
		});
		const edited = updateGenreToOutlineInput(initial, {
			genre: '都市悬疑 + 科幻',
			premise: '一个能看到死亡日期的人遇到一个没有日期的人。',
			mode: 'deep',
			scale: 'novel',
			tones: ['克制', '黑暗'],
			requiredElements: ['旧车站'],
			excludedElements: ['穿越'],
			endingPreference: 'bittersweet'
		}, now);
		const restored = parseCreationJourneyState(JSON.stringify(edited));

		expect(restored.genreInput).toMatchObject({
			projectId: 'novel-genre',
			genre: '都市悬疑 + 科幻',
			mode: 'deep',
			scale: 'novel',
			tones: ['克制', '黑暗']
		});
		expect(() => parseCreationJourneyState(JSON.stringify({
			...edited,
			genreInput: {
				...edited.genreInput,
				projectId: 'novel-foreign'
			}
		}))).toThrow('creationJourneyStateInvalid');
	});

	it('materializes validated AI fields with local IDs and never creates chapters', () => {
		const initial = updateGenreToOutlineInput(
			createCreationJourneyState('novel-genre', {
				startRoute: 'genre',
				now
			}),
			{
				genre: '都市悬疑',
				premise: '记者追查一座会重置记忆的车站。'
			},
			now
		);
		let idIndex = 0;
		const generated = setGeneratedGenreOutline(initial, {
			outline: {
				title: '雨夜重置',
				genre: '都市悬疑',
				premise: '记者追查一座会重置记忆的车站。',
				centralConflict: '公开真相会抹去记者最后的私人记忆'
			},
			storyBeats: Array.from({ length: 5 }, (_, index) => ({
				title: `节拍 ${index + 1}`,
				summary: `推进 ${index + 1}`,
				goal: '取得线索',
				conflict: '付出记忆代价',
				outcome: '得到不完整答案',
				hook: '出现新的雨痕',
				povHint: '记者'
			})),
			suggestedCharacters: [],
			suggestedWorldRules: [],
			warnings: []
		}, {
			id: prefix => `${prefix}:genre-${++idIndex}`,
			now
		});

		expect(generated.storyOutline).toMatchObject({
			id: 'journey-story-outline:genre-1',
			projectId: 'novel-genre',
			status: 'draft',
			revision: 1
		});
		expect(generated.outline).toHaveLength(5);
		expect(generated.outline[0]).toMatchObject({
			type: 'story_beat',
			order: 0,
			source: 'ai_generated',
			revision: 1
		});
		expect(generated.chapters).toEqual([]);
	});
});
