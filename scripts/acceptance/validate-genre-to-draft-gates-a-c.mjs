import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const executable = process.env.WRITING_BUDDY_EXE ?? join(
	repositoryRoot,
	'apps',
	'desktop',
	'src-tauri',
	'target',
	'release',
	'writing-buddy-next.exe'
);
const debuggingPort = Number(process.env.WRITING_BUDDY_NATIVE_CDP_PORT ?? 9751);
const outputDirectory = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'screenshots',
	'genre-to-draft-gates-a-c'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'genre-to-draft-gates-a-c-metrics.json'
);
const acceptanceStartedAt = performance.now();

class CdpClient {
	constructor(url) {
		this.url = url;
		this.nextId = 1;
		this.pending = new Map();
		this.listeners = new Map();
	}

	async connect() {
		this.socket = new WebSocket(this.url);
		await new Promise((resolveConnection, reject) => {
			this.socket.addEventListener('open', resolveConnection, { once: true });
			this.socket.addEventListener('error', reject, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (message.id) {
				const pending = this.pending.get(message.id);
				if (!pending) return;
				this.pending.delete(message.id);
				if (message.error) {
					pending.reject(new Error(`${message.error.message} (${pending.method})`));
				} else {
					pending.resolve(message.result);
				}
				return;
			}
			for (const listener of this.listeners.get(message.method) ?? []) {
				listener(message.params);
			}
		});
	}

	call(method, params = {}) {
		return new Promise((resolveCall, reject) => {
			const id = this.nextId++;
			this.pending.set(id, { method, resolve: resolveCall, reject });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}

	on(method, listener) {
		const listeners = this.listeners.get(method) ?? [];
		listeners.push(listener);
		this.listeners.set(method, listeners);
	}

	close() {
		this.socket?.close();
	}
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function delay(milliseconds) {
	return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

async function evaluate(client, expression) {
	const response = await client.call('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true,
		userGesture: true
	});
	if (response.exceptionDetails) {
		throw new Error(
			response.exceptionDetails.exception?.description
			?? response.exceptionDetails.text
		);
	}
	return response.result.value;
}

async function waitFor(client, expression, description, timeout = 20_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(50);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForTarget(child) {
	const deadline = Date.now() + 25_000;
	while (Date.now() < deadline) {
		assert(child.exitCode === null, `Writing Buddy exited early with ${child.exitCode}.`);
		try {
			const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
				.then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page'
				&& !candidate.url.startsWith('devtools://')
			));
			if (target) return target;
		} catch {
			// WebView2 is still starting.
		}
		await delay(80);
	}
	throw new Error('Timed out waiting for the native Writing Buddy WebView target.');
}

async function invoke(client, command, args = {}) {
	return evaluate(client, `(async () => {
		const internals = window.__TAURI_INTERNALS__;
		if (!internals?.invoke) throw new Error('nativeTauriBridgeUnavailable');
		return internals.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)});
	})()`);
}

const normalizeTextExpression = `
	const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
	const visible = element => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return rect.width > 0 && rect.height > 0
			&& style.display !== 'none' && style.visibility !== 'hidden';
	};
`;

async function clickButton(client, label, scopeSelector = undefined) {
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		return Boolean(root && [...root.querySelectorAll('button:not([hidden])')]
			.some(button => !button.disabled && visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			)));
	})()`, `button “${label}”`);
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const matches = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => !button.disabled && visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			)) : [];
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(result === 1, `Expected one button named “${label}”; found ${result}.`);
}

async function openCreationJourney(client) {
	try {
		await waitFor(client, `(() => {
			if (document.querySelector('.structured-outline-workspace')) return true;
			return [...document.querySelectorAll('button')].some(button => (
				!button.disabled
				&& button.getBoundingClientRect().width > 0
				&& button.textContent?.replace(/\\s+/gu, '').includes('创作旅程')
			));
		})()`, 'creation-journey route or dashboard action');
	} catch (error) {
		const diagnostic = await evaluate(client, `(() => ({
			shellClass: document.querySelector('.app-shell')?.className,
			bodyText: document.body.innerText.replace(/\\s+/gu, ' ').trim().slice(0, 2_000),
			buttons: [...document.querySelectorAll('button')].map(button => ({
				text: button.textContent?.replace(/\\s+/gu, ' ').trim(),
				ariaLabel: button.getAttribute('aria-label'),
				disabled: button.disabled,
				width: Math.round(button.getBoundingClientRect().width),
				height: Math.round(button.getBoundingClientRect().height)
			})).slice(0, 80)
		}))()`);
		throw new Error(
			`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`,
			{ cause: error }
		);
	}
	if (await evaluate(client, `Boolean(document.querySelector('.structured-outline-workspace'))`)) {
		return;
	}
	const count = await evaluate(client, `(() => {
		const matches = [...document.querySelectorAll('button')].filter(button => (
			!button.disabled
			&& button.getBoundingClientRect().width > 0
			&& button.textContent?.replace(/\\s+/gu, '').includes('创作旅程')
		));
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one dashboard creation-journey action; found ${count}.`);
}

async function fillByLabel(client, label, value) {
	const result = await evaluate(client, `(() => {
		const element = document.querySelector(
			'[aria-label=' + CSS.escape(${JSON.stringify(label)}) + ']'
		);
		if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
			return { found: Boolean(element), value: null };
		}
		element.focus();
		const prototype = element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
			element,
			${JSON.stringify(value)}
		);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
		element.blur();
		return { found: true, value: element.value };
	})()`);
	assert(
		result.found && result.value === value,
		`Could not fill “${label}”: ${JSON.stringify(result)}`
	);
	await waitFor(
		client,
		`document.querySelector('[aria-label=' + CSS.escape(${JSON.stringify(label)}) + ']')?.value === ${JSON.stringify(value)}`,
		`updated value for “${label}”`
	);
	await delay(80);
}

async function setViewport(client, width, height) {
	await client.call('Emulation.setDeviceMetricsOverride', {
		width,
		height,
		screenWidth: width,
		screenHeight: height,
		deviceScaleFactor: 1,
		mobile: false
	});
	await delay(180);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectMetrics(client, expectedMode) {
	return evaluate(client, `(() => {
		const workspace = document.querySelector('.structured-outline-workspace');
		const grid = document.querySelector('.structured-outline-grid');
		const tree = document.querySelector('.structured-outline-tree');
		const cards = document.querySelector('.structured-outline-cards');
		const inspector = document.querySelector('.structured-outline-inspector');
		if (!workspace || !grid || !tree || !cards || !inspector) {
			return { missingWorkspace: true };
		}
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...workspace.querySelectorAll('button, input, textarea, select')]
			.filter(visible);
		const undersizedControls = controls.flatMap(element => {
			const rect = element.getBoundingClientRect();
			return rect.height < 44 ? [{
				label: element.getAttribute('aria-label')
					?? element.textContent?.replace(/\\s+/gu, ' ').trim(),
				width: Math.round(rect.width),
				height: Math.round(rect.height)
			}] : [];
		});
		const page = document.documentElement;
		const gridStyle = getComputedStyle(grid);
		const treeRect = tree.getBoundingClientRect();
		const cardsRect = cards.getBoundingClientRect();
		const inspectorRect = inspector.getBoundingClientRect();
		const primaryButtons = [...workspace.querySelectorAll('button.primary-button')]
			.filter(element => visible(element) && !element.disabled);
		return {
			missingWorkspace: false,
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, page.scrollWidth - page.clientWidth),
			pageOverflowY: Math.max(0, page.scrollHeight - page.clientHeight),
			workspaceOverflowX: Math.max(0, workspace.scrollWidth - workspace.clientWidth),
			gridTemplateColumns: gridStyle.gridTemplateColumns,
			gridTemplateAreas: gridStyle.gridTemplateAreas,
			primaryActionCount: primaryButtons.length,
			undersizedControls,
			tree: {
				left: Math.round(treeRect.left),
				top: Math.round(treeRect.top),
				width: Math.round(treeRect.width),
				height: Math.round(treeRect.height)
			},
			cards: {
				left: Math.round(cardsRect.left),
				top: Math.round(cardsRect.top),
				width: Math.round(cardsRect.width),
				height: Math.round(cardsRect.height)
			},
			inspector: {
				left: Math.round(inspectorRect.left),
				top: Math.round(inspectorRect.top),
				width: Math.round(inspectorRect.width),
				height: Math.round(inspectorRect.height)
			},
			expectedMode: ${JSON.stringify(expectedMode)}
		};
	})()`);
}

function buildJourney(projectId) {
	const timestamp = '2026-07-30T08:00:00.000Z';
	const beats = [
		{
			title: '雨夜来信',
			summary: '失踪多年的姐姐寄来一封只写着车站编号的信。',
			goal: '确认来信是否真实',
			conflict: '旧车站已封闭且有人阻止调查',
			outcome: '主角找到仍在运作的寄存柜',
			hook: '柜中录音提到了明晚',
			povHint: '林澄'
		},
		{
			title: '玻璃顶下的脚印',
			summary: '雨水显出一串不可能存在的脚印。',
			goal: '追踪脚印来源',
			conflict: '脚印在封闭站台中央消失',
			outcome: '发现维修通道',
			hook: '通道里亮起旧时刻表',
			povHint: '林澄'
		},
		{
			title: '错位时刻表',
			summary: '废弃时刻表记录着尚未发生的列车。',
			goal: '破解列车编号',
			conflict: '编号指向姐姐失踪当晚',
			outcome: '确认有人在重演旧案',
			hook: '下一站写着主角住址',
			povHint: '林澄'
		},
		{
			title: '站长室的第二把钥匙',
			summary: '旧站长留下两把只能同时使用的钥匙。',
			goal: '进入封存档案室',
			conflict: '另一把钥匙在未知跟踪者手中',
			outcome: '双方被迫短暂合作',
			hook: '档案证明姐姐主动消失',
			povHint: '林澄'
		},
		{
			title: '零点末班车',
			summary: '主角在零点列车到站前作出最后选择。',
			goal: '阻止下一次失踪',
			conflict: '救姐姐意味着让旧案永远沉没',
			outcome: '真相被公开，循环终止',
			hook: '远处再次响起并不存在的汽笛',
			povHint: '林澄'
		}
	];
	return {
		schemaVersion: 2,
		revision: 1,
		projectId,
		startRoute: 'genre',
		stage: 'outline',
		genreInput: {
			projectId,
			genre: '都市悬疑',
			premise: '一座废弃车站在雨夜重新亮起时刻表。',
			mode: 'deep',
			scale: 'novel',
			tones: ['克制', '悬疑'],
			protagonistHints: ['档案修复师林澄'],
			requiredElements: ['旧车站', '雨夜来信'],
			excludedElements: ['超能力解决一切'],
			endingPreference: 'bittersweet',
			audience: '成年悬疑读者',
			structureTemplateId: 'five-beat-mystery'
		},
		storyOutline: {
			id: 'journey-story-outline:rain-station',
			projectId,
			title: '雨夜无日期',
			genre: '都市悬疑',
			premise: '一座废弃车站在雨夜重新亮起时刻表。',
			themePromise: '记忆不是证词，但选择可以成为证词。',
			protagonistGoal: '找到姐姐失踪的真实原因。',
			centralConflict: '主角越接近真相，越可能让旧案中的幸存者再次受伤。',
			stakes: '姐姐的下落与主角自己的清白。',
			mysteryQuestion: '是谁让废弃车站在雨夜重新运作？',
			endingDirection: '真相公开，但姐姐选择留在远方。',
			structureTemplateId: 'five-beat-mystery',
			status: 'draft',
			revision: 1,
			createdAt: timestamp,
			updatedAt: timestamp
		},
		genreGeneration: {
			suggestedCharacters: [],
			suggestedWorldRules: [],
			warnings: [],
			generatedAt: timestamp
		},
		elements: [
			{ id: 'journey-element:genre', category: 'theme', text: '都市悬疑', locked: true },
			{ id: 'journey-element:station', category: 'place', text: '旧车站', locked: true },
			{ id: 'journey-element:letter', category: 'object', text: '雨夜来信', locked: false }
		],
		core: {
			oneSentence: '',
			protagonist: '',
			goal: '',
			obstacle: '',
			stakes: '',
			mystery: '',
			readerExperience: '',
			endingDirection: ''
		},
		directions: [],
		selectedDirectionIds: [],
		outline: beats.map((beat, index) => ({
			id: `journey-outline:rain-beat-${index + 1}`,
			title: beat.title,
			summary: beat.summary,
			purpose: beat.goal,
			type: 'story_beat',
			order: index,
			goal: beat.goal,
			conflict: beat.conflict,
			outcome: beat.outcome,
			hook: beat.hook,
			povHint: beat.povHint,
			characterIds: [],
			plotThreadIds: [],
			foreshadowingIds: [],
			status: 'planned',
			source: 'ai_generated',
			revision: 1
		})),
		chapters: [],
		guidance: { answers: [] },
		locks: {
			coreFields: [],
			directionIds: [],
			outlineNodeIds: [],
			chapterIds: []
		},
		impacts: [],
		stale: {
			directions: false,
			outline: false,
			chapters: false
		},
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

async function seedFreshProject(client, projectParent) {
	const created = await invoke(client, 'create_project', {
		request: {
			name: '雨夜无日期',
			description: 'Phase 1.2B Gate A-C 原生验收项目',
			rootDirectory: projectParent,
			projectType: 'longform',
			language: 'zh-CN',
			templateId: 'blank-longform',
			selectedInitialResources: ['first-volume'],
			themeId: 'paper',
			accentId: 'gold',
			writingMode: 'planningFirst'
		}
	});
	assert(created?.projectId && created?.root, `Native project creation failed: ${JSON.stringify(created)}`);
	assert(
		created.firstChapterId === undefined || created.firstChapterId === null,
		'Fresh acceptance project unexpectedly created a chapter.'
	);
	await invoke(client, 'open_project', {
		projectRoot: created.root,
		mode: 'read-write'
	});
	const journey = buildJourney(created.projectId);
	const write = await invoke(client, 'write_creation_journey_state', {
		projectRoot: created.root,
		content: `${JSON.stringify(journey, null, 2)}\n`,
		expectedHash: ''
	});
	assert(write?.hash, `Native journey seed failed: ${JSON.stringify(write)}`);
	const persistedWorkspace = JSON.stringify({
		state: {
			recentProjectRoot: created.root,
			recentProjectRoots: [created.root],
			activeMode: 'planning',
			storyView: 'creation-journey',
			theme: 'paper',
			accent: 'gold'
		},
		version: 2
	});
	const seedScript = await client.call('Page.addScriptToEvaluateOnNewDocument', {
		source: `localStorage.setItem(
			'writing-buddy-next-workspace',
			${JSON.stringify(persistedWorkspace)}
		);`
	});
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'reloaded app shell');
	await client.call('Page.removeScriptToEvaluateOnNewDocument', {
		identifier: seedScript.identifier
	});
	await openCreationJourney(client);
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-workspace'))`,
		'structured outline workspace'
	);
	return { created, journey, seedHash: write.hash };
}

