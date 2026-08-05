import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
	parseForeshadowing,
	parseStoryScene,
	StorySchemaRegistry,
	type Character
} from '@writing-buddy/story-kernel';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DndKitCore from '@dnd-kit/core';
import type * as StoryAssociationServiceModule from './StoryAssociationService';
import type { StoryAssociationData } from './StoryAssociationPage';
import { StoryAssociationPage } from './StoryAssociationPage';

const dndHarness = vi.hoisted(() => ({
	onDragEnd: undefined as ((event: unknown) => void) | undefined
}));

const serviceHarness = vi.hoisted(() => ({
	associateWithScene: vi.fn(),
	transferItem: vi.fn(),
	undo: vi.fn()
}));

vi.mock('@dnd-kit/core', async importOriginal => {
	const actual = await importOriginal<typeof DndKitCore>();
	return {
		...actual,
		DndContext: ({
			children,
			onDragEnd
		}: {
			readonly children: React.ReactNode;
			readonly onDragEnd?: (event: unknown) => void;
		}) => {
			dndHarness.onDragEnd = onDragEnd;
			return <>{children}</>;
		},
		DragOverlay: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
		useDraggable: () => ({
			attributes: { 'aria-roledescription': 'draggable' },
			isDragging: false,
			listeners: {},
			setNodeRef: vi.fn(),
			transform: null
		}),
		useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() }),
		useSensor: () => ({}),
		useSensors: () => []
	};
});

vi.mock('./StoryAssociationService', async importOriginal => {
	const actual = await importOriginal<typeof StoryAssociationServiceModule>();
	return {
		...actual,
		StoryAssociationService: class {
			associateWithScene = serviceHarness.associateWithScene;
			transferItem = serviceHarness.transferItem;
			undo = serviceHarness.undo;
		}
	};
});

const timestamp = '2026-08-04T00:00:00.000Z';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
}

function buildData(label: string): StoryAssociationData {
	const chapterId = `chapter:${label}`;
	return {
		characters: [StorySchemaRegistry.parse('character', {
			id: `character:${label}`,
			type: 'character',
			title: `${label} character`,
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			evidenceIds: []
		}) as unknown as Character],
		items: [],
		foreshadowing: [parseForeshadowing({
			id: `foreshadowing:${label}`,
			type: 'foreshadowing',
			title: `${label} clue`,
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			status: 'planted',
			readerVisibility: 0.2,
			evidenceIds: []
		})],
		scenes: [parseStoryScene({
			id: `scene:${label}`,
			type: 'scene',
			title: `${label} scene`,
			aliases: [],
			tags: [],
			schemaVersion: 1,
			createdAt: timestamp,
			updatedAt: timestamp,
			revision: 0,
			chapterId,
			manuscriptRange: {
				start: 0,
				end: 4,
				revision: 1,
				quote: `${label} text`
			},
			narrativeOrder: 10,
			locationIds: [],
			participantIds: [],
			plotThreadIds: [],
			revealInformationIds: [],
			foreshadowingIds: [],
			evidenceIds: []
		})],
		itemStates: []
	};
}

function chapter(label: string) {
	return {
		resourceId: `chapter:${label}`,
		chapterId: label,
		title: `${label} chapter`,
		path: `chapters/${label}.md`,
		narrativeOrder: 0,
		volumeId: 'volume:first',
		volumeTitle: 'Volume One'
	};
}

async function openForeshadowingConfirmation(label = 'alpha'): Promise<void> {
	await screen.findByText(`${label} clue`);
	act(() => {
		dndHarness.onDragEnd?.({
			active: {
				data: {
					current: {
						associationSource: {
							type: 'foreshadowing',
							id: `foreshadowing:${label}`,
							title: `${label} clue`
						}
					}
				}
			},
			over: {
				data: {
					current: {
						associationTarget: {
							type: 'scene',
							id: `scene:${label}`,
							title: `${label} scene`
						}
					}
				}
			}
		});
	});
	await screen.findByRole('button', { name: '确认关联' });
}

