import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { discoverVitestTests } from './test-discovery.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputRoot = resolve(repositoryRoot, 'artifacts', 'qa');
const responsiveTargets = ['820x720', '1024x720', '1280x800', '1440x900', '1920x1080@125%'];

const domainSpecs = [
	['01', 'WRITING', '写作', ['继续写作', '卷章场景树', 'Monaco 正文编辑', '当前场景条', 'AI 临时草稿', 'AI 写入正文', '部分写入', 'Candidate 编辑', 'Undo / Redo', '保存状态', 'Session Restore', '专注模式', '字数与进度', '快速记录']],
	['02', 'PLANNING', '规划', ['题材生成大纲', '故事核心', '故事总纲', '分卷', '章节', '场景', '节点拖拽', '节点锁定', '局部重新生成', '候选比较', '大纲检查', '剧情线', '伏笔规划', '大纲与正文同步']],
	['03', 'STORY-LIBRARY', '故事库', ['当前章节相关资料', '人物', '人物关系', '人物知识边界', '地点', '世界规则', '势力', '物品', '事件', '时间线', '术语', 'Evidence', 'TextAnchor', '从正文提取']],
	['04', 'REVIEW', '检查', ['本章检查', '全书一致性', '人物知识冲突', '时间冲突', '物品状态冲突', '剧情线停滞', '伏笔遗漏', '计划与实际差异', '错别字', '重复表达', '敏感词', '发布前检查']],
	['05', 'HISTORY', '历史与恢复', ['版本历史', 'Snapshot', '差异查看', '恢复版本', '自动备份', '崩溃恢复', 'AI 修改记录', '导出记录']],
	['06', 'PROJECT', '项目与文件', ['新建项目', '打开项目', '最近项目', '重命名项目', '移动项目', '删除项目', '导入正文', '导入大纲', '导出 TXT', '导出 Markdown', '导出 DOCX', '文件冲突', '外部修改']],
	['07', 'AI-RUNTIME', 'AI Runtime', ['Provider 配置', 'Credential Storage', 'Context Pack', 'Context Preview', 'Prompt Registry', 'Structured Output', 'Schema Repair', 'Streaming', 'Stop', 'Retry', 'Timeout', 'Rate Limit', 'Usage', 'Candidate Store', 'Stale Detection', 'Atomic Apply', 'Privacy Filter']],
	['08', 'GLOBAL', '全局导航', ['一级导航', '作者导航器 Ctrl+K', '全局搜索', '快速新建', '快速记录', 'Command Palette', 'Toast', 'Dialog', 'Drawer', 'Context Menu', '系统状态']],
	['09', 'SETTINGS', '设置', ['外观', '字体', '编辑器宽度', '自动保存', '快捷键', 'AI Provider', 'API Key', '数据目录', '备份', '隐私', 'Reduce Motion', '重置设置']],
	['10', 'NATIVE', 'Tauri 与 Windows Native', ['窗口打开', '最小化', '最大化', '关闭', '无边框窗口', '单实例', '文件选择器', 'Windows Credential Manager', '文件系统权限', '剪贴板', '拖放文件', '系统快捷键', '崩溃恢复', '后台任务']],
	['11', 'INSTALL', '安装、升级与迁移', ['首次安装', '覆盖安装', '版本升级', 'Schema 迁移', '项目迁移', '设置迁移', '卸载', '卸载后数据保留', '回滚']],
	['12', 'QUALITY', '性能、视觉与无障碍', ['启动性能', '大项目加载', '长文编辑', 'AI 流式性能', '内存', '窗口尺寸', 'DPI', '视觉回归', '键盘', '焦点', 'ARIA', '对比度', 'Reduce Motion']]
];