async function exerciseWorkspace(client) {
	await fillByLabel(client, '故事标题', '雨夜车站：修订大纲');

	const initialIds = await evaluate(client, `[
		...document.querySelectorAll('.structured-outline-card')
	].map(card => card.getAttribute('aria-label'))`);
	assert(initialIds.length === 5, `Expected five outline cards; found ${initialIds.length}.`);

	const dragStarted = await evaluate(client, `(() => {
		const card = document.querySelectorAll('.structured-outline-card')[0];
		if (!card) return false;
		return card.dispatchEvent(new DragEvent('dragstart', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
	})()`);
	assert(dragStarted, 'The first outline card did not start dragging.');
	await delay(100);
	await evaluate(client, `(() => {
		const card = document.querySelectorAll('.structured-outline-card')[2];
		if (!card) return false;
		card.dispatchEvent(new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
		card.dispatchEvent(new DragEvent('drop', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
		return true;
	})()`);
	await waitFor(
		client,
		`document.querySelectorAll('[data-testid="outline-card-title"]')[2]?.textContent?.trim() === '雨夜来信'`,
		'persisted drag reorder'
	);

	await evaluate(client, `document.querySelectorAll('.structured-outline-card')[1]?.click(); true`);
	await waitFor(
		client,
		`Boolean(document.querySelector('[aria-label=' + CSS.escape('节点标题') + ']'))`,
		'story beat inspector'
	);
	await fillByLabel(client, '节点标题', '错位时刻表（作者修订）');
	await clickButton(client, '锁定此节点', '.structured-outline-inspector');
	await waitFor(
		client,
		`[...document.querySelectorAll('.structured-outline-inspector button')]
			.some(button => button.textContent?.replace(/\\s+/gu, ' ').trim() === '解除节点锁定')`,
		'locked outline node'
	);
	await clickButton(client, '保存大纲', '.structured-outline-toolbar');
	await delay(500);

	const idsAfterDrag = await evaluate(client, `[
		...document.querySelectorAll('[data-testid="outline-card-title"]')
	].map(element => element.textContent?.trim())`);
	return { initialCardLabels: initialIds, cardTitlesAfterDrag: idsAfterDrag };
}

