import {
	BookOpenText,
	Check,
	ChevronLeft,
	ChevronRight,
	FileCheck2,
	FileText,
	FileUp,
	FolderOpen,
	LayoutTemplate,
	Lightbulb,
	LoaderCircle,
	Palette,
	Sparkles,
	X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { CreationStartRoute } from '../../creation-journey/CreationJourneyModel';
import {
	analyzeDraftImport,
	toProjectImportSource,
	type DraftImportAnalysis
} from '../application/DraftImportModel';
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
	{ title: '创作起点', Icon: Lightbulb },
	{ title: '初始结构', Icon: LayoutTemplate },
	{ title: '外观与写作方式', Icon: Palette },
	{ title: '确认创建', Icon: FileCheck2 }
] as const;

const creationStartOptions: readonly {
	readonly id: CreationStartRoute;
	readonly title: string;
	readonly description: string;
	readonly result: string;
}[] = [
	{ id: 'genre', title: '根据题材生成小说大纲', description: '提供题材与可选创作条件，生成一份由你继续编辑、排序和锁定的结构化大纲。', result: '进入题材创作旅程（推荐）' },
	{ id: 'ideas', title: '我只有几个想法', description: '记录 3–8 个零散要素，再逐步确认故事核心、方向和总纲。', result: '进入完整创作旅程（推荐）' },
	{ id: 'synopsis', title: '我已经有故事梗概', description: '保留现有规划与资料工具，不自动改写梗概。', result: '进入作品仪表盘' },
	{ id: 'character-world', title: '我先有了人物或世界', description: '保留人物和世界资料入口，不强迫先完成数据库。', result: '进入作品仪表盘' },
	{ id: 'outline', title: '我已经有完整大纲', description: '选择本地大纲，预览识别结果后创建章节；原始文件会保留。', result: '导入章节并进入作品仪表盘' },
	{ id: 'manuscript', title: '我已经写了一部分正文', description: '选择本地正文，内容不经 AI 改写，原样写入第一章。', result: '导入并打开第一章' },
	{ id: 'blank', title: '空白项目', description: '只创建最小项目，不生成章节、设定或 AI 内容。', result: '进入空白作品' }
] as const;

interface WizardDraft {
	readonly name: string;
	readonly description: string;
	readonly rootDirectory: string;
	readonly projectType: ProjectType;
	readonly language: string;
	readonly startRoute: CreationStartRoute;
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
		startRoute: 'genre',
		templateId: template.id,
		selectedInitialResources: resourcesForStartRoute(
			template.initialResources
				.filter(resource => resource.defaultSelected)
				.map(resource => resource.id),
			'genre'
		),
		themeId: template.defaultThemeId,
		accentId: template.defaultAccentId,
		writingMode: 'manuscriptFirst'
	};
}

function draftWithStartRoute(
	current: WizardDraft,
	startRoute: CreationStartRoute
): WizardDraft {
	return {
		...current,
		startRoute,
		selectedInitialResources: resourcesForStartRoute(
			current.selectedInitialResources,
			startRoute
		),
		writingMode: startRoute === 'manuscript'
			? 'manuscriptFirst'
			: 'planningFirst'
	};
}

function toRequest(
	draft: WizardDraft,
	importAnalysis?: DraftImportAnalysis
): CreateProjectRequest {
	const selectedInitialResources = resourcesForStartRoute(
		draft.selectedInitialResources,
		draft.startRoute
	);
	return {
		name: draft.name,
		description: draft.description,
		rootDirectory: draft.rootDirectory,
		projectType: draft.projectType,
		language: draft.language,
		templateId: draft.templateId,
		selectedInitialResources,
		themeId: draft.themeId,
		accentId: draft.accentId,
		writingMode: draft.writingMode,
		...(importAnalysis ? { importSource: toProjectImportSource(importAnalysis) } : {})
	};
}

function resourcesForStartRoute(
	resources: readonly InitialResourceId[],
	route: CreationStartRoute
): InitialResourceId[] {
	if (route === 'blank') return [];
	const selected = new Set(resources);
	if (route === 'genre' || route === 'ideas') {
		selected.add('first-volume');
		selected.delete('first-chapter');
	}
	if (route === 'manuscript') {
		selected.add('first-volume');
		selected.add('first-chapter');
	}
	if (route === 'outline') {
		selected.add('first-volume');
		selected.delete('first-chapter');
	}
	return [...selected];
}

