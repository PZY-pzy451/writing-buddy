import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const qaRoot = resolve(repositoryRoot, 'artifacts', 'qa');
const statusValues = new Set([
	'NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'STALE', 'CACHED_PASS',
	'NOT_APPLICABLE', 'SKIPPED_WITH_REASON'
]);

const dimensionPatterns = new Map([
	['VISIBLE', /render|show|present|display|visible|打开|显示|呈现/iu],
	['HIDDEN', /hide|hidden|close|dismiss|quiet|隐藏|关闭/iu],
	['ENABLED', /enable|available|允许|可用/iu],
	['DISABLED', /disable|block|read.?only|阻止|禁用|只读/iu],
	['POINTER', /click|pointer|open|select|choose|create|点击|选择|打开|创建/iu],
	['KEYBOARD', /keyboard|ctrl|cmd|alt|enter|escape|tab|arrow|快捷键|键盘|焦点/iu],
	['FOCUS-IN', /focus|tab|焦点/iu], ['FOCUS-OUT', /focus|escape|restore|焦点|恢复/iu],
	['REPEAT', /repeat|rapid|twice|duplicate|重复|连续|多次/iu],
	['DEDUPLICATION', /dedup|duplicate|rapid|guard|重复|防重/iu],
	['LOADING', /loading|stream|pending|加载|生成中|等待/iu],
	['SUCCESS', /success|save|write|create|apply|pass|成功|保存|写入|创建/iu],
	['FAILURE', /fail|error|invalid|reject|rollback|失败|错误|异常|回滚/iu],
	['CANCELLED', /cancel|stop|dismiss|取消|停止/iu],
	['OFFLINE', /offline|network|connection|离线|网络|连接/iu],
	['PERMISSION', /permission|credential|secret|read.?only|权限|凭据|只读/iu],
	['PERSISTENCE', /persist|save|reload|reopen|保存|持久|重载|重启/iu],
	['RESTART', /restart|reload|reopen|restore|重启|重载|恢复/iu],
	['VISUAL', /visual|responsive|layout|clip|overflow|视觉|响应式|布局/iu],
	['ACCESSIBLE-NAME', /accessib|aria|label|role|无障碍/iu],
	['DESTRUCTIVE-CONFIRMATION', /confirm|delete|remove|trash|restore|确认|删除|回收|恢复/iu],
	['UNDO', /undo|redo|rollback|revert|撤销|重做|回滚/iu]
]);

async function readJson(name) {
	return JSON.parse(await readFile(resolve(qaRoot, name), 'utf8'));
}