const pages = [
	['PAGE-WELCOME', 'welcome', '欢迎与最近项目', '06'],
	['PAGE-PROJECT-CREATION', 'dialog:new-project', '新建项目', '06'],
	['PAGE-WRITING-HOME', 'mode:works/home', '继续写作', '01'],
	['PAGE-WRITING-EDITOR', 'mode:works/chapter', '正文编辑器', '01'],
	['PAGE-PLANNING-STRUCTURE', 'mode:planning#structure', '故事结构', '02'],
	['PAGE-PLANNING-PLOTS', 'mode:planning#plots', '剧情线与伏笔', '02'],
	['PAGE-STORY-CREATION-JOURNEY', 'mode:references#creation-journey', '题材到大纲', '02'],
	['PAGE-STORY-CHARACTERS', 'mode:references#characters', '人物', '03'],
	['PAGE-STORY-RELATIONSHIPS', 'mode:references#relationships', '人物关系', '03'],
	['PAGE-STORY-WORLD', 'mode:references#worldbuilding', '世界构建', '03'],
	['PAGE-STORY-ASSETS', 'mode:references#assets', '物品', '03'],
	['PAGE-STORY-TIMELINE', 'mode:references#timeline', '时间线', '03'],
	['PAGE-STORY-INFORMATION', 'mode:references#information', '信息权限', '03'],
	['PAGE-STORY-ASSOCIATIONS', 'mode:references#associations', '故事关联', '03'],
	['PAGE-STORY-EXTRACTION', 'mode:references#extraction', '正文提取', '03'],
	['PAGE-REVIEW', 'mode:review', '检查', '04'],
	['PAGE-CONTINUITY', 'mode:references#continuity', '一致性检查', '04'],
	['PAGE-HISTORY', 'mode:versions', '历史与恢复', '05'],
	['PAGE-SETTINGS', 'mode:settings', '设置', '09'],
	['PAGE-AI-DIAGNOSTICS', 'mode:ai', 'AI 诊断', '07'],
	['PAGE-GLOBAL-SHELL', 'shell', '全局外壳', '08'],
	['PAGE-NATIVE-RUNTIME', 'native', '原生运行时', '10'],
	['PAGE-INSTALLATION', 'installer', '安装与迁移', '11'],
	['PAGE-QUALITY-GATES', 'quality', '性能、视觉与无障碍', '12']
];

const workspaces = [
	{ id: 'WORKSPACE-WRITING', runtimeId: 'writing', pageIds: ['PAGE-WRITING-HOME', 'PAGE-WRITING-EDITOR'] },
	{ id: 'WORKSPACE-PLANNING', runtimeId: 'planning', pageIds: ['PAGE-PLANNING-STRUCTURE', 'PAGE-PLANNING-PLOTS', 'PAGE-STORY-CREATION-JOURNEY'] },
	{ id: 'WORKSPACE-REFERENCE', runtimeId: 'reference', pageIds: pages.filter(([id]) => id.startsWith('PAGE-STORY-') && id !== 'PAGE-STORY-CREATION-JOURNEY').map(([id]) => id) },
	{ id: 'WORKSPACE-REVIEW', runtimeId: 'review', pageIds: ['PAGE-REVIEW', 'PAGE-CONTINUITY'] },
	{ id: 'WORKSPACE-HISTORY', runtimeId: 'history', pageIds: ['PAGE-HISTORY'] }
];

const stateDimensions = [
	['VISIBLE', '是否显示'], ['HIDDEN', '是否隐藏'], ['ENABLED', '是否启用'],
	['DISABLED', '是否禁用'], ['POINTER', '鼠标操作'], ['KEYBOARD', '键盘操作'],
	['FOCUS-IN', '焦点进入'], ['FOCUS-OUT', '焦点离开'], ['REPEAT', '重复操作'],
	['DEDUPLICATION', '防重复提交'], ['LOADING', '加载状态'], ['SUCCESS', '成功状态'],
	['FAILURE', '失败状态'], ['CANCELLED', '取消状态'], ['OFFLINE', '离线状态'],
	['PERMISSION', '权限状态'], ['PERSISTENCE', '持久化'], ['RESTART', '重启恢复'],
	['VISUAL', '视觉状态'], ['ACCESSIBLE-NAME', '无障碍名称'],
	['DESTRUCTIVE-CONFIRMATION', '破坏性确认'], ['UNDO', '撤销']
];

