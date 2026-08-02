import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const phaseSlug = 'phase-1.2m-scene-plot-grid';
const outputDirectory = join(repositoryRoot, 'docs', 'acceptance', 'screenshots', phaseSlug);
const metricsPath = join(repositoryRoot, 'docs', 'acceptance', `${phaseSlug}-visual-metrics.json`);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2M_CDP_PORT ?? 9422);
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
			const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
			const target = targets.find(candidate => candidate.type === 'page' && candidate.url.startsWith(appUrl));
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
		throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
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
		const expected = ${JSON.stringify(label)};
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => {
				const actual = normalize(button.getAttribute('aria-label') ?? button.textContent);
				return ${contains ? 'actual.includes(expected)' : 'actual === expected'};
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

async function fillSearch(client, value) {
	const count = await evaluate(client, `(() => {
		const inputs = [...document.querySelectorAll('input[type="search"]')]
			.filter(input => input.placeholder === '搜索章节、场景或剧情线');
		if (inputs.length === 1) {
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
			setter.call(inputs[0], ${JSON.stringify(value)});
			inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
		}
		return inputs.length;
	})()`);
	assert(count === 1, `Expected one scene-grid search input; found ${count}.`);
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
			return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
				&& rect.left < innerWidth && rect.top < innerHeight
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), input:not([hidden]), select:not([hidden]), textarea:not([hidden]), [role="button"]:not([hidden])'
		)].filter(isVisible);
		const hasScrollableAncestor = element => {
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== document.body) {
				const style = getComputedStyle(ancestor);
				if (/(auto|scroll)/u.test(style.overflow + style.overflowX + style.overflowY)
					&& (ancestor.scrollHeight > ancestor.clientHeight + 1 || ancestor.scrollWidth > ancestor.clientWidth + 1)) return true;
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const clipped = controls.filter(element => {
			const rect = element.getBoundingClientRect();
			if (hasScrollableAncestor(element)) return false;
			return rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
		}).map(element => ({
			label: element.getAttribute('aria-label') ?? element.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
			rect: element.getBoundingClientRect().toJSON()
		}));
		const scopedControls = controls.filter(control => control.closest(
			'.scene-plot-grid-shell, .plot-board-toolbar, .plot-inspector.is-scene-inspector'
		));
		const occluded = scopedControls.filter(control => {
			const rect = control.getBoundingClientRect();
			const scroll = control.closest('.scene-plot-grid-scroll');
			if (scroll) {
				const scrollRect = scroll.getBoundingClientRect();
				if (rect.right <= scrollRect.left || rect.left >= scrollRect.right
					|| rect.bottom <= scrollRect.top || rect.top >= scrollRect.bottom) return false;
			}
			const x = Math.max(0, Math.min(innerWidth - 1, rect.left + Math.min(rect.width / 2, 20)));
			const y = Math.max(0, Math.min(innerHeight - 1, rect.top + Math.min(rect.height / 2, 20)));
			const top = document.elementFromPoint(x, y);
			return Boolean(top && !control.contains(top));
		}).map(control => control.getAttribute('aria-label')
			?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80));
		return {
			surface: ${JSON.stringify(surface)},
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clipped.length,
			clippedInteractiveDetails: clipped,
			shortScopedControls: scopedControls.filter(control => control.getBoundingClientRect().height < 43.5)
				.map(control => ({
					label: control.getAttribute('aria-label') ?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
					height: control.getBoundingClientRect().height
				})),
			occludedScopedControls: occluded,
			gridScrollsInternally: Boolean(document.querySelector('.scene-plot-grid-scroll')?.scrollWidth
				> document.querySelector('.scene-plot-grid-scroll')?.clientWidth)
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
], { stdio: 'ignore', windowsHide: true });