function csvCell(value) {
	const text = value === null || value === undefined ? '' : String(value);
	return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function testContentPath(testSource) {
	return resolve(repositoryRoot, ...testSource.split('/'));
}

function titleMatchesDimension(title, dimension) {
	return dimensionPatterns.get(dimension)?.test(title) ?? false;
}

export function controlReferenceTokens(control) {
	return [...new Set([
		control?.stableSelectorValue,
		control?.accessibleName
	].filter(value => typeof value === 'string' && value.trim()))];
}

export function testSourceReferencesControl(control, source) {
	return controlReferenceTokens(control).some(token => source.includes(token));
}

async function readTestContents(tests) {
	const bySource = new Map();
	for (const test of tests) {
		if (!bySource.has(test.source)) {
			bySource.set(test.source, await readFile(testContentPath(test.source), 'utf8'));
		}
	}
	return bySource;
}

function priorityForFeature(featureInventory, featureId) {
	return featureInventory.features.find(feature => feature.id === featureId)?.priority ?? 'P2';
}

function severityForPriority(priority) {
	return priority === 'P0' ? 'critical' : priority === 'P1' ? 'high' : priority === 'P2' ? 'medium' : 'low';
}

export function validateTraceabilityRows(rows) {
	const errors = [];
	for (const row of rows) {
		if (!statusValues.has(row.execution_status)) errors.push(`${row.test_case_id || row.state_id}: invalid execution status`);
		if (row.execution_status === 'NOT_APPLICABLE' && !row.notes?.trim()) errors.push(`${row.state_id}: NOT_APPLICABLE requires a reason`);
		if (row.execution_status === 'SKIPPED_WITH_REASON' && !row.notes?.trim()) errors.push(`${row.state_id}: SKIPPED_WITH_REASON requires approval, reason and risk`);
		if (row.cache_status === 'CACHED_PASS' && (!row.last_passed_commit || !row.evidence_path)) errors.push(`${row.test_case_id}: CACHED_PASS requires passing commit and evidence`);
	}
	return errors;
}

export function summarizeTraceability(input) {
	const mappedFeatures = new Set(input.rows.filter(row => row.test_case_id).map(row => row.feature_id));
	const mappedPages = new Set(input.rows.filter(row => row.test_case_id).map(row => row.page_id));
	const mappedControls = new Set(input.rows.filter(row => row.test_case_id).map(row => row.control_id));
	const mappedStates = new Set(input.rows.filter(row => row.test_case_id).map(row => row.state_id));
	const mappedTests = new Set(input.rows.filter(row => row.test_case_id).map(row => row.test_case_id));
	const counts = {
		domains: input.domainCount,
		features: input.featureIds.length,
		pages: input.pageIds.length,
		workspaces: input.workspaceCount,
		controls: input.controlIds.length,
		states: input.stateIds.length,
		shortcuts: input.shortcutIds.length,
		nativeActions: input.nativeActionIds.length,
		testCases: input.testCaseIds.length,
		mappedFeatures: mappedFeatures.size,
		mappedPages: mappedPages.size,
		mappedControls: mappedControls.size,
		mappedStates: mappedStates.size,
		mappedShortcuts: input.mappedShortcutIds.size,
		mappedNativeActions: input.mappedNativeActionIds.size,
		mappedTestCases: mappedTests.size,
		unmappedFeatures: input.featureIds.filter(id => !mappedFeatures.has(id)).length,
		unmappedPages: input.pageIds.filter(id => !mappedPages.has(id)).length,
		unmappedControls: input.controlIds.filter(id => !mappedControls.has(id)).length,
		unmappedStates: input.stateIds.filter(id => !mappedStates.has(id)).length,
		unmappedShortcuts: input.shortcutIds.filter(id => !input.mappedShortcutIds.has(id)).length,
		unmappedNativeActions: input.nativeActionIds.filter(id => !input.mappedNativeActionIds.has(id)).length,
		unmappedTestCases: input.testCaseIds.filter(id => !mappedTests.has(id)).length,
		notApplicable: input.rows.filter(row => row.execution_status === 'NOT_APPLICABLE').length,
		automatedMappings: input.rows.filter(row => row.automation_status === 'AUTOMATED' && row.test_case_id).length,
		missingMappings: input.rows.filter(row => row.automation_status === 'MISSING').length
	};
	const totalUnmapped = counts.unmappedFeatures + counts.unmappedPages + counts.unmappedControls
		+ counts.unmappedStates + counts.unmappedShortcuts + counts.unmappedNativeActions + counts.unmappedTestCases;
	return {
		schemaVersion: 1,
		status: totalUnmapped > 0 ? 'REGRESSION_INCOMPLETE' : 'PASS',
		productConclusion: totalUnmapped > 0 ? 'PARTIAL' : 'PASS',
		counts: { ...counts, totalUnmapped },
		coverage: {
			features: counts.features ? counts.mappedFeatures / counts.features : 1,
			pages: counts.pages ? counts.mappedPages / counts.pages : 1,
			controls: counts.controls ? counts.mappedControls / counts.controls : 1,
			states: counts.states ? counts.mappedStates / counts.states : 1,
			shortcuts: counts.shortcuts ? counts.mappedShortcuts / counts.shortcuts : 1,
			nativeActions: counts.nativeActions ? counts.mappedNativeActions / counts.nativeActions : 1,
			testCases: counts.testCases ? counts.mappedTestCases / counts.testCases : 1
		}
	};
}

async function build() {
	const [features, pages, controls, states, shortcuts, nativeActions, hierarchy] = await Promise.all([
		readJson('feature-inventory.json'), readJson('page-inventory.json'), readJson('control-inventory.json'),
		readJson('state-inventory.json'), readJson('shortcut-inventory.json'), readJson('native-action-inventory.json'),
		readJson('test-hierarchy.json')
	]);
	const tests = hierarchy.discoveredTests;
	const contents = await readTestContents(tests);
	const testsByPageFeature = new Map();
	for (const test of tests) {
		const key = `${test.pageId}|${test.featureId}`;
		const current = testsByPageFeature.get(key) ?? [];
		current.push(test);
		testsByPageFeature.set(key, current);
	}
	const rows = [];
	for (const state of states.states) {
		const control = controls.controls.find(item => item.id === state.controlIds[0]);
		const candidates = testsByPageFeature.get(`${state.pageId}|${state.featureId}`) ?? [];
		const mapped = candidates.find(test => (
			testSourceReferencesControl(control, contents.get(test.source) ?? '')
			&& titleMatchesDimension(test.title, state.dimension)
		));
		const priority = priorityForFeature(features, state.featureId);
		rows.push({
			domain_id: features.features.find(feature => feature.id === state.featureId)?.domainId ?? '',
			feature_id: state.featureId, page_id: state.pageId, control_id: control?.id ?? '', state_id: state.id,
			test_case_id: mapped?.id ?? '', test_layer: mapped?.testLayer ?? '', priority,
			automation_status: mapped ? 'AUTOMATED' : 'MISSING', execution_status: 'STALE',
			cache_status: 'STALE', last_run_commit: '', last_passed_commit: '', evidence_path: '',
			severity_if_failed: severityForPriority(priority),
			notes: mapped ? 'Conservative exact stable-selector/accessibility token and state-intent source mapping.' : 'No valid control-state test mapping.'
		});
	}
	const mappedShortcutIds = new Set();
	for (const shortcut of shortcuts.shortcuts) {
		if (tests.some(test => {
			const content = contents.get(test.source) ?? '';
			return content.includes(shortcut.commandId) || content.includes(shortcut.keys);
		})) mappedShortcutIds.add(shortcut.id);
	}
	const mappedNativeActionIds = new Set();
	for (const action of nativeActions.actions) {
		const commandWords = action.commandId.replaceAll('_', ' ');
		if (tests.some(test => test.title.includes(action.commandId) || test.title.toLocaleLowerCase().includes(commandWords))) {
			mappedNativeActionIds.add(action.id);
		}
	}
	const validationErrors = validateTraceabilityRows(rows);
	const summary = summarizeTraceability({
		rows,
		domainCount: features.domains.length,
		featureIds: features.features.map(item => item.id),
		pageIds: pages.pages.map(item => item.id),
		workspaceCount: pages.workspaces.length,
		controlIds: controls.controls.map(item => item.id),
		stateIds: states.states.map(item => item.id),
		shortcutIds: shortcuts.shortcuts.map(item => item.id),
		nativeActionIds: nativeActions.actions.map(item => item.id),
		testCaseIds: tests.map(item => item.id),
		mappedShortcutIds,
		mappedNativeActionIds
	});
	summary.validationErrors = validationErrors;
	const columns = [
		'domain_id', 'feature_id', 'page_id', 'control_id', 'state_id', 'test_case_id', 'test_layer',
		'priority', 'automation_status', 'execution_status', 'cache_status', 'last_run_commit',
		'last_passed_commit', 'evidence_path', 'severity_if_failed', 'notes'
	];
	const csv = [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\n') + '\n';
	await Promise.all([
		writeFile(resolve(qaRoot, 'feature-control-traceability.csv'), csv, 'utf8'),
		writeFile(resolve(qaRoot, 'traceability-summary.json'), `${JSON.stringify(summary, undefined, 2)}\n`, 'utf8')
	]);
	return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const summary = await build();
	console.log(JSON.stringify(summary, undefined, 2));
	if (process.argv.includes('--strict') && (summary.status !== 'PASS' || summary.validationErrors.length > 0)) {
		process.exitCode = 1;
	}
}
