import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const phaseSlug = 'phase-1.2k-daily-writing-progress';
const outputDirectory = join(repositoryRoot, 'docs', 'acceptance', 'screenshots', phaseSlug);
const metricsPath = join(repositoryRoot, 'docs', 'acceptance', `${phaseSlug}-visual-metrics.json`);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2K_CDP_PORT ?? 9419);
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

async function clickControl(client, label) {
	const count = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const matches = [...document.querySelectorAll(
			'button:not([hidden]), summary:not([hidden]), [role="button"]:not([hidden])'
		)]
			.filter(control => normalize(control.getAttribute('aria-label') ?? control.textContent)
				=== ${JSON.stringify(label)})
			.filter(control => {
				const rect = control.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			});
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one visible control for “${label}”; found ${count}.`);
}

async function setInputValue(client, selector, value) {
	const actual = await evaluate(client, `(() => {
		const input = document.querySelector(${JSON.stringify(selector)});
		if (!(input instanceof HTMLInputElement)) return undefined;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
		setter?.call(input, ${JSON.stringify(value)});
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		return input.value;
	})()`);
	assert(actual === value, `Failed to set ${selector}: ${JSON.stringify(actual)}`);
}

async function clickSelector(client, selector) {
	const clicked = await evaluate(client, `(() => {
		const control = document.querySelector(${JSON.stringify(selector)});
		if (!(control instanceof HTMLElement) || control.getBoundingClientRect().width <= 0) {
			return false;
		}
		control.click();
		return true;
	})()`);
	assert(clicked, `Could not click ${selector}.`);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectMetrics(client, surface) {
	return evaluate(client, `(() => {
		const root = document.documentElement;
		const isVisible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), input:not([hidden]), summary:not([hidden]), '
				+ 'select:not([hidden]), textarea:not([hidden]), [role="button"]:not([hidden])'
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
		const isClippedByAncestor = element => {
			const rect = element.getBoundingClientRect();
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== document.body) {
				const style = getComputedStyle(ancestor);
				const ancestorRect = ancestor.getBoundingClientRect();
				if (/(hidden|clip)/u.test(style.overflowX)
					&& (rect.left < ancestorRect.left - 1 || rect.right > ancestorRect.right + 1)) {
					return true;
				}
				if (/(hidden|clip)/u.test(style.overflowY)
					&& (rect.top < ancestorRect.top - 1 || rect.bottom > ancestorRect.bottom + 1)) {
					return true;
				}
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const clipped = controls.filter(element => {
			const rect = element.getBoundingClientRect();
			if (element.closest('.daily-writing-goal') && isClippedByAncestor(element)) return true;
			if (hasScrollableAncestor(element)) return false;
			return rect.left < -1 || rect.top < -1
				|| rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
		}).map(element => ({
			label: element.getAttribute('aria-label')
				?? element.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
			rect: element.getBoundingClientRect().toJSON()
		}));
		const goalControls = controls.filter(control => control.closest('.daily-writing-goal'));
		const goal = document.querySelector('.daily-writing-goal[open]');
		const goalPopover = goal?.querySelector('.daily-goal-popover');
		const goalPopoverRect = goalPopover?.getBoundingClientRect();
		const goalOccludingControls = goalPopover && goalPopoverRect
			? controls.filter(control => !control.closest('.daily-writing-goal')).filter(control => {
				const rect = control.getBoundingClientRect();
				const left = Math.max(rect.left, goalPopoverRect.left);
				const right = Math.min(rect.right, goalPopoverRect.right);
				const top = Math.max(rect.top, goalPopoverRect.top);
				const bottom = Math.min(rect.bottom, goalPopoverRect.bottom);
				if (right <= left || bottom <= top) return false;
				const topElement = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
				return Boolean(topElement && !goalPopover.contains(topElement));
			}).map(control => control.getAttribute('aria-label')
				?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80))
			: [];
		return {
			surface: ${JSON.stringify(surface)},
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clipped.length,
			clippedInteractiveDetails: clipped,
			visibleControls: controls.length,
			shortGoalControls: goalControls.filter(control => (
				control.getBoundingClientRect().height < 43.5
			)).map(control => ({
				label: control.getAttribute('aria-label')
					?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
				height: control.getBoundingClientRect().height
			})),
			goalOccludingControls,
			goal: goal ? {
				rect: goal.getBoundingClientRect().toJSON(),
				label: goal.querySelector('summary')?.getAttribute('aria-label'),
				popover: goal.querySelector('.daily-goal-popover')?.getBoundingClientRect().toJSON(),
				message: goal.querySelector('.daily-goal-status')?.textContent
					.replace(/\\s+/gu, ' ').trim()
			} : undefined,
			writerTitle: (() => {
				const title = document.querySelector('.writer-header h1');
				if (!title) return undefined;
				return {
					text: title.textContent?.trim(),
					rect: title.getBoundingClientRect().toJSON(),
					display: getComputedStyle(title).display,
					visibility: getComputedStyle(title).visibility
				};
			})(),
			statusText: document.querySelector('.status-bar')?.textContent
				.replace(/\\s+/gu, ' ').trim()
		};
	})()`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), `writing-buddy-${phaseSlug}-`));
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
	await clickControl(client, '打开已有 Writing Buddy 作品');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'writing home'
	);

	const initialLabel = await evaluate(client, `document.querySelector(
		'.daily-writing-goal.is-dashboard summary'
	)?.getAttribute('aria-label')`);
	assert(initialLabel?.includes('0 / 1,000 字'), `Unexpected initial goal: ${initialLabel}`);
	await clickControl(client, initialLabel);
	await setInputValue(client, '#daily-writing-goal-dashboard', '1200');
	await clickControl(client, '保存目标');
	await waitFor(
		client,
		`document.querySelector('.daily-goal-message')?.textContent.includes('1,200 字')`,
		'updated daily goal'
	);
	const dashboardMetrics = await collectMetrics(client, 'dashboard');
	await screenshot(client, '01-dashboard-goal-1440x900.png');

	await client.call('Page.reload', { ignoreCache: true });
	await delay(600);
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'restored writing home'
	);
	const restoredGoal = await evaluate(client, `document.querySelector(
		'.daily-writing-goal.is-dashboard summary'
	)?.getAttribute('aria-label')`);
	assert(restoredGoal?.includes('0 / 1,200 字'), `Goal did not survive reload: ${restoredGoal}`);
	await clickControl(client, '继续上次位置');
	await waitFor(client, `Boolean(document.querySelector('.writer-header'))`, 'chapter writer');
	const appended = await evaluate(client, `window.__WRITING_BUDDY_DEVTOOLS__
		?.appendManuscriptText('\\n\\n雨声越过空站台，林墨继续向前。')`);
	assert(appended, 'Development writer fixture could not append manuscript text.');
	await waitFor(
		client,
		`(() => {
			const text = document.querySelector('.status-bar')?.textContent ?? '';
			return text.includes('/ 1,200 字') && !text.includes('今日 0 /');
		})()`,
		'live daily progress'
	);
	await clickSelector(client, '.writer-header button[aria-label="保存"]');
	await waitFor(
		client,
		`document.querySelector('.save-indicator')?.textContent.includes('已保存')`,
		'saved manuscript'
	);
	const writerGoalLabel = await evaluate(client, `document.querySelector(
		'.daily-writing-goal.is-header summary'
	)?.getAttribute('aria-label')`);
	await clickControl(client, writerGoalLabel);

	const captures = [dashboardMetrics];
	for (const [width, height, name] of [
		[1280, 800, '02-writer-goal-1280x800.png'],
		[1024, 720, '03-writer-goal-1024x720.png'],
		[820, 720, '04-writer-goal-820x720.png']
	]) {
		await setViewport(client, width, height);
		const metrics = await collectMetrics(client, 'writer');
		await screenshot(client, name);
		captures.push({ name, ...metrics });
	}

	for (const metrics of captures) {
		assert(metrics.pageOverflowX === 0, `Horizontal overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
		assert(metrics.shortGoalControls.length === 0,
			`Daily-goal controls below 44px: ${JSON.stringify(metrics)}`);
		assert(metrics.goalOccludingControls.length === 0,
			`Daily-goal disclosure is occluded: ${JSON.stringify(metrics)}`);
		assert(metrics.goal?.popover?.width > 0 && metrics.goal?.popover?.height > 0,
			`Daily-goal disclosure missing: ${JSON.stringify(metrics)}`);
	}

	await client.call('Page.reload', { ignoreCache: true });
	await delay(600);
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'writing home after saved progress'
	);
	const persisted = await evaluate(client, `(() => {
		const label = document.querySelector('.daily-writing-goal.is-dashboard summary')
			?.getAttribute('aria-label');
		return {
			label,
			stored: localStorage.getItem('writing-buddy-next-workspace')
		};
	})()`);
	assert(persisted.label?.includes('/ 1,200 字') && !persisted.label?.includes('0 /'),
		`Saved progress did not survive reload: ${JSON.stringify(persisted)}`);
	assert(persisted.stored?.includes('writingProgress'),
		`Writing progress was not persisted: ${JSON.stringify(persisted)}`);

	const runtimeErrors = client.events.filter(event => (
		event.method === 'Runtime.exceptionThrown'
		|| (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
		|| (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
	));
	assert(runtimeErrors.length === 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

	await writeFile(metricsPath, `${JSON.stringify({
		generatedAt: new Date().toISOString(),
		appUrl,
		initialLabel,
		restoredGoal,
		writerGoalLabel,
		persistedLabel: persisted.label,
		runtimeErrors,
		captures
	}, null, 2)}\n`);
	console.log(`Phase 1.2K browser acceptance passed: ${metricsPath}`);
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
