import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const phaseSlug = 'phase-1.2l-whole-work-consistency';
const outputDirectory = join(repositoryRoot, 'docs', 'acceptance', 'screenshots', phaseSlug);
const metricsPath = join(repositoryRoot, 'docs', 'acceptance', `${phaseSlug}-visual-metrics.json`);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2L_CDP_PORT ?? 9421);
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

async function clickButton(client, label) {
	const count = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => normalize(button.getAttribute('aria-label') ?? button.textContent)
				=== ${JSON.stringify(label)})
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
		const scopedControls = controls.filter(control => control.closest(
			'.review-whole-work-card, .story-consistency-panel'
		)).filter(control => !(
			control instanceof HTMLInputElement && control.type === 'checkbox'
		));
		const occluded = scopedControls.filter(control => {
			const rect = control.getBoundingClientRect();
			if (rect.top < 0 || rect.bottom > innerHeight) return false;
			const top = document.elementFromPoint(
				Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2)),
				Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2))
			);
			return Boolean(top && !control.contains(top));
		}).map(control => control.getAttribute('aria-label')
			?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80));
		const panel = document.querySelector('.story-consistency-panel');
		const panelRect = panel?.getBoundingClientRect();
		const panelLeftProbe = panel && panelRect
			? document.elementFromPoint(panelRect.left + 8, panelRect.top + 24)
			: undefined;
		return {
			surface: ${JSON.stringify(surface)},
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clipped.length,
			clippedInteractiveDetails: clipped,
			shortScopedControls: scopedControls.filter(control => (
				control.getBoundingClientRect().height < 43.5
			)).map(control => ({
				label: control.getAttribute('aria-label')
					?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
				height: control.getBoundingClientRect().height
			})),
			occludedScopedControls: occluded,
			panelOccludedAtLeftEdge: Boolean(panel && panelLeftProbe && !panel.contains(panelLeftProbe)),
			panel: panelRect?.toJSON()
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
	await clickButton(client, '打开已有 Writing Buddy 作品');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'writing home'
	);
	await clickButton(client, '检查');
	await waitFor(client, `Boolean(document.querySelector('.review-whole-work-card'))`, 'whole-work Check card');
	const reviewEntry = await evaluate(client, `(() => ({
		title: document.querySelector('#review-whole-work-title')?.textContent.trim(),
		description: document.querySelector('.review-whole-work-card p')?.textContent.trim(),
		action: document.querySelector('.review-whole-work-card button')?.textContent.replace(/\\s+/gu, ' ').trim(),
		actionDisabled: document.querySelector('.review-whole-work-card button')?.disabled
	}))()`);
	assert(reviewEntry.title === '全书一致性', `Missing Check entry: ${JSON.stringify(reviewEntry)}`);
	assert(reviewEntry.action === '打开全书扫描' && !reviewEntry.actionDisabled,
		`Whole-work action is not available: ${JSON.stringify(reviewEntry)}`);
	const checkMetrics = await collectMetrics(client, 'review-center');
	await screenshot(client, '01-review-center-entry-1440x900.png');

	await clickButton(client, '打开全书扫描');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="长篇一致性审查"]'))`,
		'long-form consistency page'
	);
	await clickButton(client, 'AI 对照审查');
	await waitFor(client, `Boolean(document.querySelector('.story-consistency-panel'))`, 'AI comparison panel');
	const defaultScope = await evaluate(client, `(() => ({
		title: document.querySelector('#story-consistency-title')?.textContent.trim(),
		selected: document.querySelector('.story-consistency-scope [aria-selected="true"]')?.textContent
			.replace(/\\s+/gu, ' ').trim(),
		start: document.querySelector('.story-consistency-panel .primary-action')?.textContent
			.replace(/\\s+/gu, ' ').trim(),
		boundary: document.querySelector('.story-consistency-boundary')?.textContent
			.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(defaultScope.title === 'AI 跨章对照审查', `Missing panel: ${JSON.stringify(defaultScope)}`);
	assert(defaultScope.selected?.startsWith('全书扫描'), `Whole work is not default: ${JSON.stringify(defaultScope)}`);
	assert(defaultScope.start === '开始全书扫描', `Missing start action: ${JSON.stringify(defaultScope)}`);
	assert(defaultScope.boundary?.includes('每批发送 2–12 个连续章节'),
		`Missing batch privacy boundary: ${JSON.stringify(defaultScope)}`);

	const captures = [checkMetrics];
	for (const [width, height, name] of [
		[1440, 900, '02-whole-work-panel-1440x900.png'],
		[1024, 720, '03-whole-work-panel-1024x720.png'],
		[820, 720, '04-whole-work-panel-820x720.png']
	]) {
		await setViewport(client, width, height);
		const metrics = await collectMetrics(client, 'whole-work-panel');
		await screenshot(client, name);
		captures.push({ name, ...metrics });
	}

	await clickButton(client, '自选章节精确选择 2–12 章对照');
	const selectedMode = await evaluate(client, `(() => ({
		checked: document.querySelectorAll('.story-consistency-source-list input:checked').length,
		checkboxes: document.querySelectorAll('.story-consistency-source-list input').length,
		start: document.querySelector('.story-consistency-panel .primary-action')?.textContent
			.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(selectedMode.checkboxes >= 2 && selectedMode.checked === 2,
		`Explicit selection was not preserved: ${JSON.stringify(selectedMode)}`);
	assert(selectedMode.start === '开始对照审查',
		`Selected-scope action mismatch: ${JSON.stringify(selectedMode)}`);
	const selectedMetrics = await collectMetrics(client, 'selected-panel');
	await screenshot(client, '05-selected-panel-820x720.png');
	captures.push({ name: '05-selected-panel-820x720.png', ...selectedMetrics });

	for (const metrics of captures) {
		assert(metrics.pageOverflowX === 0, `Horizontal overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
		assert(metrics.shortScopedControls.length === 0,
			`Consistency controls below 44px: ${JSON.stringify(metrics)}`);
		assert(metrics.occludedScopedControls.length === 0,
			`Consistency controls are occluded: ${JSON.stringify(metrics)}`);
		assert(!metrics.panelOccludedAtLeftEdge,
			`Consistency panel is covered by another layer: ${JSON.stringify(metrics)}`);
	}
	const runtimeErrors = client.events.filter(event => (
		event.method === 'Runtime.exceptionThrown'
		|| (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
		|| (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
	));
	assert(runtimeErrors.length === 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

	await writeFile(metricsPath, `${JSON.stringify({
		generatedAt: new Date().toISOString(),
		appUrl,
		reviewEntry,
		defaultScope,
		selectedMode,
		runtimeErrors,
		captures
	}, null, 2)}\n`);
	console.log(`Phase 1.2L browser acceptance passed: ${metricsPath}`);
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
