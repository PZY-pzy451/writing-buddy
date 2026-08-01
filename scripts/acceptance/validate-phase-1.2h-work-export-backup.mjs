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
	'phase-1.2h-work-export-backup'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'phase-1.2h-work-export-backup-visual-metrics.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2H_CDP_PORT ?? 9415);
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
		const matches = [...document.querySelectorAll('button:not([hidden]), [role="button"]:not([hidden])')]
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
		const historyControls = controls.filter(control => control.closest('.versions-page'));
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
			visibleControls: controls.length,
			backupPanel: (() => {
				const panel = document.querySelector('.history-backup .project-backup-panel');
				if (!panel) return undefined;
				const style = getComputedStyle(panel);
				return {
					rect: panel.getBoundingClientRect().toJSON(),
					display: style.display,
					position: style.position,
					padding: style.padding,
					children: [...panel.children].map(child => ({
						className: child.className,
						rect: child.getBoundingClientRect().toJSON(),
						display: getComputedStyle(child).display,
						position: getComputedStyle(child).position
					}))
				};
			})(),
			historySections: [...document.querySelectorAll('.versions-page > section')]
				.map(section => ({
					className: section.className,
					rect: section.getBoundingClientRect().toJSON(),
					childCount: section.childElementCount
				})),
			shortHistoryControls: historyControls.filter(control => (
				control.getBoundingClientRect().height < 43.5
			)).map(control => ({
				label: control.getAttribute('aria-label')
					?? control.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
				height: control.getBoundingClientRect().height
			}))
		};
	})()`);
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2h-'));
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
	await clickButton(client, '继续上次位置');
	await waitFor(client, `Boolean(document.querySelector('.writer-header'))`, 'chapter writer');
	await clickButton(client, '历史');
	await waitFor(client, `Boolean(document.querySelector('.history-export-card'))`, 'history export card');

	const beforeExport = await evaluate(client, `(() => ({
		title: document.querySelector('.versions-page h1')?.textContent.trim(),
		primaryActions: [...document.querySelectorAll('.versions-page .primary-button')]
			.filter(button => button.getBoundingClientRect().width > 0 && !button.disabled)
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim()),
		exportActions: [...document.querySelectorAll('.history-export-actions button')]
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim()),
		projectSummary: document.querySelector('.history-card-copy p span')?.textContent.trim(),
		backupMounted: Boolean(document.querySelector('.history-backup .project-backup-panel')),
		backupActions: [...document.querySelectorAll('.history-backup .project-backup-actions button')]
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim())
	}))()`);
	assert(beforeExport.title === '历史与导出', `Unexpected History title: ${JSON.stringify(beforeExport)}`);
	assert(beforeExport.primaryActions.length === 1
		&& beforeExport.primaryActions[0] === '导出作品',
	`History should expose one primary action: ${JSON.stringify(beforeExport)}`);
	assert(beforeExport.exportActions.includes('作品纯文本')
		&& beforeExport.exportActions.includes('当前章 Markdown')
		&& beforeExport.exportActions.includes('当前章纯文本'),
	`Missing export alternatives: ${JSON.stringify(beforeExport)}`);
	assert(beforeExport.projectSummary?.includes('3 章'),
		`Missing whole-work chapter summary: ${JSON.stringify(beforeExport)}`);
	assert(beforeExport.backupMounted
		&& beforeExport.backupActions.includes('创建备份')
		&& beforeExport.backupActions.includes('选择已有备份')
		&& beforeExport.backupActions.includes('恢复所选备份'),
	`Missing backup actions: ${JSON.stringify(beforeExport)}`);

	await clickButton(client, '导出作品');
	await waitFor(client, `Boolean(document.querySelector('.history-receipts li'))`, 'work export receipt');
	await clickButton(client, '创建备份');
	await waitFor(
		client,
		`document.querySelector('.project-backup-status')?.textContent.includes('校验通过')`,
		'validated backup status'
	);
	const history = await evaluate(client, `(() => ({
		receiptTitle: document.querySelector('.history-receipt-title strong')?.textContent.trim(),
		receiptScope: document.querySelector('.history-receipt-title small')?.textContent.trim(),
		receiptPath: document.querySelector('.history-receipt-main code')?.textContent.trim(),
		receiptMeta: document.querySelector('.history-receipt-meta')?.textContent
			.replace(/\\s+/gu, ' ').trim(),
		backupStatus: document.querySelector('.project-backup-status')?.textContent
			.replace(/\\s+/gu, ' ').trim(),
		restoreEnabled: !document.querySelector('.history-backup .project-backup-actions button:last-child')?.disabled
	}))()`);
	assert(history.receiptTitle === '我的小说' && history.receiptScope === '整部作品',
		`Work receipt scope is incomplete: ${JSON.stringify(history)}`);
	assert(history.receiptPath?.endsWith('我的小说.md') && history.receiptMeta?.includes('3 章'),
		`Work receipt delivery evidence is incomplete: ${JSON.stringify(history)}`);
	assert(history.backupStatus?.includes('校验通过') && history.restoreEnabled,
		`Backup trust state is incomplete: ${JSON.stringify(history)}`);

	const captures = [];
	for (const [width, height, name] of [
		[1440, 900, '01-history-work-export-backup-1440x900.png'],
		[1280, 800, '02-history-work-export-backup-1280x800.png'],
		[1024, 720, '03-history-work-export-backup-1024x720.png'],
		[820, 720, '04-history-work-export-backup-820x720.png']
	]) {
		await setViewport(client, width, height);
		const metrics = await collectMetrics(client);
		await screenshot(client, name);
		captures.push({ name, ...metrics });
	}
	for (const metrics of captures) {
		assert(metrics.pageOverflowX === 0, `Horizontal overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
		assert(metrics.shortHistoryControls.length === 0,
			`History controls below 44px: ${JSON.stringify(metrics)}`);
		const backupSection = metrics.historySections.find(section => (
			section.className === 'history-backup'
		));
		assert(backupSection?.rect.height >= 120,
			`History backup panel collapsed: ${JSON.stringify(metrics)}`);
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
		beforeExport,
		history,
		runtimeErrors,
		captures
	}, null, 2)}\n`);
	console.log(`Phase 1.2H browser acceptance passed: ${metricsPath}`);
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
