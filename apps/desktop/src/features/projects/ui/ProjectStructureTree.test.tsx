import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySceneMetadata } from '@writing-buddy/domain';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import type { StoryScene } from '@writing-buddy/story-kernel';
import { useAppStore } from '../../../app/store';
import { ProjectStructureTree } from './ProjectStructureTree';

const timestamp = '2026-07-28T00:00:00.000Z';

const snapshot: ProjectSnapshot = {
	root: 'C:\\sanitized\\scene-tree',
	project: {
		schemaVersion: 1,
		projectId: 'project-scene-tree',
		title: 'Sanitized',
		volumes: [{
			id: 'volume-one',
			title: '第一卷',
			chapters: [{
				id: 'chapter-one',
				title: '第一章',
				file: 'chapters/one.md',
				scene: emptySceneMetadata()
			}]
		}]
	},
	projectRevision: 'revision-one',
	resources: [],
	wordCounts: { 'chapter-one': 120 },
	integrityIssues: [],
	readOnly: false
};

const scene: StoryScene = {
	id: 'scene:first',
	type: 'scene',
	title: '雨夜站台',
	aliases: [],
	tags: [],
	schemaVersion: 1,
	createdAt: timestamp,
	updatedAt: timestamp,
	revision: 1,
	chapterId: 'chapter:chapter-one',
	manuscriptRange: {
		start: 4,
		end: 8,
		revision: 1,
		quote: '站台'
	},
	narrativeOrder: 0,
	locationIds: [],
	participantIds: [],
	plotThreadIds: [],
	revealInformationIds: [],
	foreshadowingIds: [],
	evidenceIds: []
};

afterEach(cleanup);

beforeEach(() => {
	useAppStore.setState({
		structureScenes: [scene],
		structureMoveBusy: false,
		structureMoveAnnouncement: undefined,
		session: undefined
	});
});

describe('ProjectStructureTree scenes', () => {
	it('renders a nested scene with a keyboard-capable handle and opens its anchor', async () => {
		const onOpenScene = vi.fn();
		render(
			<ProjectStructureTree
				snapshot={snapshot}
				collapsedVolumes={new Set()}
				search=""
				chapterWords={() => 120}
				onToggleVolume={vi.fn()}
				onOpenChapter={vi.fn()}
				onOpenScene={onOpenScene}
			/>
		);

		expect(screen.getByRole('button', { name: '拖动场景：雨夜站台' }))
			.toHaveAttribute('aria-describedby', 'project-structure-drag-instructions');
		await userEvent.click(screen.getByText('雨夜站台'));
		expect(onOpenScene).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'chapter-one' }),
			4
		);
	});

	it('keeps scene drag discoverable but disabled while the chapter has unsaved edits', () => {
		const dirtySession = {
			state: { dirty: true }
		};
		useAppStore.setState({
			session: dirtySession as never
		});
		render(
			<ProjectStructureTree
				snapshot={snapshot}
				collapsedVolumes={new Set()}
				search=""
				chapterWords={() => 120}
				onToggleVolume={vi.fn()}
				onOpenChapter={vi.fn()}
				onOpenScene={vi.fn()}
			/>
		);

		expect(screen.getByRole('button', {
			name: '拖动场景：雨夜站台；保存当前文稿后可移动场景'
		})).toBeDisabled();
		expect(screen.getByRole('button', { name: '拖动章节：第一章' }))
			.toBeEnabled();
		expect(screen.getByRole('button', { name: '拖动卷：第一卷' }))
			.toBeEnabled();
		expect(screen.getByText('保存当前文稿后可移动场景')).toBeVisible();
	});
});
