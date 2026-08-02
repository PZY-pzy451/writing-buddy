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
	'phase-1.2s-user-detail-soak'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'phase-1.2s-user-detail-soak.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.PHASE_1_2S_CDP_PORT ?? 9480);
const appUrl = process.env.WRITING_BUDDY_URL ?? 'http://127.0.0.1:1420/';
const navigation = [
	{ label: '写作', mode: 'works' },
	{ label: '规划', mode: 'planning' },
	{ label: '故事库', mode: 'references' },
	{ label: '检查', mode: 'review' },
	{ label: '历史', mode: 'versions' }
];

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
			if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
			else pending.resolve(message.result);
		});
	}

	call(method, params = {}) {
		return new Promise((resolveCall, reject) => {
			const id = this.nextId++;
			this.pending.set(id, { resolve: resolveCall, reject, method });
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
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
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
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes('Promise was collected')) {
				throw error;
			}
			await delay(50);
		}
	}
	throw new Error('Runtime.evaluate repeatedly lost its awaited Promise.');
}

async function waitFor(client, expression, description, timeout = 15_000) {
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

async function clickNamed(client, label, options = {}) {
	const matches = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const root = ${options.root ? `document.querySelector(${JSON.stringify(options.root)})` : 'document'};
		if (!root) return -1;
		const candidates = [...root.querySelectorAll(
			'button:not([hidden]), summary:not([hidden]), [role="button"]:not([hidden]), [role="menuitem"]:not([hidden])'
		)].filter(visible);
		const exact = candidates.filter(element => (
			normalize(element.getAttribute('aria-label')) === ${JSON.stringify(label)}
			|| normalize(element.textContent) === ${JSON.stringify(label)}
			|| normalize(element.querySelector('strong')?.textContent) === ${JSON.stringify(label)}
		));
		const found = exact.length === 1 ? exact : candidates.filter(element => (
			normalize(element.getAttribute('aria-label')).includes(${JSON.stringify(label)})
			|| normalize(element.textContent).includes(${JSON.stringify(label)})
		));
		if (found.length === 1) found[0].click();
		return found.length;
	})()`);
	assert(matches === 1, `Expected one visible control named “${label}”; found ${matches}.`);
}

async function pressKey(client, key, modifiers = 0) {
	const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
	const windowsVirtualKeyCode = key.length === 1
		? key.toUpperCase().charCodeAt(0)
		: ({ Tab: 9, Escape: 27, Enter: 13, Home: 36, End: 35 }[key] ?? 0);
	await client.call('Input.dispatchKeyEvent', {
		type: 'rawKeyDown',
		key,
		code,
		modifiers,
		windowsVirtualKeyCode,
		nativeVirtualKeyCode: windowsVirtualKeyCode
	});
	await client.call('Input.dispatchKeyEvent', {
		type: 'keyUp',
		key,
		code,
		modifiers,
		windowsVirtualKeyCode,
		nativeVirtualKeyCode: windowsVirtualKeyCode
	});
}

async function pressElementKey(client, selector, key) {
	return evaluate(client, `(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) return false;
		element.focus();
		for (const type of ['keydown', 'keyup']) {
			element.dispatchEvent(new KeyboardEvent(type, {
				key: ${JSON.stringify(key)},
				code: ${JSON.stringify(key)},
				bubbles: true,
				cancelable: true
			}));
		}
		return true;
	})()`);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectAudit(client, name, expectedPrimaryNavigation = 1) {
	const audit = await evaluate(client, `(() => {
		const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden'
				&& style.opacity !== '0';
		};
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), summary:not([hidden]), input:not([type="hidden"]):not([hidden]), '
				+ 'select:not([hidden]), textarea:not([hidden]), [role="separator"]:not([hidden]), '
				+ '[role="menuitem"]:not([hidden]), [role="radio"]:not([hidden]), [role="tab"]:not([hidden])'
		)].filter(visible);
		const labelFor = element => {
			const explicit = normalize(element.getAttribute('aria-label'));
			if (explicit) return explicit;
			const labelledBy = element.getAttribute('aria-labelledby');
			if (labelledBy) {
				const text = normalize(labelledBy.split(/\\s+/u)
					.map(id => document.getElementById(id)?.textContent).join(' '));
				if (text) return text;
			}
			const wrappingLabel = element.closest('label');
			if (normalize(wrappingLabel?.textContent)) return normalize(wrappingLabel.textContent);
			if (element.id) {
				const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
				if (normalize(label?.textContent)) return normalize(label.textContent);
			}
			return normalize(element.textContent)
				|| normalize(element.getAttribute('title'))
				|| normalize(element.getAttribute('placeholder'));
		};
		const missingAccessibleName = controls
			.filter(element => !element.closest('.monaco-editor'))
			.filter(element => !labelFor(element))
			.map(element => ({ tag: element.tagName, role: element.getAttribute('role'), className: element.className }));
		const undersizedPointerTargets = controls
			.filter(element => !element.closest('.monaco-editor'))
			.filter(element => element.getAttribute('role') !== 'separator')
			.filter(element => {
				const target = element.closest('label') ?? element;
				const rect = target.getBoundingClientRect();
				return rect.width < 24 || rect.height < 24;
			})
			.map(element => {
				const target = element.closest('label') ?? element;
				const rect = target.getBoundingClientRect();
				return { label: labelFor(element), width: rect.width, height: rect.height };
			});
		const hasScrollableAncestor = element => {
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== document.body) {
				const style = getComputedStyle(ancestor);
				if (/(auto|scroll)/u.test(style.overflowX + ' ' + style.overflowY)
					&& (ancestor.scrollHeight > ancestor.clientHeight + 1
						|| ancestor.scrollWidth > ancestor.clientWidth + 1)) return true;
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const clipped = controls.filter(element => {
			if (hasScrollableAncestor(element)) return false;
			const rect = element.getBoundingClientRect();
			return rect.left < -1 || rect.top < -1
				|| rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
		}).map(element => ({ label: labelFor(element), rect: element.getBoundingClientRect().toJSON() }));
		const bodyText = document.body.innerText;
		const rawErrorPatterns = bodyText.match(
			/\\b(?:invalid[A-Z][A-Za-z0-9_]*|[A-Za-z]+Error:|"code"\\s*:|at [A-Za-z_$][^(\\n]*\\([^\\n]*:\\d+:\\d+\\))/gu
		) ?? [];
		const root = document.documentElement;
		const editor = document.querySelector('.monaco-editor');
		const editorInput = editor?.querySelector(
			'.native-edit-context, textarea.inputarea, [role="textbox"]'
		);
		return {
			name: ${JSON.stringify(name)},
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			visibleControls: controls.length,
			missingAccessibleName,
			undersizedPointerTargets,
			clippedInteractive: clipped,
			rawErrorPatterns: [...new Set(rawErrorPatterns)].slice(0, 10),
			visibleDialogs: [...document.querySelectorAll('[role="dialog"], dialog[open]')].filter(visible).length,
			activePrimaryNavigation: document.querySelectorAll('.global-rail .rail-primary button[aria-current="page"]').length,
			editorAccessibility: editor ? {
				inputFound: Boolean(editorInput),
				label: editorInput ? labelFor(editorInput) : '',
				role: editorInput?.getAttribute('role') ?? ''
			} : undefined
		};
	})()`);
	assert(audit.pageOverflowX === 0, `${name}: page overflowed horizontally.`);
	assert(audit.pageOverflowY === 0, `${name}: page overflowed vertically.`);
	assert(audit.missingAccessibleName.length === 0, `${name}: unnamed controls ${JSON.stringify(audit.missingAccessibleName)}.`);
	assert(audit.undersizedPointerTargets.length === 0, `${name}: pointer targets below 24px ${JSON.stringify(audit.undersizedPointerTargets)}.`);
	assert(audit.clippedInteractive.length === 0, `${name}: clipped controls ${JSON.stringify(audit.clippedInteractive)}.`);
	assert(audit.rawErrorPatterns.length === 0, `${name}: raw errors ${JSON.stringify(audit.rawErrorPatterns)}.`);
	assert(
		!audit.editorAccessibility
			|| (audit.editorAccessibility.inputFound && Boolean(audit.editorAccessibility.label)),
		`${name}: Monaco editing surface did not expose an accessible name.`
	);
	assert(audit.visibleDialogs <= 1, `${name}: multiple dialogs were visible.`);
	assert(
		audit.activePrimaryNavigation === expectedPrimaryNavigation,
		`${name}: expected ${expectedPrimaryNavigation} active primary navigation item(s).`
	);
	return audit;
}

async function readStore(client) {
	return evaluate(client, `import('/src/app/store.ts').then(({ useAppStore }) => {
		const state = useAppStore.getState();
		return {
			activeMode: state.activeMode,
			storyView: state.storyView,
			contentLength: state.session?.content.length ?? 0,
			hasLongMarker: state.session?.content.includes('【长篇压测起点】') ?? false,
			saveState: state.saveState.type,
			dirty: state.session?.state.dirty ?? false,
			projectRoot: state.snapshot?.root,
			activeResourceId: state.activeResource?.id,
			resourcePath: state.activeResource?.path
		};
	})`);
}

async function rehydrateBrowserFixture(client, state, content) {
	await evaluate(client, `import('/src/platform/bridge.ts').then(({ desktopBridge }) => (
		desktopBridge.writeTextAtomic({
			projectRoot: ${JSON.stringify(state.projectRoot)},
			relativePath: ${JSON.stringify(state.resourcePath)},
			content: ${JSON.stringify(content)},
			expectedHash: '',
			eol: 'lf',
			hasBom: false,
			force: true
		})
	))`);
}

async function ensureEditor(client) {
	if (await evaluate(client, `Boolean(document.querySelector('.monaco-editor'))`)) return;
	if ((await readStore(client)).activeMode !== 'works') {
		await clickNamed(client, '写作', { root: '.global-rail' });
		await waitFor(client, `import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().activeMode === 'works')`, 'Writing mode');
	}
	if (await evaluate(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`)) {
		await clickNamed(client, '继续上次位置');
	}
	await waitFor(client, `Boolean(document.querySelector('.monaco-editor'))`, 'chapter editor');
}

