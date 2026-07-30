import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDirectory = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'screenshots',
	'phase-1.2b-creation-journey'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'phase-1.2b-creation-journey-metrics.json'
);
const statusPath = join(
	repositoryRoot,
	'artifacts',
	'acceptance',
	'phase-1.2b-status.json'
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
	console.log(`[Phase 1.2B] ${step}`);
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
	await evaluate(client, `import('/src/app/store.ts').then(({ useAppStore }) => {
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
	assert(metrics.focusedHeading, `${expected.name}: stage heading did not receive focus.`);
	assert(metrics.alertCount === 0, `${expected.name}: visible journey error.`);
	assert(metrics.theme === expected.theme, `${expected.name}: theme did not apply.`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2b-'));
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
	assert(await evaluate(run.client, 'globalThis.__phase12bAiCalls === 1'), 'Core AI call count drifted.');
	assert(
		await evaluate(
			run.client,
			`Boolean([...document.querySelectorAll('.creation-core-grid textarea')]
				.find(element => element.value.includes('失忆记者必须在一夜内')))`
		),
		'Generated core was not editable and visible.'
	);
	await clickButton(run.client, '确认故事核心');
	await waitFor(
		run.client,
		`document.querySelector('#creation-journey-heading')?.textContent
			=== '比较三个真正不同的方向'`,
		'story directions decision'
	);
	assert(
		await evaluate(run.client, 'globalThis.__phase12bAiCalls === 1'),
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
		await evaluate(run.client, 'globalThis.__phase12bAiCalls === 2'),
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
		await evaluate(run.client, 'globalThis.__phase12bAiCalls === 4'),
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
	assert(finalContract.aiCalls === 4, 'AI call count changed during materialization.');
	assert(finalContract.chapterCount === 3, 'Project manifest did not contain exactly three chapters.');
	assert(finalContract.journeyChapterCount === 3, 'Journey did not retain exactly three chapters.');
	assert(finalContract.materializeCalls === 1, 'Chapter transaction was not invoked exactly once.');
	assert(finalContract.resourceIds.every(Boolean), 'Materialized chapters lack native resource IDs.');
	assert(finalContract.stage === 'writing', 'Journey did not advance to writing.');
	assert(run.browserErrors.length === 0, `Browser errors: ${run.browserErrors.join(' | ')}`);
	await screenshot(run.client, '06-opened-first-chapter-paper-1024x720.png');

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
	console.log(`Phase 1.2B creation journey acceptance passed: ${metricsPath}`);
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
