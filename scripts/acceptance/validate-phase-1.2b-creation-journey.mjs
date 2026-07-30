import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const phase12c = process.argv.includes('--phase-1.2c');
const phaseLabel = phase12c ? 'Phase 1.2C' : 'Phase 1.2B';
const phaseSlug = phase12c ? 'phase-1.2c-guided-development' : 'phase-1.2b-creation-journey';
const outputDirectory = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'screenshots',
	phaseSlug
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	`${phaseSlug}-metrics.json`
);
const statusPath = join(
	repositoryRoot,
	'artifacts',
	'acceptance',
	`${phaseSlug}-status.json`
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const appUrl = process.env.WRITING_BUDDY_URL ?? 'http://127.0.0.1:4174/';
const debuggingPort = Number(process.env.WRITING_BUDDY_CDP_PORT ?? 9731);

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

async function reportProgress(step) {
	console.log(`[${phaseLabel}] ${step}`);
	await mkdir(dirname(statusPath), { recursive: true });
	await writeFile(statusPath, `${JSON.stringify({
		step,
		updatedAt: new Date().toISOString()
	}, null, 2)}\n`);
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

async function waitFor(client, expression, description, timeout = 15_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(40);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForTarget() {
	const deadline = Date.now() + 20_000;
	while (Date.now() < deadline) {
		try {
			const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
				.then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page' && candidate.url.startsWith(appUrl)
			));
			if (target) return target;
		} catch {
			// Edge is still starting.
		}
		await delay(80);
	}
	throw new Error('Timed out waiting for the Edge acceptance target.');
}

async function launchBrowser(profileDirectory) {
	const child = spawn(edgePath, [
		`--remote-debugging-port=${debuggingPort}`,
		`--user-data-dir=${profileDirectory}`,
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-background-networking',
		'--disable-component-update',
		'--disable-sync',
		'--hide-crash-restore-bubble',
		'--window-size=1536,992',
		appUrl
	], {
		stdio: 'ignore',
		windowsHide: true
	});
	const target = await waitForTarget();
	const client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	const browserErrors = [];
	client.on('Runtime.exceptionThrown', params => {
		browserErrors.push(
			params.exceptionDetails?.exception?.description
			?? params.exceptionDetails?.text
			?? 'Uncaught browser exception'
		);
	});
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('DOM.enable');
	await setViewport(client, 1536, 992, false);
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'application shell');
	return { browserErrors, child, client };
}

