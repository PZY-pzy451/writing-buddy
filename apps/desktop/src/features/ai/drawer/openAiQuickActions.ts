import { useAppStore } from '../../../app/store';
import { aiGenerationStore } from './aiGenerationStore';

export function openAiQuickActions(): void {
	const state = useAppStore.getState();
	const snapshot = state.snapshot;
	const activeResource = state.activeResource;
	const session = state.session;
	const content = session?.content ?? state.resourceContent;
	const selection = state.selection;
	const activeChapter = snapshot?.project.volumes
		.flatMap(volume => volume.chapters)
		.find(chapter => chapter.id === activeResource?.id);
	aiGenerationStore.getState().openAiAction(
		'review.consistency',
		{ instruction: '' },
		{
			currentResourceType: activeResource?.type,
			baseRevision: session?.state.version ?? 0,
			source: {
				projectRoot: snapshot?.root,
				projectId: snapshot?.project.projectId,
				resourceId: activeResource?.id,
				resourcePath: activeResource?.path,
				modelUri: session?.state.modelUri
			},
			context: {
				...(snapshot ? {
					project: {
						id: snapshot.project.projectId,
						title: snapshot.project.title,
						summary: `${snapshot.project.volumes.length} 卷作品；仅发送当前明确勾选的上下文。`
					}
				} : {}),
				...(activeResource && content ? {
					currentResource: {
						id: activeResource.id,
						title: activeResource.title,
						summary: content
					}
				} : {}),
				...(selection?.text ? {
					selection: {
						id: `${activeResource?.id ?? 'selection'}:${selection.start}-${selection.end}`,
						title: '当前选区',
						summary: selection.text,
						start: selection.start,
						end: selection.end
					}
				} : {}),
				...(activeChapter ? {
					scene: {
						id: `${activeChapter.id}:scene`,
						title: '当前场景信息',
						summary: [
							activeChapter.scene.location ? `地点：${activeChapter.scene.location}` : '',
							activeChapter.scene.time ? `时间：${activeChapter.scene.time}` : '',
							activeChapter.scene.pov ? `视角：${activeChapter.scene.pov}` : '',
							activeChapter.scene.goal ? `目标：${activeChapter.scene.goal}` : ''
						].filter(Boolean).join('\n') || '当前章节尚未设置场景信息。'
					}
				} : {})
			}
		}
	);
}
