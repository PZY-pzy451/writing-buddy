import { Check, KeyRound, Palette, ShieldCheck, TextCursorInput } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore, type ThemeId } from '../app/store';
import { desktopBridge } from '../platform/bridge';

const themes: readonly { id: ThemeId; label: string; description: string; swatches: readonly string[] }[] = [
	{ id: 'paper', label: '纸页', description: '温暖纸张与深色产品外壳', swatches: ['#fbf8f1', '#172033', '#a5783d'] },
	{ id: 'midnight', label: '深夜', description: '适合低光环境的沉浸写作', swatches: ['#101522', '#20293a', '#c9a96e'] },
	{ id: 'fog', label: '薄雾', description: '柔和、低刺激的灰白界面', swatches: ['#eef1f3', '#384454', '#6f8090'] },
	{ id: 'focus', label: '专注', description: '极简画布与最低界面噪音', swatches: ['#f5f0e6', '#26231f', '#8d6b3d'] }
];

export function SettingsPage(): React.JSX.Element {
	const theme = useAppStore(state => state.theme);
	const setTheme = useAppStore(state => state.setTheme);
	const accent = useAppStore(state => state.accent);
	const setAccent = useAppStore(state => state.setAccent);
	const aiMode = useAppStore(state => state.aiMode);
	const setAiMode = useAppStore(state => state.setAiMode);
	const [key, setKey] = useState('');
	const [saved, setSaved] = useState(false);
	const [configured, setConfigured] = useState(false);

	useEffect(() => {
		void desktopBridge.secretExists('deepseek-api-key').then(setConfigured);
	}, []);

	const saveKey = async () => {
		if (!key.trim()) {
			return;
		}
		await desktopBridge.setSecret('deepseek-api-key', key.trim());
		setKey('');
		setSaved(true);
		setConfigured(true);
	};

	const removeKey = async () => {
		await desktopBridge.deleteSecret('deepseek-api-key');
		setConfigured(false);
		setSaved(false);
		setAiMode('local');
	};

	return (
		<div className="system-page settings-page">
			<header>
				<span className="eyebrow">Preferences</span>
				<h1>写作偏好</h1>
				<p>界面状态保存在应用数据目录，不会写入你的小说项目。</p>
			</header>
			<section>
				<div className="setting-section-title"><Palette size={20} /><div><h2>主题</h2><p>立即生效并在重启后恢复。</p></div></div>
				<div className="theme-grid">
					{themes.map(candidate => (
						<button key={candidate.id} className={`theme-card ${theme === candidate.id ? 'is-active' : ''}`} type="button" onClick={() => setTheme(candidate.id)}>
							<div className="theme-swatches">{candidate.swatches.map(color => <span key={color} style={{ background: color }} />)}</div>
							<strong>{candidate.label}</strong>
							<span>{candidate.description}</span>
							{theme === candidate.id && <Check size={18} />}
						</button>
					))}
				</div>
			</section>
			<section>
				<div className="setting-section-title"><TextCursorInput size={20} /><div><h2>强调色</h2><p>用于选择、焦点与重要操作。</p></div></div>
				<div className="accent-picker">
					{(['gold', 'blue', 'purple'] as const).map(candidate => (
						<button key={candidate} className={`accent-swatch accent-${candidate} ${accent === candidate ? 'is-active' : ''}`} type="button" onClick={() => setAccent(candidate)} aria-label={`使用 ${candidate} 强调色`} />
					))}
				</div>
			</section>
			<section>
				<div className="setting-section-title"><ShieldCheck size={20} /><div><h2>写作助手模式</h2><p>默认使用本地模拟；只有明确选择 DeepSeek 才会发送当前选区与局部上下文。</p></div></div>
				<div className="provider-picker">
					<button className={aiMode === 'local' ? 'is-active' : ''} type="button" onClick={() => setAiMode('local')}>
						<strong>本地模拟</strong><span>不联网，用于完整交互与隐私验证</span>
					</button>
					<button className={aiMode === 'deepseek' ? 'is-active' : ''} type="button" onClick={() => setAiMode('deepseek')} disabled={!configured}>
						<strong>DeepSeek</strong><span>{configured ? '仅发送作者主动选择的短文本' : '请先安全保存 API Key'}</span>
					</button>
				</div>
			</section>
			<section>
				<div className="setting-section-title"><KeyRound size={20} /><div><h2>DeepSeek API Key</h2><p>只保存在 Windows 凭据管理器，不导入 Legacy 明文。</p></div></div>
				<div className="secret-form">
					<label><span>API Key</span><input type="password" value={key} onChange={event => { setKey(event.target.value); setSaved(false); }} autoComplete="off" /></label>
					<button className="primary-button" type="button" onClick={() => void saveKey()} disabled={!key.trim()}><ShieldCheck size={17} />安全保存</button>
					<button className="secondary-button" type="button" onClick={() => void removeKey()} disabled={!configured}>移除凭据</button>
					{saved && <span className="success-message"><Check size={16} />已保存</span>}
					{configured && !saved && <span className="success-message"><Check size={16} />已配置</span>}
				</div>
			</section>
		</div>
	);
}
