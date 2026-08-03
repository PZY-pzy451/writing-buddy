import { BookPlus, FolderOpen, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../app/store';

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

export function ProjectActionsMenu(): React.JSX.Element {
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const projectWizardOpen = useAppStore(state => state.projectWizardOpen);
	const chooseProject = useAppStore(state => state.chooseProject);
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const restoreAfterWizardRef = useRef(false);

	useEffect(() => {
		if (projectWizardOpen || !restoreAfterWizardRef.current) return;
		restoreAfterWizardRef.current = false;
		triggerRef.current?.focus();
	}, [projectWizardOpen]);

	useEffect(() => {
		if (!open) return;
		menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
		const closeOutside = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			setOpen(false);
			triggerRef.current?.focus();
		};
		window.addEventListener('pointerdown', closeOutside);
		window.addEventListener('keydown', closeOnEscape);
		return () => {
			window.removeEventListener('pointerdown', closeOutside);
			window.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	const closeAndRun = (action: () => void) => {
		triggerRef.current?.focus();
		setOpen(false);
		action();
	};
	const openWizard = () => {
		restoreAfterWizardRef.current = true;
		closeAndRun(openProjectWizard);
	};

	return (
		<div className="global-create project-actions-menu" ref={rootRef}>
			<button
				ref={triggerRef}
				className="icon-button"
				type="button"
				aria-label="项目菜单"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen(value => !value)}
			>
				<MoreHorizontal size={20} />
			</button>
			{open && (
				<div
					ref={menuRef}
					className="global-create-menu"
					role="menu"
					aria-label="项目操作"
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
						onClick={openWizard}
					>
						<BookPlus size={18} aria-hidden="true" />
						<span><strong>新建项目</strong><small>从模板和初始结构开始</small></span>
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => closeAndRun(() => void chooseProject())}
					>
						<FolderOpen size={18} aria-hidden="true" />
						<span><strong>打开项目</strong><small>选择已有的项目目录</small></span>
					</button>
				</div>
			)}
		</div>
	);
}
