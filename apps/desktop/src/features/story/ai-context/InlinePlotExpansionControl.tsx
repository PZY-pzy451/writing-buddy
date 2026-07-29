import {
	Check,
	CheckCircle2,
	CircleAlert,
	LoaderCircle,
	RefreshCw,
	Settings,
	WandSparkles,
	X
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { InlinePlotExpansionSuggestion } from './InlinePlotExpansionService';
import type { InlinePlotExpansionStatus } from './useInlinePlotExpansion';

export function InlinePlotExpansionControl({
	enabled,
	status,
	statusMessage,
	suggestion,
	readOnly,
	onToggle,
	onRetry,
	onAccept,
	onReject,
	onOpenSettings
}: {
	readonly enabled: boolean;
	readonly status: InlinePlotExpansionStatus;
	readonly statusMessage: string;
	readonly suggestion?: InlinePlotExpansionSuggestion;
	readonly readOnly: boolean;
	readonly onToggle: (enabled: boolean) => void;
	readonly onRetry: () => void;
	readonly onAccept: () => void;
	readonly onReject: () => void;
	readonly onOpenSettings: () => void;
}): React.JSX.Element {
	const active = status === 'waiting'
		|| status === 'paused'
		|| status === 'checking';
	const needsAttention = status === 'needs-setup' || status === 'error';
	const [open, setOpen] = useState(false);
	const controlRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const positionPopover = useCallback(() => {
		const trigger = controlRef.current?.querySelector('button');
		const popover = popoverRef.current;
		if (!trigger || !popover) return;
		const triggerRect = trigger.getBoundingClientRect();
		const width = Math.min(360, window.innerWidth - 32);
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
				if (suggestion) {
					onReject();
				}
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
	}, [onReject, open, suggestion]);

	const popover = (
		<div
			ref={popoverRef}
			className="inline-plot-expansion-popover"
			role="dialog"
			aria-label="Tab 自动情节拓展"
		>
			<header>
				<strong>Tab 自动情节拓展</strong>
				<small>
					停笔 2.4 秒后，只发送光标前最多 4,000 字符；预览不会自动写入。
				</small>
			</header>
			<label className="inline-plot-expansion-toggle">
				<input
					type="checkbox"
					checked={enabled}
					disabled={readOnly}
					onChange={event => onToggle(event.target.checked)}
				/>
				<span>
					<strong>自动生成情节灰字预览</strong>
					<small>完整句末生效；AI 语法检查期间会自动等待。</small>
				</span>
			</label>
			<p className={`inline-plot-expansion-status is-${status}`} role="status">
				{active
					? <LoaderCircle className="spin" size={16} aria-hidden="true" />
					: needsAttention
						? <CircleAlert size={16} aria-hidden="true" />
						: <CheckCircle2 size={16} aria-hidden="true" />}
				<span>{statusMessage}</span>
			</p>
			<div className="inline-plot-expansion-keys" aria-label="预览快捷键">
				<span><kbd>Tab</kbd> 接受预览</span>
				<span><kbd>Esc</kbd> 忽略预览</span>
			</div>
			{suggestion ? (
				<article className="inline-plot-expansion-candidate">
					<strong>{suggestion.title}</strong>
					<p>{suggestion.rationale}</p>
					<div>
						<button type="button" disabled={readOnly} onClick={onAccept}>
							<Check size={16} aria-hidden="true" />
							接受预览
						</button>
						<button type="button" onClick={onReject}>
							<X size={16} aria-hidden="true" />
							忽略
						</button>
					</div>
				</article>
			) : null}
			<div className="inline-plot-expansion-actions">
				<button
					type="button"
					onClick={onRetry}
					disabled={!enabled || readOnly || active}
				>
					<RefreshCw size={16} aria-hidden="true" />
					立即生成
				</button>
				{needsAttention ? (
					<button type="button" onClick={() => {
						setOpen(false);
						onOpenSettings();
					}}>
						<Settings size={16} aria-hidden="true" />
						AI 设置
					</button>
				) : null}
			</div>
		</div>
	);

	return (
		<div className="inline-plot-expansion-control" ref={controlRef}>
			<button
				type="button"
				data-enabled={enabled}
				data-state={status}
				data-open={open}
				title={`Tab 自动情节拓展：${statusMessage}`}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-keyshortcuts="Tab Escape"
				onClick={() => setOpen(current => !current)}
			>
				{active
					? <LoaderCircle className="spin" size={16} aria-hidden="true" />
					: needsAttention
						? <CircleAlert size={16} aria-hidden="true" />
						: suggestion
							? <CheckCircle2 size={16} aria-hidden="true" />
							: <WandSparkles size={16} aria-hidden="true" />}
				<span>Tab 拓展</span>
				<small>{suggestion ? 'Tab' : enabled ? '开' : '关'}</small>
			</button>
			<span className="sr-only" aria-live="polite">{statusMessage}</span>
			{open ? createPortal(popover, document.body) : null}
		</div>
	);
}
