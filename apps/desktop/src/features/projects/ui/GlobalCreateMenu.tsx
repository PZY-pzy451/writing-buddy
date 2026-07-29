import {
	BookPlus,
	CalendarPlus,
	ChevronDown,
	FilePlus2,
	FolderInput,
	FolderPlus,
	Landmark,
	Lightbulb,
	MapPinned,
	Plus,
	UserRoundPlus
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../app/store';
import { openCreateMenuEvent } from './GlobalCreateRequest';

const projectItems = [
	{ label: '新建卷', Icon: FolderPlus },
	{ label: '新建场景', Icon: MapPinned },
	{ label: '新建人物', Icon: UserRoundPlus },
	{ label: '新建设定', Icon: Landmark },
	{ label: '新建时间事件', Icon: CalendarPlus }
] as const;

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
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const requestedFocus = useRef<'first' | 'chapter'>('first');
	const shortcutOrigin = useRef<HTMLElement | null>(null);

	const restoreFocus = useCallback(() => {
		const target = shortcutOnly ? shortcutOrigin.current : triggerRef.current;
		if (target?.isConnected) target.focus();
	}, [shortcutOnly]);

	useEffect(() => {
		if (!open) return;
		const selector = requestedFocus.current === 'chapter'
			? '[data-create-item="chapter"]'
			: '[role="menuitem"]';
		menuRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
		requestedFocus.current = 'first';
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
				restoreFocus();
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setOpen(false);
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
			shortcutOrigin.current = document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
			requestedFocus.current = detail?.focus ?? 'first';
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
				hidden={shortcutOnly}
				type="button"
				aria-label="新建"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-keyshortcuts="Control+Shift+N Meta+Shift+N"
				onClick={() => setOpen(value => !value)}
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
						onClick={() => {
							restoreFocus();
							setOpen(false);
							openProjectWizard();
						}}
					>
						<BookPlus size={18} />
						<span><strong>新建项目</strong><small>从模板和初始结构开始</small></span>
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							restoreFocus();
							setOpen(false);
							void chooseProject();
						}}
					>
						<FolderInput size={18} />
						<span><strong>打开项目</strong><small>选择已有项目目录</small></span>
					</button>
					<div className="global-create-separator" role="separator" />
					<button
						type="button"
						role="menuitem"
						data-create-item="chapter"
						disabled={!snapshot || snapshot.readOnly}
						title={!snapshot
							? '请先打开作品'
							: snapshot.readOnly
								? '只读作品不能新建章节'
								: 'Ctrl+N'}
						onClick={() => {
							restoreFocus();
							setOpen(false);
							openChapterCreator();
						}}
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
						disabled={!snapshot || snapshot.readOnly}
						title={!snapshot ? '请先打开作品' : snapshot.readOnly ? '只读作品不能新增记录' : 'Ctrl+Shift+Space'}
						onClick={() => {
							restoreFocus();
							setOpen(false);
							openQuickCapture();
						}}
					>
						<Lightbulb size={18} />
						<span>
							<strong>快速记录</strong>
							<small>{snapshot ? '写作中先记下来，稍后整理' : '打开作品后可用'}</small>
						</span>
					</button>
					<div className="global-create-separator" role="separator" />
					{projectItems.map(({ label, Icon }) => (
						<button
							key={label}
							type="button"
							role="menuitem"
							disabled
							title={snapshot ? '将在项目结构编排阶段启用' : '请先打开作品'}
						>
							<Icon size={18} />
							<span>
								<strong>{label}</strong>
								<small>{snapshot ? '下一阶段启用' : '请先打开作品'}</small>
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
