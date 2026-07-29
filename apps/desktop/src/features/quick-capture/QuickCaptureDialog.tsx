import {
	BookmarkPlus,
	Check,
	Globe2,
	Lightbulb,
	Link2,
	PencilLine,
	Save,
	UserRound,
	X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore, type QuickCaptureSeed } from '../../app/store';
import { useModalFocus } from '../../accessibility/useModalFocus';
import {
	quickCaptureTypes,
	type QuickCaptureType
} from './QuickCaptureModel';

const captureChoices: Readonly<Record<QuickCaptureType, {
	readonly label: string;
	readonly icon: typeof Lightbulb;
}>> = {
	idea: { label: '灵感', icon: Lightbulb },
	revision: { label: '待修改', icon: PencilLine },
	foreshadowing: { label: '伏笔', icon: BookmarkPlus },
	character: { label: '人物', icon: UserRound },
	world: { label: '设定', icon: Globe2 }
};

export function QuickCaptureDialog(): React.JSX.Element | null {
	const open = useAppStore(state => state.quickCaptureOpen);
	const seed = useAppStore(state => state.quickCaptureSeed);
	if (!open) return null;
	return <QuickCaptureDialogContent seed={seed} />;
}

function QuickCaptureDialogContent({
	seed
}: {
	readonly seed?: QuickCaptureSeed;
}): React.JSX.Element {
	const busy = useAppStore(state => state.quickCaptureBusy);
	const snapshot = useAppStore(state => state.snapshot);
	const close = useAppStore(state => state.closeQuickCapture);
	const save = useAppStore(state => state.saveQuickCapture);
	const [type, setType] = useState<QuickCaptureType>(seed?.type ?? 'idea');
	const [text, setText] = useState(seed?.text ?? '');
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const dialogRef = useModalFocus(close);

	useEffect(() => {
		window.requestAnimationFrame(() => {
			textareaRef.current?.focus();
			textareaRef.current?.setSelectionRange(
				textareaRef.current.value.length,
				textareaRef.current.value.length
			);
		});
	}, []);

	const closeAndRestore = () => {
		if (busy) return;
		close();
	};
	const saveAndRestore = async () => {
		if (!text.trim() || busy) return;
		await save(type, text);
	};
	const chapterTitle = seed?.chapterId
		? snapshot?.project.volumes
				.flatMap(volume => volume.chapters)
				.find(chapter => `chapter:${chapter.id}` === seed.chapterId)?.title
		: undefined;

	return (
		<div
			className="quick-capture-overlay"
			onMouseDown={event => {
				if (event.target === event.currentTarget) closeAndRestore();
			}}
		>
			<section
				ref={dialogRef}
				className="quick-capture-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="quick-capture-title"
				tabIndex={-1}
				onKeyDown={event => {
					if (
						event.key === 'Enter'
						&& (event.ctrlKey || event.metaKey)
					) {
						event.preventDefault();
						void saveAndRestore();
					}
				}}
			>
				<header>
					<div>
						<Lightbulb size={20} aria-hidden="true" />
						<div>
							<h2 id="quick-capture-title">快速记录</h2>
							<p>先记下来，写完再整理。</p>
						</div>
					</div>
					<button
						className="icon-button"
						type="button"
						aria-label="关闭快速记录"
						disabled={busy}
						onClick={closeAndRestore}
					>
						<X size={18} />
					</button>
				</header>
				<textarea
					ref={textareaRef}
					value={text}
					maxLength={20_000}
					placeholder="记录一个想法……"
					aria-label="记录内容"
					onChange={event => setText(event.target.value)}
				/>
				<div className="quick-capture-types" role="radiogroup" aria-label="记录类型">
					{quickCaptureTypes.map(value => {
						const choice = captureChoices[value];
						const Icon = choice.icon;
						return (
							<button
								key={value}
								type="button"
								role="radio"
								aria-checked={type === value}
								className={type === value ? 'is-active' : ''}
								onClick={() => setType(value)}
							>
								<Icon size={16} />
								{choice.label}
							</button>
						);
					})}
				</div>
				<div className="quick-capture-context">
					{seed?.anchor ? <Check size={16} /> : <Link2 size={16} />}
					<span>
						{seed?.anchor
							? `已关联${chapterTitle ? `《${chapterTitle}》` : '当前正文'}原文`
							: chapterTitle
								? `已关联《${chapterTitle}》`
								: '未关联正文位置'}
					</span>
				</div>
				<footer>
					<span>Esc 关闭 · Ctrl+Enter 保存</span>
					<button
						className="primary-button"
						type="button"
						disabled={busy || !text.trim()}
						onClick={() => void saveAndRestore()}
					>
						<Save size={18} />
						{busy ? '保存中…' : '保存到待整理箱'}
					</button>
				</footer>
			</section>
		</div>
	);
}