async function verifyPersistedState(client, projectRoot) {
	const file = await invoke(client, 'read_creation_journey_state', { projectRoot });
	assert(file?.content && file?.hash, 'Native journey file was not readable after save.');
	const state = JSON.parse(file.content);
	const expectedIds = [
		'journey-outline:rain-beat-2',
		'journey-outline:rain-beat-3',
		'journey-outline:rain-beat-1',
		'journey-outline:rain-beat-4',
		'journey-outline:rain-beat-5'
	];
	assert(
		state.storyOutline?.title === '雨夜车站：修订大纲',
		`Root title was not persisted: ${state.storyOutline?.title}`
	);
	assert(
		JSON.stringify(state.outline.map(node => node.id)) === JSON.stringify(expectedIds),
		`Outline order was not persisted: ${JSON.stringify(state.outline.map(node => node.id))}`
	);
	assert(
		state.outline.every((node, index) => node.order === index),
		`Outline order fields were not normalized: ${JSON.stringify(
			state.outline.map(node => node.order)
		)}`
	);
	assert(
		state.outline[1].title === '错位时刻表（作者修订）',
		`Node edit was not persisted: ${state.outline[1].title}`
	);
	assert(
		JSON.stringify(state.locks.outlineNodeIds) === JSON.stringify([
			'journey-outline:rain-beat-3'
		]),
		`Node lock was not persisted: ${JSON.stringify(state.locks.outlineNodeIds)}`
	);
	assert(state.chapters.length === 0, 'Structured outline unexpectedly materialized chapters.');
	return {
		hash: file.hash,
		revision: state.revision,
		storyOutlineRevision: state.storyOutline.revision,
		outlineIds: state.outline.map(node => node.id),
		outlineOrders: state.outline.map(node => node.order),
		lockedIds: state.locks.outlineNodeIds,
		chapterCount: state.chapters.length
	};
}

