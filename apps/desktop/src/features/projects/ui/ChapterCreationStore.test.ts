import type {
	AtomicWriteResult,
	CreateChapterResult,
	ProjectSnapshot
} from '@writing-buddy/platform-ports';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';

function firstChapter(snapshot: ProjectSnapshot) {
	const chapter = snapshot.project.volumes.flatMap(volume => volume.chapters)[0];
	if (!chapter) throw new Error('missing chapter fixture');
	return {
		id: chapter.id,
		type: 'chapter' as const,
		title: chapter.title,
		path: chapter.file,
		projectId: snapshot.project.projectId
	};
}

async function openDirtyChapter(): Promise<ProjectSnapshot> {
	await useAppStore.getState().openProject('browser-fixture');
	const snapshot = useAppStore.getState().snapshot;
	if (!snapshot) throw new Error('browser fixture failed to open');
	await useAppStore.getState().openResource(firstChapter(snapshot));
	useAppStore.getState().setContent(`${useAppStore.getState().resourceContent ?? ''}\nDirty draft`);
	return snapshot;
}

beforeEach(() => {
	localStorage.clear();
	useAppStore.setState({
		snapshot: undefined,
		activeResource: undefined,
		activeResourceId: undefined,
		session: undefined,
		resourceContent: undefined,
		resourceHash: undefined,
		openResourceIds: [],
		tabs: [],
		writerSessions: {},
		documentViews: {},
		chapterCreatorOpen: false,
		chapterCreateBusy: false,
		saveState: { type: 'clean', savedAt: '2026-08-04T12:00:00.000Z' },
		error: undefined
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
});

describe('chapter creation Store lifecycle', () => {
	it('creates one chapter for one hundred requests queued behind a dirty save', async () => {
		const snapshot = await openDirtyChapter();
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockResolvedValue({
			hash: 'saved-before-chapter',
			modifiedAt: '2026-08-04T13:00:00.000Z',
			byteLength: 128
		});
		const createChapter = vi.spyOn(desktopBridge, 'createChapter');
		const volumeId = snapshot.project.volumes[0]?.id;

		const results = await Promise.all(Array.from({ length: 100 }, () => (
			useAppStore.getState().createChapter('Pressure Chapter', volumeId)
		)));

		expect(createChapter).toHaveBeenCalledTimes(1);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect(useAppStore.getState().chapterCreateBusy).toBe(false);
	});

	it('does not create in the old project when identity changes during the prerequisite save', async () => {
		const snapshot = await openDirtyChapter();
		let finishWrite: ((result: AtomicWriteResult) => void) | undefined;
		vi.spyOn(desktopBridge, 'writeTextAtomic').mockImplementationOnce(() => (
			new Promise(resolve => { finishWrite = resolve; })
		));
		const createChapter = vi.spyOn(desktopBridge, 'createChapter');
		const creating = useAppStore.getState().createChapter(
			'Stale Project Chapter',
			snapshot.project.volumes[0]?.id
		);
		const replacement: ProjectSnapshot = {
			...snapshot,
			root: 'browser-fixture-replacement',
			project: {
				...snapshot.project,
				projectId: 'replacement-project'
			}
		};
		useAppStore.setState({
			snapshot: replacement,
			activeResource: undefined,
			activeResourceId: undefined,
			session: undefined,
			resourceContent: undefined,
			resourceHash: undefined
		});
		finishWrite?.({
			hash: 'superseded-save',
			modifiedAt: '2026-08-04T13:01:00.000Z',
			byteLength: 128
		});

		expect(await creating).toBe(false);
		expect(createChapter).not.toHaveBeenCalled();
		expect(useAppStore.getState().snapshot?.project.projectId).toBe('replacement-project');
		expect(useAppStore.getState().chapterCreateBusy).toBe(false);
	});

	it('does not apply a native creation result after the author switches projects', async () => {
		await useAppStore.getState().openProject('browser-fixture');
		const snapshot = useAppStore.getState().snapshot;
		if (!snapshot) throw new Error('browser fixture failed to open');
		const chapter = {
			id: 'chapter-delayed-result',
			title: 'Delayed Chapter',
			file: 'chapters/chapter-delayed-result.md',
			status: 'draft' as const,
			scene: {
				location: '',
				time: '',
				pov: '',
				characters: [],
				goal: '',
				note: ''
			}
		};
		let finishCreate: ((result: CreateChapterResult) => void) | undefined;
		vi.spyOn(desktopBridge, 'createChapter').mockImplementationOnce(() => (
			new Promise(resolve => { finishCreate = resolve; })
		));
		const creating = useAppStore.getState().createChapter(
			chapter.title,
			snapshot.project.volumes[0]?.id
		);
		const replacement: ProjectSnapshot = {
			...snapshot,
			root: 'browser-fixture-late-replacement',
			project: {
				...snapshot.project,
				projectId: 'late-replacement-project'
			}
		};
		useAppStore.setState({ snapshot: replacement });
		finishCreate?.({
			project: {
				...snapshot.project,
				volumes: snapshot.project.volumes.map((volume, index) => (
					index === 0
						? { ...volume, chapters: [...volume.chapters, chapter] }
						: volume
				))
			},
			projectRevision: 'delayed-project-revision',
			chapter,
			description: 'Created delayed chapter'
		});

		expect(await creating).toBe(false);
		expect(useAppStore.getState().snapshot?.project.projectId).toBe(
			'late-replacement-project'
		);
		expect(useAppStore.getState().activeResource).toBeUndefined();
		expect(useAppStore.getState().chapterCreateBusy).toBe(false);
	});
});
