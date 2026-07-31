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
	'phase-1.2f-task-closure'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'phase-1.2f-task-closure-visual-metrics.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2F_CDP_PORT ?? 9413);
const appUrl = process.env.WRITING_BUDDY_URL ?? 'http://127.0.0.1:1420/';

class CdpClient {
	constructor(url) {
		this.url = url;
		this.nextId = 1;
		this.pending = new Map();
		this.events = [];
	}

	async connect() {
		this.socket = new WebSocket(this.url);
		await new Promise((resolveConnection, reject) => {
			this.socket.addEventListener('open', resolveConnection, { once: true });
			this.socket.addEventListener('error', reject, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (!message.id) {
				this.events.push(message);
				return;
			}
			const pending = this.pending.get(message.id);
			if (!pending) return;
			this.pending.delete(message.id);
			if (message.error) pending.reject(new Error(message.error.message));
			else pending.resolve(message.result);
		});
	}

	call(method, params = {}) {
		return new Promise((resolveCall, reject) => {
			const id = this.nextId++;
			this.pending.set(id, { resolve: resolveCall, reject });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
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

async function waitForTarget() {
	const deadline = Date.now() + 20_000;
	while (Date.now() < deadline) {
		try {
			const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
				response => response.json()
			);
			const target = targets.find(candidate => (
				candidate.type === 'page' && candidate.url.startsWith(appUrl)
			));
			if (target) return target;
		} catch {
			// Edge is still starting.
		}
		await delay(100);
	}
	throw new Error('Timed out waiting for the Writing Buddy browser target.');
}

async function evaluate(client, expression) {
	const response = await client.call('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true,
		userGesture: true
	});
	if (response.exceptionDetails) {
		throw new Error(response.exceptionDetails.exception?.description
			?? response.exceptionDetails.text);
	}
	return response.result.value;
}

async function waitFor(client, expression, description, timeout = 12_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(50);
	}
	throw new Error(`Timed out waiting for ${description}.`);
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
	await delay(120);
}

async function clickButton(client, label, contains = false) {
	const count = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => {
				const value = normalize(button.getAttribute('aria-label') ?? button.textContent);
				return ${contains ? 'value.includes(' : 'value === '}${JSON.stringify(label)}${contains ? ')' : ''};
			})
			.filter(button => {
				const rect = button.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			});
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one visible button for “${label}”; found ${count}.`);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectMetrics(client) {
	return evaluate(client, `(() => {
		const root = document.documentElement;
		const isVisible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), input:not([hidden]), select:not([hidden]), '
				+ 'textarea:not([hidden]), [role="button"]:not([hidden])'
		)].filter(isVisible);
		const hasScrollableAncestor = element => {
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== document.body) {
				const style = getComputedStyle(ancestor);
				if (/(auto|scroll)/u.test(style.overflowY)
					&& ancestor.scrollHeight > ancestor.clientHeight + 1) return true;
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const clipped = controls.filter(element => {
			const rect = element.getBoundingClientRect();
			if (hasScrollableAncestor(element)) return false;
			return rect.left < -1 || rect.top < -1
				|| rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
		}).map(element => ({
			label: element.getAttribute('aria-label')
				?? element.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
			rect: element.getBoundingClientRect().toJSON()
		}));
		return {
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clipped.length,
			clippedInteractiveDetails: clipped,
			visibleControls: controls.length
		};
	})()`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2f-'));
const edge = spawn(edgePath, [
	`--remote-debugging-port=${port}`,
	`--user-data-dir=${profileDirectory}`,
	'--headless=new',
	'--no-first-run',
	'--no-default-browser-check',
	'--disable-background-networking',
	'--disable-component-update',
	'--disable-sync',
	appUrl
], {
	stdio: 'ignore',
	windowsHide: true
});

let client;
try {
	const target = await waitForTarget();
	client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('Log.enable');

	await setViewport(client, 1440, 900);
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`,
		'welcome page'
	);
	await clickButton(client, '打开已有 Writing Buddy 作品');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'writing home'
	);

	await clickButton(client, '新建');
	await waitFor(client, `Boolean(document.querySelector('.global-create-menu'))`, 'create menu');
	const menu = await evaluate(client, `(() => ({
		labels: [...document.querySelectorAll('.global-create-menu [role="menuitem"]')]
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim()),
		disabledContextual: [...document.querySelectorAll('.global-create-menu [role="menuitem"]')]
			.filter(button => /创建人物|创建剧情线|创建地点|创建物品|创建时间事件|规划卷/u.test(button.textContent))
			.filter(button => button.disabled).length,
		legacyPlaceholders: document.querySelector('.global-create-menu')?.textContent.includes('下一阶段启用') ?? false
	}))()`);
	for (const label of ['规划卷、章与场景', '创建剧情线或伏笔', '创建人物', '创建地点或设定', '创建物品', '创建时间事件']) {
		assert(menu.labels.some(candidate => candidate.includes(label)), `Missing contextual action: ${label}`);
	}
	assert(menu.disabledContextual === 0, `Contextual actions are disabled: ${JSON.stringify(menu)}`);
	assert(!menu.legacyPlaceholders, 'Legacy “next phase” placeholders remain visible.');
	const menuMetrics = await collectMetrics(client);
	await screenshot(client, '01-contextual-create-menu-1440x900.png');

	await clickButton(client, '创建人物', true);
	await waitFor(
		client,
		`Boolean(document.querySelector('aside[aria-label="AI 人物助手"]'))`,
		'character assistant'
	);
	const assistant = await evaluate(client, `(() => ({
		activeRail: document.querySelector('.global-rail button.is-active')?.textContent.trim(),
		activeStoryView: document.querySelector('.story-reference-sidebar button.is-active strong')?.textContent.trim(),
		hasCandidates: Boolean(document.querySelector('.ai-review-candidate-card')),
		generateLabel: [...document.querySelectorAll('aside[aria-label="AI 人物助手"] button')]
			.map(button => button.textContent.trim()).find(label => label.includes('生成候选'))
	}))()`);
	assert(assistant.activeRail === '故事库', `Unexpected active rail: ${JSON.stringify(assistant)}`);
	assert(assistant.activeStoryView === '人物', `Unexpected Story Library view: ${JSON.stringify(assistant)}`);
	assert(!assistant.hasCandidates, 'Opening create action unexpectedly ran AI.');
	assert(assistant.generateLabel === '生成候选', `Missing explicit AI action: ${JSON.stringify(assistant)}`);
	await setViewport(client, 1280, 800);
	const assistantMetrics = await collectMetrics(client);
	await screenshot(client, '02-character-assistant-1280x800.png');

	await clickButton(client, '关闭 AI 人物助手');
	await clickButton(client, '检查');
	await waitFor(
		client,
		`Boolean(document.querySelector('.review-task-overview'))`,
		'review task overview'
	);
	const reviewInbox = await evaluate(client, `(() => ({
		title: document.querySelector('#review-task-overview-title')?.textContent.trim(),
		primaryActions: [...document.querySelectorAll('.review-page .primary-button')]
			.filter(button => button.getBoundingClientRect().width > 0 && !button.disabled)
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim()),
		taskAction: document.querySelector('.review-task-action button')?.textContent.replace(/\\s+/gu, ' ').trim(),
		runDisabled: document.querySelector('.review-run-actions button')?.disabled
	}))()`);
	assert(reviewInbox.title === '项目待处理事项', `Missing review inbox: ${JSON.stringify(reviewInbox)}`);
	assert(reviewInbox.primaryActions.length === 1, `Review page should expose one primary action: ${JSON.stringify(reviewInbox)}`);
	assert(reviewInbox.taskAction?.includes('第一章'), `Review action has no chapter target: ${JSON.stringify(reviewInbox)}`);
	assert(reviewInbox.runDisabled, 'Review run action should stay disabled before a chapter is opened.');
	await setViewport(client, 1024, 720);
	const reviewInboxMetrics = await collectMetrics(client);
	await screenshot(client, '03-review-inbox-1024x720.png');

	const opened = await evaluate(client, `(() => {
		const button = document.querySelector('.review-task-action button');
		if (!button) return false;
		button.click();
		return true;
	})()`);
	assert(opened, 'Review task action was not clickable.');
	await waitFor(
		client,
		`document.querySelector('.review-panel-heading p')?.textContent.includes('当前章节：第一章')`,
		'review chapter target'
	);
	const openedTask = await evaluate(client, `(() => ({
		target: document.querySelector('.review-task-action strong')?.textContent.trim(),
		runEnabled: !document.querySelector('.review-run-actions button')?.disabled,
		runPrimary: document.querySelector('.review-run-actions button')?.classList.contains('primary-button')
	}))()`);
	assert(openedTask.target?.includes('第一章'), `Review target did not open: ${JSON.stringify(openedTask)}`);
	assert(openedTask.runEnabled && openedTask.runPrimary, `Review action did not become primary: ${JSON.stringify(openedTask)}`);
	const openedTaskMetrics = await collectMetrics(client);
	await screenshot(client, '04-review-task-opened-1024x720.png');

	await setViewport(client, 820, 720);
	const compactMetrics = await collectMetrics(client);
	await screenshot(client, '05-review-compact-820x720.png');

	for (const metrics of [menuMetrics, assistantMetrics, reviewInboxMetrics, openedTaskMetrics, compactMetrics]) {
		assert(metrics.pageOverflowX === 0, `Horizontal overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
	}
	const runtimeErrors = client.events.filter(event => (
		event.method === 'Runtime.exceptionThrown'
		|| (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
		|| (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
	));
	assert(runtimeErrors.length === 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

	const report = {
		generatedAt: new Date().toISOString(),
		appUrl,
		menu,
		assistant,
		reviewInbox,
		openedTask,
		runtimeErrors,
		captures: [
			{ name: '01-contextual-create-menu-1440x900.png', ...menuMetrics },
			{ name: '02-character-assistant-1280x800.png', ...assistantMetrics },
			{ name: '03-review-inbox-1024x720.png', ...reviewInboxMetrics },
			{ name: '04-review-task-opened-1024x720.png', ...openedTaskMetrics },
			{ name: '05-review-compact-820x720.png', ...compactMetrics }
		]
	};
	await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Phase 1.2F browser acceptance passed: ${metricsPath}`);
} finally {
	client?.close();
	if (edge.pid) {
		spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
	if (profileDirectory.startsWith(tmpdir())) {
		await rm(profileDirectory, { recursive: true, force: true, maxRetries: 4 });
	}
}
