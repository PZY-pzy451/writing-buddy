import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const phaseSlug = 'phase-1.2p-delivery-freshness';
const outputDirectory = join(repositoryRoot, 'docs', 'acceptance', 'screenshots', phaseSlug);
const metricsPath = join(repositoryRoot, 'docs', 'acceptance', `${phaseSlug}-visual-metrics.json`);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2P_CDP_PORT ?? 9425);
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
			const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
				.then(response => response.json());
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

async function clickControl(client, selector, label, contains = false) {
	const count = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const expected = ${JSON.stringify(label)};
		const matches = [...document.querySelectorAll(${JSON.stringify(selector)})]
			.filter(element => {
				const actual = normalize(element.getAttribute('aria-label') ?? element.textContent);
				return ${contains ? 'actual.includes(expected)' : 'actual === expected'};
			})
			.filter(element => {
				const rect = element.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			});
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one visible control for “${label}”; found ${count}.`);
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
					&& (ancestor.scrollHeight > ancestor.clientHeight + 1
						|| ancestor.scrollWidth > ancestor.clientWidth + 1)) return true;
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
		const scopedControls = controls.filter(control => control.closest('.publish-readiness'));
		const occluded = scopedControls.filter(control => {
			const rect = control.getBoundingClientRect();
			if (hasScrollableAncestor(control) && (rect.top < 68 || rect.bottom > innerHeight - 40)) {
				return false;
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
			shortScopedControls: scopedControls.filter(control => (
				control.getBoundingClientRect().height < 43.5
			)).map(control => ({
				label: control.getAttribute('aria-label')
					?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
				height: control.getBoundingClientRect().height
			})),
			occludedScopedControls: occluded
		};
	})()`);
}

async function deliveryState(client) {
	return evaluate(client, `(() => {
		const row = [...document.querySelectorAll('.publish-readiness-row')]
			.find(candidate => candidate.querySelector('strong')?.textContent.trim() === '整书交付回执');
		return {
			status: row?.getAttribute('data-status'),
			detail: row?.querySelector('p')?.textContent.replace(/\\s+/gu, ' ').trim(),
			context: [...document.querySelectorAll('.publish-readiness-context span')]
				.map(node => node.textContent.trim())
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
	await clickControl(client, 'button', '打开已有 Writing Buddy 作品');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`, 'writing home');
	await clickControl(client, 'button', '历史');
	await waitFor(client, `Boolean(document.querySelector('.history-export-card'))`, 'history page');
	await clickControl(client, 'button', '导出 Word 文档');
	await waitFor(client, `[...document.querySelectorAll('.history-receipt-meta small')]
		.some(node => node.textContent.includes('精确源指纹'))`, 'exact source receipt');

	const receipt = await evaluate(client, `(() => ({
		title: document.querySelector('.history-receipt-title strong')?.textContent.trim(),
		destination: document.querySelector('.history-receipt-main code')?.textContent.trim(),
		meta: document.querySelector('.history-receipt-meta')?.textContent.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(receipt.title === '我的小说' && receipt.meta?.includes('精确源指纹'),
		`Whole-work receipt did not expose exact source evidence: ${JSON.stringify(receipt)}`);

	const captures = [];
	let metrics = await collectMetrics(client, 'history-exact-receipt');
	await screenshot(client, '01-history-exact-receipt-1440x900.png');
	captures.push({ name: '01-history-exact-receipt-1440x900.png', ...metrics });

	await clickControl(client, 'button', '检查');
	await waitFor(client, `Boolean(document.querySelector('.publish-readiness'))`, 'publish readiness');
	await clickControl(client, 'button', '查看发布清单', true);
	await waitFor(client, `[...document.querySelectorAll('.publish-readiness-row')]
		.some(row => row.textContent.includes('逐章正文哈希完全一致'))`, 'matching source fingerprint');
	const matching = await deliveryState(client);
	assert(matching.status === 'passed' && matching.detail?.includes('未回读目标文件'),
		`Exact delivery did not pass: ${JSON.stringify(matching)}`);

	for (const [width, height, name] of [
		[1440, 900, '02-publish-exact-match-1440x900.png'],
		[1024, 720, '03-publish-exact-match-1024x720.png'],
		[820, 720, '04-publish-exact-match-820x720.png']
	]) {
		await setViewport(client, width, height);
		if (width === 820) {
			await evaluate(client, `(() => {
				const row = [...document.querySelectorAll('.publish-readiness-row')]
					.find(candidate => candidate.querySelector('strong')?.textContent.trim()
						=== '整书交付回执');
				row?.scrollIntoView({ block: 'center' });
				return Boolean(row);
			})()`);
			await delay(120);
		}
		metrics = await collectMetrics(client, 'publish-exact-match');
		await screenshot(client, name);
		captures.push({ name, ...metrics });
	}

	await clickControl(client, 'button', '写作');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`, 'writing home after check');
	await clickControl(client, 'button', '继续上次位置');
	await waitFor(client, `Boolean(document.querySelector('.chapter-status-control > summary'))`, 'chapter status');
	const currentStatusLabel = await evaluate(client, `document.querySelector('.chapter-status-control > summary')?.getAttribute('aria-label')`);
	await clickControl(client, '.chapter-status-control > summary', currentStatusLabel);
	const targetStatus = currentStatusLabel === '章节状态：已完成' ? '修订中' : '已完成';
	await clickControl(client, '[role="menuitemradio"]', targetStatus, true);
	await waitFor(client, `document.querySelector('.chapter-status-control > summary')?.getAttribute('aria-label')
		=== ${JSON.stringify(`章节状态：${targetStatus}`)}`, 'changed chapter status');

	await clickControl(client, 'button', '检查');
	await waitFor(client, `Boolean(document.querySelector('.publish-readiness'))`, 'publish readiness after status');
	await clickControl(client, 'button', '查看发布清单', true);
	await waitFor(client, `[...document.querySelectorAll('.publish-readiness-row')]
		.some(row => row.textContent.includes('相同字数也不会视为同一版本'))`, 'stale exact receipt');
	const stale = await deliveryState(client);
	assert(stale.status === 'attention'
		&& stale.detail?.includes('项目结构或正文内容已经变化')
		&& JSON.stringify(stale.context) === JSON.stringify(matching.context),
		`Same-count source change was not invalidated: ${JSON.stringify({ matching, stale })}`);
	await evaluate(client, `(() => {
		const row = [...document.querySelectorAll('.publish-readiness-row')]
			.find(candidate => candidate.querySelector('strong')?.textContent.trim()
				=== '整书交付回执');
		row?.scrollIntoView({ block: 'center' });
		return Boolean(row);
	})()`);
	await delay(120);
	metrics = await collectMetrics(client, 'publish-stale-same-count');
	await screenshot(client, '05-publish-stale-same-count-820x720.png');
	captures.push({ name: '05-publish-stale-same-count-820x720.png', ...metrics });

	for (const capture of captures) {
		assert(capture.pageOverflowX === 0, `Horizontal page overflow: ${JSON.stringify(capture)}`);
		assert(capture.pageOverflowY === 0, `Vertical page overflow: ${JSON.stringify(capture)}`);
		assert(capture.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(capture)}`);
		assert(capture.shortScopedControls.length === 0,
			`Publish controls below 44px: ${JSON.stringify(capture)}`);
		assert(capture.occludedScopedControls.length === 0,
			`Occluded publish controls: ${JSON.stringify(capture)}`);
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
		receipt,
		matching,
		stale,
		runtimeErrors,
		captures
	}, null, 2)}\n`);
	console.log(`Phase 1.2P browser acceptance passed: ${metricsPath}`);
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