describe('StoryAssociationPage persistence convergence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dndHarness.onDragEnd = undefined;
		serviceHarness.associateWithScene.mockResolvedValue({
			kind: 'item-states',
			before: [],
			after: [],
			description: 'association saved'
		});
	});

	it('TC-STORY-ASSOCIATION-001 exposes stable controls for drag, expansion, action and confirmation', async () => {
		render(
			<StoryAssociationPage
				projectRoot="alpha"
				chapters={[chapter('alpha')]}
				loadData={() => Promise.resolve(buildData('alpha'))}
			/>
		);

		const draggableSources = await screen.findAllByTestId('association-draggable-source');
		expect(draggableSources).toHaveLength(2);
		expect(draggableSources.every(source => !source.hasAttribute('disabled'))).toBe(true);
		expect(screen.getByTestId('association-chapter-toggle')).toHaveAttribute('aria-expanded', 'true');
		await openForeshadowingConfirmation();
		expect(screen.getAllByTestId('association-foreshadowing-action')).toHaveLength(3);
		expect(screen.getByTestId('association-confirm-save')).toBeEnabled();
	});

	it('TC-STORY-ASSOCIATION-002 dispatches one write for 100 same-frame confirmations and locks cancellation', async () => {
		const write = deferred<{
			readonly kind: 'item-states';
			readonly before: readonly [];
			readonly after: readonly [];
			readonly description: string;
		}>();
		serviceHarness.associateWithScene.mockReturnValue(write.promise);
		render(
			<StoryAssociationPage
				projectRoot="alpha"
				chapters={[chapter('alpha')]}
				loadData={() => Promise.resolve(buildData('alpha'))}
			/>
		);
		await openForeshadowingConfirmation();

		const save = screen.getByRole('button', { name: '确认关联' });
		for (let index = 0; index < 100; index += 1) fireEvent.click(save);

		expect(serviceHarness.associateWithScene).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
		expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();

		await act(async () => {
			write.resolve({
				kind: 'item-states',
				before: [],
				after: [],
				description: 'association saved'
			});
			await write.promise;
		});
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('TC-STORY-ASSOCIATION-003 releases confirmation for one explicit retry after failure', async () => {
		serviceHarness.associateWithScene
			.mockRejectedValueOnce(new Error('C:\\private\\story.json'))
			.mockResolvedValueOnce({
				kind: 'item-states',
				before: [],
				after: [],
				description: 'association saved'
			});
		render(
			<StoryAssociationPage
				projectRoot="alpha"
				chapters={[chapter('alpha')]}
				loadData={() => Promise.resolve(buildData('alpha'))}
			/>
		);
		await openForeshadowingConfirmation();

		fireEvent.click(screen.getByRole('button', { name: '确认关联' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('关联保存失败，原资料没有改变。');
		expect(screen.getByRole('alert')).not.toHaveTextContent('C:\\private');
		fireEvent.click(screen.getByRole('button', { name: '确认关联' }));

		await waitFor(() => expect(serviceHarness.associateWithScene).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('TC-STORY-ASSOCIATION-004 redacts loader details and deduplicates 100 same-frame retries', async () => {
		const retry = deferred<StoryAssociationData>();
		const loadData = vi.fn()
			.mockRejectedValueOnce(new Error('C:\\private\\author\\story.json'))
			.mockReturnValueOnce(retry.promise);
		render(
			<StoryAssociationPage
				projectRoot="alpha"
				chapters={[chapter('alpha')]}
				loadData={loadData}
			/>
		);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('关联资料读取失败，请重试。');
		expect(alert).not.toHaveTextContent('C:\\private');
		const retryButton = screen.getByTestId('association-retry-load');
		for (let index = 0; index < 100; index += 1) fireEvent.click(retryButton);

		await waitFor(() => expect(loadData).toHaveBeenCalledTimes(2));
		expect(screen.getByRole('button', { name: '正在重试…' })).toBeDisabled();
		await act(async () => {
			retry.resolve(buildData('alpha'));
			await retry.promise;
		});
		expect(await screen.findByText('alpha clue')).toBeInTheDocument();
	});

	it('TC-STORY-ASSOCIATION-005 ignores an old project load that finishes after the new project', async () => {
		const alpha = deferred<StoryAssociationData>();
		const beta = deferred<StoryAssociationData>();
		const loadData = vi.fn((projectRoot: string) => (
			projectRoot === 'alpha' ? alpha.promise : beta.promise
		));
		const view = render(
			<StoryAssociationPage
				projectRoot="alpha"
				chapters={[chapter('alpha')]}
				loadData={loadData}
			/>
		);
		await waitFor(() => expect(loadData).toHaveBeenCalledWith('alpha'));

		view.rerender(
			<StoryAssociationPage
				projectRoot="beta"
				chapters={[chapter('beta')]}
				loadData={loadData}
			/>
		);
		await waitFor(() => expect(loadData).toHaveBeenCalledWith('beta'));
		await act(async () => {
			beta.resolve(buildData('beta'));
			await beta.promise;
		});
		expect(await screen.findByText('beta clue')).toBeInTheDocument();

		await act(async () => {
			alpha.resolve(buildData('alpha'));
			await alpha.promise;
		});
		await waitFor(() => expect(screen.queryByText('alpha clue')).not.toBeInTheDocument());
		expect(screen.getByText('beta clue')).toBeInTheDocument();
	});
});