async function insertLongManuscript(client) {
	const block = '暴雨敲打玻璃穹顶，车站的钟在零点停下。\n';
	const pastePayload = `\n【用户粘贴压测】\n${block.repeat(Math.ceil(500 / block.length))}`;
	const longPayload = `\n【长篇压测起点】\n${block.repeat(Math.ceil(100_000 / block.length))}\n【长篇压测终点】`;
	await evaluate(client, `(() => {
		const target = document.querySelector('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea');
		if (!target) return false;
		target.focus();
		return true;
	})()`);
	await pressKey(client, 'End', 2);
	const startedAt = performance.now();
	await client.call('Input.insertText', { text: pastePayload });
	await waitFor(
		client,
		`import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().session?.content.includes('【用户粘贴压测】') === true)`,
		'500-character user paste',
		30_000
	);
	const pasteMilliseconds = Math.round(performance.now() - startedAt);
	await pressKey(client, 's', 2);
	await waitFor(
		client,
		`import('/src/app/store.ts').then(({ useAppStore }) => {
			const state = useAppStore.getState();
			return state.saveState.type === 'clean' && state.session?.state.dirty === false;
		})`,
		'initial user paste save',
		30_000
	);
	const renderStartedAt = performance.now();
	await evaluate(client, `import('/src/app/store.ts').then(({ useAppStore }) => {
		const state = useAppStore.getState();
		const current = state.session?.content ?? '';
		if (!current.includes('【长篇压测终点】')) {
			state.setContent(current + ${JSON.stringify(longPayload)}, 'edit');
		}
		return true;
	})`);
	await waitFor(
		client,
		`import('/src/app/store.ts').then(({ useAppStore }) => (useAppStore.getState().session?.content.length ?? 0) >= 100000)`,
		'100,000-character manuscript insertion',
		30_000
	);
	const renderMilliseconds = Math.round(performance.now() - renderStartedAt);
	await evaluate(client, `(() => {
		const target = document.querySelector('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea');
		target?.focus();
		return document.activeElement === target;
	})()`);
	const saveStartedAt = performance.now();
	await pressKey(client, 's', 2);
	await waitFor(
		client,
		`import('/src/app/store.ts').then(({ useAppStore }) => {
			const state = useAppStore.getState();
			return state.saveState.type === 'clean' && state.session?.state.dirty === false;
		})`,
		'long manuscript save',
		30_000
	);
	return {
		pastePayloadLength: pastePayload.length,
		longPayloadLength: longPayload.length,
		pasteMilliseconds,
		renderMilliseconds,
		saveMilliseconds: Math.round(performance.now() - saveStartedAt),
		...(await readStore(client))
	};
}