async function reopenAndVerify(client) {
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'app shell after reopen');
	await openCreationJourney(client);
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-workspace'))`,
		'structured outline after reopen'
	);
	const restored = await evaluate(client, `(() => ({
		title: document.querySelector('[aria-label=' + CSS.escape('故事标题') + ']')?.value,
		cardTitles: [...document.querySelectorAll('[data-testid="outline-card-title"]')]
			.map(element => element.textContent?.trim()),
		lockedCardCount: document.querySelectorAll('.structured-outline-card.is-locked').length,
		chapterOrSceneNodes: [...document.querySelectorAll('.structured-outline-tree button')]
			.filter(button => /章节|场景/u.test(button.textContent ?? '')).length
	}))()`);
	assert(restored.title === '雨夜车站：修订大纲', 'Root title did not survive native reopen.');
	assert(
		restored.cardTitles[1] === '错位时刻表（作者修订）',
		'Node title did not survive native reopen.'
	);
	assert(restored.cardTitles[2] === '雨夜来信', 'Card order did not survive native reopen.');
	assert(restored.lockedCardCount === 1, 'Node lock did not survive native reopen.');
	assert(
		restored.chapterOrSceneNodes === 0,
		'The structured outline tree displayed fabricated Chapter/Scene nodes.'
	);
	return restored;
}

