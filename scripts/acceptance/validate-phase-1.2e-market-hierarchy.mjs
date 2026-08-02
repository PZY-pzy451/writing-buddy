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
	'phase-1.2e-market-hierarchy'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'phase-1.2e-market-hierarchy-visual-metrics.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2E_CDP_PORT ?? 9412);
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
			.filter(button => (
				normalize(button.getAttribute('aria-label')) === ${JSON.stringify(label)}
				|| normalize(button.textContent) === ${JSON.stringify(label)}
			))
			.filter(button => {
				const rect = button.getBoundingClientRect();
				return rect.width > 0 && rect.height > 0;
			});
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one visible button named “${label}”; found ${count}.`);
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
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2e-'));
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

	await setViewport(client, 1440, 900);
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`,
		'welcome page'
	);
	const welcome = await evaluate(client, `(() => {
		const visible = element => element.getBoundingClientRect().width > 0
			&& element.getBoundingClientRect().height > 0;
		const welcome = document.querySelector('main[aria-label="开始使用 Writing Buddy"]');
		const labels = [...welcome.querySelectorAll('button')]
			.filter(visible)
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim());
		const primary = [...welcome.querySelectorAll('button.primary-button')]
			.filter(visible)
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim());
		const rail = [...document.querySelectorAll('.global-rail .rail-primary button')]
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim());
		return { labels, primary, rail };
	})()`);
	assert(welcome.primary.length === 1, `Expected one welcome primary action: ${JSON.stringify(welcome)}`);
	assert(welcome.primary[0] === '根据题材生成大纲', 'Genre start is not the primary action.');
	for (const label of [
		'导入已有大纲预览后创建章节结构',
		'导入已有正文文字不经 AI 改写并打开第一章',
		'创建空白作品不生成任何内容'
	]) {
		assert(welcome.labels.includes(label), `Missing welcome route: ${label}`);
	}
	assert(
		JSON.stringify(welcome.rail) === JSON.stringify(['写作', '规划', '故事库', '检查', '历史']),
		`Unexpected primary navigation: ${JSON.stringify(welcome.rail)}`
	);
	const welcomeMetrics = await collectMetrics(client);
	await screenshot(client, '01-welcome-1440x900.png');

	await clickButton(client, '打开已有 Writing Buddy 作品');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'writing home'
	);
	const writingHome = await evaluate(client, `(() => ({
		taskHeadings: [...document.querySelectorAll('.dashboard-card h2')]
			.map(heading => heading.textContent.trim()),
		hasAiTopAction: [...document.querySelectorAll('.top-bar button')]
			.some(button => button.textContent.includes('AI 快速生成')),
		primaryActions: [...document.querySelectorAll('.story-dashboard button')]
			.filter(button => getComputedStyle(button).backgroundColor !== 'rgba(0, 0, 0, 0)')
			.map(button => button.textContent.replace(/\\s+/gu, ' ').trim())
	}))()`);
	for (const heading of ['继续写作', '当前章节', '下一步任务', '待处理审校', '最近活动']) {
		assert(writingHome.taskHeadings.includes(heading), `Missing writing-home task: ${heading}`);
	}
	assert(!writingHome.hasAiTopAction, 'AI remained a top-bar product destination.');
	const homeMetrics = await collectMetrics(client);
	await screenshot(client, '02-writing-home-1440x900.png');

	await setViewport(client, 1024, 720);
	await clickButton(client, '规划');
	await waitFor(
		client,
		`Boolean(document.querySelector('.story-reference-sidebar nav[aria-label="规划页面"]'))`,
		'planning navigation'
	);
	const planningMetrics = await collectMetrics(client);
	await screenshot(client, '03-planning-1024x720.png');

	await clickButton(client, '故事库');
	await waitFor(
		client,
		`Boolean(document.querySelector('.story-reference-sidebar nav[aria-label="故事库页面"]'))`,
		'Story Library navigation'
	);
	const library = await evaluate(client, `(() => ({
		groups: [...document.querySelectorAll('.story-navigation-group h3')]
			.map(heading => heading.textContent.trim()),
		entries: [...document.querySelectorAll('.story-reference-sidebar nav button strong')]
			.map(label => label.textContent.trim()),
		muted: document.querySelectorAll('.story-reference-sidebar nav button.is-progressive-muted').length
	}))()`);
	assert(library.groups[0] === '现在需要', `Current relevance is not first: ${JSON.stringify(library)}`);
	assert(library.entries[0] === '当前相关', `Story Library first entry drifted: ${JSON.stringify(library)}`);
	const libraryMetrics = await collectMetrics(client);
	await screenshot(client, '04-story-library-1024x720.png');

	for (const metrics of [welcomeMetrics, homeMetrics, planningMetrics, libraryMetrics]) {
		assert(metrics.pageOverflowX === 0, `Horizontal overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Vertical overflow: ${JSON.stringify(metrics)}`);
		assert(metrics.clippedInteractive === 0, `Clipped controls: ${JSON.stringify(metrics)}`);
	}

	const report = {
		generatedAt: new Date().toISOString(),
		appUrl,
		welcome,
		writingHome,
		library,
		captures: [
			{ name: '01-welcome-1440x900.png', ...welcomeMetrics },
			{ name: '02-writing-home-1440x900.png', ...homeMetrics },
			{ name: '03-planning-1024x720.png', ...planningMetrics },
			{ name: '04-story-library-1024x720.png', ...libraryMetrics }
		]
	};
	await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Phase 1.2E browser acceptance passed: ${metricsPath}`);
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
