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

export function GlobalCreateMenu(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const openProjectWizard = useAppStore(state => state.openProjectWizard);
	const chooseProject = useAppStore(state => state.chooseProject);
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				setOpen(false);
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
				className="global-create-trigger"
				type="button"
				aria-label="新建"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen(value => !value)}
			>
				<Plus size={17} aria-hidden="true" />
				<span>新建</span>
				<ChevronDown size={14} aria-hidden="true" />
			</button>
			{open && (
				<div className="global-create-menu" role="menu" aria-label="新建内容">
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							openProjectWizard();
						}}
					>
						<BookPlus size={18} />
						<span><strong>新建作品</strong><small>从模板和初始结构开始</small></span>
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
						<span><strong>导入旧项目</strong><small>选择已有项目目录</small></span>
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
							<Icon size={17} />
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