const shortcutSpecs = [
	['WRITER-NAVIGATOR', 'Ctrl/Cmd+K', 'writer-navigator', 'global'],
	['FULL-SEARCH', 'Ctrl/Cmd+Shift+F', 'full-search', 'global'],
	['NEW-CHAPTER', 'Ctrl/Cmd+N', 'new-chapter', 'workspace'],
	['QUICK-CREATE', 'Ctrl/Cmd+Shift+N', 'quick-create', 'global'],
	['QUICK-CAPTURE', 'Ctrl/Cmd+Shift+Space', 'quick-capture', 'global'],
	['AI-QUICK-ACTIONS', 'Alt/Option+A', 'ai-quick-actions', 'editor'],
	['FOCUS-MODE', 'F11', 'focus-mode', 'workspace'],
	['SAVE', 'Ctrl/Cmd+S', 'save', 'editor'],
	['CLOSE-TAB', 'Ctrl/Cmd+W', 'close-tab', 'workspace'],
	['RESTORE-TAB', 'Ctrl/Cmd+Shift+T', 'restore-tab', 'workspace'],
	['SWITCH-TAB', 'Ctrl/Cmd+Tab', 'switch-tab', 'workspace'],
	['UNDO', 'Ctrl/Cmd+Z', 'undo', 'editor'],
	['TOGGLE-SIDEBAR', 'Ctrl/Cmd+B', 'sidebar', 'workspace'],
	['TOGGLE-ASSISTANT', 'Ctrl/Cmd+Alt+B', 'assistant', 'workspace'],
	['TOGGLE-DOCK', 'Ctrl/Cmd+J', 'dock', 'workspace'],
	['DIALOG-SAVE', 'Ctrl/Cmd+Enter', 'dialog-save', 'dialog'],
	['DISMISS', 'Escape', 'dismiss', 'dialog'],
	['ROVING-NEXT', 'ArrowDown/ArrowRight', 'roving-next', 'dialog'],
	['ROVING-PREVIOUS', 'ArrowUp/ArrowLeft', 'roving-previous', 'dialog'],
	['ROVING-FIRST', 'Home', 'roving-first', 'dialog'],
	['ROVING-LAST', 'End', 'roving-last', 'dialog'],
	['ACTIVATE', 'Enter/Space', 'activate-focused', 'dialog'],
	['ENTITY-PEEK', 'Ctrl/Cmd+Click', 'entity-peek', 'editor']
];

function normalizePath(path) {
	return path.replaceAll('\\', '/');
}

function sha(value, size = 10) {
	return createHash('sha256').update(value).digest('hex').slice(0, size).toUpperCase();
}

async function listFiles(root, predicate) {
	const result = [];
	for (const entry of await readdir(root, { withFileTypes: true })) {
		if (['node_modules', 'dist', 'target', 'coverage', 'artifacts'].includes(entry.name)) continue;
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) result.push(...await listFiles(path, predicate));
		else if (predicate(path)) result.push(path);
	}
	return result.sort();
}

function featureId(code) {
	return `FEATURE-${code.replace('.', '-')}`;
}

function domainId(code) {
	return `DOMAIN-${code}`;
}

function priorityFor(code) {
	if (/^(01\.(03|06|09|10)|06\.(01|02|12|13)|07\.(06|07|08|09|11|12|15|16|17)|10\.(01|04|06|08|09)|11\.(01|02|03|04|05))$/u.test(code)) return 'P0';
	if (/^(01|02|03|04|05|06|07|10|11)\./u.test(code)) return 'P1';
	if (/^(08|09|12)\./u.test(code)) return 'P2';
	return 'P3';
}