async function stopBrowser(run) {
	try {
		await Promise.race([run.client.call('Browser.close'), delay(3_000)]);
	} catch {
		// CDP disconnects as soon as Edge accepts Browser.close.
	}
	run.client.close();
	for (let attempt = 0; attempt < 30 && run.child.exitCode === null; attempt += 1) {
		await delay(100);
	}
	if (run.child.pid && run.child.exitCode === null) {
		spawnSync('taskkill', ['/PID', String(run.child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
}

async function setViewport(client, width, height, reducedMotion) {
	await client.call('Emulation.setDeviceMetricsOverride', {
		width,
		height,
		screenWidth: width,
		screenHeight: height,
		deviceScaleFactor: 1,
		mobile: false
	});
	await client.call('Emulation.setEmulatedMedia', {
		features: [{
			name: 'prefers-reduced-motion',
			value: reducedMotion ? 'reduce' : 'no-preference'
		}]
	});
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

async function clickButton(client, label, scopeSelector = undefined, match = 'exact', index = 0) {
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const matches = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && !button.disabled && (
				${match === 'contains'
					? 'normalize(button.getAttribute("aria-label")).includes(label) || normalize(button.textContent).includes(label)'
					: 'normalize(button.getAttribute("aria-label")) === label || normalize(button.textContent) === label'}
			)) : [];
		return matches.length > ${index};
	})()`, `button “${label}”`);
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const matches = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && (
				${match === 'contains'
					? 'normalize(button.getAttribute("aria-label")).includes(label) || normalize(button.textContent).includes(label)'
					: 'normalize(button.getAttribute("aria-label")) === label || normalize(button.textContent) === label'}
			)) : [];
		if (matches.length > ${index}) matches[${index}].click();
		return { count: matches.length, disabled: matches[${index}]?.disabled ?? true };
	})()`);
	assert(
		result.count > index && !result.disabled,
		`Could not activate button “${label}” at index ${index}; found ${result.count}.`
	);
}

async function fillSelector(client, selector, value, index = 0) {
	const result = await evaluate(client, `(() => {
		const matches = [...document.querySelectorAll(${JSON.stringify(selector)})];
		const element = matches[${index}];
		if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
			return { count: matches.length, filled: false };
		}
		const prototype = element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
			element,
			${JSON.stringify(value)}
		);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
		return { count: matches.length, filled: element.value === ${JSON.stringify(value)} };
	})()`);
	assert(result.count > index && result.filled, `Could not fill ${selector} at index ${index}.`);
}

async function setTheme(client, theme) {
	await evaluate(client, `globalThis.__acceptanceSetThemePromise
		= import('/src/app/store.ts').then(({ useAppStore }) => {
		useAppStore.setState({ theme: ${JSON.stringify(theme)} });
		return useAppStore.getState().theme;
	})`);
	await waitFor(
		client,
		`document.querySelector('.app-shell')?.classList.contains(
			${JSON.stringify(`theme-${theme}`)}
		)`,
		`${theme} theme`
	);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectJourneyMetrics(client) {
	return evaluate(client, `(() => {
		const root = document.documentElement;
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...document.querySelectorAll(
			'.creation-journey button:not([hidden]), '
				+ '.creation-journey input:not([hidden]), '
				+ '.creation-journey textarea:not([hidden]), '
				+ '.creation-journey select:not([hidden])'
		)].filter(visible);
		const rectangles = controls.map(element => element.getBoundingClientRect());
		const clippedControls = controls.map((element, index) => ({
			element,
			rect: rectangles[index]
		})).filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1);
		return {
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			clippedInteractive: clippedControls.length,
			clippedDetails: clippedControls.slice(0, 8).map(({ element, rect }) => ({
				ariaLabel: element.getAttribute('aria-label'),
				className: element.className,
				left: Math.round(rect.left),
				right: Math.round(rect.right),
				tagName: element.tagName,
				text: element.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80)
			})),
			controlCount: controls.length,
			minControlHeight: rectangles.length
				? Math.round(Math.min(...rectangles.map(rect => rect.height)))
				: 0,
			focusedHeading: document.activeElement?.id === 'creation-journey-heading',
			focusedInDialog: Boolean(document.activeElement?.closest('.creation-impact-dialog')),
			alertCount: document.querySelectorAll('.creation-journey [role="alert"]').length,
			theme: document.querySelector('.app-shell')?.className.includes('theme-midnight')
				? 'midnight'
				: 'paper'
		};
	})()`);
}

async function assertResponsiveStage(client, metrics, expected) {
	assert(metrics.viewport.width === expected.width, `${expected.name}: viewport width drifted.`);
	assert(metrics.viewport.height === expected.height, `${expected.name}: viewport height drifted.`);
	assert(metrics.pageOverflowX === 0, `${expected.name}: horizontal page overflow.`);
	assert(
		metrics.clippedInteractive === 0,
		`${expected.name}: clipped interactive controls: ${JSON.stringify(metrics.clippedDetails)}`
	);
	assert(metrics.controlCount > 0, `${expected.name}: no journey controls were visible.`);
	assert(metrics.minControlHeight >= 44, `${expected.name}: control below 44px touch target.`);
	if (expected.focus === 'dialog') {
		assert(metrics.focusedInDialog, `${expected.name}: focus did not enter the dialog.`);
	} else {
		assert(metrics.focusedHeading, `${expected.name}: stage heading did not receive focus.`);
	}
	assert(metrics.alertCount === 0, `${expected.name}: visible journey error.`);
	assert(metrics.theme === expected.theme, `${expected.name}: theme did not apply.`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), `${phaseSlug}-`));
let run;
const evidence = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	appUrl,
	journey: {},
	responsive: {}
};

