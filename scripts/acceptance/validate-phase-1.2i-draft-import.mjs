import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDirectory = join(repositoryRoot, 'docs', 'acceptance', 'screenshots', 'phase-1.2i-draft-import');
const metricsPath = join(repositoryRoot, 'docs', 'acceptance', 'phase-1.2i-draft-import-visual-metrics.json');
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2I_CDP_PORT ?? 9416);
const appUrl = process.env.WRITING_BUDDY_URL ?? 'http://127.0.0.1:1420/';

class CdpClient {
	constructor(url) {
		this.url = url;
		this.nextId = 1;
		this.pending = new Map();
	}

	async connect() {
		this.socket = new WebSocket(this.url);
		await new Promise((resolveConnection, reject) => {
			this.socket.addEventListener('open', resolveConnection, { once: true });
			this.socket.addEventListener('error', reject, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (!message.id) return;
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

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

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
	await delay(100);
}

async function clickButton(client, label) {
	const count = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => normalize(button.getAttribute('aria-label')) === ${JSON.stringify(label)}
				|| normalize(button.textContent) === ${JSON.stringify(label)})
			.filter(button => {
				const rect = button.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0 && !button.disabled;
			});
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one enabled visible button named “${label}”; found ${count}.`);
}

async function fill(client, label, value) {
	const count = await evaluate(client, `(() => {
		const matches = [...document.querySelectorAll('input, textarea')]
			.filter(input => input.getAttribute('aria-label') === ${JSON.stringify(label)});
		if (matches.length === 1) {
			const input = matches[0];
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
				?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
			setter.call(input, ${JSON.stringify(value)});
			input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
		}
		return matches.length;
	})()`);
	assert(count === 1, `Expected one field labelled “${label}”; found ${count}.`);
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
		const dialog = document.querySelector('.project-wizard');
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...document.querySelectorAll('button:not([hidden]), input:not([hidden]), select:not([hidden]), textarea:not([hidden]), summary')].filter(visible);
		const importControls = [...document.querySelectorAll('.draft-import-card button, .draft-import-card summary')].filter(visible);
		return {
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			dialogOverflowX: dialog ? Math.max(0, dialog.scrollWidth - dialog.clientWidth) : 0,
			visibleControls: controls.length,
			shortImportControls: importControls.filter(control => control.getBoundingClientRect().height < 43.5).map(control => ({
				label: control.textContent?.replace(/\\s+/gu, ' ').trim(),
				height: control.getBoundingClientRect().height
			}))
		};
	})()`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2i-'));
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
	await setViewport(client, 1440, 900);
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`, 'welcome page');

	const welcome = await evaluate(client, `(() => ({
		primaryCount: document.querySelectorAll('.project-welcome .primary-button').length,
		text: document.querySelector('.project-welcome').textContent.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(welcome.primaryCount === 1, `Expected one welcome primary action: ${JSON.stringify(welcome)}`);
	assert(welcome.text.includes('导入已有大纲预览后创建章节结构'), 'Outline import promise is missing.');
	assert(
		welcome.text.includes('导入已有正文文字不经 AI 改写并打开第一章'),
		'Manuscript import promise is missing.'
	);

	await clickButton(client, '导入已有大纲预览后创建章节结构');
	await waitFor(client, `Boolean(document.querySelector('.project-wizard'))`, 'project wizard');
	await fill(client, '作品名称', '零点回声导入验收');
	await clickButton(client, '浏览');
	await clickButton(client, '下一步');
	await waitFor(client, `Boolean(document.querySelector('.draft-import-card'))`, 'outline import card');
	await clickButton(client, '选择文件');
	await waitFor(client, `document.querySelector('.draft-import-card')?.textContent.includes('零点回声大纲.md')`, 'outline preview');

	const outlinePreview = await evaluate(client, `(() => ({
		text: document.querySelector('.draft-import-card').textContent.replace(/\\s+/gu, ' ').trim(),
		chapterItems: document.querySelectorAll('.draft-import-chapters li').length,
		primaryActions: [...document.querySelectorAll('.project-wizard .primary-button')].filter(button => button.getBoundingClientRect().height > 0).map(button => button.textContent.trim())
	}))()`);
	assert(outlinePreview.text.includes('2 章'), `Missing outline chapter count: ${JSON.stringify(outlinePreview)}`);
	assert(outlinePreview.chapterItems === 2, `Unexpected outline preview: ${JSON.stringify(outlinePreview)}`);
	const outlineWide = await collectMetrics(client);
	await screenshot(client, '01-outline-preview-1440x900.png');

	await setViewport(client, 820, 720);
	const outlineNarrow = await collectMetrics(client);
	await screenshot(client, '02-outline-preview-820x720.png');
	for (const metrics of [outlineWide, outlineNarrow]) {
		assert(metrics.pageOverflowX === 0, `Page overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.dialogOverflowX === 0, `Dialog overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.shortImportControls.length === 0, `Import controls below 44 px: ${JSON.stringify(metrics)}`);
	}

	await clickButton(client, '下一步');
	await clickButton(client, '下一步');
	await clickButton(client, '下一步');
	await waitFor(client, `document.querySelector('.creation-summary')?.textContent.includes('2 个章节 + 原始大纲')`, 'outline review');
	const review = await evaluate(client, `document.querySelector('.creation-summary').textContent.replace(/\\s+/gu, ' ').trim()`);
	assert(review.includes('5 个文件'), `Unexpected import file count: ${review}`);
	await screenshot(client, '03-outline-confirm-820x720.png');
	await clickButton(client, '创建并导入');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`, 'imported project dashboard');
	const handoff = await evaluate(client, `(() => ({
		first: document.body.textContent.includes('第一章 · 迟到四十七秒'),
		second: document.body.textContent.includes('第二章 · 城市回声协议'),
		dialogClosed: !document.querySelector('.project-wizard')
	}))()`);
	assert(handoff.first && handoff.second && handoff.dialogClosed, `Outline handoff failed: ${JSON.stringify(handoff)}`);
	await screenshot(client, '04-outline-dashboard-820x720.png');

	const errors = await client.call('Log.enable').then(async () => evaluate(client, `performance.getEntriesByType('resource').filter(entry => entry.name.includes('undefined')).length`));
	assert(errors === 0, 'Undefined resource URL was requested.');
	const report = {
		generatedAt: new Date().toISOString(),
		appUrl,
		welcome,
		outlinePreview,
		outlineWide,
		outlineNarrow,
		review,
		handoff
	};
	await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Phase 1.2I browser acceptance passed: ${metricsPath}`);
} finally {
	client?.close();
	if (edge.pid) {
		spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
	}
	if (profileDirectory.startsWith(tmpdir())) {
		await rm(profileDirectory, { recursive: true, force: true, maxRetries: 4 });
	}
}
