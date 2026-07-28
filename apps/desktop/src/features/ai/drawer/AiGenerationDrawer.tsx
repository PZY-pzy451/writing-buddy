import {
	AlertTriangle,
	CheckCircle2,
	LoaderCircle,
	Maximize2,
	Minimize2,
	Play,
	ShieldCheck,
	Sparkles,
	Square,
	X
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { ContextPreview } from '../context/ContextPreview';
import {
	aiGenerationStore,
	type AiGenerationDrawerState,
	type AiGenerationStore
} from './aiGenerationStore';
import './AiGenerationDrawer.css';

const stateLabels: Readonly<Record<AiGenerationDrawerState, string>> = {
	idle: '等待开始',
	validating_context: '检查上下文',
	queued: '排队中',
	connecting: '连接 DeepSeek',
	streaming: '流式生成',
	validating_output: '校验输出',
	preview: '等待确认',
	applying: '正在应用',
	completed: '已完成',
	cancelled: '已停止',
	failed: '需要处理',
	stale: '来源已变化'
};

function reviewIssues(output: unknown): readonly {
	readonly title: string;
	readonly message: string;
	readonly severity: string;
	readonly replacement?: string;
}[] {
	if (
		!output
		|| typeof output !== 'object'
		|| !('issues' in output)
		|| !Array.isArray(output.issues)
	) return [];
	return output.issues.filter(issue => (
		typeof issue === 'object'
		&& issue
		&& 'title' in issue
		&& 'message' in issue
	)) as readonly {
		readonly title: string;
		readonly message: string;
		readonly severity: string;
		readonly replacement?: string;
	}[];
}

export function AiGenerationDrawer({
	store = aiGenerationStore
}: {
	readonly store?: StoreApi<AiGenerationStore>;
}): React.JSX.Element | null {
	const state = useStore(store, value => value);
	const panelRef = useRef<HTMLElement>(null);
	const previousFocus = useRef<HTMLElement | null>(null);
	const active = ['validating_context', 'queued', 'connecting', 'streaming', 'validating_output']
		.includes(state.state);
	const issues = reviewIssues(state.parsedOutput);

	useEffect(() => {
		if (!state.open) return;
		previousFocus.current = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
		window.setTimeout(() => {
			panelRef.current?.querySelector<HTMLElement>('button, textarea, input')?.focus();
		}, 0);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				store.getState().close();
				return;
			}
			if (event.key !== 'Tab' || !panelRef.current) return;
			const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
				'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex="0"]'
			)];
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable.at(-1);
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			previousFocus.current?.focus();
		};
	}, [state.open, store]);

	if (!state.open) return null;

	return (
		<div
			className="ai-drawer-backdrop"
			onMouseDown={event => {
				if (event.target === event.currentTarget) state.close();
			}}
		>
			<aside
				ref={panelRef}
				className={`ai-generation-drawer ${state.expanded ? 'is-expanded' : ''}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="ai-generation-title"
			>
				<header className="ai-generation-heading">
					<div>
						<span><Sparkles size={14} />AI QUICK ACTION</span>
						<h2 id="ai-generation-title">AI 快速生成</h2>
					</div>
					<div>
						<button
							className="icon-button"
							type="button"
							onClick={state.toggleExpanded}
							aria-label={state.expanded ? '恢复抽屉宽度' : '展开抽屉'}
						>
							{state.expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
						</button>
						<button className="icon-button" type="button" onClick={state.close} aria-label="关闭 AI 快速生成">
							<X size={19} />
						</button>
					</div>
				</header>

				<div className="ai-generation-scroll">
					<section className="ai-action-summary">
						<div>
							<span>当前动作</span>
							<strong>{state.definition?.title ?? '未选择动作'}</strong>
							<p>{state.definition?.description}</p>
						</div>
						<span className={`ai-generation-state is-${state.state}`}>
							{active ? <LoaderCircle size={14} className="spin" /> : null}
							{stateLabels[state.state]}
						</span>
						<dl>
							<div><dt>模型</dt><dd>{state.definition?.defaultModelClass === 'reasoning' ? '深度推理' : '快速'}</dd></div>
							<div><dt>输出</dt><dd>{state.definition?.outputSchemaName ?? '—'} v{state.definition?.outputSchemaVersion ?? '—'}</dd></div>
						</dl>
					</section>

					{state.unavailableReason ? (
						<div className="ai-drawer-notice" role="status">
							<AlertTriangle size={17} />
							<div><strong>暂时不可用</strong><span>{state.unavailableReason}</span></div>
						</div>
					) : null}

					<section className="ai-instruction-note">
						<span>你的要求</span>
						<p>本轮基础接入复用安全的章节审校合同；具体润色、续写和资料生成动作将在后续 Gate 接入。</p>
					</section>

					<ContextPreview
						pack={state.contextPack}
						onToggle={state.setContextRecordIncluded}
					/>

					{state.error ? (
						<div className="ai-drawer-error" role="alert">
							<AlertTriangle size={17} />
							<div>
								<strong>生成未完成</strong>
								<span>{state.error}</span>
								{state.repairInstruction ? <pre>{state.repairInstruction}</pre> : null}
							</div>
						</div>
					) : null}

					<section className="ai-generation-controls" aria-label="生成控制">
						<button
							className="primary-button"
							type="button"
							disabled={active || Boolean(state.unavailableReason) || Boolean(state.error)}
							onClick={() => void state.startGeneration()}
						>
							<Play size={16} />开始生成
						</button>
						<button
							className="secondary-button"
							type="button"
							disabled={!active}
							onClick={() => void state.cancelGeneration()}
						>
							<Square size={15} />停止
						</button>
					</section>

					{state.rawOutput || state.state === 'preview' ? (
						<section className="ai-candidate-preview">
							<header>
								<div>
									<span>候选结果</span>
									<strong>校验后的预览事务</strong>
								</div>
								{state.state === 'preview' ? <em><ShieldCheck size={15} />尚未写入作品</em> : null}
							</header>
							{state.state === 'preview' && issues.length === 0 ? (
								<div className="ai-empty-result">
									<CheckCircle2 size={20} />
									<span>未发现需要列出的章节问题。</span>
								</div>
							) : null}
							{issues.map((issue, index) => (
								<article key={`${issue.title}:${index}`}>
									<span data-severity={issue.severity} />
									<div>
										<strong>{issue.title}</strong>
										<p>{issue.message}</p>
										{issue.replacement ? <small>建议：{issue.replacement}</small> : null}
									</div>
								</article>
							))}
							{state.state === 'stale' ? (
								<div className="ai-drawer-notice">
									<AlertTriangle size={17} />
									<span>章节在生成后已变化。请重新生成，旧候选不能应用。</span>
								</div>
							) : null}
							<details>
								<summary>查看原始输出</summary>
								<pre tabIndex={0}>{state.rawOutput}</pre>
							</details>
							{state.state === 'preview' ? (
								<footer>
									<span>确认操作将在对应审校页面完成并创建安全快照。</span>
									<button className="secondary-button" type="button" onClick={state.rejectPreview}>
										拒绝候选
									</button>
								</footer>
							) : null}
						</section>
					) : null}
				</div>
			</aside>
		</div>
	);
}