const createErrorCopy: Readonly<Record<string, string>> = {
	projectTargetExists: '同名项目目录已经存在，不会自动覆盖。',
	projectParentUnavailable: '保存位置不存在或当前不可访问。',
	projectParentReadOnly: '保存位置为只读，无法创建项目。',
	projectStagingCreateFailed: '无法建立安全的临时创建目录。',
	projectStagingWriteFailed: '写入项目结构时中断，临时内容已清理。',
	projectStagingVerifyFailed: '项目结构校验失败，未保留半成品。',
	projectAtomicRenameFailed: '最终保存项目时失败，未覆盖任何现有目录。',
	importUnsupportedFormat: '仅支持 UTF-8 编码的 Markdown（.md/.markdown）或文本（.txt）文件。',
	importSourceTooLarge: '文件超过 5 MiB，请拆分后再导入。',
	importSourceBinary: '所选文件包含二进制内容，无法作为大纲或正文导入。',
	importSourceInvalidUtf8: '所选文件不是有效的 UTF-8 文本。',
	importSourceEmpty: '所选文件没有可导入的文字。',
	importOutlineHasNoChapters: '没有识别到明确的章节标题。请使用“第一章 / Chapter 1 / 1. 标题”等行标记章节。',
	importOutlineTooManyChapters: '一次最多导入 200 章，请拆分大纲后重试。',
	importChapterTitleTooLong: '大纲中有超过 120 个字符的章节标题，请缩短后重试。',
	importSourceReadFailed: '无法读取所选文件，请检查文件权限后重试。',
	projectCreationFailed: '暂时无法创建项目，请检查保存位置后重试。'
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
	const openCreationJourney = useAppStore(state => state.openCreationJourney);
	const setError = useAppStore(state => state.setError);
	const currentProjectTitle = useAppStore(state => state.snapshot?.project.title);
	const currentManuscriptDirty = useAppStore(state => Boolean(state.session?.state.dirty));
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<WizardDraft>(() => {
		const initial = defaultDraft();
		const requested = useAppStore.getState().projectWizardStartRoute;
		return requested ? draftWithStartRoute(initial, requested) : initial;
	});
	const [preflight, setPreflight] = useState<ProjectCreationPreflight>();
	const [issues, setIssues] = useState<readonly ProjectCreationIssue[]>([]);
	const [importAnalysis, setImportAnalysis] = useState<DraftImportAnalysis>();
	const [importError, setImportError] = useState('');
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState('');
	const contentRef = useRef<HTMLElement>(null);

	useEffect(() => {
		contentRef.current?.scrollTo?.({ top: 0 });
	}, [step]);

	const request = useMemo(() => toRequest(draft, importAnalysis), [draft, importAnalysis]);
	const isDirty = Boolean(importAnalysis) || JSON.stringify(draft) !== JSON.stringify(defaultDraft());

	const reset = () => {
		setStep(0);
		setDraft(defaultDraft());
		setPreflight(undefined);
		setIssues([]);
		setImportAnalysis(undefined);
		setImportError('');
		setBusy(false);
		setStatus('');
	};

	const dismiss = () => {
		if (busy) return;
		if (isDirty) {
			const retain = window.confirm('关闭新建项目向导并保留当前表单草稿吗？');
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
			selectedInitialResources: resourcesForStartRoute(
				template.initialResources
					.filter(resource => resource.defaultSelected)
					.map(resource => resource.id),
				current.startRoute
			),
			themeId: template.defaultThemeId,
			accentId: template.defaultAccentId
		}));
		setIssues([]);
		setPreflight(undefined);
	};

	const selectStartRoute = (startRoute: CreationStartRoute) => {
		setDraft(current => draftWithStartRoute(current, startRoute));
		if (startRoute !== draft.startRoute) {
			setImportAnalysis(undefined);
			setImportError('');
		}
		setIssues([]);
		setPreflight(undefined);
	};

	const browse = async () => {
		const root = await creationService.chooseParentDirectory();
		if (root) updateDraft('rootDirectory', root);
	};

	const chooseImport = async () => {
		if (draft.startRoute !== 'outline' && draft.startRoute !== 'manuscript') return;
		setBusy(true);
		setImportError('');
		setStatus(draft.startRoute === 'outline' ? '请选择 UTF-8 大纲文件…' : '请选择 UTF-8 正文文件…');
		try {
			const file = await creationService.chooseImportedText(draft.startRoute);
			if (!file) {
				setStatus(importAnalysis ? '已取消选择，保留当前导入文件。' : '已取消选择，尚未添加文件。');
				return;
			}
			const analysis = analyzeDraftImport(file, draft.startRoute);
			setImportAnalysis(analysis);
			setIssues([]);
			setPreflight(undefined);
			setStatus(draft.startRoute === 'outline'
				? `已识别 ${analysis.chapters.length} 章；请核对预览。`
				: `已读取 ${analysis.wordCount.toLocaleString()} 字；正文不会被改写。`);
		} catch (error) {
			const code = error instanceof Error ? error.message.split(':')[0] : 'importSourceReadFailed';
			const message = createErrorCopy[code] ?? createErrorCopy.importSourceReadFailed;
			setImportError(message);
			setStatus(message);
		} finally {
			setBusy(false);
		}
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
		if (step === 1 && (draft.startRoute === 'outline' || draft.startRoute === 'manuscript') && !importAnalysis) {
			const message = draft.startRoute === 'outline' ? '请先选择并核对大纲文件。' : '请先选择并核对正文文件。';
			setImportError(message);
			setStatus(message);
			return;
		}
		if (step === 0 || step === 3) {
			if (!await runPreflight()) return;
		}
		setStep(current => Math.min(4, current + 1));
	};

	const create = async () => {
		if (currentManuscriptDirty) {
			const confirmed = window.confirm(
				`“${currentProjectTitle ?? '当前项目'}”有尚未保存的正文。创建后将切换到新项目，是否放弃这些未保存修改并继续？`
			);
			if (!confirmed) {
				setStatus('已取消创建；当前项目和未保存正文保持不变。');
				return;
			}
		}
		setBusy(true);
		setStatus(importAnalysis ? '正在安全创建、导入并验证可重新打开…' : '正在安全创建项目并验证可重新打开…');
		try {
			const created = await creationService.create(request);
			await openProject(created.root);
			const state = useAppStore.getState();
			const chapter = created.firstChapterId
				? state.snapshot?.project.volumes
					.flatMap(volume => volume.chapters)
					.find(candidate => candidate.id === created.firstChapterId)
				: undefined;
			if (draft.startRoute === 'genre' || draft.startRoute === 'ideas') {
				openCreationJourney(draft.startRoute);
			} else if (chapter && state.snapshot && draft.writingMode === 'manuscriptFirst' && draft.startRoute !== 'outline') {
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
		if (step === 4) void create();
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
						<h2 id="project-wizard-title">新建项目</h2>
						<p id="project-wizard-description">建立项目结构、外观与写作方式</p>
					</div>
					<button className="icon-button" type="button" aria-label="关闭新建项目向导" onClick={dismiss} disabled={busy}>
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

				<section ref={contentRef} className="wizard-content">
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
						<div className="wizard-step-panel" aria-labelledby="wizard-start-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 2</span>
								<h3 id="wizard-start-title">你现在从哪里开始？</h3>
								<p>选择最接近当前状态的一项。这里只决定起点，不会自动调用 AI。</p>
							</div>
							<fieldset className="creation-start-grid">
								<legend className="sr-only">创作起点</legend>
								{creationStartOptions.map(option => (
									<button
										type="button"
										key={option.id}
										className={draft.startRoute === option.id ? 'is-selected' : ''}
										aria-pressed={draft.startRoute === option.id}
										onClick={() => selectStartRoute(option.id)}
									>
										<span className="creation-start-icon" aria-hidden="true">
											{option.id === 'genre' || option.id === 'ideas'
												? <Sparkles size={20} />
												: <BookOpenText size={20} />}
										</span>
										<span>
											<strong>{option.title}</strong>
											<small>{option.description}</small>
											<em>{option.result}</em>
										</span>
										{draft.startRoute === option.id && <Check size={18} aria-label="已选择" />}
									</button>
								))}
							</fieldset>
							{(draft.startRoute === 'outline' || draft.startRoute === 'manuscript') && (
								<section className={`draft-import-card ${importAnalysis ? 'is-ready' : ''}`} aria-labelledby="draft-import-title">
									<div className="draft-import-heading">
										<span className="draft-import-icon" aria-hidden="true">
											{importAnalysis ? <FileText size={22} /> : <FileUp size={22} />}
										</span>
										<div>
											<strong id="draft-import-title">
												{draft.startRoute === 'outline' ? '添加已有大纲文件' : '添加已有正文文件'}
											</strong>
											<small>支持 UTF-8 的 .md、.markdown、.txt，最大 5 MiB</small>
										</div>
										<button className={importAnalysis ? 'secondary-button' : 'primary-button'} type="button" onClick={() => void chooseImport()} disabled={busy}>
											<FileUp size={18} />{importAnalysis ? '替换文件' : '选择文件'}
										</button>
									</div>
									{importAnalysis && (
										<div className="draft-import-review">
											<div className="draft-import-file">
												<span><strong>{importAnalysis.file.fileName}</strong><small>{(importAnalysis.file.byteLength / 1024).toFixed(1)} KiB · {importAnalysis.file.format === 'markdown' ? 'Markdown' : '纯文本'}</small></span>
												<span className="draft-import-metrics">
													{draft.startRoute === 'outline'
														? `${importAnalysis.chapters.length} 章`
														: `${importAnalysis.wordCount.toLocaleString()} 字 · ${importAnalysis.paragraphCount} 段`}
												</span>
											</div>
											{draft.startRoute === 'outline' && (
												<ol className="draft-import-chapters" aria-label="识别到的章节">
													{importAnalysis.chapters.slice(0, 5).map((chapter, index) => <li key={`${index}:${chapter.title}`}>{chapter.title}</li>)}
													{importAnalysis.chapters.length > 5 && <li>另有 {importAnalysis.chapters.length - 5} 章…</li>}
												</ol>
											)}
											<details className="draft-import-preview">
												<summary>查看原文预览</summary>
												<pre>{importAnalysis.preview}</pre>
											</details>
											<div className="draft-import-safety"><Check size={16} /><span>{draft.startRoute === 'outline' ? '原始大纲会完整保存在项目中，章节标题只来自明确标记。' : '正文将原样写入第一章，不会调用 AI 或改写内容。'}</span></div>
											<button className="text-button draft-import-remove" type="button" onClick={() => {
												setImportAnalysis(undefined);
												setImportError('');
												setPreflight(undefined);
												setStatus('已移除导入文件。');
											}}>移除文件</button>
										</div>
									)}
									{importError && <p className="wizard-inline-error" role="alert">{importError}</p>}
									{fieldIssue(issues, 'importSource') && <p className="wizard-inline-error" role="alert">{fieldIssue(issues, 'importSource')}</p>}
								</section>
							)}
						</div>
					)}

					{step === 2 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-structure-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 3</span>
								<h3 id="wizard-structure-title">初始结构</h3>
								<p>
									{draft.startRoute === 'ideas'
										? '创作旅程会在最终确认后一次性创建三章，因此这里不预建第一章。'
										: `${selectedTemplate.title} 已提供推荐项，你可以逐项调整。`}
								</p>
							</div>
							<div className="structure-card-grid">
								{selectedTemplate.initialResources.map(resource => {
									const selected = draft.selectedInitialResources.includes(resource.id);
									const locked = (
										resource.id === 'first-volume'
										&& draft.selectedInitialResources.includes('first-chapter')
									) || (
										draft.startRoute === 'ideas'
										&& resource.id === 'first-chapter'
									);
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

					{step === 3 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-appearance-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 4</span>
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

					{step === 4 && (
						<div className="wizard-step-panel" aria-labelledby="wizard-review-title">
							<div className="wizard-step-title">
								<span className="eyebrow">STEP 5</span>
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
									<div><dt>创作起点</dt><dd>{creationStartOptions.find(option => option.id === draft.startRoute)?.title}</dd></div>
									<div><dt>主题</dt><dd>{themes.find(theme => theme.id === draft.themeId)?.title} · {accents.find(accent => accent.id === draft.accentId)?.title}</dd></div>
									<div><dt>写作方式</dt><dd>{draft.writingMode === 'manuscriptFirst' ? '正文优先' : '故事规划优先'}</dd></div>
									<div><dt>AI 快速入口</dt><dd>{draft.selectedInitialResources.includes('ai-quick-actions') ? '启用（不自动请求）' : '关闭'}</dd></div>
									<div><dt>初始资源</dt><dd>{draft.selectedInitialResources.length} 项</dd></div>
									{importAnalysis && <div><dt>导入文件</dt><dd>{importAnalysis.file.fileName}</dd></div>}
									{importAnalysis && <div><dt>导入结果</dt><dd>{importAnalysis.kind === 'outline' ? `${importAnalysis.chapters.length} 个章节 + 原始大纲` : `${importAnalysis.wordCount.toLocaleString()} 字写入第一章`}</dd></div>}
									<div><dt>创建规模</dt><dd>{preflight?.createdDirectoryCount ?? '—'} 个目录 · {preflight?.createdFileCount ?? '—'} 个文件</dd></div>
								</dl>
								<div className="creation-safety-note">
									<Check size={18} />
									<span><strong>安全创建事务</strong><small>同级 staging 写入 → 重新读取验证 → 原子保存到目标目录</small></span>
								</div>
								{currentManuscriptDirty && (
									<div className="creation-switch-warning" role="note">
										<strong>当前项目有未保存正文</strong>
										<span>创建前会再次确认；取消不会写入新项目。</span>
									</div>
								)}
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
						{step === 4 ? <><Sparkles size={18} />{busy ? (importAnalysis ? '正在导入…' : '正在创建…') : (importAnalysis ? '创建并导入' : '创建项目')}</> : <>下一步<ChevronRight size={18} /></>}
					</button>
				</footer>
			</form>
		</div>
	);
}
