import { FilePlus2, X } from 'lucide-react';
import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useAppStore } from '../../../app/store';
import { useModalFocus } from '../../../accessibility/useModalFocus';

export function ChapterCreationDialog(): React.JSX.Element | null {
	const open = useAppStore(state => state.chapterCreatorOpen);
	if (!open) return null;
	return <ChapterCreationDialogContent />;
}

function ChapterCreationDialogContent(): React.JSX.Element {
	const snapshot = useAppStore(state => state.snapshot);
	const activeResource = useAppStore(state => state.activeResource);
	const busy = useAppStore(state => state.chapterCreateBusy);
	const close = useAppStore(state => state.closeChapterCreator);
	const createChapter = useAppStore(state => state.createChapter);
	const chapterCount = snapshot?.project.volumes.reduce(
		(total, volume) => total + volume.chapters.length,
		0
	) ?? 0;
	const activeVolume = snapshot?.project.volumes.find(volume => (
		volume.chapters.some(chapter => chapter.id === activeResource?.id)
	));
	const defaultVolumeId = activeVolume?.id ?? snapshot?.project.volumes.at(-1)?.id ?? '';
	const [title, setTitle] = useState(`第 ${chapterCount + 1} 章`);
	const [volumeId, setVolumeId] = useState(defaultVolumeId);
	const inputRef = useRef<HTMLInputElement>(null);
	const dialogRef = useModalFocus(close);
	const volumes = useMemo(
		() => snapshot?.project.volumes ?? [],
		[snapshot?.project.volumes]
	);

	useLayoutEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	const submit = async () => {
		if (busy || !title.trim()) return;
		await createChapter(title, volumeId || undefined);
	};

	return (
		<div
			className="chapter-create-overlay"
			onMouseDown={event => {
				if (event.target === event.currentTarget) close();
			}}
		>
			<section
				ref={dialogRef}
				className="chapter-create-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="chapter-create-title"
				tabIndex={-1}
				onKeyDown={event => {
					if (
						event.key === 'Enter'
						&& (event.ctrlKey || event.metaKey)
					) {
						event.preventDefault();
						void submit();
					}
				}}
			>
				<header>
					<div>
						<FilePlus2 size={20} aria-hidden="true" />
						<div>
							<h2 id="chapter-create-title">新建章节</h2>
							<p>创建空白正文并立即保存到作品结构。</p>
						</div>
					</div>
					<button
						className="icon-button"
						type="button"
						aria-label="关闭新建章节"
						disabled={busy}
						onClick={close}
					>
						<X size={18} />
					</button>
				</header>
				<label>
					<span>章节标题</span>
					<input
						ref={inputRef}
						value={title}
						maxLength={120}
						disabled={busy}
						autoComplete="off"
						aria-label="章节标题"
						onChange={event => setTitle(event.target.value)}
					/>
					<small>{title.trim().length}/120</small>
				</label>
				{volumes.length > 0 && (
					<label>
						<span>放入卷</span>
						<select
							value={volumeId}
							disabled={busy}
							aria-label="放入卷"
							onChange={event => setVolumeId(event.target.value)}
						>
							{volumes.map(volume => (
								<option key={volume.id} value={volume.id}>{volume.title}</option>
							))}
						</select>
						<small>新章节会添加到所选卷的末尾。</small>
					</label>
				)}
				{volumes.length === 0 && (
					<p className="chapter-create-note">作品还没有卷，将同时创建“第一卷”。</p>
				)}
				<footer>
					<span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> 创建</span>
					<div>
						<button type="button" className="secondary-button" disabled={busy} onClick={close}>
							取消
						</button>
						<button
							type="button"
							className="primary-button"
							disabled={busy || !title.trim()}
							onClick={() => void submit()}
						>
							<FilePlus2 size={18} aria-hidden="true" />
							{busy ? '创建中…' : '创建并打开'}
						</button>
					</div>
				</footer>
			</section>
		</div>
	);
}
