import {
	BookPlus,
	CalendarPlus,
	ChevronDown,
	FilePlus2,
	FolderInput,
	FolderPlus,
	Landmark,
	MapPinned,
	Plus,
	UserRoundPlus
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../app/store';

const projectItems = [
	{ label: '新建卷', Icon: FolderPlus },
	{ label: '新建章节', Icon: FilePlus2 },
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

export function GlobalCreateMenu(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const chooseProject = useAppStore(state => state.chooseProject);
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		window.addEventListener('pointerdown', close);
		window.addEventListener('keydown', closeOnEscape);
		return () => {
			window.removeEventListener('pointerdown', close);
			window.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	return (
		<div className="global-create" ref={rootRef}>
			<button
				ref={triggerRef}
				className="global-create-trigger"
				type="button"
				aria-label="新建"
				aria-haspopup="menu"
				aria-expanded={open}
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
							setOpen(false);
							void chooseProject();
						}}
					>
						<FolderInput size={18} />
						<span><strong>打开项目</strong><small>选择已有项目目录</small></span>
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
