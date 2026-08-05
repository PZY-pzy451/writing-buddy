import {
	Check,
	ChevronDown,
	ChevronUp,
	Eye,
	EyeOff,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
	X
} from 'lucide-react';
import { useState } from 'react';
import { useModalFocus } from '../../accessibility/useModalFocus';
import type {
	GenreToOutlineInput,
	StoryScale
} from './CreationJourneyModel';

const genrePresets = [
	'都市悬疑',
	'悬疑 + 科幻',
	'古代权谋 + 群像',
	'末日生存 + 公路',
	'奇幻冒险',
	'现实主义成长'
] as const;

const scaleOptions: readonly {
	readonly id: StoryScale;
	readonly label: string;
}[] = [
	{ id: 'short', label: '短篇' },
	{ id: 'novella', label: '中篇' },
	{ id: 'novel', label: '长篇' },
	{ id: 'serial', label: '连载' }
];

const toneOptions = ['克制', '黑暗', '轻松', '热血', '温暖', '冷峻'] as const;

function commaSeparated(value: string): string[] {
	return [...new Set(value
		.split(/[,，、]/u)
		.map(item => item.trim())
		.filter(Boolean))]
		.slice(0, 12);
}

function joined(values: readonly string[]): string {
	return values.join('，');
}

interface GenreToOutlineStartProps {
	readonly input: GenreToOutlineInput;
	readonly readOnly: boolean;
	readonly busy: boolean;
	readonly status: string;
	readonly onChange: (
		patch: Partial<Omit<GenreToOutlineInput, 'projectId'>>
	) => void;
	readonly onGenerate: () => void;
	readonly onCancel: () => void;
}

