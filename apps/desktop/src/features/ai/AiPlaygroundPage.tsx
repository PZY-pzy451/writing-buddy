import {
	Bot,
	Check,
	Clipboard,
	Eraser,
	KeyRound,
	LoaderCircle,
	Sparkles,
	Square
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiJobState } from '@writing-buddy/ai';
import { useAppStore } from '../../app/store';
import { useAiStore } from './stores/aiStore';

const activeStates: readonly AiJobState[] = ['queued', 'connecting', 'thinking', 'streaming'];

export function AiPlaygroundPage(): React.JSX.Element {
	const setMode = useAppStore(state => state.setMode);
	const {
		initialized,
		status,
		preferences,
		prompt,
		output,
		jobState,
		jobUsage,
		durationMs,
		partial,
		error,
		initialize,
		setPrompt,
		startGeneration,
		cancelGeneration,
		clearResult
	} = useAiStore();
	const [copied, setCopied] = useState(false);
	const active = activeStates.includes(jobState);
	const configured = status?.secret.configured ?? false;

	useEffect(() => {
		void initialize();
	}, [initialize]);

	const copy = async () => {
		if (!output) {
			return;
		}
		await navigator.clipboard.writeText(output);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="system-page ai-playground">
			<header>
				<span className="eyebrow">StoryForge Lab</span>
				<h1>AI 流式测试台</h1>
				<p>这里是隔离测试面板：只发送你在下方输入框中主动填写的内容，不读取项目、章节、路径或历史。</p>
				<div className="ai-safety-strip"><KeyRound size={16} />密钥由 Windows 凭据管理器保护；响应只保留正文增量，原始推理内容会在 Rust 层丢弃。</div>
			</header>

			{initialized && !configured && (
				<div className="ai-empty-state">
					<KeyRound size={28} />
					<div><strong>先配置 DeepSeek API Key</strong><span>完成安全保存与连接验证后，才能开始流式测试。</span></div>
					<button className="primary-button" type="button" onClick={() => setMode('settings')}>打开 AI 设置</button>
				</div>
			)}

			<div className="ai-playground-grid">
				<section className="ai-prompt-card" aria-labelledby="storyforge-prompt-title">
					<div className="ai-card-heading">
						<div><Bot size={20} /><h2 id="storyforge-prompt-title">测试指令</h2></div>
						<span>{preferences.defaultModelId}</span>
					</div>
					<label className="ai-field">
						<span>仅发送此输入框的内容</span>
						<textarea
							value={prompt}
							onChange={event => setPrompt(event.target.value)}
							maxLength={10_000}
							placeholder="例如：写一段 200 字的悬疑场景，地点是雨夜的废弃车站。"
							disabled={active}
						/>
					</label>
					<div className="ai-prompt-meta"><span>{prompt.length.toLocaleString()} / 10,000 字符</span><span>最大输出 {preferences.maxOutputTokens.toLocaleString()} Token</span></div>
					<div className="ai-button-row">
						<button className="primary-button" type="button" onClick={() => void startGeneration()} disabled={!configured || !prompt.trim() || active}>
							{active ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
							{active ? '正在生成…' : '开始流式生成'}
						</button>
						<button className="secondary-button" type="button" onClick={() => void cancelGeneration()} disabled={!active}>
							<Square size={16} />停止
						</button>
					</div>
					{error && <p className="ai-inline-error" role="alert">{error.message}</p>}
				</section>

				<section className="ai-output-card" aria-labelledby="storyforge-output-title">
					<div className="ai-card-heading">
						<div><Sparkles size={20} /><h2 id="storyforge-output-title">候选输出</h2></div>
						<JobBadge state={jobState} partial={partial} />
					</div>
					<div
						className={`ai-stream-output ${output ? 'has-output' : ''}`}
						role="log"
						aria-live="polite"
						aria-busy={active}
					>
						{output || (active ? '正在等待首段内容…' : '生成内容会逐段显示在这里。')}
					</div>
					<div className="ai-output-footer">
						<div>
							<span>输入 {jobUsage?.inputTokens?.toLocaleString() ?? '—'}</span>
							<span>输出 {jobUsage?.outputTokens?.toLocaleString() ?? '—'}</span>
							<span>耗时 {durationMs === undefined ? '—' : `${(durationMs / 1000).toFixed(1)}s`}</span>
						</div>
						<div className="ai-button-row compact">
							<button className="secondary-button" type="button" onClick={() => void copy()} disabled={!output}>
								{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? '已复制' : '复制'}
							</button>
							<button className="secondary-button" type="button" onClick={clearResult} disabled={!output || active}>
								<Eraser size={16} />清空
							</button>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

function JobBadge(props: { readonly state: AiJobState; readonly partial: boolean }): React.JSX.Element {
	const labels: Readonly<Record<AiJobState, string>> = {
		created: '待生成',
		queued: '排队中',
		connecting: '正在连接',
		thinking: '正在思考',
		streaming: '流式输出',
		completed: '已完成',
		cancelled: props.partial ? '已停止 · 保留部分内容' : '已停止',
		failed: props.partial ? '失败 · 保留部分内容' : '失败'
	};
	return <span className={`ai-job-badge state-${props.state}`}>{labels[props.state]}</span>;
}
