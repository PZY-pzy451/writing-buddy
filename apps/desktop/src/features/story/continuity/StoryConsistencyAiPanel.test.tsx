import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopBridge } from '../../../platform/bridge';
import { StoryConsistencyAiPanel } from './StoryConsistencyAiPanel';

const chapters = [{
	resourceId: 'chapter:chapter-a11ce001',
	chapterId: 'chapter-a11ce001',
	title: '第一章 停摆的时钟',
	path: 'chapters/chapter-001.md',
	narrativeOrder: 0,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}, {
	resourceId: 'chapter:chapter-a11ce002',
	chapterId: 'chapter-a11ce002',
	title: '第二章 迷路的旅人',
	path: 'chapters/chapter-002.md',
	narrativeOrder: 1,
	volumeId: 'volume-a11ce001',
	volumeTitle: '第一卷'
}];

describe('StoryConsistencyAiPanel', () => {
	beforeEach(async () => {
		await desktopBridge.saveDeepSeekKey('browser-fixture-key');
	});

	it('requires an explicit start and creates grounded warning-only findings', async () => {
		const onCreated = vi.fn();
		render(
			<StoryConsistencyAiPanel
				projectId="project-a11ce001"
				projectRoot="browser-fixture"
				chapters={chapters}
				onClose={vi.fn()}
				onCreated={onCreated}
			/>
		);

		expect(onCreated).not.toHaveBeenCalled();
		expect(screen.getAllByRole('checkbox')).toHaveLength(2);
		fireEvent.click(screen.getByRole('button', { name: '开始对照审查' }));

		await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1), { timeout: 5_000 });
		const [issues] = onCreated.mock.calls[0] as [readonly {
			readonly severity: string;
			readonly replacement?: string;
			readonly relatedEvidence?: readonly unknown[];
			readonly storyFact?: unknown;
		}[]];
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			severity: 'warning',
			relatedEvidence: [{ label: '证据 A' }, { label: '证据 B' }]
		});
		expect(issues[0]).not.toHaveProperty('replacement');
		expect(await screen.findByText(/最高严重级别为“警告”/u)).toBeInTheDocument();
	});
});
