import {
	CheckCircle2,
	CircleAlert,
	LoaderCircle,
	RefreshCw,
	Settings,
	SpellCheck2
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReviewIssue } from '@writing-buddy/review';
import type { InlineLanguageCheckStatus } from './useInlineLanguageCheck';

export function InlineLanguageCheckControl({
	enabled,
	status,
	statusMessage,
	issues,
	readOnly,
	onToggle,
	onRetry,
	onOpenSettings,
	onApply
}: {
	readonly enabled: boolean;
	readonly status: InlineLanguageCheckStatus;
	readonly statusMessage: string;
	readonly issues: readonly ReviewIssue[];
	readonly readOnly: boolean;
	readonly onToggle: (enabled: boolean) => void;
	readonly onRetry: () => void;
	readonly onOpenSettings: () => void;
	readonly onApply: (issue: ReviewIssue) => void;
}): React.JSX.Element {
	const active = status === 'waiting' || status === 'checking';
	const needsAttention = status === 'needs-setup' || status === 'error';
	const [open, setOpen] = useState(false);
	const controlRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const positionPopover = useCallback(() => {
		const trigger = controlRef.current?.querySelector('button');
		const popover = popoverRef.current;
		if (!trigger || !popover) return;
		const triggerRect = trigger.getBoundingClientRect();
		const width = Math.min(340, window.innerWidth - 32);
		const left = Math.max(
			16,
			Math.min(triggerRect.right - width, window.innerWidth - width - 16)
		);
		const top = triggerRect.bottom + 8;
		popover.style.left = `${left}px`;
		popover.style.top = `${top}px`;
		popover.style.width = `${width}px`;
		popover.style.maxHeight = `${Math.max(180, window.innerHeight - top - 16)}px`;
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		positionPopover();
		window.addEventListener('resize', positionPopover);
		return () => window.removeEventListener('resize', positionPopover);
	}, [open, positionPopover]);

	useEffect(() => {
		if (!open) return;
		const closeOutside = (event: PointerEvent) => {
			const target = event.target;
			if (
				target instanceof Node
				&& !controlRef.current?.contains(target)
				&& !popoverRef.current?.contains(target)
			) {
				setOpen(false);
			}
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
				controlRef.current?.querySelector('button')?.focus();
			}
		};
		document.addEventListener('pointerdown', closeOutside);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	const popover = (
		<div
			ref={popoverRef}
			className="inline-language-check-popover"
			role="dialog"
			aria-label="AI 内联语法检查"
		>
			<header>
				<strong>AI 内联语法检查</strong>
				<small>停笔 1.2 秒后，只发送变化段落；不会自动改写正文。</small>
			</header>
			<label className="inline-language-check-toggle">
				<input
					type="checkbox"
					checked={enabled}
					onChange={event => onToggle(event.target.checked)}
				/>
				<span>
					<strong>自动检查拼写与语病</strong>
					<small>每次最多 2,400 字符，旧请求会取消。</small>
				</span>
			</label>
			<p className={`inline-language-check-status is-${status}`} role="status">
				{active
					? <LoaderCircle className="spin" size={16} aria-hidden="true" />
					: needsAttention
						? <CircleAlert size={16} aria-hidden="true" />
						: <CheckCircle2 size={16} aria-hidden="true" />}
				<span>{statusMessage}</span>
			</p>
			{issues.length > 0 && (
				<div className="inline-language-issue-list" aria-label="当前段落语法问题">
					{issues.slice(0, 5).map(issue => (
						<article key={issue.id}>
							<div>
								<strong>{issue.title}</strong>
								<code>{issue.anchor.target}</code>
							</div>
							<p>{issue.message}</p>
							{issue.replacement !== undefined
								&& issue.replacement !== issue.anchor.target
								&& (
									<button
										type="button"
										disabled={readOnly}
										onClick={() => onApply(issue)}
									>
										替换为“{truncate(issue.replacement, 28)}”
									</button>
								)}
						</article>
					))}
					{issues.length > 5 && <small>另有 {issues.length - 5} 处，请在正文中悬停查看。</small>}
				</div>
			)}
			<div className="inline-language-check-actions">
				<button type="button" onClick={onRetry} disabled={!enabled || active}>
					<RefreshCw size={16} aria-hidden="true" />
					检查当前段落
				</button>
				{needsAttention && (
					<button type="button" onClick={() => {
						setOpen(false);
						onOpenSettings();
					}}>
						<Settings size={16} aria-hidden="true" />
						AI 设置
					</button>
				)}
			</div>
		</div>
	);

	return (
		<div className="inline-language-check-control" ref={controlRef}>
			<button
				type="button"
				data-enabled={enabled}
				data-state={status}
				data-open={open}
				title={`AI 内联语法检查：${statusMessage}`}
				aria-expanded={open}
				aria-haspopup="dialog"
				onClick={() => setOpen(current => !current)}
			>
				{active
					? <LoaderCircle className="spin" size={16} aria-hidden="true" />
					: needsAttention
						? <CircleAlert size={16} aria-hidden="true" />
						: status === 'ready'
							? <CheckCircle2 size={16} aria-hidden="true" />
							: <SpellCheck2 size={16} aria-hidden="true" />}
				<span>AI 语法</span>
				<small>{issues.length > 0 ? issues.length : enabled ? '开' : '关'}</small>
			</button>
			{open ? createPortal(popover, document.body) : null}
		</div>
	);
}

function truncate(value: string, maximum: number): string {
	return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}
