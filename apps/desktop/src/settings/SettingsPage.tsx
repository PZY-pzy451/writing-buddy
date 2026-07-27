import { Bot, Check, Palette, TextCursorInput } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, type ThemeId } from '../app/store';
import { AiSettingsSection } from '../features/ai/AiSettingsSection';

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
	const [tab, setTab] = useState<'appearance' | 'ai'>('appearance');

	return (
		<div className="system-page settings-page">
			<header>
				<span className="eyebrow">Preferences</span>
				<h1>应用设置</h1>
				<p>界面、AI 配置与使用统计保存在应用数据目录，不会写入小说项目。</p>
				<div className="settings-tabs" role="tablist" aria-label="设置类别">
					<button type="button" role="tab" aria-selected={tab === 'appearance'} onClick={() => setTab('appearance')}>
						<Palette size={17} />外观
					</button>
					<button type="button" role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>
						<Bot size={17} />AI 与模型
					</button>
				</div>
			</header>
			{tab === 'appearance' ? (
				<>
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
				</>
			) : <AiSettingsSection />}
		</div>
	);
}
