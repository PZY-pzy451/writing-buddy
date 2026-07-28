import {
	BookOpenText,
	Check,
	ChevronLeft,
	ChevronRight,
	FileCheck2,
	FolderOpen,
	LayoutTemplate,
	LoaderCircle,
	Palette,
	Sparkles,
	X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	projectTemplateRegistry,
	type InitialResourceId,
	type ProjectAccentId,
	type ProjectThemeId,
	type ProjectType
} from '@writing-buddy/project';
import type {
	CreateProjectRequest,
	ProjectCreationIssue,
	ProjectCreationPreflight,
	ProjectWritingMode
} from '@writing-buddy/platform-ports';
import { useModalFocus } from '../../../accessibility/useModalFocus';
import { useAppStore } from '../../../app/store';
import { desktopBridge } from '../../../platform/bridge';
import {
	ProjectCreationError,
	ProjectCreationService
} from '../application/ProjectCreationService';

const creationService = new ProjectCreationService(desktopBridge);
const templates = projectTemplateRegistry.list();
const themes: readonly { id: ProjectThemeId; title: string; description: string }[] = [
	{ id: 'paper', title: '纸页', description: '温暖、安静，适合长时间写作' },
	{ id: 'midnight', title: '深夜', description: '低亮度深色工作空间' },
	{ id: 'fog', title: '薄雾', description: '冷静、轻盈的灰蓝界面' },
	{ id: 'focus', title: '专注', description: '更克制的正文优先体验' }
];
const accents: readonly { id: ProjectAccentId; title: string; color: string }[] = [
	{ id: 'gold', title: '琥珀', color: '#B66A36' },
	{ id: 'blue', title: '静蓝', color: '#4F7DB8' },
	{ id: 'purple', title: '暮紫', color: '#7E5BA6' }
];
const steps = [
	{ title: '基础信息', Icon: BookOpenText },
	{ title: '初始结构', Icon: LayoutTemplate },
	{ title: '外观与写作方式', Icon: Palette },
	{ title: '确认创建', Icon: FileCheck2 }
] as const;

interface WizardDraft {
	readonly name: string;
	readonly description: string;
	readonly rootDirectory: string;
	readonly projectType: ProjectType;
	readonly language: string;
	readonly templateId: string;
	readonly selectedInitialResources: readonly InitialResourceId[];
	readonly themeId: ProjectThemeId;
	readonly accentId: ProjectAccentId;
	readonly writingMode: ProjectWritingMode;
}

function defaultDraft(): WizardDraft {
	const template = projectTemplateRegistry.get('blank-longform');
	return {
		name: '',
		description: '',
		rootDirectory: '',
		projectType: template.projectType,
		language: 'zh-CN',
		templateId: template.id,
		selectedInitialResources: template.initialResources
			.filter(resource => resource.defaultSelected)
			.map(resource => resource.id),
		themeId: template.defaultThemeId,
		accentId: template.defaultAccentId,
		writingMode: 'manuscriptFirst'
	};
}

function toRequest(draft: WizardDraft): CreateProjectRequest {
	return {
		...draft,
		selectedInitialResources: [...draft.selectedInitialResources]
	};
}

const createErrorCopy: Readonly<Record<string, string>> = {
	projectTargetExists: '同名作品目录已经存在，不会自动覆盖。',
	projectParentUnavailable: '保存位置不存在或当前不可访问。',
	projectParentReadOnly: '保存位置为只读，无法创建作品。',
	projectStagingCreateFailed: '无法建立安全的临时创建目录。',
	projectStagingWriteFailed: '写入项目结构时中断，临时内容已清理。',
	projectStagingVerifyFailed: '项目结构校验失败，未保留半成品。',
	projectAtomicRenameFailed: '最终保存项目时失败，未覆盖任何现有目录。',
	projectCreationFailed: '暂时无法创建作品，请检查保存位置后重试。'
};

