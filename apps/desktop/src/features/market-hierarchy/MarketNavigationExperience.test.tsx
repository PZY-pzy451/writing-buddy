import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProjectSnapshot } from '@writing-buddy/platform-ports';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../app/store';
import { StoryReferenceSidebar } from '../story/navigation/StoryReferenceSidebar';

const structureSnapshot: ProjectSnapshot = {
	root: 'D:/Market Navigation',
	projectRevision: 'revision-1',
	project: {
		schemaVersion: 1,
		projectId: 'market-navigation',
		title: '雾港来信',
		volumes: [{
			id: 'volume-one',
			title: '第一卷',
			chapters: [{
				id: 'chapter-one',
				title: '第一章',
				file: 'chapters/chapter-one.md',
				status: 'draft',
				targetWords: 3000,
				scene: {
					location: '',
					time: '',
					pov: '',
					characters: [],
					goal: '',
					note: ''
				}
			}]
		}]
	},
	resources: [],
	wordCounts: {},
	integrityIssues: [],
	readOnly: false
};

afterEach(() => {
	useAppStore.setState({
		snapshot: undefined,
		activeMode: 'works',
		storyView: 'characters',
		writerSessions: {}
	});
});

describe('MarketNavigationExperience', () => {
	it('separates planning from the Story Library and supports arrow navigation', () => {
		useAppStore.setState({
			snapshot: structureSnapshot,
			activeMode: 'planning',
			storyView: 'creation-journey',
			writerSessions: {}
		});
		const view = render(<StoryReferenceSidebar />);

		expect(screen.getByRole('heading', { name: '规划' })).toBeInTheDocument();
		const planning = screen.getByRole('navigation', { name: '规划页面' });
		const structure = within(planning).getByRole('button', { name: /故事结构/u });
		expect(within(planning).getByRole('button', { name: /剧情线与伏笔/u })).toBeInTheDocument();
		expect(within(planning).queryByRole('button', { name: /人物关系/u })).not.toBeInTheDocument();

		structure.focus();
		act(() => {
			fireEvent.keyDown(structure, { key: 'ArrowDown' });
		});
		expect(useAppStore.getState().storyView).toBe('plots');
		expect(within(planning).getByRole('button', { name: /剧情线与伏笔/u })).toHaveFocus();

		act(() => {
			useAppStore.setState({
				activeMode: 'references',
				storyView: 'characters'
			});
		});
		view.rerender(<StoryReferenceSidebar />);

		expect(screen.getByRole('heading', { name: '故事库' })).toBeInTheDocument();
		const library = screen.getByRole('navigation', { name: '故事库页面' });
		expect(within(library).getByRole('button', { name: /当前相关/u })).toBeInTheDocument();
		expect(within(library).getByRole('button', { name: /^人物，/u })).toBeInTheDocument();
		expect(within(library).queryByRole('button', { name: /剧情线与伏笔/u })).not.toBeInTheDocument();
		expect(within(library).getByRole('button', { name: /事件与时间线/u }))
			.toHaveClass('is-progressive-muted');
	});
});