export function GenreToOutlineStart({
	input,
	readOnly,
	busy,
	status,
	onChange,
	onGenerate,
	onCancel
}: GenreToOutlineStartProps): React.JSX.Element {
	const [previewOpen, setPreviewOpen] = useState(false);
	const closePreview = () => setPreviewOpen(false);
	const previewRef = useModalFocus(closePreview, previewOpen);
	const deep = input.mode === 'deep';
	const valid = Boolean(input.genre.trim());

	const toggleTone = (tone: string) => {
		const tones = input.tones.includes(tone)
			? input.tones.filter(candidate => candidate !== tone)
			: [...input.tones, tone];
		onChange({ tones });
	};

	const included = [
		['题材', input.genre.trim()],
		['一句话设想', input.premise?.trim() ?? ''],
		['故事规模', scaleOptions.find(option => option.id === input.scale)?.label ?? ''],
		['整体氛围', joined(input.tones)],
		['主角提示', joined(input.protagonistHints)],
		['希望包含', joined(input.requiredElements)],
		['不希望出现', joined(input.excludedElements)],
		['结局倾向', input.endingPreference ?? ''],
		['目标读者', input.audience?.trim() ?? ''],
		['结构模板', input.structureTemplateId?.trim() ?? '']
	].filter((row): row is [string, string] => Boolean(row[1]));

	return (
		<div className="genre-outline-start">
			<div className="genre-outline-intro">
				<span className="eyebrow">GENRE TO OUTLINE</span>
				<h2 id="creation-journey-heading">创建你的故事</h2>
				<p>先给出题材。AI 只生成可编辑的大纲草稿，不会创建章节、正文或资料记录。</p>
			</div>

			<div className="genre-outline-form">
				<label className="genre-outline-field is-wide">
					<span>选择题材 <em>必填</em></span>
					<input
						list="genre-outline-presets"
						aria-label="选择题材"
						autoComplete="off"
						value={input.genre}
						maxLength={240}
						disabled={readOnly || busy}
						placeholder="搜索、选择或输入组合题材，例如：都市悬疑 + 科幻"
						onChange={event => onChange({ genre: event.target.value })}
					/>
					<datalist id="genre-outline-presets">
						{genrePresets.map(genre => <option value={genre} key={genre} />)}
					</datalist>
					<small>支持搜索、自定义输入与多题材组合，不限制为单个枚举。</small>
				</label>

				<label className="genre-outline-field is-wide">
					<span>用一句话描述你的故事（可选）</span>
					<textarea
						aria-label="用一句话描述你的故事（可选）"
						value={input.premise ?? ''}
						maxLength={2_000}
						disabled={readOnly || busy}
						placeholder="例如：一个能看到死亡日期的人遇到一个没有日期的人……"
						onChange={event => onChange({ premise: event.target.value })}
					/>
				</label>

				<button
					className="genre-outline-more"
					type="button"
					data-testid="genre-outline-more-toggle"
					aria-expanded={deep}
					disabled={readOnly || busy}
					onClick={() => onChange({ mode: deep ? 'quick' : 'deep' })}
				>
					{deep ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
					{deep ? '收起更多控制' : '更多控制'}
				</button>

				{deep && (
					<div className="genre-outline-deep">
						<fieldset className="genre-outline-choice-field">
							<legend>故事规模</legend>
							<div>
								{scaleOptions.map(option => (
									<button
										type="button"
										key={option.id}
										data-testid="genre-outline-choice-option"
										data-choice-kind="scale"
										data-choice-value={option.id}
										aria-pressed={input.scale === option.id}
										disabled={readOnly || busy}
										onClick={() => onChange({ scale: option.id })}
									>
										{input.scale === option.id && <Check size={16} />}
										{option.label}
									</button>
								))}
							</div>
						</fieldset>

						<fieldset className="genre-outline-choice-field">
							<legend>整体氛围</legend>
							<div>
								{toneOptions.map(tone => (
									<button
										type="button"
										key={tone}
										data-testid="genre-outline-choice-option"
										data-choice-kind="tone"
										data-choice-value={tone}
										aria-pressed={input.tones.includes(tone)}
										disabled={readOnly || busy}
										onClick={() => toggleTone(tone)}
									>
										{input.tones.includes(tone) && <Check size={16} />}
										{tone}
									</button>
								))}
							</div>
						</fieldset>

						<label className="genre-outline-field">
							<span>主角提示</span>
							<input
								aria-label="主角提示"
								value={joined(input.protagonistHints)}
								maxLength={1_000}
								disabled={readOnly || busy}
								placeholder="用逗号分隔，例如：调查记者，失踪者家属"
								onChange={event => onChange({
									protagonistHints: commaSeparated(event.target.value)
								})}
							/>
						</label>

						<label className="genre-outline-field">
							<span>目标读者</span>
							<input
								aria-label="目标读者"
								value={input.audience ?? ''}
								maxLength={500}
								disabled={readOnly || busy}
								placeholder="例如：成年悬疑读者"
								onChange={event => onChange({ audience: event.target.value })}
							/>
						</label>

						<label className="genre-outline-field">
							<span>希望包含</span>
							<input
								aria-label="希望包含"
								value={joined(input.requiredElements)}
								maxLength={1_000}
								disabled={readOnly || busy}
								placeholder="用逗号分隔"
								onChange={event => onChange({
									requiredElements: commaSeparated(event.target.value)
								})}
							/>
						</label>

						<label className="genre-outline-field">
							<span>不希望出现</span>
							<input
								aria-label="不希望出现"
								value={joined(input.excludedElements)}
								maxLength={1_000}
								disabled={readOnly || busy}
								placeholder="用逗号分隔"
								onChange={event => onChange({
									excludedElements: commaSeparated(event.target.value)
								})}
							/>
						</label>

						<label className="genre-outline-field">
							<span>结局倾向</span>
							<select
								aria-label="结局倾向"
								value={input.endingPreference ?? 'unspecified'}
								disabled={readOnly || busy}
								onChange={event => onChange({
									endingPreference: event.target.value as GenreToOutlineInput['endingPreference']
								})}
							>
								<option value="unspecified">暂不限定</option>
								<option value="open">开放</option>
								<option value="hopeful">希望</option>
								<option value="tragic">悲剧</option>
								<option value="bittersweet">苦甜</option>
								<option value="surprising">意外</option>
							</select>
						</label>

						<label className="genre-outline-field">
							<span>结构倾向</span>
							<select
								aria-label="结构倾向"
								value={input.structureTemplateId ?? ''}
								disabled={readOnly || busy}
								onChange={event => onChange({
									structureTemplateId: event.target.value || undefined
								})}
							>
								<option value="">由故事决定</option>
								<option value="three-act">三幕式</option>
								<option value="mystery-investigation">调查推进</option>
								<option value="character-arc">人物弧线</option>
								<option value="serial-arcs">连载单元</option>
							</select>
						</label>
					</div>
				)}
			</div>

			{busy && (
				<div className="genre-outline-progress" role="status" aria-live="polite">
					<div>
						<LoaderCircle className="spin" size={20} />
						<strong>{status}</strong>
					</div>
					<ol>
						<li>正在整理题材</li>
						<li>正在构建故事核心</li>
						<li>正在生成结构节点</li>
						<li>正在校验大纲</li>
					</ol>
					<button type="button" onClick={onCancel}>
						<X size={18} />停止生成
					</button>
				</div>
			)}

			{!busy && (
				<div className="genre-outline-actions">
					<button
						type="button"
						className="secondary-button"
						disabled={!valid}
						onClick={() => setPreviewOpen(true)}
					>
						<Eye size={18} />查看生成依据
					</button>
					<button
						type="button"
						className="primary-button"
						disabled={!valid || readOnly}
						onClick={() => setPreviewOpen(true)}
					>
						<Sparkles size={18} />生成小说大纲
					</button>
				</div>
			)}

			{previewOpen && (
				<div className="genre-context-backdrop" role="presentation">
					<section
						ref={previewRef}
						className="genre-context-preview"
						role="dialog"
						aria-modal="true"
						aria-labelledby="genre-context-title"
						tabIndex={-1}
					>
						<header>
							<div>
								<span className="eyebrow">CONTEXT PREVIEW</span>
								<h3 id="genre-context-title">生成依据</h3>
							</div>
							<button type="button" aria-label="关闭生成依据" onClick={closePreview}>
								<X size={18} />
							</button>
						</header>
						<div className="genre-context-columns">
							<section aria-labelledby="genre-context-included">
								<h4 id="genre-context-included">
									<ShieldCheck size={18} />本次会使用
								</h4>
								<dl>
									{included.map(([label, value]) => (
										<div key={label}>
											<dt>{label}</dt>
											<dd>{value}</dd>
										</div>
									))}
								</dl>
							</section>
							<section aria-labelledby="genre-context-excluded">
								<h4 id="genre-context-excluded">
									<EyeOff size={18} />默认不会发送
								</h4>
								<ul>
									<li>全部正文</li>
									<li>未明确选择的人物秘密与世界设定</li>
									<li>API Key 与账户秘密</li>
									<li>绝对路径与其他项目内容</li>
								</ul>
							</section>
						</div>
						<footer>
							<p>只有上方列出的作者输入会进入这次请求。</p>
							<button type="button" className="secondary-button" onClick={closePreview}>
								返回修改
							</button>
							<button
								type="button"
								className="primary-button"
								onClick={() => {
									closePreview();
									onGenerate();
								}}
							>
								<Sparkles size={18} />确认并生成
							</button>
						</footer>
					</section>
				</div>
			)}
		</div>
	);
}