function pageForPath(path) {
	const rules = [
		['features/creation-journey', 'PAGE-STORY-CREATION-JOURNEY'],
		['features/projects', 'PAGE-PROJECT-CREATION'],
		['features/story/characters', 'PAGE-STORY-CHARACTERS'],
		['features/story/relationships', 'PAGE-STORY-RELATIONSHIPS'],
		['features/story/worldbuilding', 'PAGE-STORY-WORLD'],
		['features/story/assets', 'PAGE-STORY-ASSETS'],
		['features/story/timeline', 'PAGE-STORY-TIMELINE'],
		['features/story/information', 'PAGE-STORY-INFORMATION'],
		['features/story/associations', 'PAGE-STORY-ASSOCIATIONS'],
		['features/story/extraction', 'PAGE-STORY-EXTRACTION'],
		['features/story/continuity', 'PAGE-CONTINUITY'],
		['features/story/plots', 'PAGE-PLANNING-PLOTS'],
		['features/review', 'PAGE-REVIEW'], ['review/', 'PAGE-REVIEW'],
		['features/version', 'PAGE-HISTORY'], ['features/backup', 'PAGE-HISTORY'],
		['settings/', 'PAGE-SETTINGS'], ['features/ai', 'PAGE-AI-DIAGNOSTICS'],
		['editor/', 'PAGE-WRITING-EDITOR'], ['workspace/', 'PAGE-WRITING-EDITOR'],
		['shell/', 'PAGE-GLOBAL-SHELL'], ['app/', 'PAGE-GLOBAL-SHELL']
	];
	return rules.find(([needle]) => path.includes(needle))?.[1] ?? 'PAGE-GLOBAL-SHELL';
}

function featureForPath(path, pageId) {
	const rules = [
		['creation-journey', '02.01'], ['story/characters', '03.02'],
		['story/relationships', '03.03'], ['story/worldbuilding', '03.05'],
		['story/assets', '03.08'], ['story/timeline', '03.10'],
		['story/information', '03.04'], ['story/extraction', '03.14'],
		['story/continuity', '04.02'], ['story/plots', '02.12'],
		['review/inline', '04.09'], ['features/review', '04.01'], ['review/', '04.01'],
		['features/version', '05.01'], ['features/backup', '05.05'],
		['features/projects', '06.01'], ['settings/', '09.01'],
		['features/ai', '07.08'], ['editor/', '01.03'], ['workspace/', '01.02'],
		['shell/', '08.01'], ['app/', '08.01']
	];
	const found = rules.find(([needle]) => path.includes(needle))?.[1];
	if (found) return featureId(found);
	const page = pages.find(([id]) => id === pageId);
	return featureId(`${page?.[3] ?? '08'}.01`);
}

function staticAttribute(opening, name) {
	const attribute = opening.attributes.properties.find(property => (
		ts.isJsxAttribute(property) && property.name.text === name
	));
	if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return undefined;
	if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text.trim();
	if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
		const expression = attribute.initializer.expression;
		if (ts.isStringLiteralLike(expression)) return expression.text.trim();
	}
	return undefined;
}

function enclosingComponent(node) {
	let current = node.parent;
	while (current) {
		if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
		if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) return current.parent.name.text;
		if (ts.isMethodDeclaration(current) && current.name && ts.isIdentifier(current.name)) return current.name.text;
		current = current.parent;
	}
	return 'Module';
}

function descendantText(node) {
	if (!ts.isJsxElement(node)) return undefined;
	const text = node.children.filter(ts.isJsxText).map(child => child.text.replace(/\s+/gu, ' ').trim()).filter(Boolean).join(' ').trim();
	return text || undefined;
}