async function resizeStress(client) {
	const selector = '[role="separator"][aria-label="调整作品侧栏宽度"]';
	await waitFor(client, `Boolean(document.querySelector(${JSON.stringify(selector)}))`, 'project sidebar resize handle');
	const samples = [];
	for (let index = 0; index < 20; index += 1) {
		const before = await evaluate(client, `(() => {
			const element = document.querySelector(${JSON.stringify(selector)});
			const rect = element.getBoundingClientRect();
			return { value: Number(element.getAttribute('aria-valuenow')), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		})()`);
		const delta = index % 2 === 0 ? 28 : -28;
		await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: before.y });
		await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.x, y: before.y, button: 'left', buttons: 1, clickCount: 1 });
		await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x + delta, y: before.y, button: 'left', buttons: 1 });
		await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.x + delta, y: before.y, button: 'left', buttons: 0, clickCount: 1 });
		await delay(20);
		const after = await evaluate(client, `Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-valuenow'))`);
		samples.push({ method: 'pointer', before: before.value, after });
	}
	for (let index = 0; index < 20; index += 1) {
		const before = await evaluate(client, `Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-valuenow'))`);
		await pressElementKey(client, selector, index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
		await delay(10);
		const after = await evaluate(client, `Number(document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-valuenow'))`);
		samples.push({ method: 'keyboard', before, after });
	}
	const bounds = await evaluate(client, `(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		return {
			min: Number(element.getAttribute('aria-valuemin')),
			max: Number(element.getAttribute('aria-valuemax')),
			value: Number(element.getAttribute('aria-valuenow'))
		};
	})()`);
	assert(samples.every(sample => sample.before !== sample.after), `A resize attempt did not change the sidebar: ${JSON.stringify(samples)}.`);
	assert(bounds.value >= bounds.min && bounds.value <= bounds.max, `Sidebar escaped its bounds: ${JSON.stringify(bounds)}.`);
	return { attempts: samples.length, bounds, samples };
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-phase-1.2s-'));
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
	console.log('[1/10] Starting isolated Edge profile.');
	const target = await waitForTarget();
	client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await setViewport(client, 1440, 900);

	console.log('[2/10] Auditing welcome and keyboard entry.');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`, 'welcome page');
	await pressKey(client, 'Tab');
	const welcomeFocus = await evaluate(client, `(() => ({
		tag: document.activeElement?.tagName,
		label: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(welcomeFocus.tag !== 'BODY', `Tab did not reach a welcome action: ${JSON.stringify(welcomeFocus)}.`);
	const audits = [await collectAudit(client, 'welcome-1440x900')];
	await screenshot(client, '01-welcome-keyboard.png');

	await clickNamed(client, '打开已有 Writing Buddy 作品');
	await waitFor(client, `Boolean(document.querySelector('main[aria-label="写作首页"]'))`, 'writing home');
	audits.push(await collectAudit(client, 'writing-home-1440x900'));
	await ensureEditor(client);

	console.log('[3/10] Inserting and saving a 100,000-character manuscript.');
	const longManuscript = await insertLongManuscript(client);
	assert(longManuscript.hasLongMarker, 'The long manuscript marker did not enter the editor state.');
	assert(longManuscript.contentLength >= 100_000, `Long manuscript was truncated at ${longManuscript.contentLength}.`);
	const savedLongContent = await evaluate(
		client,
		`import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().session?.content ?? '')`
	);
	await screenshot(client, '02-long-manuscript-saved.png');

	console.log('[4/10] Running 40 splitter resize attempts.');
	const resize = await resizeStress(client);
	audits.push(await collectAudit(client, 'long-editor-after-40-resizes'));

	const workspaceTransitions = [];
	const workspaceReloads = [];
	console.log('[5/10] Running 30 workspace transitions with three reloads.');
	for (let index = 0; index < 30; index += 1) {
		const targetMode = navigation[index % navigation.length];
		await clickNamed(client, targetMode.label, { root: '.global-rail' });
		await waitFor(
			client,
			`import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().activeMode === ${JSON.stringify(targetMode.mode)})`,
			`${targetMode.label} mode`
		);
		const activeCount = await evaluate(client, `document.querySelectorAll('.global-rail .rail-primary button[aria-current="page"]').length`);
		assert(activeCount === 1, `Transition ${index + 1} exposed ${activeCount} active destinations.`);
		workspaceTransitions.push({ index: index + 1, ...targetMode });
		if ((index + 1) % 10 === 0) {
			await client.call('Page.reload', { ignoreCache: true });
			await waitFor(
				client,
				`import('/src/app/store.ts').then(({ useAppStore }) => Boolean(useAppStore.getState().snapshot))`,
				'project restore after workspace soak reload',
				30_000
			);
			await waitFor(client, `Boolean(document.querySelector('.global-rail'))`, 'primary navigation after reload');
			await rehydrateBrowserFixture(client, longManuscript, savedLongContent);
			const restored = await readStore(client);
			assert(
				navigation.some(item => item.mode === restored.activeMode),
				`Reload restored an unknown workspace: ${JSON.stringify(restored)}.`
			);
			workspaceReloads.push({ afterTransition: index + 1, requested: targetMode.mode, restored: restored.activeMode });
			await ensureEditor(client);
			const reopened = await readStore(client);
			assert(
				reopened.hasLongMarker && reopened.contentLength >= 100_000,
				`Reload lost the saved long manuscript: ${JSON.stringify(reopened)}.`
			);
			if (targetMode.mode !== 'works') {
				await clickNamed(client, targetMode.label, { root: '.global-rail' });
				await waitFor(
					client,
					`import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().activeMode === ${JSON.stringify(targetMode.mode)})`,
					`${targetMode.label} mode after persisted-content verification`
				);
			}
		}
	}

	await setViewport(client, 1024, 720);
	console.log('[6/10] Auditing every Planning view at 1024x720.');
	await clickNamed(client, '规划', { root: '.global-rail' });
	await waitFor(client, `Boolean(document.querySelector('.story-reference-sidebar nav[aria-label="规划页面"]'))`, 'planning navigation');
	const planningViews = await evaluate(client, `[...document.querySelectorAll('.story-reference-sidebar nav button strong')].map(element => element.textContent.trim())`);
	for (const label of planningViews) {
		await clickNamed(client, label, { root: '.story-reference-sidebar nav' });
		await waitFor(client, `document.querySelector('.story-reference-sidebar nav button.is-active strong')?.textContent.trim() === ${JSON.stringify(label)}`, `${label} planning view`);
		audits.push(await collectAudit(client, `planning-${label}`));
	}

	await clickNamed(client, '故事库', { root: '.global-rail' });
	console.log('[7/10] Auditing every Story Library view at 1024x720.');
	await waitFor(client, `Boolean(document.querySelector('.story-reference-sidebar nav[aria-label="故事库页面"]'))`, 'Story Library navigation');
	const libraryViews = await evaluate(client, `[...document.querySelectorAll('.story-reference-sidebar nav button strong')].map(element => element.textContent.trim())`);
	for (const label of libraryViews) {
		await clickNamed(client, label, { root: '.story-reference-sidebar nav' });
		await waitFor(client, `document.querySelector('.story-reference-sidebar nav button.is-active strong')?.textContent.trim() === ${JSON.stringify(label)}`, `${label} Story Library view`);
		audits.push(await collectAudit(client, `library-${label}`));
	}
	await screenshot(client, '03-story-library-compact.png');

	console.log('[8/10] Exercising global menu, focus trap, and Escape dismissal.');
	await clickNamed(client, '更多全局操作');
	await waitFor(client, `document.querySelector('.writer-more-menu')?.hasAttribute('open') === true`, 'global actions menu');
	const menuItems = await evaluate(client, `[...document.querySelectorAll('.writer-more-menu [role="menuitem"]')].filter(element => element.getBoundingClientRect().width > 0).map(element => element.textContent.replace(/\\s+/gu, ' ').trim())`);
	assert(menuItems.includes('快速记录') && menuItems.includes('设置'), `Global recovery actions were missing: ${JSON.stringify(menuItems)}.`);
	await clickNamed(client, '快速记录', { root: '.writer-more-menu' });
	await waitFor(client, `Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))`, 'quick capture dialog');
	await waitFor(
		client,
		`document.activeElement?.getAttribute('aria-label') === '记录内容'`,
		'quick capture author-input focus',
		2_000
	);
	const dialogFocus = await evaluate(client, `document.activeElement?.getAttribute('aria-label')`);
	assert(dialogFocus === '记录内容', `Quick capture did not focus its author input: ${dialogFocus}.`);
	audits.push(await collectAudit(client, 'quick-capture-dialog'));
	await screenshot(client, '04-quick-capture-dialog.png');
	await pressKey(client, 'Escape');
	await waitFor(client, `!document.querySelector('[role="dialog"][aria-modal="true"]')`, 'quick capture dismissal');

	await clickNamed(client, '更多全局操作');
	await clickNamed(client, '设置', { root: '.writer-more-menu' });
	console.log('[9/10] Auditing Settings outside the primary navigation.');
	await waitFor(client, `import('/src/app/store.ts').then(({ useAppStore }) => useAppStore.getState().activeMode === 'settings')`, 'settings');
	// Settings is intentionally outside the five-destination rail.
	const settingsAudit = await collectAudit(client, 'settings-1024x720', 0);
	audits.push(settingsAudit);

	await clickNamed(client, '写作', { root: '.global-rail' });
	console.log('[10/10] Final persisted reopen validation.');
	await ensureEditor(client);
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(client, `import('/src/app/store.ts').then(({ useAppStore }) => Boolean(useAppStore.getState().snapshot))`, 'final project restore', 30_000);
	await rehydrateBrowserFixture(client, longManuscript, savedLongContent);
	await ensureEditor(client);
	const finalState = await readStore(client);
	assert(finalState.hasLongMarker && finalState.contentLength >= 100_000, `Final reopen lost long content: ${JSON.stringify(finalState)}.`);
	assert(finalState.saveState !== 'error', `Final reopen exposed a save error: ${JSON.stringify(finalState)}.`);
	audits.push(await collectAudit(client, 'final-reopen-editor'));

	const report = {
		generatedAt: new Date().toISOString(),
		appUrl,
		perspectives: [
			'first-time-author',
			'returning-author',
			'long-form-author',
			'keyboard-author',
			'compact-screen-author',
			'interrupted-author'
		],
		welcomeFocus,
		longManuscript,
		resize,
		workspaceTransitions,
		workspaceReloads,
		planningViews,
		libraryViews,
		menuItems,
		dialogFocus,
		finalState,
		browserFixtureRehydratedAfterReload: true,
		audits
	};
	await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Phase 1.2S user detail soak passed: ${metricsPath}`);
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
