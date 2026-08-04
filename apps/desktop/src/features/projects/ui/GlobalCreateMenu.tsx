import {
	BookPlus,
	CalendarPlus,
	ChevronDown,
	FilePlus2,
	FolderInput,
	Landmark,
	Lightbulb,
	MapPinned,
	PackagePlus,
	Plus,
	Route,
	UserRoundPlus
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, type ContextualCreateIntent, type RailMode } from '../../../app/store';
import { openCreateMenuEvent } from './GlobalCreateRequest';

interface ContextualCreateAction {
	readonly id: 'structure' | ContextualCreateIntent;
	readonly label: string;
	readonly description: string;
	readonly Icon: LucideIcon;
}

const contextualCreateActions: readonly ContextualCreateAction[] = [
	{
		id: 'structure',
		label: '规划卷、章与场景',
		description: '打开故事结构，继续拆分大纲',
		Icon: MapPinned
	},
	{
		id: 'plot',
		label: '创建剧情线或伏笔',
		description: '打开剧情助手，先生成候选再确认',
		Icon: Route
	},
	{
		id: 'character',
		label: '创建人物',
		description: '打开人物助手，补充角色资料',
		Icon: UserRoundPlus
	},
	{
		id: 'worldbuilding',
		label: '创建地点或设定',
		description: '打开世界助手，建立地点与规则',
		Icon: Landmark
	},
	{
		id: 'asset',
		label: '创建物品',
		description: '打开物品助手，记录关键资产',
		Icon: PackagePlus
	},
	{
		id: 'timeline',
		label: '创建时间事件',
		description: '打开时间线助手，安排事件顺序',
		Icon: CalendarPlus
	}
] as const;

const contextualOrder: Readonly<Record<Extract<RailMode, 'planning' | 'references'> | 'default', readonly ContextualCreateAction['id'][]>> = {
	planning: ['structure', 'plot', 'character', 'worldbuilding', 'asset', 'timeline'],
	references: ['character', 'worldbuilding', 'asset', 'timeline', 'plot', 'structure'],
	default: ['structure', 'character', 'plot', 'worldbuilding', 'asset', 'timeline']
};

function moveMenuFocus(menu: HTMLDivElement, direction: 'first' | 'last' | 'next' | 'previous'): void {
	const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')];
	if (!items.length) return;
	const current = items.indexOf(document.activeElement as HTMLButtonElement);
	const next = direction === 'first'
		? items[0]
		: direction === 'last'
			? items.at(-1)
			: direction === 'next'
				? items[(current + 1 + items.length) % items.length]
				: items[(current - 1 + items.length) % items.length];
	next?.focus();
}

