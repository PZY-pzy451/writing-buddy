import {
	ExternalLink,
	Link2,
	LoaderCircle,
	SearchX,
	X
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { MentionLink } from '@writing-buddy/story-kernel';
import type { EntityPeekResult } from './EntityPeekService';

interface EntityPeekCardProps {
	readonly x: number;
	readonly y: number;
	readonly candidates: readonly MentionLink[];
	readonly result?: EntityPeekResult;
	readonly loading?: boolean;
	readonly error?: string;
	readonly onSelect: (mention: MentionLink) => void;
	readonly onClose: () => void;
	readonly onOpenFull: () => void;
	readonly onJumpBacklink: (mention: MentionLink) => void;
}

export function EntityPeekCard({
	x,
	y,
	candidates,
	result,
	loading = false,
	error,
	onSelect,
	onClose,
	onOpenFull,
	onJumpBacklink
}: EntityPeekCardProps): React.JSX.Element {
	const dialogRef = useRef<HTMLElement>(null);
	useEffect(() => {
		dialogRef.current?.focus({ preventScroll: true });
	}, []);
	const left = Math.max(12, Math.min(x, window.innerWidth - 372));
	const top = Math.max(12, Math.min(y, window.innerHeight - 420));
	const accessibleName = result
		? `${result.resource.title}资料速览`
		: candidates.length > 1
			? '选择正文资料引用'
			: '正文资料速览';

	return (
		<section
			ref={dialogRef}
			className="entity-peek-card"
			role="dialog"
			aria-label={accessibleName}
			tabIndex={-1}
			style={{ left, top }}
			onKeyDown={event => {
				if (event.key === 'Escape') {
					event.preventDefault();
					onClose();
				} else if (
					event.key === 'Enter'
					&& event.target === event.currentTarget
					&& result
				) {
					event.preventDefault();
					onOpenFull();
				}
			}}
		>
			<header>
				<div>
					<Link2 size={18} />
					<strong>{result?.summary.kindLabel ?? '正文资料引用'}</strong>
				</div>
				<button className="icon-button" type="button" aria-label="关闭资料速览" onClick={onClose}>
					<X size={18} />
				</button>
			</header>
			{loading && (
				<div className="entity-peek-state" role="status">
					<LoaderCircle className="spin" size={20} />
					正在读取这一条资料…
				</div>
			)}
			{error && (
				<div className="entity-peek-state is-error" role="alert">
					<SearchX size={20} />
					{error}
				</div>
			)}
			{!loading && !error && !result && candidates.length > 1 && (
				<div className="entity-peek-chooser">
					<strong>这里有 {candidates.length} 个精确引用</strong>
					<span>选择要速览的资料，不会离开当前正文。</span>
					<div role="listbox" aria-label="重叠的正文资料引用">
						{candidates.map(candidate => (
							<button
								key={candidate.id}
								type="button"
								role="option"
								aria-selected="false"
								onClick={() => onSelect(candidate)}
							>
								<strong>{candidate.displayText}</strong>
								<small>{candidate.resourceId}</small>
							</button>
						))}
					</div>
				</div>
			)}
			{result && (
				<>
					<div className="entity-peek-summary">
						<h3>{result.resource.title}</h3>
						{result.summary.lines.length
							? result.summary.lines.map(line => <p key={line}>{line}</p>)
							: <p className="is-muted">这条资料暂时没有补充摘要。</p>}
					</div>
					<details className="entity-peek-backlinks">
						<summary>正文中出现 {result.backlinks.length} 次</summary>
						<div>
							{result.backlinks.slice(0, 8).map(link => (
								<button key={link.id} type="button" onClick={() => onJumpBacklink(link)}>
									<span>{link.displayText}</span>
									<small>{link.chapterId}</small>
								</button>
							))}
						</div>
					</details>
					<footer>
						<span>Esc 关闭 · Enter 打开详情</span>
						<button className="primary-button" type="button" onClick={onOpenFull}>
							<ExternalLink size={16} />打开完整资料
						</button>
					</footer>
				</>
			)}
		</section>
	);
}