function fieldIssue(issues: readonly ProjectCreationIssue[], field: ProjectCreationIssue['field']): string | undefined {
	return issues.find(issue => issue.field === field)?.message;
}

export function ProjectCreationWizard(): React.JSX.Element | null {
	const open = useAppStore(state => state.projectWizardOpen);
	const close = useAppStore(state => state.closeProjectWizard);
	const openProject = useAppStore(state => state.openProject);
	const openResource = useAppStore(state => state.openResource);
	const openDashboard = useAppStore(state => state.openDashboard);
	const setError = useAppStore(state => state.setError);
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<WizardDraft>(defaultDraft);
	const [preflight, setPreflight] = useState<ProjectCreationPreflight>();
	const [issues, setIssues] = useState<readonly ProjectCreationIssue[]>([]);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState('');

	const request = useMemo(() => toRequest(draft), [draft]);
	const isDirty = JSON.stringify(draft) !== JSON.stringify(defaultDraft());

	const reset = () => {
		setStep(0);
		setDraft(defaultDraft());
		setPreflight(undefined);
		setIssues([]);
		setBusy(false);
		setStatus('');
	};

	const dismiss = () => {
		if (busy) return;
		if (isDirty) {
			const retain = window.confirm('关闭新建作品向导并保留当前表单草稿吗？');
			if (!retain) reset();
		}
		close();
	};
	const dialogRef = useModalFocus(dismiss, open);

	if (!open) return null;

	const updateDraft = <Key extends keyof WizardDraft>(key: Key, value: WizardDraft[Key]) => {
		setDraft(current => ({ ...current, [key]: value }));
		setIssues([]);
		setPreflight(undefined);
	};

	const selectTemplate = (templateId: string) => {
		const template = projectTemplateRegistry.get(templateId);
		setDraft(current => ({
			...current,
			templateId: template.id,
			projectType: template.projectType,
			selectedInitialResources: template.initialResources
				.filter(resource => resource.defaultSelected)
				.map(resource => resource.id),
			themeId: template.defaultThemeId,
			accentId: template.defaultAccentId
		}));
		setIssues([]);
		setPreflight(undefined);
	};

	const browse = async () => {
		const root = await creationService.chooseParentDirectory();
		if (root) updateDraft('rootDirectory', root);
	};

	const runPreflight = async (): Promise<boolean> => {
		setBusy(true);
		setStatus('正在检查名称、路径与创建计划…');
		try {
			const result = await creationService.preflight(request);
			setPreflight(result);
			setIssues(result.issues);
			setStatus(result.valid ? '检查通过，可以安全创建。' : '请先修正标记的问题。');
			return result.valid;
		} catch {
			setIssues([{
				field: 'request',
				code: 'projectCreationPreflightFailed',
				message: '无法完成创建前检查，请重试。'
			}]);
			setStatus('创建前检查失败。');
			return false;
		} finally {
			setBusy(false);
		}
	};

	const next = async () => {
		if (step === 0 || step === 2) {
			if (!await runPreflight()) return;
		}
		setStep(current => Math.min(3, current + 1));
	};

	const create = async () => {
		setBusy(true);
		setStatus('正在安全创建项目并验证可重新打开…');
		try {
			const created = await creationService.create(request);
			await openProject(created.root);
			const state = useAppStore.getState();
			const chapter = created.firstChapterId
				? state.snapshot?.project.volumes
					.flatMap(volume => volume.chapters)
					.find(candidate => candidate.id === created.firstChapterId)
				: undefined;
			if (chapter && state.snapshot && draft.writingMode === 'manuscriptFirst') {
				await openResource({
					id: chapter.id,
					type: 'chapter',
					title: chapter.title,
					path: chapter.file,
					projectId: state.snapshot.project.projectId
				});
			} else {
				openDashboard();
			}
			close();
			reset();
		} catch (error) {
			const code = error instanceof ProjectCreationError ? error.code : 'projectCreationFailed';
			setError(createErrorCopy[code] ?? createErrorCopy.projectCreationFailed);
			setStatus(createErrorCopy[code] ?? createErrorCopy.projectCreationFailed);
		} finally {
			setBusy(false);
		}
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (busy) return;
		if (step === 3) void create();
		else void next();
	};

	const selectedTemplate = projectTemplateRegistry.get(draft.templateId);

	return (
		<div className="modal-backdrop project-wizard-backdrop" role="presentation">
			<form
				ref={dialogRef as React.RefObject<HTMLFormElement>}
				className="project-wizard"
				role="dialog"
				aria-modal="true"
				aria-labelledby="project-wizard-title"
				aria-describedby="project-wizard-description"
				onSubmit={submit}
				tabIndex={-1}
			>
				<header className="project-wizard-header">
					<div>
						<span className="eyebrow">NEW PROJECT</span>
						<h2 id="project-wizard-title">新建作品</h2>
						<p id="project-wizard-description">建立项目结构、外观与写作方式</p>
					</div>
					<button className="icon-button" type="button" aria-label="关闭新建作品向导" onClick={dismiss} disabled={busy}>
						<X size={20} />
					</button>
				</header>

				<nav className="wizard-step-rail" aria-label="创建步骤">
					{steps.map(({ title, Icon }, index) => {
						const complete = index < step;
						const current = index === step;
						const errorCount = current ? issues.length : 0;
						return (
							<button
								type="button"
								key={title}
								className={current ? 'is-current' : complete ? 'is-complete' : ''}
								aria-current={current ? 'step' : undefined}
								onClick={() => {
									if (index <= step) setStep(index);
								}}
								disabled={index > step || busy}
							>
								<span className="wizard-step-index">
									{complete ? <Check size={16} /> : <span>{index + 1}</span>}
								</span>
								<span className="wizard-step-copy">
									<strong>{title}</strong>
									<small>{errorCount ? `${errorCount} 个问题` : complete ? '已完成' : current ? '当前步骤' : '待完成'}</small>
								</span>
								<Icon className="wizard-step-icon" size={18} aria-hidden="true" />
							</button>
						);
					})}
				</nav>

				<section className="wizard-content">
					{step === 0 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-basics-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 1</span>
								<h3 id="wizard-basics-title">项目基础信息</h3>
								<p>先为作品命名，选择保存位置和项目模板。</p>
							</div>
							<label className="wizard-field">
								<span>作品名称</span>
								<input
									autoFocus
									aria-label="作品名称"
									value={draft.name}
									maxLength={80}
									onChange={event => updateDraft('name', event.target.value)}
									aria-invalid={Boolean(fieldIssue(issues, 'name'))}
									aria-describedby={fieldIssue(issues, 'name') ? 'wizard-name-error' : undefined}
									placeholder="例如：桥下的画师"
								/>
								{fieldIssue(issues, 'name') && <small className="wizard-field-error" id="wizard-name-error">{fieldIssue(issues, 'name')}</small>}
							</label>
							<label className="wizard-field">
								<span>作品说明 <small>可选</small></span>
								<textarea
									aria-label="作品说明"
									value={draft.description}
									maxLength={300}
									onChange={event => updateDraft('description', event.target.value)}
									placeholder="用一两句话记录这部作品的方向。"
								/>
							</label>
							<div className="wizard-field">
								<span>保存位置</span>
								<div className="wizard-path-row">
									<input
										aria-label="保存位置"
										value={draft.rootDirectory}
										onChange={event => updateDraft('rootDirectory', event.target.value)}
										aria-invalid={Boolean(fieldIssue(issues, 'rootDirectory'))}
										aria-describedby={fieldIssue(issues, 'rootDirectory') ? 'wizard-root-error' : undefined}
										placeholder="选择用于保存作品的父目录"
									/>
									<button className="secondary-button" type="button" onClick={() => void browse()}>
										<FolderOpen size={18} />浏览
									</button>
								</div>
								{fieldIssue(issues, 'rootDirectory') && <small className="wizard-field-error" id="wizard-root-error">{fieldIssue(issues, 'rootDirectory')}</small>}
							</div>
							<div className="wizard-two-columns">
								<label className="wizard-field">
									<span>项目类型</span>
									<select value={draft.projectType} onChange={event => updateDraft('projectType', event.target.value as ProjectType)}>
										<option value="longform">长篇小说</option>
										<option value="novella">中篇小说</option>
										<option value="short">短篇小说</option>
										<option value="series">系列作品</option>
									</select>
								</label>
								<label className="wizard-field">
									<span>语言</span>
									<select value={draft.language} onChange={event => updateDraft('language', event.target.value)}>
										<option value="zh-CN">简体中文</option>
										<option value="zh-TW">繁体中文</option>
										<option value="en">English</option>
									</select>
								</label>
							</div>
							<fieldset className="template-selector">
								<legend>项目模板</legend>
								{templates.map(template => (
									<button
										type="button"
										key={template.id}
										className={draft.templateId === template.id ? 'is-selected' : ''}
										aria-pressed={draft.templateId === template.id}
										onClick={() => selectTemplate(template.id)}
									>
										<strong>{template.title}</strong>
										<small>{template.description}</small>
									</button>
								))}
							</fieldset>
						</div>
					)}

					{step === 1 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-structure-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 2</span>
								<h3 id="wizard-structure-title">初始结构</h3>
								<p>{selectedTemplate.title} 已提供推荐项，你可以逐项调整。</p>
							</div>
							<div className="structure-card-grid">
								{selectedTemplate.initialResources.map(resource => {
									const selected = draft.selectedInitialResources.includes(resource.id);
									const locked = resource.id === 'first-volume'
										&& draft.selectedInitialResources.includes('first-chapter');
									return (
										<label key={resource.id} className={selected ? 'structure-card is-selected' : 'structure-card'}>
											<input
												type="checkbox"
												checked={selected}
												disabled={locked}
												onChange={() => {
													const next = selected
														? draft.selectedInitialResources.filter(id => id !== resource.id)
														: [...draft.selectedInitialResources, resource.id];
													updateDraft('selectedInitialResources', next);
												}}
											/>
											<span className="structure-check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
											<span><strong>{resource.title}</strong><small>{resource.description}</small></span>
										</label>
									);
								})}
							</div>
							{fieldIssue(issues, 'selectedInitialResources') && (
								<p className="wizard-inline-error" role="alert">{fieldIssue(issues, 'selectedInitialResources')}</p>
							)}
						</div>
					)}

					{step === 2 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-appearance-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 3</span>
								<h3 id="wizard-appearance-title">外观与写作方式</h3>
								<p>主题会保存在项目中，下次打开时自动恢复。</p>
							</div>
							<div className="appearance-layout">
								<fieldset className="theme-card-grid">
									<legend>主题</legend>
									{themes.map(theme => (
										<button
											type="button"
											key={theme.id}
											className={`theme-choice theme-${theme.id} ${draft.themeId === theme.id ? 'is-selected' : ''}`}
											aria-pressed={draft.themeId === theme.id}
											onClick={() => updateDraft('themeId', theme.id)}
										>
											<span className="theme-choice-preview" aria-hidden="true"><i /><i /><i /></span>
											<span><strong>{theme.title}</strong><small>{theme.description}</small></span>
											{draft.themeId === theme.id && <Check size={18} aria-label="已选择" />}
										</button>
									))}
								</fieldset>
								<div className={`workspace-mini-preview theme-${draft.themeId} accent-${draft.accentId}`} aria-label="主题实时预览">
									<div className="mini-preview-shell" />
									<div className="mini-preview-sidebar" />
									<div className="mini-preview-page">
										<span />
										<span />
										<span />
									</div>
									<small>{themes.find(theme => theme.id === draft.themeId)?.title} · {accents.find(accent => accent.id === draft.accentId)?.title}</small>
								</div>
							</div>
							<fieldset className="accent-picker">
								<legend>强调色</legend>
								{accents.map(accent => (
									<button
										type="button"
										key={accent.id}
										aria-pressed={draft.accentId === accent.id}
										className={draft.accentId === accent.id ? 'is-selected' : ''}
										onClick={() => updateDraft('accentId', accent.id)}
									>
										<i style={{ background: accent.color }} />{accent.title}
										{draft.accentId === accent.id && <Check size={16} />}
									</button>
								))}
							</fieldset>
							<fieldset className="writing-mode-picker">
								<legend>写作方式</legend>
								{([
									['manuscriptFirst', '正文优先', '创建后直接打开第一章。'],
									['planningFirst', '故事规划优先', '创建后先查看作品仪表盘。']
								] as const).map(([id, title, description]) => (
									<button
										type="button"
										key={id}
										aria-pressed={draft.writingMode === id}
										className={draft.writingMode === id ? 'is-selected' : ''}
										onClick={() => updateDraft('writingMode', id)}
									>
										<strong>{title}</strong><small>{description}</small>
									</button>
								))}
							</fieldset>
						</div>
					)}

					{step === 3 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-review-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 4</span>
								<h3 id="wizard-review-title">确认创建</h3>
								<p>写入前最后检查。不会覆盖同名目录，也不会自动调用 AI。</p>
							</div>
							<div className="creation-summary">
								<div className="creation-summary-title">
									<span className="welcome-mark" aria-hidden="true"><BookOpenText size={24} /></span>
									<div><strong>{draft.name || '未命名作品'}</strong><small>{preflight?.targetRoot ?? '尚未完成路径检查'}</small></div>
								</div>
								<dl>
									<div><dt>模板</dt><dd>{selectedTemplate.title}</dd></div>
									<div><dt>主题</dt><dd>{themes.find(theme => theme.id === draft.themeId)?.title} · {accents.find(accent => accent.id === draft.accentId)?.title}</dd></div>
									<div><dt>写作方式</dt><dd>{draft.writingMode === 'manuscriptFirst' ? '正文优先' : '故事规划优先'}</dd></div>
									<div><dt>AI 快速入口</dt><dd>{draft.selectedInitialResources.includes('ai-quick-actions') ? '启用（不自动请求）' : '关闭'}</dd></div>
									<div><dt>初始资源</dt><dd>{draft.selectedInitialResources.length} 项</dd></div>
									<div><dt>创建规模</dt><dd>{preflight?.createdDirectoryCount ?? '—'} 个目录 · {preflight?.createdFileCount ?? '—'} 个文件</dd></div>
								</dl>
								<div className="creation-safety-note">
									<Check size={18} />
									<span><strong>安全创建事务</strong><small>同级 staging 写入 → 重新读取验证 → 原子保存到目标目录</small></span>
								</div>
							</div>
							{issues.length > 0 && (
								<div className="wizard-review-errors" role="alert">
									{issues.map(issue => <p key={`${issue.field}:${issue.code}`}>{issue.message}</p>)}
								</div>
							)}
						</div>
					)}
				</section>

				<footer className="wizard-footer">
					<button className="secondary-button wizard-cancel" type="button" onClick={dismiss} disabled={busy}>取消</button>
					<div className="wizard-status" role="status" aria-live="polite">
						{busy && <LoaderCircle className="spin" size={16} />}
						<span>{status}</span>
					</div>
					{step > 0 && (
						<button className="secondary-button" type="button" onClick={() => setStep(current => current - 1)} disabled={busy}>
							<ChevronLeft size={18} />上一步
						</button>
					)}
					<button className="primary-button wizard-next" type="submit" disabled={busy}>
						{step === 3 ? <><Sparkles size={18} />{busy ? '正在创建…' : '创建作品'}</> : <>下一步<ChevronRight size={18} /></>}
					</button>
				</footer>
			</form>
		</div>
	);
}