await mkdir(outputDirectory, { recursive: true });
const temporaryRoot = await mkdtemp(join(tmpdir(), 'writing-buddy-genre-to-draft-'));
const projectParent = join(temporaryRoot, 'projects');
const profileDirectory = join(temporaryRoot, 'webview-profile');
await mkdir(projectParent, { recursive: true });
await mkdir(profileDirectory, { recursive: true });

const appOutput = [];
const child = spawn(executable, [], {
	env: {
		...process.env,
		WEBVIEW2_USER_DATA_FOLDER: profileDirectory
	},
	stdio: ['ignore', 'pipe', 'pipe'],
	windowsHide: true
});
child.stdout?.on('data', chunk => appOutput.push(chunk.toString()));
child.stderr?.on('data', chunk => appOutput.push(chunk.toString()));

let client;
let closedNormally = false;
try {
	const target = await waitForTarget(child);
	client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	const runtimeErrors = [];
	const consoleErrors = [];
	client.on('Runtime.exceptionThrown', params => {
		runtimeErrors.push(
			params.exceptionDetails?.exception?.description
			?? params.exceptionDetails?.text
			?? 'Uncaught runtime exception'
		);
	});
	client.on('Runtime.consoleAPICalled', params => {
		if (params.type === 'error') {
			consoleErrors.push(params.args.map(argument => (
				argument.value ?? argument.description ?? ''
			)).join(' '));
		}
	});
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('DOM.enable');
	await setViewport(client, 1536, 992);
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'native app shell');
	const shellReadyMs = Math.round(performance.now() - acceptanceStartedAt);
	assert(
		await evaluate(client, `Boolean(window.__TAURI_INTERNALS__?.invoke)`),
		'Acceptance target is not the native Tauri runtime.'
	);

	const seed = await seedFreshProject(client, projectParent);
	const firstWorkspaceReadyMs = Math.round(performance.now() - acceptanceStartedAt);
	const interaction = await exerciseWorkspace(client);
	const persisted = await verifyPersistedState(client, seed.created.root);

	const captures = [];
	for (const profile of [
		{ width: 1536, height: 992, name: '01-structured-outline-1536x992.png', mode: 'three-pane' },
		{ width: 1280, height: 800, name: '02-structured-outline-1280x800.png', mode: 'three-pane' },
		{ width: 1024, height: 720, name: '03-structured-outline-stacked-1024x720.png', mode: 'stacked-inspector' }
	]) {
		await setViewport(client, profile.width, profile.height);
		const metrics = await collectMetrics(client, profile.mode);
		assert(!metrics.missingWorkspace, `Workspace missing at ${profile.width}x${profile.height}.`);
		assert(metrics.pageOverflowX === 0, `Page overflowed horizontally: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Page overflowed vertically: ${JSON.stringify(metrics)}`);
		assert(
			metrics.workspaceOverflowX === 0,
			`Workspace overflowed horizontally: ${JSON.stringify(metrics)}`
		);
		assert(
			metrics.primaryActionCount === 1,
			`Expected one enabled primary action: ${JSON.stringify(metrics)}`
		);
		assert(
			metrics.undersizedControls.length === 0,
			`Found controls below 44px: ${JSON.stringify(metrics.undersizedControls)}`
		);
		if (profile.mode === 'stacked-inspector') {
			assert(
				metrics.inspector.top >= Math.min(
					metrics.tree.top + metrics.tree.height,
					metrics.cards.top + metrics.cards.height
				) - 2,
				`Inspector did not stack below the outline panes: ${JSON.stringify(metrics)}`
			);
		} else {
			assert(
				metrics.tree.top === metrics.cards.top && metrics.cards.top === metrics.inspector.top,
				`Desktop panes were not aligned: ${JSON.stringify(metrics)}`
			);
		}
		await screenshot(client, profile.name);
		captures.push({ name: profile.name, ...metrics });
	}

	await setViewport(client, 1536, 992);
	const restored = await reopenAndVerify(client);
	await screenshot(client, '04-native-reopen-restored-1536x992.png');
	assert(
		runtimeErrors.length === 0,
		`Native runtime exceptions occurred: ${JSON.stringify(runtimeErrors)}`
	);
	assert(
		consoleErrors.length === 0,
		`Native console errors occurred: ${JSON.stringify(consoleErrors)}`
	);

	const report = {
		generatedAt: new Date().toISOString(),
		executable,
		runtime: 'tauri-webview2',
		freshProject: {
			projectId: seed.created.projectId,
			firstChapterId: seed.created.firstChapterId ?? null,
			createdFileCount: seed.created.createdFileCount,
			createdDirectoryCount: seed.created.createdDirectoryCount
		},
		interaction,
		persisted,
		restored,
		captures,
		runtimeErrors,
		consoleErrors,
		performance: {
			shellReadyMs,
			firstWorkspaceReadyMs,
			acceptanceBeforeShutdownMs: Math.round(performance.now() - acceptanceStartedAt)
		}
	};

	const closeRequest = spawnSync('taskkill', ['/PID', String(child.pid)], {
		encoding: 'utf8',
		windowsHide: true
	});
	await delay(350);
	let shutdownMode = 'window-close';
	if (
		child.exitCode === null
		&& await evaluate(client, `Boolean(document.querySelector('.close-protection-dialog'))`)
	) {
		shutdownMode = 'close-protection-confirmed';
		await clickButton(client, '不保存并退出', '.close-protection-dialog');
	}
	for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt += 1) {
		await delay(100);
	}
	closedNormally = child.exitCode !== null;
	assert(closedNormally, 'Writing Buddy did not exit after a normal window-close request.');
	await writeFile(metricsPath, `${JSON.stringify({
		...report,
		shutdown: {
			mode: shutdownMode,
			exitCode: child.exitCode,
			closeRequestStatus: closeRequest.status,
			closeRequestError: closeRequest.error?.message ?? null
		}
	}, null, 2)}\n`);
	console.log(`Native Genre-to-Draft Gate A-C acceptance passed: ${metricsPath}`);
} finally {
	client?.close();
	if (child.pid && child.exitCode === null) {
		spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
	if (!closedNormally && appOutput.length) {
		console.error(appOutput.join('').slice(-8_000));
	}
	if (temporaryRoot.startsWith(tmpdir())) {
		await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 4 });
	}
}
