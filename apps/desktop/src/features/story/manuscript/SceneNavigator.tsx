import {
	Link2Off,
	MapPin,
	Plus
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoryScene } from '@writing-buddy/story-kernel';
import type { CreateSceneInput } from './SceneService';

export interface SceneNavigatorService {
	listScenesForChapter(chapterId: string): Promise<readonly StoryScene[]>;
	createScene(input: CreateSceneInput): Promise<StoryScene>;
	unlinkScene(sceneId: string): Promise<void>;
}

interface SceneNavigatorProps {
	readonly service: SceneNavigatorService;
	readonly chapterId: string;
	readonly manuscript: string;
	readonly currentOffset: number;
	readonly selection?: { readonly start: number; readonly end: number };
	readonly readOnly?: boolean;
	readonly onNavigate: (offset: number) => void;
	readonly onScenesChange?: (scenes: readonly StoryScene[]) => void;
}

export function SceneNavigator({
	service,
	chapterId,
	manuscript,
	currentOffset,
	selection,
	readOnly = false,
	onNavigate,
	onScenesChange
}: SceneNavigatorProps): React.JSX.Element {
	const [scenes, setScenes] = useState<readonly StoryScene[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	const reload = useCallback(async () => {
		try {
			const next = await service.listScenesForChapter(chapterId);
			setScenes(next);
			setError(undefined);
			onScenesChange?.(next);
			return next;
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'sceneReadFailed');
			return [];
		}
	}, [chapterId, onScenesChange, service]);

	useEffect(() => {
		let cancelled = false;
		void service.listScenesForChapter(chapterId)
			.then(next => {
				if (!cancelled) {
					setScenes(next);
					setError(undefined);
					onScenesChange?.(next);
				}
			})
			.catch(reason => {
				if (!cancelled) {
					setError(reason instanceof Error ? reason.message : 'sceneReadFailed');
				}
			});
		return () => {
			cancelled = true;
		};
	}, [chapterId, onScenesChange, service]);

	const current = useMemo(() => scenes.find(scene => (
		scene.manuscriptRange.start <= currentOffset
			&& currentOffset < scene.manuscriptRange.end
	)), [currentOffset, scenes]);

	const createFromSelection = async () => {
		if (!selection || readOnly) {
			return;
		}
		setBusy(true);
		try {
			await service.createScene({
				chapterId,
				title: `场景 ${scenes.length + 1}`,
				start: selection.start,
				end: selection.end,
				manuscript
			});
			await reload();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'sceneCreateFailed');
		} finally {
			setBusy(false);
		}
	};

	const unlinkCurrent = async () => {
		if (!current || readOnly || !window.confirm(
			'这只会解除场景元数据关联，不会删除任何正文。场景记录将移入可恢复区，是否继续？'
		)) {
			return;
		}
		setBusy(true);
		try {
			await service.unlinkScene(current.id);
			await reload();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'sceneUnlinkFailed');
		} finally {
			setBusy(false);
		}
	};

	return (
		<nav className="scene-navigator" aria-label="场景导航">
			<span className="scene-navigator-label"><MapPin size={15} />场景</span>
			<div className="scene-chip-list">
				{scenes.length ? scenes.map(scene => (
					<button
						key={scene.id}
						type="button"
						className={current?.id === scene.id ? 'is-current' : ''}
						aria-current={current?.id === scene.id ? 'true' : undefined}
						onClick={() => onNavigate(scene.manuscriptRange.start)}
					>
						{scene.title}
					</button>
				)) : <span className="scene-empty">选中文字即可建立场景</span>}
			</div>
			{error && <span className="scene-error" role="status">{error}</span>}
			<button
				type="button"
				className="scene-action"
				disabled={!selection || readOnly || busy}
				onClick={() => void createFromSelection()}
				aria-label="将选区设为场景"
			>
				<Plus size={15} />选区建场景
			</button>
			<button
				type="button"
				className="scene-action is-danger"
				disabled={!current || readOnly || busy}
				onClick={() => void unlinkCurrent()}
				aria-label="解除当前场景关联"
			>
				<Link2Off size={15} />解除关联
			</button>
		</nav>
	);
}
