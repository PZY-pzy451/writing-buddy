import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	parseStoryScene,
	type StoryScene
} from '@writing-buddy/story-kernel';
import validResources from '../../../../../../packages/story-kernel/src/schema/fixtures/valid-resources.json';
import {
	SceneNavigator,
	type SceneNavigatorService
} from './SceneNavigator';
import type { CreateSceneInput } from './SceneService';

function scene(): StoryScene {
	return parseStoryScene(validResources.scene);
}

function serviceFixture() {
	const listScenesForChapter = vi.fn(() => Promise.resolve([scene()]));
	const createScene = vi.fn((input: CreateSceneInput) => Promise.resolve({
			...scene(),
			id: 'scene:new',
			title: input.title,
			manuscriptRange: {
				start: input.start,
				end: input.end,
				revision: 0,
				quote: input.manuscript.slice(input.start, input.end)
			}
		}));
	const unlinkScene = vi.fn(() => Promise.resolve());
	const service: SceneNavigatorService = {
		listScenesForChapter,
		createScene,
		unlinkScene
	};
	return { service, listScenesForChapter, createScene, unlinkScene };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SceneNavigator', () => {
	it('shows the current scene and navigates to its source range', async () => {
		const fixture = serviceFixture();
		const onNavigate = vi.fn();
		render(
			<SceneNavigator
				service={fixture.service}
				chapterId="chapter:chapter-001"
				manuscript={'夜'.repeat(80)}
				currentOffset={4}
				onNavigate={onNavigate}
			/>
		);

		const sceneButton = await screen.findByRole('button', { name: '雨夜车站' });
		expect(sceneButton).toHaveAttribute('aria-current', 'true');
		fireEvent.click(sceneButton);
		expect(onNavigate).toHaveBeenCalledWith(0);
	});

	it('confirms unlinking metadata and explicitly preserves正文', async () => {
		const fixture = serviceFixture();
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		render(
			<SceneNavigator
				service={fixture.service}
				chapterId="chapter:chapter-001"
				manuscript={'夜'.repeat(80)}
				currentOffset={4}
				onNavigate={() => undefined}
			/>
		);

		const unlink = await screen.findByRole('button', { name: '解除当前场景关联' });
		fireEvent.click(unlink);
		await waitFor(() => expect(fixture.unlinkScene).toHaveBeenCalledWith('scene:station-rain'));
		expect(confirm).toHaveBeenCalledWith(expect.stringContaining('不会删除任何正文'));
	});

	it('creates a scene from the current text selection', async () => {
		const fixture = serviceFixture();
		const onScenesChange = vi.fn();
		render(
			<SceneNavigator
				service={fixture.service}
				chapterId="chapter:chapter-001"
				manuscript={'夜'.repeat(80)}
				currentOffset={36}
				selection={{ start: 32, end: 48 }}
				onNavigate={() => undefined}
				onScenesChange={onScenesChange}
			/>
		);

		fireEvent.click(await screen.findByRole('button', { name: '将选区设为场景' }));
		await waitFor(() => expect(fixture.createScene).toHaveBeenCalledWith(expect.objectContaining({
			start: 32,
			end: 48
		})));
		expect(onScenesChange).toHaveBeenCalled();
	});
});
