import { useMemo } from 'react';
import { flattenChapters, type ResourceDescriptor } from '@writing-buddy/domain';
import {
	toStoryChapterId,
	type MentionLink
} from '@writing-buddy/story-kernel';
import { useAppStore } from './store';
import { StoryResourceView } from '../features/story/ui/StoryResourceView';
import { BacklinksPanel } from '../features/story/shared/BacklinksPanel';
import { MentionService } from '../features/story/manuscript/MentionService';
import { desktopBridge } from '../platform/bridge';
import { CharacterCenterPage } from '../features/story/characters/CharacterCenterPage';
import { RelationshipGraphPage } from '../features/story/relationships/RelationshipGraphPage';
import { TimelinePage } from '../features/story/timeline/TimelinePage';
import { WorldbuildingPage } from '../features/story/worldbuilding/WorldbuildingPage';
import { StoryAssetsPage } from '../features/story/assets/StoryAssetsPage';
import { PlotBoardPage } from '../features/story/plots/PlotBoardPage';
import { InformationControlPage } from '../features/story/information/InformationControlPage';
import { ContinuityReviewPage } from '../features/story/continuity/ContinuityReviewPage';
import { ManuscriptExtractionCenterPage } from '../features/story/extraction/ManuscriptExtractionCenterPage';
import { StoryAssociationPage } from '../features/story/associations/StoryAssociationPage';

export function StoryStudioRoute(): React.JSX.Element {
	const storyView = useAppStore(state => state.storyView);
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const openResource = useAppStore(state => state.openResource);
	const requestEditorReveal = useAppStore(state => state.requestEditorReveal);
	const setMode = useAppStore(state => state.setMode);
	const projectRoot = snapshot?.root;
	const chapters = useMemo(() => snapshot
		? snapshot.project.volumes.flatMap(volume => volume.chapters.map(chapter => ({
			volume,
			chapter
		}))).map(({ volume, chapter }, index) => ({
			resourceId: toStoryChapterId(chapter.id),
			chapterId: chapter.id,
			title: chapter.title,
			path: chapter.file,
			narrativeOrder: index,
			volumeId: volume.id,
			volumeTitle: volume.title
		}))
		: [], [snapshot]);
	const openEvidence = (evidence: {
		readonly resourceId: string;
		readonly range?: { readonly start: number; readonly end: number };
	}) => {
		if (!snapshot) return;
		const chapter = flattenChapters(snapshot.project).find(candidate => (
			candidate.id === evidence.resourceId
			|| toStoryChapterId(candidate.id) === evidence.resourceId
		));
		if (!chapter) return;
		void openResource({
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		}).then(() => {
			setMode('works');
			requestEditorReveal(chapter.id, evidence.range?.start ?? 0);
		});
	};

	if (storyView === 'characters') {
		return (
			<CharacterCenterPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'relationships') {
		return (
			<RelationshipGraphPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'timeline') {
		return (
			<TimelinePage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'worldbuilding') {
		return (
			<WorldbuildingPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'assets') {
		return (
			<StoryAssetsPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'plots') {
		return (
			<PlotBoardPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
				onOpenEvidence={openEvidence}
			/>
		);
	}
	if (storyView === 'information') {
		return <InformationControlPage projectRoot={projectRoot} />;
	}
	if (storyView === 'associations') {
		return (
			<StoryAssociationPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
			/>
		);
	}
	if (storyView === 'continuity') {
		return (
			<ContinuityReviewPage
				projectRoot={projectRoot}
				chapters={chapters}
				readOnly={snapshot?.readOnly}
			/>
		);
	}
	if (storyView === 'extraction') {
		return (
			<ManuscriptExtractionCenterPage
				projectRoot={projectRoot}
				chapters={chapters}
				activeChapterId={activeResource?.type === 'chapter'
					? toStoryChapterId(activeResource.id)
					: undefined}
				readOnly={snapshot?.readOnly}
			/>
		);
	}
	return (
		<WorldbuildingPage
			projectRoot={projectRoot}
			chapters={chapters}
			readOnly={snapshot?.readOnly}
			onOpenEvidence={openEvidence}
		/>
	);
}

/**
 * Story routes stay inside the existing workspace state machine. The persisted
 * route shape is `story/:type/:id`; no second client router is introduced.
 */
export function StoryWorkspaceRoute(): React.JSX.Element | null {
	const activeResource = useAppStore(state => state.activeResource);
	const result = useAppStore(state => state.storyOpenResult);
	const snapshot = useAppStore(state => state.snapshot);
	const openStoryResource = useAppStore(state => state.openStoryResource);
	const restoreStoryResource = useAppStore(state => state.restoreStoryResource);
	const openResource = useAppStore(state => state.openResource);
	const requestEditorReveal = useAppStore(state => state.requestEditorReveal);
	const projectRoot = snapshot?.root;
	const mentionService = useMemo(() => projectRoot
		? new MentionService(projectRoot, desktopBridge)
		: undefined, [projectRoot]);

	if (activeResource?.type !== 'story') {
		return null;
	}

	const openBacklink = (mention: MentionLink) => {
		if (!snapshot) {
			return;
		}
		const chapter = flattenChapters(snapshot.project).find(candidate => (
			toStoryChapterId(candidate.id) === mention.chapterId
		));
		if (!chapter) {
			return;
		}
		const resource: ResourceDescriptor = {
			id: chapter.id,
			type: 'chapter',
			title: chapter.title,
			path: chapter.file,
			projectId: snapshot.project.projectId
		};
		void openResource(resource).then(() => {
			requestEditorReveal(chapter.id, mention.anchor.start);
		});
	};

	return (
		<StoryResourceView
			result={result}
			onRetry={reference => void openStoryResource(reference)}
			onRestore={() => void restoreStoryResource()}
			backlinks={mentionService && result?.status === 'ready'
				? (
					<BacklinksPanel
						service={mentionService}
						resourceId={result.resource.id}
						onOpenBacklink={openBacklink}
					/>
				)
				: undefined}
		/>
	);
}
