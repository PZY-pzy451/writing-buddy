import {
	Check,
	ChevronDown,
	ChevronRight,
	EyeOff,
	Link2Off,
	ListTree,
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
	readonly expanded?: boolean;
	readonly onExpandedChange?: (expanded: boolean) => void;
	readonly onNavigate: (offset: number, preserveSelection?: boolean) => void;
	readonly onActiveSceneChange?: (sceneId?: string) => void;
	readonly onOpenOutline?: () => void;
	readonly onCompleteScene?: (sceneId: string) => void;
	readonly onScenesChange?: (scenes: readonly StoryScene[]) => void;
}

export function SceneNavigator({
	service,
	chapterId,
	manuscript,
	currentOffset,
	selection,
	readOnly = false,
	expanded,
	onExpandedChange,
	onNavigate,
	onActiveSceneChange,
	onOpenOutline,
	onCompleteScene,
	onScenesChange
}: SceneNavigatorProps): React.JSX.Element {
	const [scenes, setScenes] = useState<readonly StoryScene[]>([]);
	const [internalExpanded, setInternalExpanded] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const sceneBarExpanded = expanded ?? internalExpanded;
	const current = useMemo(() => scenes.find(scene => (
		scene.manuscriptRange.start <= currentOffset
			&& currentOffset < scene.manuscriptRange.end
	)), [currentOffset, scenes]);
	const currentIndex = current
		? scenes.findIndex(scene => scene.id === current.id)
		: -1;

	const setExpanded = (next: boolean) => {
		setInternalExpanded(next);
		onExpandedChange?.(next);
	};

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

	useEffect(() => {
		onActiveSceneChange?.(current?.id);
	}, [current?.id, onActiveSceneChange]);

	const createFromSelection = async () => {
		if (!selection || readOnly) return;
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

	const navigate = (scene: StoryScene) => {
		onActiveSceneChange?.(scene.id);
		const preserveSelection = Boolean(
			selection && selection.end > selection.start
		);
		if (preserveSelection) {
			onNavigate(scene.manuscriptRange.start, true);
		} else {
			onNavigate(scene.manuscriptRange.start);
		}
	};

	if (!sceneBarExpanded) {
		return (
			<nav className="scene-navigator is-collapsed" aria-label="场景导航">
				<button
					type="button"
					className="scene-bar-show"
					aria-label="显示当前场景条"
					onClick={() => setExpanded(true)}
				>
					<ChevronRight size={18} />
					<span>{current
						? `场景 ${currentIndex + 1} · ${current.title}`
						: '显示当前场景'}</span>
				</button>
				{error && <span className="scene-error" role="status">{error}</span>}
			</nav>
		);
	}

	return (
		<nav className="scene-navigator" aria-label="场景导航">
			<div className="current-scene-heading">
				<div>
					<span className="scene-navigator-label">
						<MapPin size={16} />当前场景
					</span>
					<strong>
						{current
							? `场景 ${currentIndex + 1} · ${current.title}`
							: scenes.length ? '光标尚未进入场景' : '本章还没有场景'}
					</strong>
				</div>
				<div className="current-scene-actions">
					<button
						type="button"
						disabled={!current}
						aria-label="完成当前场景"
						onClick={() => current && onCompleteScene?.(current.id)}
					>
						<Check size={16} />完成场景
					</button>
					<button
						type="button"
						aria-label="查看当前场景细纲"
						onClick={onOpenOutline}
					>
						<ListTree size={16} />查看细纲
					</button>
					<button
						type="button"
						aria-label="隐藏当前场景条"
						onClick={() => setExpanded(false)}
					>
						<EyeOff size={16} />隐藏
					</button>
				</div>
			</div>

			{current && (
				<dl className="current-scene-brief">
					<div><dt>目标</dt><dd>{current.goal || '未设置'}</dd></div>
					<div><dt>冲突</dt><dd>{current.conflict || '未设置'}</dd></div>
					<div><dt>结尾</dt><dd>{current.outcome || current.turn || '未设置'}</dd></div>
				</dl>
			)}

			<div className="scene-navigation-row">
				<button
					type="button"
					className="scene-list-label"
					aria-expanded="true"
					disabled
				>
					<ChevronDown size={16} />本章场景
				</button>
				<div className="scene-chip-list">
					{scenes.length ? scenes.map(scene => (
						<button
							key={scene.id}
							type="button"
							className={current?.id === scene.id ? 'is-current' : ''}
							aria-current={current?.id === scene.id ? 'true' : undefined}
							aria-label={`转到场景：${scene.title}`}
							onClick={() => navigate(scene)}
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
					<Plus size={16} />选区建场景
				</button>
				<button
					type="button"
					className="scene-action is-danger"
					disabled={!current || readOnly || busy}
					onClick={() => void unlinkCurrent()}
					aria-label="解除当前场景关联"
				>
					<Link2Off size={16} />解除关联
				</button>
			</div>
		</nav>
	);
}