let client;
try {
	const target = await waitForTarget();
	client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('Log.enable');

	await setViewport(client, 1440, 900);
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`, 'welcome page');
	await clickButton(client, '打开已有 Writing Buddy 作品');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`, 'writing home');
	await clickButton(client, '规划');
	await waitFor(client, `Boolean(document.querySelector('nav[aria-label="规划页面"]'))`, 'planning navigation');
	await clickButton(client, '剧情线与伏笔', true);
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="剧情线与伏笔"]'))`, 'plot workspace');
	await clickButton(client, '场景网格');
	await waitFor(client, `Boolean(document.querySelector('table[aria-label="场景与剧情线关联表"]'))`, 'scene plot grid');

	const grid = await evaluate(client, `(() => ({
		selectedTab: document.querySelector('.plot-board-toolbar [role="tab"][aria-selected="true"]')?.textContent.trim(),
		headers: [...document.querySelectorAll('.scene-plot-grid thead th')].map(cell => cell.textContent.replace(/\\s+/gu, ' ').trim()),
		rows: document.querySelectorAll('.scene-plot-grid tbody tr').length,
		links: document.querySelectorAll('.scene-plot-link').length,
		summary: document.querySelector('.scene-plot-grid-summary')?.textContent.replace(/\\s+/gu, ' ').trim(),
		inspectorInitiallyClosed: !document.querySelector('.plot-inspector.is-scene-inspector')
	}))()`);
	assert(grid.selectedTab === '场景网格', `Scene grid tab is not selected: ${JSON.stringify(grid)}`);
	assert(grid.headers.some(header => header.includes('遗失笔记'))
		&& grid.headers.some(header => header.includes('封存站台')),
	`Plot columns are incomplete: ${JSON.stringify(grid)}`);
	assert(grid.rows === 1 && grid.links === 1, `Scene mapping mismatch: ${JSON.stringify(grid)}`);
	assert(grid.summary?.includes('1 个场景') && grid.summary?.includes('2 条剧情线'),
		`Grid summary mismatch: ${JSON.stringify(grid)}`);
	assert(grid.inspectorInitiallyClosed, `Scene inspector should start closed: ${JSON.stringify(grid)}`);

	const captures = [];
	for (const [width, height, name] of [
		[1440, 900, '01-scene-plot-grid-1440x900.png'],
		[1024, 720, '02-scene-plot-grid-1024x720.png'],
		[820, 720, '03-scene-plot-grid-820x720.png']
	]) {
		await setViewport(client, width, height);
		const metrics = await collectMetrics(client, 'scene-grid');
		await screenshot(client, name);
		captures.push({ name, ...metrics });
	}

	await clickButton(client, '节拍待补');
	await fillSearch(client, '不存在');
	await waitFor(client, `Boolean([...document.querySelectorAll('.scene-plot-grid-empty strong')].some(node => node.textContent === '当前条件下没有场景'))`, 'filtered empty state');
	const filteredMetrics = await collectMetrics(client, 'filtered-empty');
	await screenshot(client, '04-filtered-empty-820x720.png');
	captures.push({ name: '04-filtered-empty-820x720.png', ...filteredMetrics });
	await clickButton(client, '清除筛选');
	await waitFor(client, `Boolean(document.querySelector('button[aria-label="查看场景节拍：雨夜旧车站"]'))`, 'restored scene row');
	await clickButton(client, '查看场景节拍：雨夜旧车站');
	await waitFor(client, `Boolean(document.querySelector('.plot-inspector.is-scene-inspector'))`, 'scene inspector');
	const inspector = await evaluate(client, `(() => ({
		title: document.querySelector('.plot-inspector.is-scene-inspector h2')?.textContent.trim(),
		hasFourBeats: ['目标', '冲突', '转折', '结果'].every(label =>
			[...document.querySelectorAll('.plot-inspector.is-scene-inspector h3')].some(node => node.textContent === label)),
		close: Boolean(document.querySelector('button[aria-label="关闭场景详情"]')),
		open: Boolean([...document.querySelectorAll('.plot-inspector.is-scene-inspector button')]
			.find(button => button.textContent.includes('打开场景正文')))
	}))()`);
	assert(inspector.title === '雨夜旧车站' && inspector.hasFourBeats && inspector.close && inspector.open,
		`Scene inspector mismatch: ${JSON.stringify(inspector)}`);
	const inspectorMetrics = await collectMetrics(client, 'scene-inspector');
	await screenshot(client, '05-scene-inspector-820x720.png');
	captures.push({ name: '05-scene-inspector-820x720.png', ...inspectorMetrics });

	for (const metrics of captures) {
		assert(metrics.pageOverflowX === 0, `Horizontal page overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical page overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
		assert(metrics.shortScopedControls.length === 0, `Controls below 44px: ${JSON.stringify(metrics)}`);
		assert(metrics.occludedScopedControls.length === 0, `Occluded controls: ${JSON.stringify(metrics)}`);
	}

	await clickButton(client, '打开场景正文');
	await waitFor(client, `Boolean(document.querySelector('.chapter-editor-host'))`, 'scene manuscript');
	const manuscript = await evaluate(client, `(() => ({
		mode: Boolean(document.querySelector('.chapter-editor-host')),
		chapter: document.querySelector('.chapter-header h1')?.textContent.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(manuscript.mode, `Scene manuscript did not open: ${JSON.stringify(manuscript)}`);

	const runtimeErrors = client.events.filter(event => (
		event.method === 'Runtime.exceptionThrown'
		|| (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
		|| (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
	));
	assert(runtimeErrors.length === 0, `Browser runtime errors: ${JSON.stringify(runtimeErrors)}`);

	await writeFile(metricsPath, `${JSON.stringify({
		generatedAt: new Date().toISOString(), appUrl, grid, inspector, manuscript, runtimeErrors, captures
	}, null, 2)}\n`);
	console.log(`Phase 1.2M browser acceptance passed: ${metricsPath}`);
} finally {
	client?.close();
	if (edge.pid) {
		spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
	}
	if (profileDirectory.startsWith(tmpdir())) {
		await rm(profileDirectory, { recursive: true, force: true, maxRetries: 4 });
	}
}