export function GlobalCreateMenu({
	shortcutOnly = false
}: {
	readonly shortcutOnly?: boolean;
}): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const chooseProject = useAppStore(state => state.chooseProject);
	const openQuickCapture = useAppStore(state => state.openQuickCapture);
	const openChapterCreator = useAppStore(state => state.openChapterCreator);
	const activeMode = useAppStore(state => state.activeMode);
	const setRailMode = useAppStore(state => state.setMode);
	const requestContextualCreate = useAppStore(state => state.requestContextualCreate);
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const requestedFocus = useRef<'first' | 'chapter'>('first');
	const shortcutOrigin = useRef<HTMLElement | null>(null);
	const openRef = useRef(false);
	const actionGuardRef = useRef(false);

	const restoreFocus = useCallback(() => {
		const target = shortcutOnly ? shortcutOrigin.current : triggerRef.current;
		if (target?.isConnected) target.focus();
	}, [shortcutOnly]);
	const contextualActions = (contextualOrder[
		activeMode === 'planning' || activeMode === 'references' ? activeMode : 'default'
	]).map(id => contextualCreateActions.find(action => action.id === id)!);
	const closeMenu = () => {
		openRef.current = false;
		setOpen(false);
	};
	const focusRequestedItem = (focus: 'first' | 'chapter') => {
		const selector = focus === 'chapter'
			? '[data-create-item="chapter"]'
			: '[role="menuitem"]';
		menuRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
	};
	const runAndClose = (action: () => void) => {
		if (actionGuardRef.current) return;
		actionGuardRef.current = true;
		restoreFocus();
		closeMenu();
		action();
	};

	useEffect(() => {
		if (!open) return;
		focusRequestedItem(requestedFocus.current);
		requestedFocus.current = 'first';
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				closeMenu();
				restoreFocus();
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeMenu();
				restoreFocus();
			}
		};
		window.addEventListener('pointerdown', close);
		window.addEventListener('keydown', closeOnEscape);
		return () => {
			window.removeEventListener('pointerdown', close);
			window.removeEventListener('keydown', closeOnEscape);
		};
	}, [open, restoreFocus]);

	useEffect(() => {
		const openFromShortcut = (event: Event) => {
			const detail = (event as CustomEvent<{ readonly focus?: 'first' | 'chapter' }>).detail;
			const focus = detail?.focus ?? 'first';
			if (openRef.current) {
				focusRequestedItem(focus);
				return;
			}
			shortcutOrigin.current = document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
			requestedFocus.current = focus;
			actionGuardRef.current = false;
			openRef.current = true;
			setOpen(true);
		};
		window.addEventListener(openCreateMenuEvent, openFromShortcut);
		return () => window.removeEventListener(openCreateMenuEvent, openFromShortcut);
	}, []);

	return (
		<div
			className={`global-create${shortcutOnly ? ' is-shortcut-only' : ''}${open ? ' is-open' : ''}`}
			ref={rootRef}
			hidden={shortcutOnly && !open}
		>
			<button
				ref={triggerRef}
				className="global-create-trigger"
				data-testid="global-create-trigger"
				hidden={shortcutOnly}
				type="button"
				aria-label="新建"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-keyshortcuts="Control+Shift+N Meta+Shift+N"
				onClick={() => {
					const next = !openRef.current;
					openRef.current = next;
					if (next) {
						actionGuardRef.current = false;
						requestedFocus.current = 'first';
					}
					setOpen(next);
				}}
			>
				<Plus size={18} aria-hidden="true" />
				<span>新建</span>
				<ChevronDown size={16} aria-hidden="true" />
			</button>
			{open && (
				<div
					ref={menuRef}
					className="global-create-menu"
					role="menu"
					aria-label="新建内容"
					onKeyDown={event => {
						if (event.key === 'ArrowDown') {
							event.preventDefault();
							moveMenuFocus(event.currentTarget, 'next');
						} else if (event.key === 'ArrowUp') {
							event.preventDefault();
							moveMenuFocus(event.currentTarget, 'previous');
						} else if (event.key === 'Home') {
							event.preventDefault();
							moveMenuFocus(event.currentTarget, 'first');
						} else if (event.key === 'End') {
							event.preventDefault();
							moveMenuFocus(event.currentTarget, 'last');
						}
					}}
				>
					<button
						type="button"
						role="menuitem"
						data-testid="global-create-new-project"
						onClick={() => runAndClose(openProjectWizard)}
					>
						<BookPlus size={18} />
						<span><strong>新建项目</strong><small>从模板和初始结构开始</small></span>
					</button>
					<button
						type="button"
						role="menuitem"
						data-testid="global-create-open-project"
						onClick={() => runAndClose(() => void chooseProject())}
					>
						<FolderInput size={18} />
						<span><strong>打开项目</strong><small>选择已有项目目录</small></span>
					</button>
					<div className="global-create-separator" role="separator" />
					<button
						type="button"
						role="menuitem"
						data-create-item="chapter"
						data-testid="global-create-new-chapter"
						disabled={!snapshot || snapshot.readOnly}
						title={!snapshot
							? '请先打开作品'
							: snapshot.readOnly
								? '只读作品不能新建章节'
								: 'Ctrl+N'}
						onClick={() => runAndClose(openChapterCreator)}
					>
						<FilePlus2 size={18} />
						<span>
							<strong>新建章节</strong>
							<small>{snapshot ? '创建空白正文并添加到作品结构' : '打开作品后可用'}</small>
						</span>
					</button>
					<button
						type="button"
						role="menuitem"
						data-testid="global-create-quick-capture"
						disabled={!snapshot || snapshot.readOnly}
						title={!snapshot ? '请先打开作品' : snapshot.readOnly ? '只读作品不能新增记录' : 'Ctrl+Shift+Space'}
						onClick={() => runAndClose(openQuickCapture)}
					>
						<Lightbulb size={18} />
						<span>
							<strong>快速记录</strong>
							<small>{snapshot ? '写作中先记下来，稍后整理' : '打开作品后可用'}</small>
						</span>
					</button>
					{snapshot && (
						<>
							<div className="global-create-separator" role="separator" />
							{contextualActions.map(({ id, label, description, Icon }) => (
								<button
									key={id}
									type="button"
									role="menuitem"
									data-testid="global-create-contextual-action"
									disabled={snapshot.readOnly}
									title={snapshot.readOnly ? '只读作品不能创建内容' : description}
									onClick={() => runAndClose(() => {
										if (id === 'structure') {
											setRailMode('planning');
										} else {
											requestContextualCreate(id);
										}
									})}
								>
									<Icon size={18} />
									<span>
										<strong>{label}</strong>
										<small>{snapshot.readOnly ? '当前作品为只读' : description}</small>
									</span>
								</button>
							))}
						</>
					)}
				</div>
			)}
		</div>
	);
}