function discoverControls(sourcePath, sourceText) {
	const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const path = normalizePath(relative(repositoryRoot, sourcePath));
	const pageId = pageForPath(path);
	const discovered = [];
	const visit = node => {
		const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
		if (opening) {
			const tag = opening.tagName.getText(sourceFile);
			const intrinsic = /^[a-z]/u.test(tag);
			const propNames = opening.attributes.properties.filter(ts.isJsxAttribute).map(property => property.name.text);
			const eventProps = propNames.filter(name => /^on(?:Click|Change|Input|Submit|KeyDown|PointerDown|DragStart|Drop)$/u.test(name));
			const role = staticAttribute(opening, 'role');
			const native = ['button', 'input', 'select', 'textarea'].includes(tag);
			const customInteractive = intrinsic && (
				eventProps.length > 0
				|| ['button', 'menuitem', 'tab', 'slider', 'checkbox', 'radio', 'option', 'treeitem'].includes(role ?? '')
			);
			if (native || customInteractive) {
				const component = enclosingComponent(opening);
				const semanticProps = ['data-testid', 'id', 'name', 'aria-controls', 'type'].map(name => [name, staticAttribute(opening, name)]).filter(([, value]) => value);
				const structure = JSON.stringify({ path, component, tag, role, eventProps: eventProps.sort(), propNames: propNames.sort(), semanticProps });
				const accessibleName = staticAttribute(opening, 'aria-label')
					?? staticAttribute(opening, 'title')
					?? descendantText(node)
					?? '';
				const dataTestId = staticAttribute(opening, 'data-testid');
				const stableSelectorValue = dataTestId
					?? staticAttribute(opening, 'aria-label')
					?? staticAttribute(opening, 'title')
					?? staticAttribute(opening, 'id')
					?? staticAttribute(opening, 'name')
					?? accessibleName;
				const controlId = `CTRL-${component.replace(/[^A-Za-z0-9]+/gu, '-').toUpperCase()}-${tag.replace(/[^A-Za-z0-9]+/gu, '-').toUpperCase()}-${sha(structure, 8)}`;
				discovered.push({
					id: controlId,
					pageId,
					featureId: featureForPath(path, pageId),
					controlType: tag,
					accessibleName,
					stableSelectorValue,
					selectorStrategy: staticAttribute(opening, 'aria-label') || (role && accessibleName) ? 'role+accessible-name'
						: dataTestId ? 'data-testid'
							: accessibleName ? 'accessible-name'
								: staticAttribute(opening, 'id') || staticAttribute(opening, 'name') ? 'label-or-id'
									: 'MISSING_STABLE_SELECTOR',
					visibleWhen: ['rendered source branch is active'],
					enabledWhen: propNames.includes('disabled') ? ['disabled expression is false'] : ['rendered'],
					actions: eventProps,
					expectedEffects: ['requires traceability assertion'],
					stateIds: stateDimensions.map(([dimension]) => `STATE-${controlId.slice(5)}-${dimension}`),
					persistenceExpected: /save|persist|project|setting|editor|chapter|story|backup|version/iu.test(path),
					destructive: /delete|remove|trash|restore|reset|discard/iu.test(`${path} ${eventProps.join(' ')}`),
					nativeRuntimeRequired: /project|backup|version|export|import|settings|platform/iu.test(path),
					aiRequired: /ai|generation|extraction|continuity|language/iu.test(path),
					source: path,
					stableSelectorStatus: accessibleName || dataTestId || staticAttribute(opening, 'id') || staticAttribute(opening, 'name') ? 'MAPPED' : 'UNMAPPED'
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return discovered;
}

function testLayer(path) {
	if (path.includes('/tests/e2e/')) return 'browser-component';
	if (path.startsWith('scripts/')) return 'orchestration';
	if (path.startsWith('packages/')) return 'unit-contract';
	return 'ui-integration';
}

async function discoverTests() {
	const roots = ['apps', 'packages', 'scripts'].map(root => resolve(repositoryRoot, root));
	const files = (await Promise.all(roots.map(root => listFiles(root, path => /\.(?:test|spec)\.(?:ts|tsx|mjs)$/u.test(path))))).flat().sort();
	const tests = [];
	for (const file of files) {
		const path = normalizePath(relative(repositoryRoot, file));
		const content = await readFile(file, 'utf8');
		const identityOccurrences = new Map();
		for (const discovered of discoverVitestTests(path, content)) {
			const title = discovered.title;
			const pageId = pageForPath(path);
			const identity = `${path}|${title}`;
			const occurrence = (identityOccurrences.get(identity) ?? 0) + 1;
			identityOccurrences.set(identity, occurrence);
			tests.push({
				id: `TC-DISCOVERED-${sha(occurrence === 1 ? identity : `${identity}|${occurrence}`)}`,
				title,
				declarationTitle: discovered.declarationTitle,
				declarationLine: discovered.declarationLine,
				parameterized: discovered.parameterized,
				parameterCase: discovered.parameterCase,
				parameterCaseLabel: discovered.parameterCaseLabel,
				parameterizationResolved: discovered.parameterizationResolved,
				source: path,
				domainId: domainId(featureForPath(path, pageId).slice(8, 10)),
				featureId: featureForPath(path, pageId),
				pageId,
				controlId: null,
				stateId: null,
				testLayer: testLayer(path),
				automationStatus: 'AUTOMATED',
				executionStatus: 'NOT_RUN',
				stableIdStatus: 'MISSING_EXPLICIT_ID'
			});
		}
	}
	const rustFiles = await listFiles(resolve(repositoryRoot, 'apps', 'desktop', 'src-tauri', 'src'), path => extname(path) === '.rs');
	for (const file of rustFiles) {
		const path = normalizePath(relative(repositoryRoot, file));
		const content = await readFile(file, 'utf8');
		const regex = /#\[(?:tokio::)?test\][\s\S]{0,160}?fn\s+([A-Za-z0-9_]+)/gu;
		for (const match of content.matchAll(regex)) {
			tests.push({
				id: `TC-NATIVE-${match[1].replaceAll('_', '-').toUpperCase()}-${sha(path, 6)}`,
				title: match[1], source: path, domainId: 'DOMAIN-10', featureId: 'FEATURE-10-09',
				pageId: 'PAGE-NATIVE-RUNTIME', controlId: null, stateId: null,
				testLayer: 'native-unit', automationStatus: 'AUTOMATED', executionStatus: 'NOT_RUN', stableIdStatus: 'SOURCE_FUNCTION_ID'
			});
		}
	}
	return tests.sort((a, b) => a.id.localeCompare(b.id));
}

async function discoverNativeActions() {
	const source = await readFile(resolve(repositoryRoot, 'apps', 'desktop', 'src-tauri', 'src', 'lib.rs'), 'utf8');
	const block = source.match(/invoke_handler\(tauri::generate_handler!\[([\s\S]*?)\]\)/u)?.[1] ?? '';
	return [...block.matchAll(/(?:[A-Za-z_][A-Za-z0-9_]*::)+([A-Za-z_][A-Za-z0-9_]*)/gu)]
		.map(match => match[1]).filter((name, index, values) => values.indexOf(name) === index).sort()
		.map(command => ({
			id: `NATIVE-${command.replaceAll('_', '-').toUpperCase()}`,
			commandId: command,
			pageId: /ai_/u.test(command) ? 'PAGE-AI-DIAGNOSTICS' : /backup|version|snapshot/u.test(command) ? 'PAGE-HISTORY' : 'PAGE-NATIVE-RUNTIME',
			featureId: /ai_/u.test(command) ? 'FEATURE-07-01' : /backup/u.test(command) ? 'FEATURE-05-05' : /snapshot|version/u.test(command) ? 'FEATURE-05-02' : /create_project/u.test(command) ? 'FEATURE-06-01' : /open_project/u.test(command) ? 'FEATURE-06-02' : 'FEATURE-10-09',
			testCaseIds: [],
			mappingStatus: 'UNMAPPED_TEST'
		}));
}

async function writeJson(name, value) {
	await mkdir(outputRoot, { recursive: true });
	await writeFile(resolve(outputRoot, name), `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
}

const domainItems = domainSpecs.map(([code, key, name]) => ({ id: domainId(code), code, key, name }));
const pageItems = pages.map(([id, route, title, domain]) => ({
	id, route, title, entryPoints: [route],
	featureIds: domainSpecs.find(([code]) => code === domain)?.[3].map((_, index) => featureId(`${domain}.${String(index + 1).padStart(2, '0')}`)) ?? [],
	controlIds: [], stateIds: [], responsiveTargets
}));
const featureItems = domainSpecs.flatMap(([domain, , , names]) => names.map((name, index) => {
	const code = `${domain}.${String(index + 1).padStart(2, '0')}`;
	const routeIds = pageItems.filter(page => page.featureIds.includes(featureId(code))).map(page => page.id);
	return {
		id: featureId(code), code, name, domainId: domainId(domain), routeIds,
		controlIds: [], stateIds: [], userJourneyIds: [],
		persistenceExpected: !/性能|视觉|对比度|焦点|ARIA|窗口|DPI|搜索|Toast|Dialog|Drawer/u.test(name),
		nativeRuntimeRequired: ['05', '06', '10', '11'].includes(domain),
		aiRequired: domain === '07' || /AI|生成|检查|提取|一致性/u.test(name),
		priority: priorityFor(code)
	};
}));

const tsxFiles = await listFiles(resolve(repositoryRoot, 'apps', 'desktop', 'src'), path => path.endsWith('.tsx') && !/\.(?:test|spec)\.tsx$/u.test(path));
const discoveredControls = (await Promise.all(tsxFiles.map(async path => discoverControls(path, await readFile(path, 'utf8'))))).flat();
const controlItems = [...new Map(discoveredControls.map(control => [control.id, control])).values()].sort((a, b) => a.id.localeCompare(b.id));
const stateItems = controlItems.flatMap(control => stateDimensions.map(([dimension, name]) => ({
	id: `STATE-${control.id.slice(5)}-${dimension}`, featureId: control.featureId, pageId: control.pageId,
	controlIds: [control.id], name, dimension, preconditions: ['requires scenario assessment'],
	expectedVisualState: 'UNASSESSED', expectedFunctionalState: 'UNASSESSED', applicability: 'UNASSESSED'
})));
for (const control of controlItems) {
	const feature = featureItems.find(item => item.id === control.featureId);
	const page = pageItems.find(item => item.id === control.pageId);
	if (feature) {
		feature.controlIds.push(control.id);
		feature.stateIds.push(...control.stateIds);
	}
	if (page) {
		page.controlIds.push(control.id);
		page.stateIds.push(...control.stateIds);
	}
}

const shortcutItems = shortcutSpecs.map(([key, keys, commandId, scope]) => ({
	id: `SHORTCUT-${key}`, keys, commandId, scope,
	enabledWhen: ['matching workspace or dialog is active'], expectedAction: commandId,
	conflictChecked: false, testCaseIds: [], mappingStatus: 'UNMAPPED_TEST'
}));
const nativeActionItems = await discoverNativeActions();
const tests = await discoverTests();
const frontendTests = tests.filter(test => test.testLayer !== 'native-unit');
const unresolvedParameterizedTests = frontendTests.filter(test => (
	test.parameterized && !test.parameterizationResolved
));

const hierarchy = {
	id: 'REGRESSION-WRITING-BUDDY-V2', level: 'L0', name: 'Writing Buddy 全量回归',
	domains: domainItems.map(domain => ({
		...domain, level: 'L1',
		features: featureItems.filter(feature => feature.domainId === domain.id).map(feature => ({
			id: feature.id, level: 'L2', name: feature.name,
			pages: pageItems.filter(page => page.featureIds.includes(feature.id)).map(page => ({
				id: page.id, level: 'L3', name: page.title,
				controls: controlItems.filter(control => control.featureId === feature.id && control.pageId === page.id).map(control => ({
					id: control.id, level: 'L4', name: control.accessibleName || control.controlType,
					states: stateItems.filter(state => state.controlIds[0] === control.id).map(state => ({
						id: state.id, level: 'L5', name: state.name,
						testCaseIds: tests.filter(test => test.stateId === state.id).map(test => test.id)
					}))
				}))
			}))
		}))
	})),
	discoveredTests: tests
};

await writeJson('feature-inventory.json', { schemaVersion: 1, domains: domainItems, features: featureItems });
await writeJson('page-inventory.json', { schemaVersion: 1, workspaces, pages: pageItems });
await writeJson('control-inventory.json', {
	schemaVersion: 1,
	discovery: { sourceFiles: tsxFiles.length, declarationCount: controlItems.length, semanticSelectorMapped: controlItems.filter(item => item.stableSelectorStatus === 'MAPPED').length, semanticSelectorMissing: controlItems.filter(item => item.stableSelectorStatus === 'UNMAPPED').length },
	controls: controlItems
});
await writeJson('state-inventory.json', { schemaVersion: 1, dimensions: stateDimensions.map(([id, name]) => ({ id, name })), states: stateItems });
await writeJson('shortcut-inventory.json', { schemaVersion: 1, shortcuts: shortcutItems });
await writeJson('native-action-inventory.json', { schemaVersion: 1, actions: nativeActionItems });
await writeJson('test-hierarchy.json', hierarchy);
await writeJson('inventory-summary.json', {
	schemaVersion: 1,
	status: controlItems.some(item => item.stableSelectorStatus === 'UNMAPPED') ? 'PARTIAL' : 'COMPLETE',
	counts: {
		domains: domainItems.length, features: featureItems.length, pages: pageItems.length,
		workspaces: workspaces.length, controls: controlItems.length, states: stateItems.length,
		shortcuts: shortcutItems.length, nativeActions: nativeActionItems.length,
		discoveredTests: tests.length,
		frontendDiscoveredTests: frontendTests.length,
		parameterizedTestInstances: frontendTests.filter(test => test.parameterized).length,
		unresolvedParameterizedDeclarations: unresolvedParameterizedTests.length,
		missingStableSelectors: controlItems.filter(item => item.stableSelectorStatus === 'UNMAPPED').length
	},
	notes: [
		'Controls are unique interactive source declarations; repeated rendered collection instances share one declaration.',
		'UNMAPPED stable selectors remain inventory items and block complete traceability.',
		'Existing tests without explicit regression IDs are retained as discovered automation and require Gate C mapping.',
		'Parameterized test tables and statically bounded loops are expanded into runtime-equivalent instances.',
		...(unresolvedParameterizedTests.length > 0
			? [`${unresolvedParameterizedTests.length} dynamic parameterized declaration(s) require runtime collection reconciliation.`]
			: [])
	]
});

console.log(JSON.stringify({
	domains: domainItems.length, features: featureItems.length, pages: pageItems.length, workspaces: workspaces.length,
	controls: controlItems.length, states: stateItems.length, shortcuts: shortcutItems.length,
	nativeActions: nativeActionItems.length, discoveredTests: tests.length,
	frontendDiscoveredTests: frontendTests.length,
	parameterizedTestInstances: frontendTests.filter(test => test.parameterized).length,
	unresolvedParameterizedDeclarations: unresolvedParameterizedTests.length,
	missingStableSelectors: controlItems.filter(item => item.stableSelectorStatus === 'UNMAPPED').length
}, undefined, 2));
