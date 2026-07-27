import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const appUrl = process.argv[2] ?? 'http://127.0.0.1:1420';
const gate = process.argv[3] ?? 'gate-c';
const outputRoot = resolve(`docs/acceptance/screenshots/${gate}`);
const profileRoot = resolve(`tmp/${gate}-edge-profile-${Date.now()}`);
const attachedDebugPort = Number(process.argv[4]) || undefined;
const debugPort = attachedDebugPort ?? 9337;

await mkdir(outputRoot, { recursive: true });
await mkdir(profileRoot, { recursive: true });

const edge = attachedDebugPort ? undefined : spawn(edgePath, [
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
	edge?.kill();
	throw new Error('No inspectable Edge page was created.');
}

const client = new CdpClient(page.webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');

const initialState = {
	state: {
		recentProjectRoot: process.argv[5] ?? 'C:\\StoryForge Gate C Browser Fixture',
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

const gateCCaptures = [
	{ view: 'characters', selector: '.character-center', width: 1536, height: 960, name: '01-character-center-1536x992.png' },
	{ view: 'relationships', selector: '.relationship-page', width: 1536, height: 960, name: '02-relationship-graph-1536x992.png' },
	{ view: 'timeline', selector: '.timeline-page', width: 1536, height: 960, name: '03-timeline-1536x992.png' },
	{ view: 'relationships', selector: '.relationship-page', width: 1280, height: 768, name: '04-relationship-1280x800.png' },
	{ view: 'timeline', selector: '.timeline-page', width: 1024, height: 688, name: '05-timeline-1024x720.png' }
];
const gateDCaptures = [
	{ view: 'worldbuilding', selector: '.worldbuilding-page', width: 1536, height: 960, name: '01-worldbuilding-1536x992.png' },
	{ view: 'assets', selector: '.story-assets-page', width: 1536, height: 960, name: '02-story-assets-1536x992.png' },
	{ view: 'plots', selector: '.plot-board-page', width: 1536, height: 960, name: '03-plot-board-1536x992.png' },
	{ view: 'information', selector: '.information-control-page', width: 1536, height: 960, name: '04-information-control-1536x992.png' },
	{ view: 'worldbuilding', selector: '.worldbuilding-page', width: 1280, height: 768, name: '05-worldbuilding-1280x800.png' },
	{ view: 'information', selector: '.information-control-page', width: 1024, height: 688, name: '06-information-control-1024x720.png' }
];
const gateECaptures = [
	{ view: 'continuity', selector: '.continuity-review-page', width: 1536, height: 960, name: '01-continuity-review-1536x992.png' },
	{ view: 'continuity', selector: '.continuity-review-page', width: 1280, height: 768, name: '02-continuity-review-1280x800.png' },
	{ view: 'continuity', selector: '.continuity-review-page', width: 1024, height: 688, name: '03-continuity-review-1024x720.png' }
];
const gateFCaptures = [
	{ mode: 'works', selector: '.story-dashboard', width: 1536, height: 960, name: '01-workspace-overview-1536x992.png' },
	{ mode: 'references', view: 'characters', selector: '.character-center', width: 1536, height: 960, name: '02-character-center-1536x992.png' },
	{ mode: 'references', view: 'relationships', selector: '.relationship-page', width: 1536, height: 960, name: '03-relationship-graph-1536x992.png' },
	{ mode: 'references', view: 'timeline', selector: '.timeline-page', width: 1536, height: 960, name: '04-timeline-1536x992.png' },
	{ mode: 'references', view: 'assets', selector: '.story-assets-page', width: 1536, height: 960, name: '05-story-assets-1536x992.png' },
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.selection-rewrite-panel',
		prepare: 'select-editor',
		width: 1536,
		height: 960,
		name: '06-ai-grounded-context-1536x992.png'
	},
	{ mode: 'works', selector: '.story-dashboard', width: 1280, height: 768, name: '07-workspace-overview-1280x800.png' },
	{ mode: 'references', view: 'timeline', selector: '.timeline-page', width: 1024, height: 688, name: '08-timeline-1024x720.png' }
];
const aiQuickActionsCaptures = [
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writer-header',
		selector: '.ai-generation-drawer',
		prepare: 'open-ai-drawer',
		width: 1536,
		height: 960,
		name: '01-unified-ai-drawer-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writer-header',
		selector: '.ai-generation-drawer',
		prepare: 'open-ai-drawer',
		width: 1280,
		height: 768,
		name: '02-unified-ai-drawer-1280x800.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writer-header',
		selector: '.ai-generation-drawer',
		prepare: 'open-ai-drawer',
		width: 1024,
		height: 688,
		name: '03-context-preview-1024x720.png'
	}
];
const aiQuickActionsGateCCaptures = [
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.selection-action-menu',
		prepare: 'select-editor',
		width: 1536,
		height: 960,
		name: '01-selection-toolbar-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.selection-rewrite-panel',
		prepare: 'select-editor-ai-polish',
		width: 1536,
		height: 960,
		name: '02-ai-polish-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.kernel-generator',
		prepare: 'select-editor-create-character',
		width: 1536,
		height: 960,
		name: '03-create-character-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.selection-rewrite-panel',
		prepare: 'select-editor-ai-polish',
		width: 1280,
		height: 768,
		name: '04-ai-polish-1280x800.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.kernel-generator',
		prepare: 'select-editor-create-character',
		width: 1024,
		height: 688,
		name: '05-create-character-1024x720.png'
	}
];
const aiQuickActionsGateC2Captures = [
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writer-header',
		selector: '.ai-continuation-menu[open]',
		prepare: 'open-continuation-menu',
		width: 1536,
		height: 960,
		name: '01-continuation-entry-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.continuation-candidates',
		prepare: 'generate-three-directions',
		width: 1536,
		height: 960,
		name: '02-three-directions-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.scene-plan-fields',
		prepare: 'generate-scene-plan',
		width: 1536,
		height: 960,
		name: '03-scene-plan-fields-1536x992.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.continuation-candidates',
		prepare: 'generate-continuation',
		width: 1280,
		height: 768,
		name: '04-continuation-candidate-1280x800.png'
	},
	{
		mode: 'works',
		resourceId: 'chapter-a11ce001',
		readySelector: '.writing-canvas .monaco-editor',
		selector: '.scene-plan-fields',
		prepare: 'generate-scene-plan',
		width: 1024,
		height: 688,
		name: '05-scene-plan-fields-1024x720.png'
	}
];
const aiQuickActionsGateDCaptures = [
	{
		mode: 'references',
		view: 'characters',
		readySelector: '.character-center',
		selector: '.ai-review-drawer',
		prepare: 'generate-character-candidates',
		width: 1536,
		height: 960,
		name: '01-character-three-candidates-1536x960.png'
	},
	{
		mode: 'references',
		view: 'relationships',
		readySelector: '.relationship-page',
		selector: '.relationship-page',
		prepare: 'generate-relationship-candidates',
		width: 1536,
		height: 960,
		name: '02-relationship-virtual-edges-1536x960.png'
	},
	{
		mode: 'references',
		view: 'characters',
		readySelector: '.character-center',
		selector: '.ai-review-drawer',
		prepare: 'extract-character-candidates',
		width: 1280,
		height: 768,
		name: '03-character-extraction-1280x768.png'
	},
	{
		mode: 'references',
		view: 'relationships',
		readySelector: '.relationship-page',
		selector: '.relationship-page',
		prepare: 'generate-relationship-candidates',
		width: 1024,
		height: 688,
		name: '04-relationship-virtual-edges-1024x688.png'
	}
];
const captures = gate === 'gate-ai-actions-d'
	? aiQuickActionsGateDCaptures
	: gate === 'gate-ai-actions-c2'
	? aiQuickActionsGateC2Captures
	: gate.startsWith('gate-ai-actions-c')
	? aiQuickActionsGateCCaptures
	: gate.startsWith('gate-ai-actions')
	? aiQuickActionsCaptures
	: gate.startsWith('gate-e')
	? gateECaptures
	: gate.startsWith('gate-f')
		? gateFCaptures
	: gate.startsWith('gate-d')
		? gateDCaptures
		: gateCCaptures;
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
				persisted.state.activeMode = ${JSON.stringify(capture.mode ?? 'references')};
				persisted.state.storyView = ${JSON.stringify(capture.view)};
				persisted.state.openResourceIds = ${JSON.stringify(capture.resourceId ? [capture.resourceId] : [])};
				persisted.state.activeResourceId = ${JSON.stringify(capture.resourceId)};
				localStorage.setItem('writing-buddy-next-workspace', JSON.stringify(persisted));
			})()`
		});
		const startedAt = performance.now();
		await client.send('Page.reload', { ignoreCache: true });
		const readyMs = await waitForSelector(client, capture.readySelector ?? capture.selector);
		await new Promise(resolveWait => setTimeout(resolveWait, 300));
		if (capture.prepare?.startsWith('select-editor')) {
			const selectionResult = await client.send('Runtime.evaluate', {
				expression: `window.__WRITING_BUDDY_DEVTOOLS__?.selectManuscriptPrefix(56) ?? false`,
				returnByValue: true
			});
			if (!selectionResult.result.value) throw new Error('No manuscript content was available.');
			if (capture.prepare === 'select-editor-ai-polish') {
				const result = await client.send('Runtime.evaluate', {
					expression: `(() => {
						const button = document.querySelector('.selection-action-ai');
						if (!(button instanceof HTMLButtonElement)) return false;
						button.click();
						return true;
					})()`,
					returnByValue: true
				});
				if (!result.result.value) throw new Error('AI polish selection action was not available.');
			}
			if (capture.prepare === 'select-editor-create-character') {
				const result = await client.send('Runtime.evaluate', {
					expression: `(() => {
						const button = document.querySelector('[data-resource-action="character"]');
						if (!(button instanceof HTMLButtonElement)) return false;
						button.click();
						return true;
					})()`,
					returnByValue: true
				});
				if (!result.result.value) throw new Error('Create-character selection action was not available.');
			}
			await waitForSelector(client, capture.selector);
		}
		if (capture.prepare === 'open-continuation-menu') {
			const result = await client.send('Runtime.evaluate', {
				expression: `(() => {
					const summary = document.querySelector('.ai-continuation-menu summary');
					if (!(summary instanceof HTMLElement)) return false;
					summary.click();
					return true;
				})()`,
				returnByValue: true
			});
			if (!result.result.value) throw new Error('AI continuation entry was not available.');
			await waitForSelector(client, capture.selector);
		}
		if (capture.prepare === 'generate-continuation' || capture.prepare === 'generate-three-directions') {
			const prepared = await client.send('Runtime.evaluate', {
				expression: `(async () => {
					const tools = window.__WRITING_BUDDY_DEVTOOLS__;
					if (!tools?.setManuscriptCursor(56)) return false;
					if (!await tools.enableBrowserAiFixture()) return false;
					const summary = document.querySelector('.ai-continuation-menu summary');
					if (!(summary instanceof HTMLElement)) return false;
					summary.click();
					const target = ${JSON.stringify(capture.prepare === 'generate-three-directions' ? '三种走向' : '继续本段')};
					const button = [...document.querySelectorAll('.ai-continuation-menu button')]
						.find(item => item.textContent?.includes(target));
					if (!(button instanceof HTMLButtonElement)) return false;
					button.click();
					tools.setManuscriptCursor(56);
					return true;
				})()`,
				awaitPromise: true,
				returnByValue: true
			});
			if (!prepared.result.value) throw new Error('Continuation workflow could not be prepared.');
			await waitForSelector(client, '.continuation-panel .context-pack-preview');
			const generated = await client.send('Runtime.evaluate', {
				expression: `(() => {
					const button = document.querySelector('.continuation-panel .primary-button');
					if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
					button.click();
					return true;
				})()`,
				returnByValue: true
			});
			if (!generated.result.value) throw new Error('Continuation generation button was not available.');
			await waitForSelector(client, capture.selector);
		}
		if (capture.prepare === 'generate-scene-plan') {
			const prepared = await client.send('Runtime.evaluate', {
				expression: `(async () => {
					const tools = window.__WRITING_BUDDY_DEVTOOLS__;
					if (!tools?.setManuscriptCursor(56)) return false;
					if (!await tools.enableBrowserAiFixture()) return false;
					const tab = [...document.querySelectorAll('.assistant-tabs [role="tab"]')]
						.find(item => item.textContent?.trim() === '细纲');
					if (!(tab instanceof HTMLButtonElement)) return false;
					tab.click();
					return true;
				})()`,
				awaitPromise: true,
				returnByValue: true
			});
			if (!prepared.result.value) throw new Error('Scene-plan workflow could not be prepared.');
			await waitForSelector(client, '.scene-planning-panel .context-pack-preview');
			const generated = await client.send('Runtime.evaluate', {
				expression: `(() => {
					const button = document.querySelector('.scene-planning-panel .primary-button');
					if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
					button.click();
					return true;
				})()`,
				returnByValue: true
			});
			if (!generated.result.value) throw new Error('Scene-plan generation button was not available.');
			await waitForSelector(client, capture.selector);
		}
		if (capture.prepare === 'open-ai-drawer') {
			const openResult = await client.send('Runtime.evaluate', {
				expression: `(() => {
					const button = document.querySelector('.ai-quick-open');
					if (!(button instanceof HTMLButtonElement)) {
						return {
							opened: false,
							topBar: document.querySelector('.top-bar')?.innerText,
							buttons: [...document.querySelectorAll('.top-bar button')]
								.map(item => ({ className: item.className, text: item.textContent?.trim() }))
						};
					}
					button.click();
					return { opened: true };
				})()`,
				returnByValue: true
			});
			if (!openResult.result.value?.opened) {
				throw new Error(
					`AI quick action entry was not available: ${JSON.stringify(openResult.result.value)}`
				);
			}
			await waitForSelector(client, capture.selector);
		}
		if (
			capture.prepare === 'generate-character-candidates'
			|| capture.prepare === 'extract-character-candidates'
			|| capture.prepare === 'generate-relationship-candidates'
		) {
			const prepared = await client.send('Runtime.evaluate', {
				expression: `(async () => {
					const tools = window.__WRITING_BUDDY_DEVTOOLS__;
					if (!await tools?.enableBrowserAiFixture()) return false;
					const isRelationship = ${JSON.stringify(capture.prepare === 'generate-relationship-candidates')};
					const openButton = document.querySelector(
						isRelationship
							? '.relationship-ai-button'
							: '.character-list-header-actions > button'
					);
					if (!(openButton instanceof HTMLButtonElement)) return false;
					openButton.click();
					return true;
				})()`,
				awaitPromise: true,
				returnByValue: true
			});
			if (!prepared.result.value) throw new Error('Gate D AI review drawer could not be opened.');
			await waitForSelector(client, '.ai-review-drawer');
			if (
				capture.prepare === 'generate-character-candidates'
				|| capture.prepare === 'generate-relationship-candidates'
			) {
				const actionLabel = capture.prepare === 'generate-character-candidates'
					? '生成三个人物'
					: '生成双向关系';
				const selected = await client.send('Runtime.evaluate', {
					expression: `(() => {
						const button = [...document.querySelectorAll('.ai-review-action-grid button')]
							.find(item => item.textContent?.trim() === ${JSON.stringify(actionLabel)});
						if (!(button instanceof HTMLButtonElement)) return false;
						button.click();
						return true;
					})()`,
					returnByValue: true
				});
				if (!selected.result.value) throw new Error(`Gate D action was not available: ${actionLabel}`);
			}
			const generated = await client.send('Runtime.evaluate', {
				expression: `(() => {
					const button = document.querySelector('.ai-review-primary');
					if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
					button.click();
					return true;
				})()`,
				returnByValue: true
			});
			if (!generated.result.value) throw new Error('Gate D generation button was not available.');
			await waitForSelector(
				client,
				capture.prepare === 'generate-relationship-candidates'
					? '.relationship-graph-canvas g.is-ai-candidate'
					: '.ai-review-candidate'
			);
		}
		if (capture.prepare?.startsWith('generate-')) {
			await client.send('Runtime.evaluate', {
				expression: `(() => {
					const target = document.querySelector(${JSON.stringify(capture.selector)});
					const scroller = target?.closest('.assistant-scroll');
					if (target && scroller) {
						scroller.scrollTop += target.getBoundingClientRect().top
							- scroller.getBoundingClientRect().top - 8;
					}
					window.scrollTo(0, 0);
				})()`
			});
		}
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
				const hasScrollableAncestor = element => {
					for (let current = element.parentElement; current; current = current.parentElement) {
						const style = getComputedStyle(current);
						const scrollsY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
						const scrollsX = /(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;
						if (scrollsY || scrollsX) return true;
					}
					return false;
				};
				const interactive = [...document.querySelectorAll('button, input, select, textarea, [role="button"], [role="tab"]')]
					.filter(element => {
						const box = element.getBoundingClientRect();
						const style = getComputedStyle(element);
						return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.opacity !== '0';
					});
				const clippedInteractiveElements = interactive.filter(element => {
					const box = element.getBoundingClientRect();
					const clipped = box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1;
					return clipped && !hasScrollableAncestor(element);
				});
				const undersizedStoryControlElements = [...root.querySelectorAll('button, input, select, textarea, [role="button"], [role="tab"]')]
					.filter(element => {
						const box = element.getBoundingClientRect();
						const style = getComputedStyle(element);
						const label = element.matches('input[type="checkbox"], input[type="radio"]')
							? element.closest('label')
							: undefined;
						const hasAccessibleLabelTarget = label
							&& label.getBoundingClientRect().height >= 43.5;
						return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
							&& style.opacity !== '0' && box.height < 43.5 && !hasAccessibleLabelTarget;
					});
				const describeInteractive = element => {
					const box = element.getBoundingClientRect();
					return {
						tag: element.tagName.toLowerCase(),
						label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 80),
						className: typeof element.className === 'string' ? element.className : '',
						rect: {
							left: Math.round(box.left),
							top: Math.round(box.top),
							right: Math.round(box.right),
							bottom: Math.round(box.bottom),
							height: Math.round(box.height)
						}
					};
				};
				return {
					viewport: { width: innerWidth, height: innerHeight },
					root: { width: Math.round(rect.width), height: Math.round(rect.height) },
					gridColumns: getComputedStyle(shell).gridTemplateColumns,
					pageOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
					pageOverflowY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
					overflowingElements: overflowing,
					clippedInteractive: clippedInteractiveElements.length,
					clippedInteractiveDetails: clippedInteractiveElements.slice(0, 5).map(describeInteractive),
					undersizedStoryControls: undersizedStoryControlElements.length,
					undersizedStoryControlDetails: undersizedStoryControlElements.slice(0, 5).map(describeInteractive),
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
		resolve(`docs/acceptance/${gate}-visual-metrics.json`),
		`${JSON.stringify({ generatedAt: new Date().toISOString(), captures: metrics }, undefined, 2)}\n`
	);
	process.stdout.write(`${JSON.stringify(metrics, undefined, 2)}\n`);
} finally {
	client.close();
	edge?.kill();
}
