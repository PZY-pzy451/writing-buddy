import {
	Activity,
	CheckCircle2,
	CircleDollarSign,
	Cloud,
	Eye,
	KeyRound,
	RefreshCw,
	ServerCog,
	ShieldCheck,
	SpellCheck2,
	Trash2,
	WandSparkles,
	XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	AI_LONG_FORM_OUTPUT_THRESHOLD,
	AI_MAX_OUTPUT_PRESETS,
	DEEPSEEK_DEFAULT_MODEL_ID,
	type AiProviderPreferences
} from '@writing-buddy/ai';
import { useAiStore } from './stores/aiStore';
import { useAppStore } from '../../app/store';

export function AiSettingsSection(): React.JSX.Element {
	const {
		initialized,
		loading,
		status,
		preferences,
		models,
		balance,
		usageSummary,
		error,
		initialize,
		saveKeyAndValidate,
		deleteKey,
		testConnection,
		refreshModels,
		refreshBalance,
		updatePreferences
	} = useAiStore();
	const [key, setKey] = useState('');
	const [revealed, setRevealed] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [notice, setNotice] = useState('');
	const inlineLanguageCheckEnabled = useAppStore(
		state => state.inlineLanguageCheckEnabled
	);
	const setInlineLanguageCheckEnabled = useAppStore(
		state => state.setInlineLanguageCheckEnabled
	);
	const inlinePlotExpansionEnabled = useAppStore(
		state => state.inlinePlotExpansionEnabled
	);
	const setInlinePlotExpansionEnabled = useAppStore(
		state => state.setInlinePlotExpansionEnabled
	);

	useEffect(() => {
		void initialize();
	}, [initialize]);

	const save = async () => {
		if (!key.trim()) {
			return;
		}
		setNotice('');
		try {
			await saveKeyAndValidate(key.trim());
			setKey('');
			setNotice('API Key 已安全保存，连接验证通过。');
		} catch {
			setKey('');
			setNotice('API Key 已交给 Windows 凭据管理器；请根据错误检查连接或密钥。');
		}
	};

	const remove = async () => {
		setNotice('');
		try {
			await deleteKey();
			setConfirmDelete(false);
			setNotice('DeepSeek 凭据和模型缓存已移除。');
		} catch {
			setNotice('移除失败，请检查错误提示后重试。');
		}
	};

	const update = (patch: Partial<AiProviderPreferences>) => {
		if (loading) {
			return;
		}
		void updatePreferences({ ...preferences, ...patch });
	};

	const configured = status?.secret.configured ?? false;
	const availableModels = models.length > 0
		? models
		: [{ id: preferences.defaultModelId ?? DEEPSEEK_DEFAULT_MODEL_ID, ownedBy: 'deepseek' }];

	return (
		<div className="ai-settings">
			<section aria-labelledby="ai-provider-title">
				<div className="setting-section-title">
					<Cloud size={20} />
					<div><h2 id="ai-provider-title">DeepSeek 提供商</h2><p>网络请求由 Rust 发起，并且只允许访问固定的 DeepSeek API 域名。</p></div>
				</div>
				<div className="ai-provider-card">
					<div className="ai-provider-identity">
						<div className="provider-mark"><ServerCog size={23} /></div>
						<div><strong>DeepSeek</strong><span>流式生成 · 模型发现 · 余额查询 · 思考模式</span></div>
					</div>
					<div className={`provider-status ${configured ? 'is-ready' : ''}`}>
						{configured ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
						{configured ? '凭据已配置' : '尚未配置'}
					</div>
					{configured && (
						<div className="provider-metadata">
							<span>指纹 <strong>{status?.secret.fingerprint ?? '已保护'}</strong></span>
							<span>上次验证 <strong>{formatTime(status?.lastValidatedAt)}</strong></span>
						</div>
					)}
				</div>
			</section>

			<section aria-labelledby="ai-key-title">
				<div className="setting-section-title">
					<KeyRound size={20} />
					<div><h2 id="ai-key-title">API Key</h2><p>密钥仅存于 Windows 凭据管理器；应用设置、日志和项目文件不会保存明文。</p></div>
				</div>
				<div className="ai-secret-panel">
					<label className="ai-field">
						<span>DeepSeek API Key</span>
						<div className="secret-input-wrap">
							<input
								type={revealed ? 'text' : 'password'}
								value={key}
								onChange={event => setKey(event.target.value)}
								autoComplete="new-password"
								spellCheck={false}
								placeholder={configured ? '输入新密钥以替换现有凭据' : '粘贴 API Key'}
							/>
							<button
								type="button"
								className="icon-button"
								aria-label="按住显示 API Key"
								onPointerDown={() => setRevealed(true)}
								onPointerUp={() => setRevealed(false)}
								onPointerLeave={() => setRevealed(false)}
								onBlur={() => setRevealed(false)}
							>
								<Eye size={18} />
							</button>
						</div>
					</label>
					<div className="ai-button-row">
						<button className="primary-button" type="button" onClick={() => void save()} disabled={!key.trim() || loading}>
							<ShieldCheck size={18} />{loading ? '正在保存并验证…' : '安全保存并验证'}
						</button>
						<button className="secondary-button" type="button" onClick={() => void testConnection()} disabled={!configured || loading}>
							<Activity size={18} />测试连接
						</button>
						{!confirmDelete ? (
							<button className="secondary-button danger-button" type="button" onClick={() => setConfirmDelete(true)} disabled={!configured || loading}>
								<Trash2 size={18} />移除凭据
							</button>
						) : (
							<div className="inline-confirm" role="group" aria-label="确认移除凭据">
								<span>确定移除？</span>
								<button className="danger-button" type="button" onClick={() => void remove()} disabled={loading}>确定</button>
								<button type="button" onClick={() => setConfirmDelete(false)} disabled={loading}>取消</button>
							</div>
						)}
					</div>
					{notice && <p className="ai-notice" role="status">{notice}</p>}
					{error && <p className="ai-inline-error" role="alert">{error.message}</p>}
				</div>
			</section>

			<section aria-labelledby="ai-generation-title">
				<div className="setting-section-title">
					<ServerCog size={20} />
					<div><h2 id="ai-generation-title">生成默认值</h2><p>应用启动不会自动联网；模型列表与余额只在你主动操作时刷新。</p></div>
				</div>
				<div className="ai-setting-grid">
					<label className="ai-field">
						<span>默认模型</span>
						<select value={preferences.defaultModelId} onChange={event => update({ defaultModelId: event.target.value })} disabled={loading}>
							{availableModels.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
						</select>
					</label>
					<label className="ai-field">
						<span>思考模式</span>
						<select value={preferences.thinkingMode} onChange={event => update({ thinkingMode: event.target.value as AiProviderPreferences['thinkingMode'] })} disabled={loading}>
							<option value="disabled">关闭（更快）</option>
							<option value="enabled">开启（reasoning effort: high）</option>
						</select>
					</label>
					<label className="ai-field ai-max-output-field">
						<span>最大输出 Token</span>
						<select
							aria-label="最大输出 Token"
							value={preferences.maxOutputTokens}
							onChange={event => update({ maxOutputTokens: Number(event.target.value) as AiProviderPreferences['maxOutputTokens'] })}
							disabled={loading}
						>
							{AI_MAX_OUTPUT_PRESETS.map(value => <option key={value} value={value}>{value.toLocaleString()}</option>)}
						</select>
						<small>DeepSeek 当前上限 384K；这里只设置上限，模型可以提前结束。</small>
						{preferences.maxOutputTokens >= AI_LONG_FORM_OUTPUT_THRESHOLD && (
							<small className="ai-field-warning" role="status">
								64K 以上适合长篇任务，耗时与费用可能显著增加。建议按场景或章节生成。
							</small>
						)}
					</label>
				</div>
				<div className="ai-button-row compact">
					<button className="secondary-button" type="button" onClick={() => void refreshModels()} disabled={!configured || loading}>
						<RefreshCw size={16} />刷新模型列表
					</button>
					<button className="secondary-button" type="button" onClick={() => void refreshBalance()} disabled={!configured || loading}>
						<CircleDollarSign size={16} />刷新余额
					</button>
				</div>
			</section>

			<section aria-labelledby="ai-inline-language-title">
				<div className="setting-section-title">
					<SpellCheck2 size={20} />
					<div>
						<h2 id="ai-inline-language-title">AI 内联语法检查</h2>
						<p>明确开启后，停笔 1.2 秒只发送变化段落；每次最多 2,400 字符。</p>
					</div>
				</div>
				<label className="ai-inline-language-setting">
					<input
						type="checkbox"
						checked={inlineLanguageCheckEnabled}
						onChange={event => setInlineLanguageCheckEnabled(event.target.checked)}
					/>
					<span>
						<strong>在正文中自动标出拼写、错别字与语病</strong>
						<small>
							默认关闭。旧请求会在继续输入时取消，AI 建议必须由你确认后才会修改正文。
						</small>
					</span>
				</label>
			</section>

			<section aria-labelledby="ai-inline-plot-title">
				<div className="setting-section-title">
					<WandSparkles size={20} />
					<div>
						<h2 id="ai-inline-plot-title">Tab 自动情节拓展</h2>
						<p>完整句末停笔 2.4 秒后，只发送光标前最多 4,000 字符。</p>
					</div>
				</div>
				<label className="ai-inline-language-setting">
					<input
						type="checkbox"
						checked={inlinePlotExpansionEnabled}
						onChange={event => setInlinePlotExpansionEnabled(event.target.checked)}
					/>
					<span>
						<strong>在正文中生成可按 Tab 接受的灰字预览</strong>
						<small>
							默认关闭。Esc 忽略预览；没有预览时，Tab 仍执行普通编辑器缩进。
						</small>
					</span>
				</label>
			</section>

			<section aria-labelledby="ai-account-title">
				<div className="setting-section-title">
					<CircleDollarSign size={20} />
					<div><h2 id="ai-account-title">账户与本月用量</h2><p>用量记录只有匿名 Token 数、模型、耗时和状态，不含提示词或生成内容。</p></div>
				</div>
				<div className="ai-metric-grid">
					<Metric label="余额" value={formatBalance(balance)} />
					<Metric label="请求数" value={usageSummary.requests.toLocaleString()} />
					<Metric label="输入 Token" value={usageSummary.inputTokens.toLocaleString()} />
					<Metric label="输出 Token" value={usageSummary.outputTokens.toLocaleString()} />
				</div>
				{!initialized && <p className="ai-notice" role="status">正在读取本地 AI 设置…</p>}
			</section>
		</div>
	);
}

function Metric(props: { readonly label: string; readonly value: string }): React.JSX.Element {
	return <div><span>{props.label}</span><strong>{props.value}</strong></div>;
}

function formatTime(value?: string): string {
	return value ? new Date(value).toLocaleString() : '尚未验证';
}

function formatBalance(balance: ReturnType<typeof useAiStore.getState>['balance']): string {
	if (!balance) {
		return '未查询';
	}
	if (!balance.available) {
		return '不可用';
	}
	const first = balance.balances[0];
	return first ? `${first.totalBalance} ${first.currency}` : '—';
}
