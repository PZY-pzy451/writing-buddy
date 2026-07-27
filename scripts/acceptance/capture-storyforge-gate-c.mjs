import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const appUrl = process.argv[2] ?? 'http://127.0.0.1:1420';
const outputRoot = resolve('docs/acceptance/screenshots/gate-c');
const profileRoot = resolve(`tmp/gate-c-edge-profile-${Date.now()}`);
const debugPort = 9337;

await mkdir(outputRoot, { recursive: true });
await mkdir(profileRoot, { recursive: true });

const edge = spawn(edgePath, [
	'--headless=new',
	'--disable-gpu',
	'--disable-extensions',
	'--disable-background-networking',
	'--no-first-run',
	`--remote-debugging-port=${debugPort}`,
	`--user-data-dir=${profileRoot}`,
	'--window-size=1536,960',
	appUrl
], {
	stdio: 'ignore',
	windowsHide: true
});

async function waitForJson(url, timeoutMs = 15_000) {
	const startedAt = performance.now();
	while (performance.now() - startedAt < timeoutMs) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				return response.json();
			}
		} catch {
			// Edge still starting.
		}
		await new Promise(resolveWait => setTimeout(resolveWait, 100));
	}
	throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
	constructor(url) {
		this.nextId = 1;
		this.pending = new Map();
		this.socket = new WebSocket(url);
		this.ready = new Promise((resolveReady, rejectReady) => {
			this.socket.addEventListener('open', resolveReady, { once: true });
			this.socket.addEventListener('error', rejectReady, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (!message.id) {
				return;
			}
			const pending = this.pending.get(message.id);
			if (!pending) {
				return;
			}
			this.pending.delete(message.id);
			if (message.error) {
				pending.reject(new Error(message.error.message));
			} else {
				pending.resolve(message.result);
			}
		});
	}

	async send(method, params = {}) {
		await this.ready;
		const id = this.nextId++;
		const result = new Promise((resolveResult, rejectResult) => {
			this.pending.set(id, { resolve: resolveResult, reject: rejectResult });
		});
		this.socket.send(JSON.stringify({ id, method, params }));
		return result;
	}

	close() {
		this.socket.close();
	}
}

async function waitForSelector(client, selector, timeoutMs = 12_000) {
	const startedAt = performance.now();
	while (performance.now() - startedAt < timeoutMs) {
		const result = await client.send('Runtime.evaluate', {
			expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
			returnByValue: true
		});
		if (result.result.value) {
			return performance.now() - startedAt;
		}
		await new Promise(resolveWait => setTimeout(resolveWait, 100));
	}
	const diagnostic = await client.send('Runtime.evaluate', {
		expression: `({
			location: location.href,
			title: document.title,
			text: document.body?.innerText?.slice(0, 1000),
			html: document.body?.innerHTML?.slice(0, 1000)
		})`,
		returnByValue: true
	});
	throw new Error(`Timed out waiting for ${selector}: ${JSON.stringify(diagnostic.result.value)}`);
}

const pages = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
const page = pages.find(candidate => candidate.type === 'page' && candidate.url.startsWith(appUrl))
	?? pages.find(candidate => candidate.type === 'page');
if (!page?.webSocketDebuggerUrl) {
	edge.kill();
	throw new Error('No inspectable Edge page was created.');
}

const client = new CdpClient(page.webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');

const initialState = {
	state: {
		recentProjectRoot: 'C:\\StoryForge Gate C Browser Fixture',
		activeMode: 'references',
		storyView: 'characters',
		theme: 'paper',
		accent: 'gold',
		focusMode: false,
		sidebarWidth: 304,
		assistantWidth: 339,
		dockHeight: 240,
		openResourceIds: [],
		documentViews: {}
	},
	version: 0
};
await client.send('Runtime.evaluate', {
	expression: `localStorage.setItem('writing-buddy-next-workspace', ${JSON.stringify(JSON.stringify(initialState))})`
});

const captures = [
	{ view: 'characters', selector: '.character-center', width: 1536, height: 960, name: '01-character-center-1536x992.png' },
	{ view: 'relationships', selector: '.relationship-page', width: 1536, height: 960, name: '02-relationship-graph-1536x992.png' },
	{ view: 'timeline', selector: '.timeline-page', width: 1536, height: 960, name: '03-timeline-1536x992.png' },
	{ view: 'relationships', selector: '.relationship-page', width: 1280, height: 768, name: '04-relationship-1280x800.png' },
	{ view: 'timeline', selector: '.timeline-page', width: 1024, height: 688, name: '05-timeline-1024x720.png' }
];
const metrics = [];

try {
	for (const capture of captures) {
		await client.send('Emulation.setDeviceMetricsOverride', {
			width: capture.width,
			height: capture.height,
			deviceScaleFactor: 1,
			mobile: false
		});
		await client.send('Runtime.evaluate', {
			expression: `(() => {
				const persisted = JSON.parse(localStorage.getItem('writing-buddy-next-workspace'));
				persisted.state.activeMode = 'references';
				persisted.state.storyView = ${JSON.stringify(capture.view)};
				localStorage.setItem('writing-buddy-next-workspace', JSON.stringify(persisted));
			})()`
		});
		const startedAt = performance.now();
		await client.send('Page.reload', { ignoreCache: true });
		const readyMs = await waitForSelector(client, capture.selector);
		await new Promise(resolveWait => setTimeout(resolveWait, 350));
		const layout = await client.send('Runtime.evaluate', {
			expression: `(() => {
				const root = document.querySelector(${JSON.stringify(capture.selector)});
				const shell = document.querySelector('.app-shell');
				const rect = root.getBoundingClientRect();
				const overflowing = [...document.querySelectorAll('*')].filter(element => {
					const box = element.getBoundingClientRect();
					return box.right > innerWidth + 1 || box.bottom > innerHeight + 1;
				}).length;
				return {
					viewport: { width: innerWidth, height: innerHeight },
					root: { width: Math.round(rect.width), height: Math.round(rect.height) },
					gridColumns: getComputedStyle(shell).gridTemplateColumns,
					pageOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
					pageOverflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
					overflowingElements: overflowing,
					domNodes: document.querySelectorAll('*').length
				};
			})()`,
			returnByValue: true
		});
		const screenshot = await client.send('Page.captureScreenshot', {
			format: 'png',
			fromSurface: true,
			captureBeyondViewport: false
		});
		await writeFile(resolve(outputRoot, capture.name), Buffer.from(screenshot.data, 'base64'));
		metrics.push({
			...capture,
			readyMs: Math.round(performance.now() - startedAt),
			selectorReadyMs: Math.round(readyMs),
			...layout.result.value
		});
	}
	await writeFile(
		resolve('docs/acceptance/gate-c-visual-metrics.json'),
		`${JSON.stringify({ generatedAt: new Date().toISOString(), captures: metrics }, undefined, 2)}\n`
	);
	process.stdout.write(`${JSON.stringify(metrics, undefined, 2)}\n`);
} finally {
	client.close();
	edge.kill();
}