try {
	await reportProgress('Launching isolated Edge profile.');
	run = await launchBrowser(profileDirectory);
	await evaluate(run.client, 'localStorage.clear(); sessionStorage.clear(); true');
	await run.client.call('Page.reload', { ignoreCache: true });
	await waitFor(
		run.client,
		`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`,
		'welcome screen'
	);
	await reportProgress('Welcome screen ready.');
	await evaluate(run.client, `Promise.all([
		import('/src/platform/bridge.ts').then(({ desktopBridge }) => {
			globalThis.__phase12bAiCalls = 0;
			globalThis.__phase12bMaterializeCalls = 0;
			return desktopBridge.saveDeepSeekKey('browser-fixture').then(() => {
				const startAi = desktopBridge.startAiGeneration.bind(desktopBridge);
				const materialize = desktopBridge.materializeCreationJourney.bind(desktopBridge);
				desktopBridge.startAiGeneration = (...args) => {
					globalThis.__phase12bAiCalls += 1;
					return startAi(...args);
				};
				desktopBridge.materializeCreationJourney = (...args) => {
					globalThis.__phase12bMaterializeCalls += 1;
					return materialize(...args);
				};
			});
		})
	])`);

	await clickButton(run.client, '新建项目', 'main[aria-label="开始使用 Writing Buddy"]');
	await waitFor(run.client, `Boolean(document.querySelector('[role="dialog"]'))`, 'project wizard');
	await fillSelector(run.client, 'input[aria-label="作品名称"]', '雨夜记忆');
	await clickButton(run.client, '浏览', '[role="dialog"]');
	await clickButton(run.client, '下一步', '[role="dialog"]');
	await waitFor(
		run.client,
		`document.querySelector('#wizard-start-title')?.textContent === '你现在从哪里开始？'`,
		'creation start routes'
	);
	await reportProgress('Six-start project wizard ready.');
	const startRouteContract = await evaluate(run.client, `(() => {
		const buttons = [...document.querySelectorAll('.creation-start-grid button')];
		return {
			count: buttons.length,
			selected: buttons.filter(button => button.getAttribute('aria-pressed') === 'true')
				.map(button => button.querySelector('strong')?.textContent),
			aiCalls: globalThis.__phase12bAiCalls
		};
	})()`);
	assert(startRouteContract.count === 6, 'The project wizard did not expose six honest starts.');
	assert(
		startRouteContract.selected.join('') === '我只有几个想法',
		'Ideas was not the default creation start.'
	);
	assert(startRouteContract.aiCalls === 0, 'Opening the creation start triggered AI.');
	await screenshot(run.client, '01-six-honest-starts-paper-1536x992.png');

	await clickButton(run.client, '下一步', '[role="dialog"]');
	await waitFor(
		run.client,
		`document.querySelector('#wizard-structure-title')?.textContent === '初始结构'`,
		'initial structure'
	);
	const firstChapterContract = await evaluate(run.client, `(() => {
		const label = [...document.querySelectorAll('.structure-card')]
			.find(candidate => candidate.textContent?.includes('创建第一章草稿'));
		const checkbox = label?.querySelector('input[type="checkbox"]');
		return {
			found: Boolean(label),
			disabled: checkbox?.disabled ?? false,
			checked: checkbox?.checked ?? true
		};
	})()`);
	assert(firstChapterContract.found, 'First-chapter option was not rendered.');
	assert(firstChapterContract.disabled, 'Ideas route allowed an early first chapter.');
	assert(!firstChapterContract.checked, 'Ideas route pre-created a first chapter.');

	await clickButton(run.client, '下一步', '[role="dialog"]');
	await clickButton(run.client, '下一步', '[role="dialog"]');
	await clickButton(run.client, '创建项目', '[role="dialog"]');
	await waitFor(
		run.client,
		`document.querySelector('#creation-journey-heading')?.textContent
			=== '先把脑中的碎片放下来'`,
		'idea element stage',
		20_000
	);
	await reportProgress('Project created at the idea stage.');
	assert(
		await evaluate(run.client, 'globalThis.__phase12bAiCalls === 0'),
		'Project creation triggered AI before author action.'
	);
	for (const [index, idea] of [
		'旧车站玻璃顶',
		'失忆记者',
		'每天重置的夜雨'
	].entries()) {
		await fillSelector(run.client, '.creation-element-card textarea', idea, index);
	}
	await waitFor(
		run.client,
		`[...document.querySelectorAll('.creation-element-card textarea')]
			.slice(0, 3).every(element => element.value.trim().length > 0)
			&& ![...document.querySelectorAll('.creation-elements-stage .primary-button')]
				.find(button => button.textContent?.includes('整理成故事核心'))?.disabled`,
		'three committed story elements'
	);
	if (phase12c) {
		const guidanceTrigger = await evaluate(run.client, `(() => {
			const button = [...document.querySelectorAll('button')]
				.find(candidate => candidate.textContent?.includes('AI 问一个关键问题'));
			return {
				found: Boolean(button),
				disabled: button?.disabled,
				text: button?.textContent?.replace(/\\s+/gu, ' ').trim()
			};
		})()`);
		assert(
			guidanceTrigger.found && !guidanceTrigger.disabled,
			`Guidance trigger unavailable: ${JSON.stringify(guidanceTrigger)}`
		);
		await clickButton(run.client, '让 AI 问一个关键问题');
		await waitFor(
			run.client,
			`document.querySelector('#creation-guidance-question')?.textContent
				=== '如果主角失败，他最不能承受失去什么？'`,
			'one explicit guidance question'
		);
		const guidanceContract = await evaluate(run.client, `(() => {
			const card = document.querySelector('.creation-guidance-card');
			return {
				optionCount: card?.querySelectorAll('.creation-guidance-options > button').length ?? 0,
				questionCount: document.querySelectorAll('#creation-guidance-question').length,
				aiCalls: globalThis.__phase12bAiCalls
			};
		})()`);
		assert(guidanceContract.questionCount === 1, 'Guidance rendered more than one question.');
		assert(guidanceContract.optionCount === 3, 'Guidance did not render exactly three options.');
		assert(guidanceContract.aiCalls === 1, 'Explicit guidance did not make exactly one AI call.');
		await screenshot(run.client, '02a-one-question-three-options-paper-1536x992.png');
		await clickButton(run.client, '最后的记忆', '.creation-guidance-card', 'contains');
		await clickButton(run.client, '确认这个答案', '.creation-guidance-card');
		await waitFor(
			run.client,
			`!document.querySelector('.creation-guidance-card')`,
			'persisted guidance answer'
		);
		await clickButton(run.client, '锁定要素 1');
	}
	const elementsMetrics = await collectJourneyMetrics(run.client);
	await assertResponsiveStage(run.client, elementsMetrics, {
		name: 'elements-wide',
		width: 1536,
		height: 992,
		theme: 'paper'
	});
	evidence.responsive.elementsWide = elementsMetrics;
	await screenshot(run.client, '02-three-ideas-paper-1536x992.png');

	await clickButton(run.client, '整理成故事核心');
	await waitFor(
		run.client,
		`document.querySelector('#creation-journey-heading')?.textContent
			=== '把碎片收束成一个故事核心'`,
		'story core'
	);
	await reportProgress('Editable story core generated.');
	assert(
		await evaluate(
			run.client,
			`globalThis.__phase12bAiCalls === ${phase12c ? 2 : 1}`
		),
		'Core AI call count drifted.'
	);
	assert(
		await evaluate(
			run.client,
			`Boolean([...document.querySelectorAll('.creation-core-grid textarea')]
				.find(element => element.value.includes('失忆记者必须在一夜内')))`
		),
		'Generated core was not editable and visible.'
	);
	if (phase12c) {
		await clickButton(run.client, '锁定主角');
		assert(
			await evaluate(run.client, 'document.querySelector("#creation-core-protagonist")?.disabled === true'),
			'Locked protagonist remained editable.'
		);
	}
	await clickButton(run.client, '确认故事核心');
	await waitFor(
		run.client,
		`document.querySelector('#creation-journey-heading')?.textContent
			=== '比较三个真正不同的方向'`,
		'story directions decision'
	);
	assert(
		await evaluate(
			run.client,
			`globalThis.__phase12bAiCalls === ${phase12c ? 2 : 1}`
		),
		'Confirming the core triggered AI automatically.'
	);
	await clickButton(run.client, '生成 3 个故事方向');
	await waitFor(
		run.client,
		'document.querySelectorAll(".creation-direction-card").length === 3',
		'exactly three story directions'
	);
	await reportProgress('Exactly three directions generated.');
	assert(
		await evaluate(
			run.client,
			`globalThis.__phase12bAiCalls === ${phase12c ? 3 : 2}`
		),
		'Direction AI call count drifted.'
	);
	await screenshot(run.client, '03-three-directions-paper-1536x992.png');
	await clickButton(run.client, '选择此方向', undefined, 'contains', 0);
	await clickButton(run.client, '生成故事总纲');
	await waitFor(
		run.client,
		'document.querySelectorAll(".creation-outline-card").length >= 5',
		'story outline'
	);
	await reportProgress('Story outline generated.');

	await setViewport(run.client, 1280, 800, true);
	await setTheme(run.client, 'midnight');
	const outlineMetrics = await collectJourneyMetrics(run.client);
	await assertResponsiveStage(run.client, outlineMetrics, {
		name: 'outline-medium',
		width: 1280,
		height: 800,
		theme: 'midnight'
	});
	evidence.responsive.outlineMedium = outlineMetrics;
	const outlineBefore = await evaluate(
		run.client,
		`[...document.querySelectorAll('.creation-outline-fields input[maxlength="120"]')]
			.slice(0, 2).map(input => input.value)`
	);
	assert(
		JSON.stringify(outlineBefore) === JSON.stringify(['雨夜抵达', '重复雨痕']),
		'Unexpected initial outline order.'
	);
	await clickButton(run.client, '下移总纲节点 1');
	const outlineAfter = await evaluate(
		run.client,
		`[...document.querySelectorAll('.creation-outline-fields input[maxlength="120"]')]
			.slice(0, 2).map(input => input.value)`
	);
	assert(
		JSON.stringify(outlineAfter) === JSON.stringify(['重复雨痕', '雨夜抵达']),
		'Keyboard-equivalent outline reorder did not persist.'
	);
	await screenshot(run.client, '04-reordered-outline-midnight-reduced-1280x800.png');
	await clickButton(run.client, '拆分为 3 个开篇章节');
	await waitFor(
		run.client,
		'document.querySelectorAll(".creation-chapter-card").length === 3',
		'exactly three chapter proposals'
	);
	await reportProgress('Exactly three chapter proposals generated.');
	assert(
		await evaluate(
			run.client,
			`globalThis.__phase12bAiCalls === ${phase12c ? 5 : 4}`
		),
		'The creation journey did not use exactly four explicit AI actions.'
	);

	await setViewport(run.client, 1024, 720, false);
	await setTheme(run.client, 'paper');
	const chapterMetrics = await collectJourneyMetrics(run.client);
	await assertResponsiveStage(run.client, chapterMetrics, {
		name: 'chapters-compact',
		width: 1024,
		height: 720,
		theme: 'paper'
	});
	evidence.responsive.chaptersCompact = chapterMetrics;
	await screenshot(run.client, '05-three-chapters-paper-1024x720.png');

	await clickButton(run.client, '创建 3 章并进入第一章');
	await waitFor(
		run.client,
		`Promise.all([
			import('/src/app/store.ts').then(
				({ useAppStore }) => useAppStore.getState().activeResource?.title === '夜雨站台'
			),
			Promise.resolve(Boolean(document.querySelector('.creation-journey [role="alert"]')))
		]).then(([opened, failed]) => opened || failed)`,
		'first generated chapter',
		20_000
	);
	const materializationOutcome = await evaluate(run.client, `import('/src/app/store.ts').then(
		({ useAppStore }) => ({
			activeTitle: useAppStore.getState().activeResource?.title,
			alert: document.querySelector('.creation-journey [role="alert"]')?.textContent?.trim()
		})
	)`);
	assert(
		!materializationOutcome.alert,
		`Chapter materialization showed an error: ${materializationOutcome.alert}`
	);
	assert(
		materializationOutcome.activeTitle === '夜雨站台',
		'The first generated chapter was not opened.'
	);
	await reportProgress('Atomic materialization opened chapter one.');
	const finalContract = await evaluate(run.client, `Promise.all([
		import('/src/app/store.ts'),
		import('/src/platform/bridge.ts')
	]).then(async ([{ useAppStore }, { desktopBridge }]) => {
		const state = useAppStore.getState();
		const journey = JSON.parse((await desktopBridge.readCreationJourneyState(
			state.snapshot.root
		)).content);
		return {
			activeTitle: state.activeResource?.title,
			aiCalls: globalThis.__phase12bAiCalls,
			chapterCount: state.snapshot?.project.volumes[0]?.chapters.length ?? 0,
			journeyChapterCount: journey.chapters.length,
			materializeCalls: globalThis.__phase12bMaterializeCalls,
			resourceIds: journey.chapters.map(chapter => chapter.resourceId),
			stage: journey.stage
		};
	})`);
	assert(finalContract.activeTitle === '夜雨站台', 'The first generated chapter was not opened.');
	assert(
		finalContract.aiCalls === (phase12c ? 5 : 4),
		'AI call count changed during materialization.'
	);
	assert(finalContract.chapterCount === 3, 'Project manifest did not contain exactly three chapters.');
	assert(finalContract.journeyChapterCount === 3, 'Journey did not retain exactly three chapters.');
	assert(finalContract.materializeCalls === 1, 'Chapter transaction was not invoked exactly once.');
	assert(finalContract.resourceIds.every(Boolean), 'Materialized chapters lack native resource IDs.');
	assert(finalContract.stage === 'writing', 'Journey did not advance to writing.');
	await screenshot(run.client, '06-opened-first-chapter-paper-1024x720.png');

	if (phase12c) {
		await run.client.call('Input.dispatchKeyEvent', {
			type: 'keyDown',
			key: 'b',
			code: 'KeyB',
			modifiers: 3,
			windowsVirtualKeyCode: 66
		});
		await run.client.call('Input.dispatchKeyEvent', {
			type: 'keyUp',
			key: 'b',
			code: 'KeyB',
			modifiers: 3,
			windowsVirtualKeyCode: 66
		});
		await waitFor(
			run.client,
			`Boolean(document.querySelector('.assistant-panel'))`,
			'writing assistant shortcut'
		);
		await clickButton(run.client, '内核', '.assistant-tabs');
		await waitFor(
			run.client,
			`Boolean(document.querySelector('.kernel-generator'))`,
			'Story Kernel generator'
		);
		await fillSelector(
			run.client,
			'.kernel-generator-instruction textarea',
			'根据正文生成候选 [QA_PARTIAL_INVALID_RESOURCE]'
		);
		const beforeStoryKernelAiCalls = await evaluate(
			run.client,
			'globalThis.__phase12bAiCalls'
		);
		const rapidClickContract = await evaluate(run.client, `(() => {
			const button = [...document.querySelectorAll('.kernel-generator button')]
				.find(candidate => candidate.textContent?.includes('生成 Story Kernel 候选'));
			if (!button || button.disabled) return { found: Boolean(button), disabled: true };
			button.click();
			button.click();
			return { found: true, disabled: button.disabled };
		})()`);
		assert(rapidClickContract.found, 'Story Kernel generate action was not visible.');
		await waitFor(
			run.client,
			`document.querySelector('.kernel-generator-warning')?.textContent
				?.includes('结构不完整，已安全隔离')`,
			'partial Story Kernel response isolation'
		);
		const storyKernelContract = await evaluate(run.client, `(() => {
			const generator = document.querySelector('.kernel-generator');
			const warning = generator?.querySelector('.kernel-generator-warning');
			const candidateTitles = [...(generator?.querySelectorAll(
				'.kernel-candidate-list article strong'
			) ?? [])].map(element => element.textContent?.trim());
			const generateButton = [...(generator?.querySelectorAll('button') ?? [])]
				.find(candidate => candidate.textContent?.includes('生成 Story Kernel 候选'));
			return {
				aiCalls: globalThis.__phase12bAiCalls,
				candidateTitles,
				generateDisabledAfterCompletion: generateButton?.disabled ?? true,
				hasRawSchemaError: generator?.textContent
					?.includes('invalidStoryKernelGenerationResource') ?? false,
				hasSettingsGuidance: generator?.textContent
					?.includes('检查 AI 设置') ?? false,
				warning: warning?.textContent?.replace(/\\s+/gu, ' ').trim()
			};
		})()`);
		assert(
			storyKernelContract.aiCalls === beforeStoryKernelAiCalls + 1,
			'Rapid Story Kernel clicks started more than one AI request.'
		);
		assert(
			storyKernelContract.candidateTitles.includes('可修复的候选地点'),
			'The locally repairable Story Kernel candidate was not preserved.'
		);
		assert(
			!storyKernelContract.candidateTitles.some(title => title?.includes('invalid')),
			'The malformed Story Kernel candidate remained visible.'
		);
		assert(
			!storyKernelContract.generateDisabledAfterCompletion,
			'Story Kernel generation did not return to an idle retryable state.'
		);
		assert(!storyKernelContract.hasRawSchemaError, 'Raw Story Kernel schema error leaked into the UI.');
		assert(
			!storyKernelContract.hasSettingsGuidance,
			'Response structure failure was incorrectly presented as an AI settings problem.'
		);
		evidence.storyKernelGeneration = {
			...storyKernelContract,
			requestsStartedByRapidClicks: storyKernelContract.aiCalls - beforeStoryKernelAiCalls
		};
		await evaluate(run.client, `(() => {
			const warning = document.querySelector('.kernel-generator-warning');
			warning?.scrollIntoView({ block: 'center' });
			return Boolean(warning);
		})()`);
		await screenshot(run.client, '06a-story-kernel-partial-response-paper-1024x720.png');
		await clickButton(run.client, '关闭写作助手');
		await clickButton(run.client, '打开作品仪表盘');
		await waitFor(
			run.client,
			`[...document.querySelectorAll('button')]
				.some(button => button.textContent?.includes('查看创作旅程'))`,
			'project dashboard journey entry'
		);
		await clickButton(run.client, '查看创作旅程', undefined, 'contains');
		await waitFor(
			run.client,
			`Boolean(document.querySelector('.creation-journey-progress'))`,
			'reopened creation journey'
		);
		await clickButton(run.client, '故事核心', '.creation-journey-progress', 'contains');
		await waitFor(
			run.client,
			`document.querySelector('#creation-journey-heading')?.textContent
				=== '把碎片收束成一个故事核心'`,
			'return to the completed story core'
		);
		assert(
			await evaluate(run.client, 'document.querySelector("#creation-core-protagonist")?.disabled === true'),
			'Core lock was not persisted after materialization.'
		);
		await fillSelector(run.client, '#creation-core-stakes', '失败会让姐姐永远不存在');
		await waitFor(
			run.client,
			`document.querySelector('.creation-journey-stale small')?.textContent
				?.includes('方向 3 项 · 提纲 5 项 · 章节 3 项待处理')`,
			'exact downstream impact counts'
		);
		const beforeImpactAiCalls = await evaluate(
			run.client,
			'globalThis.__phase12bAiCalls'
		);
		assert(beforeImpactAiCalls === 6, 'Upstream editing triggered AI automatically.');
		await setViewport(run.client, 1280, 800, true);
		await setTheme(run.client, 'midnight');
		await evaluate(run.client, `(() => {
			const opener = [...document.querySelectorAll('button')]
				.find(button => button.textContent?.trim() === '查看影响');
			opener?.focus();
			opener?.click();
			return Boolean(opener);
		})()`);
		await waitFor(
			run.client,
			`Boolean(document.querySelector('.creation-impact-dialog'))`,
			'impact dialog'
		);
		const impactContract = await evaluate(run.client, `(() => ({
			counts: [...document.querySelectorAll('.creation-impact-counts span')]
				.map(item => item.textContent?.replace(/\\s+/gu, '')),
			keepCount: [...document.querySelectorAll('.creation-impact-row button')]
				.filter(button => button.textContent?.includes('保留当前内容')).length,
			regenerateCount: [...document.querySelectorAll('.creation-impact-row button')]
				.filter(button => button.textContent?.includes('AI 重新生成此项')).length,
			materializedNotices: [...document.querySelectorAll('.creation-impact-row em')]
				.filter(item => item.textContent?.includes('正文已创建，只能保留')).length
		}))()`);
		assert(
			JSON.stringify(impactContract.counts) === JSON.stringify(['3方向', '5提纲', '3章节']),
			`Unexpected impact counts: ${JSON.stringify(impactContract.counts)}`
		);
		assert(impactContract.keepCount === 11, 'Impact dialog did not list all 11 exact targets.');
		assert(impactContract.regenerateCount === 8, 'Materialized chapters incorrectly allowed AI replacement.');
		assert(impactContract.materializedNotices === 3, 'Materialized chapter safeguards were missing.');
		const impactMetrics = await collectJourneyMetrics(run.client);
		await assertResponsiveStage(run.client, impactMetrics, {
			name: 'impact-medium',
			width: 1280,
			height: 800,
			theme: 'midnight',
			focus: 'dialog'
		});
		evidence.responsive.impactMedium = impactMetrics;
		await screenshot(run.client, '07-impact-dialog-midnight-reduced-1280x800.png');
		await clickButton(run.client, '保留当前内容', '.creation-impact-dialog', 'exact', 0);
		await waitFor(
			run.client,
			`[...document.querySelectorAll('.creation-impact-row button')]
				.filter(button => button.textContent?.includes('保留当前内容')).length === 10`,
			'one kept impact'
		);
		await clickButton(run.client, 'AI 重新生成此项', '.creation-impact-dialog', 'exact', 0);
		await waitFor(
			run.client,
			`globalThis.__phase12bAiCalls === 7
				&& [...document.querySelectorAll('.creation-impact-row button')]
					.filter(button => button.textContent?.includes('保留当前内容')).length === 9`,
			'one regenerated impact'
		);
		await run.client.call('Input.dispatchKeyEvent', {
			type: 'keyDown',
			key: 'Escape',
			code: 'Escape',
			windowsVirtualKeyCode: 27
		});
		await run.client.call('Input.dispatchKeyEvent', {
			type: 'keyUp',
			key: 'Escape',
			code: 'Escape',
			windowsVirtualKeyCode: 27
		});
		await waitFor(
			run.client,
			`!document.querySelector('.creation-impact-dialog')
				&& document.activeElement?.textContent?.trim() === '查看影响'`,
			'impact dialog focus restoration'
		);
		const developmentContract = await evaluate(run.client, `Promise.all([
			import('/src/app/store.ts'),
			import('/src/platform/bridge.ts')
		]).then(async ([{ useAppStore }, { desktopBridge }]) => {
			const state = useAppStore.getState();
			const journey = JSON.parse((await desktopBridge.readCreationJourneyState(
				state.snapshot.root
			)).content);
			return {
				schemaVersion: journey.schemaVersion,
				answerCount: journey.guidance.answers.length,
				elementLocks: journey.elements.filter(element => element.locked).length,
				coreLocks: journey.locks.coreFields,
				pendingImpacts: journey.impacts.filter(impact => impact.status === 'pending').length,
				keptImpacts: journey.impacts.filter(impact => impact.status === 'kept').length,
				updatedImpacts: journey.impacts.filter(impact => impact.status === 'updated').length,
				chapterResourceIds: journey.chapters.map(chapter => chapter.resourceId)
			};
		})`);
		assert(developmentContract.schemaVersion === 2, 'Journey was not persisted as schema v2.');
		assert(developmentContract.answerCount === 1, 'Guidance answer was not persisted.');
		assert(developmentContract.elementLocks === 1, 'Element lock was not persisted.');
		assert(
			developmentContract.coreLocks.includes('protagonist'),
			'Core lock was not persisted.'
		);
		assert(developmentContract.pendingImpacts === 9, 'Single-item resolution touched other impacts.');
		assert(developmentContract.keptImpacts === 1, 'Kept impact audit was not persisted.');
		assert(developmentContract.updatedImpacts === 1, 'Regenerated impact audit was not persisted.');
		assert(
			developmentContract.chapterResourceIds.every(Boolean),
			'Impact handling rewrote or detached materialized chapters.'
		);
		evidence.development = {
			...developmentContract,
			aiCalls: 7,
			focusRestored: true,
			impactCounts: { direction: 3, outline: 5, chapter: 3 }
		};
		await screenshot(run.client, '08-impact-pending-paper-1280x800.png');
	}
	assert(run.browserErrors.length === 0, `Browser errors: ${run.browserErrors.join(' | ')}`);

	evidence.journey = {
		aiCalls: finalContract.aiCalls,
		chapterCount: finalContract.chapterCount,
		defaultStart: startRouteContract.selected[0],
		firstChapterOpened: finalContract.activeTitle,
		firstChapterPrecreated: firstChapterContract.checked,
		firstChapterPrecreationDisabled: firstChapterContract.disabled,
		materializeCalls: finalContract.materializeCalls,
		stage: finalContract.stage,
		startRouteCount: startRouteContract.count
	};
	evidence.browserErrors = run.browserErrors;
	evidence.pass = true;
	await writeFile(metricsPath, `${JSON.stringify(evidence, null, 2)}\n`);
	console.log(`${phaseLabel} creation journey acceptance passed: ${metricsPath}`);
} finally {
	if (run) await stopBrowser(run);
	const resolvedProfile = resolve(profileDirectory);
	const resolvedTemp = resolve(tmpdir());
	if (resolvedProfile.startsWith(resolvedTemp)) {
		try {
			await delay(500);
			await rm(resolvedProfile, {
				recursive: true,
				force: true,
				maxRetries: 10,
				retryDelay: 200
			});
		} catch (error) {
			console.warn(
				`Acceptance passed or failed independently of temporary profile cleanup: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}
}
