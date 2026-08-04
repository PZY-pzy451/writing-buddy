import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	DEFAULT_AI_PREFERENCES,
	createDeepSeekProviderDefinition
} from '@writing-buddy/ai';
import { AiGenerationDrawer } from './AiGenerationDrawer';
import {
	createAiGenerationStore,
	type AiGenerationRuntime
} from './aiGenerationStore';

const runtime: AiGenerationRuntime = {
	getAiProviderStatus: () => Promise.resolve({
		provider: createDeepSeekProviderDefinition(),
		secret: { configured: true, providerId: 'deepseek' },
		preferences: DEFAULT_AI_PREFERENCES
	}),
	getAiPreferences: () => Promise.resolve(DEFAULT_AI_PREFERENCES),
	startAiGeneration: () => Promise.resolve(),
	cancelAiJob: () => Promise.resolve(true)
};

describe('AiGenerationDrawer', () => {
	it('opens any registered test action and keeps unavailable guidance in the drawer', async () => {
		const user = userEvent.setup();
		const store = createAiGenerationStore(runtime);
		store.getState().openAiAction('review.consistency', {}, { context: {} });
		render(<AiGenerationDrawer store={store} />);

		expect(screen.getByRole('dialog', { name: 'AI 快速生成' })).toBeInTheDocument();
		expect(screen.getByText('一致性审查')).toBeInTheDocument();
		expect(screen.getByText('请先打开作品')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始生成' })).toBeDisabled();

		await user.click(screen.getByRole('button', { name: '关闭 AI 快速生成' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(store.getState()).toMatchObject({
			scope: undefined,
			contextPack: undefined,
			definition: undefined
		});
	});

	it.each(['button', 'escape', 'backdrop'] as const)(
		'cancels and clears a streaming job dismissed through %s',
		async method => {
			const user = userEvent.setup();
			const cancelAiJob = vi.fn(() => Promise.resolve(true));
			const store = createAiGenerationStore({ ...runtime, cancelAiJob });
			store.setState({
				open: true,
				state: 'streaming',
				jobId: 'active-drawer-job',
				rawOutput: 'partial output'
			});
			render(<AiGenerationDrawer store={store} />);

			if (method === 'button') {
				await user.click(screen.getByRole('button', { name: '关闭 AI 快速生成' }));
			} else if (method === 'escape') {
				fireEvent.keyDown(document, { key: 'Escape' });
			} else {
				const backdrop = document.querySelector('.ai-drawer-backdrop');
				if (!(backdrop instanceof HTMLElement)) throw new Error('drawer backdrop missing');
				fireEvent.mouseDown(backdrop);
			}

			expect(screen.queryByRole('dialog', { name: 'AI 快速生成' }))
				.not.toBeInTheDocument();
			expect(cancelAiJob).toHaveBeenCalledOnce();
			expect(store.getState()).toMatchObject({
				open: false,
				state: 'idle',
				jobId: undefined,
				rawOutput: ''
			});
		}
	);

	it('scrubs stale chapter context and requires reopening from the current chapter', () => {
		const store = createAiGenerationStore(runtime);
		store.getState().openAiAction('review.consistency', {}, {
			currentResourceType: 'chapter',
			baseRevision: 4,
			source: {
				projectRoot: 'C:/novels/source',
				projectId: 'project-1',
				resourceId: 'chapter-1',
				resourcePath: 'manuscript/chapter-1.md',
				modelUri: 'writing-buddy://project-1/chapter-1'
			},
			context: {
				project: { id: 'project-1', title: 'Source novel', summary: 'Private source context' },
				currentResource: {
					id: 'chapter-1',
					title: 'Source chapter',
					summary: 'Text that belongs only to the source chapter.'
				}
			}
		});
		store.getState().markStale({
			projectRoot: 'D:/novels/replacement',
			projectId: 'project-1',
			resourceId: 'chapter-1',
			resourcePath: 'manuscript/chapter-1.md',
			modelUri: 'writing-buddy://project-1/chapter-1',
			revision: 4
		});

		render(<AiGenerationDrawer store={store} />);

		expect(screen.getByText('来源已变化，请从当前章节重新打开 AI 快速生成。'))
			.toBeInTheDocument();
		expect(screen.getByRole('button', { name: '开始生成' })).toBeDisabled();
		expect(screen.queryByText('Text that belongs only to the source chapter.'))
			.not.toBeInTheDocument();
	});
});
