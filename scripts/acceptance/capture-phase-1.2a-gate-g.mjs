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
	'gate-writer-g'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'gate-writer-g-visual-metrics.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = Number(process.env.GATE_G_CDP_PORT ?? 9371);
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
			if (message.error) {
				pending.reject(new Error(`${message.error.message} (${pending.method})`));
			} else {
				pending.resolve(message.result);
			}
		});
	}

	call(method, params = {}) {
		return new Promise((resolveCall, reject) => {
			const id = this.nextId++;
			this.pending.set(id, { method, resolve: resolveCall, reject });
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

const normalizeTextExpression = `
	const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
`;

async function clickButton(client, label) {
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const label = ${JSON.stringify(label)};
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => (
				(
					normalize(button.getAttribute('aria-label')) === label
					|| normalize(button.textContent) === label
				)
				&& button.getBoundingClientRect().width > 0
				&& button.getBoundingClientRect().height > 0
			));
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(result === 1, `Expected one visible button named “${label}”; found ${result}.`);
}

async function focusButton(client, label) {
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const label = ${JSON.stringify(label)};
		const matches = [...document.querySelectorAll('button:not([hidden])')]
			.filter(button => (
				(
					normalize(button.getAttribute('aria-label')) === label
					|| normalize(button.textContent) === label
				)
				&& button.getBoundingClientRect().width > 0
				&& button.getBoundingClientRect().height > 0
			));
		if (matches.length === 1) matches[0].focus();
		return {
			count: matches.length,
			focused: matches.length === 1 && document.activeElement === matches[0]
		};
	})()`);
	assert(result.count === 1 && result.focused, `Could not focus “${label}”.`);
}

const keyDefinitions = {
	' ': { code: 'Space', virtualKey: 32 },
	ArrowDown: { code: 'ArrowDown', virtualKey: 40 },
	Escape: { code: 'Escape', virtualKey: 27 },
	F11: { code: 'F11', virtualKey: 122 },
	a: { code: 'KeyA', virtualKey: 65 },
	k: { code: 'KeyK', virtualKey: 75 },
	n: { code: 'KeyN', virtualKey: 78 },
	s: { code: 'KeyS', virtualKey: 83 }
};

async function pressKey(client, key, modifiers = 0) {
	const definition = keyDefinitions[key];
	assert(definition, `No CDP key definition for ${key}.`);
	const common = {
		key,
		code: definition.code,
		modifiers,
		windowsVirtualKeyCode: definition.virtualKey,
		nativeVirtualKeyCode: definition.virtualKey
	};
	await client.call('Input.dispatchKeyEvent', {
		type: key === ' ' ? 'keyDown' : 'rawKeyDown',
		text: key === ' ' ? ' ' : undefined,
		unmodifiedText: key === ' ' ? ' ' : undefined,
		...common
	});
	await client.call('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
}

async function pressShortcut(
	client,
	{ key, code, ctrlKey = false, shiftKey = false, altKey = false }
) {
	await evaluate(client, `(() => {
		const init = ${JSON.stringify({
			key,
			code,
			ctrlKey,
			shiftKey,
			altKey
		})};
		window.dispatchEvent(new KeyboardEvent('keydown', {
			...init,
			bubbles: true,
			cancelable: true
		}));
		window.dispatchEvent(new KeyboardEvent('keyup', {
			...init,
			bubbles: true,
			cancelable: true
		}));
		return true;
	})()`);
}

async function pressFocusedEscape(client) {
	await evaluate(client, `(() => {
		const target = document.activeElement instanceof HTMLElement
			? document.activeElement
			: document.body;
		target.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'Escape',
			code: 'Escape',
			bubbles: true,
			cancelable: true
		}));
		target.dispatchEvent(new KeyboardEvent('keyup', {
			key: 'Escape',
			code: 'Escape',
			bubbles: true,
			cancelable: true
		}));
		return true;
	})()`);
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

async function collectViewportMetrics(client) {
	return evaluate(client, `(() => {
		const root = document.documentElement;
		const viewport = { width: innerWidth, height: innerHeight };
		const isVisible = element => {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return style.visibility !== 'hidden'
				&& style.display !== 'none'
				&& rect.width > 0
				&& rect.height > 0;
		};
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), input:not([hidden]), select:not([hidden]), '
				+ 'textarea:not([hidden]), [role="button"]:not([hidden]), '
				+ '[role="tab"]:not([hidden]), [role="menuitem"]:not([hidden])'
		)].filter(isVisible);
		const hasScrollableAncestor = element => {
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== document.body) {
				const style = getComputedStyle(ancestor);
				if (
					/(auto|scroll)/u.test(style.overflowY)
					&& ancestor.scrollHeight > ancestor.clientHeight + 1
				) return true;
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const clippedInteractiveDetails = controls.flatMap(element => {
			const rect = element.getBoundingClientRect();
			if (
				rect.left >= -1
				&& rect.top >= -1
				&& rect.right <= innerWidth + 1
				&& rect.bottom <= innerHeight + 1
			) return [];
			if (hasScrollableAncestor(element)) return [];
			return [{
				label: element.getAttribute('aria-label')
					?? element.textContent?.replace(/\\s+/gu, ' ').trim().slice(0, 80),
				rect: {
					left: Math.round(rect.left),
					top: Math.round(rect.top),
					right: Math.round(rect.right),
					bottom: Math.round(rect.bottom)
				}
			}];
		});
		return {
			viewport,
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clippedInteractiveDetails.length,
			clippedInteractiveDetails,
			visibleControls: controls.length,
			domNodes: document.querySelectorAll('*').length
		};
	})()`);
}

async function openFixture(client) {
	await evaluate(client, 'localStorage.clear(); sessionStorage.clear(); true');
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(
		client,
		`[...document.querySelectorAll('button')].some(button => (
			button.textContent?.replace(/\\s+/gu, ' ').trim() === '打开已有 Writing Buddy 作品'
		))`,
		'welcome project opener'
	);
	const openerClicked = await evaluate(client, `(() => {
		const welcome = document.querySelector('main[aria-label="开始使用 Writing Buddy"]');
		if (!welcome) return false;
		const opener = [...welcome.querySelectorAll('button')].find(button => (
			button.textContent?.replace(/\\s+/gu, ' ').trim() === '打开已有 Writing Buddy 作品'
		));
		opener?.click();
		return Boolean(opener);
	})()`);
	assert(openerClicked, 'The project welcome opener was not available.');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`,
		'project dashboard'
	);
	await clickButton(client, '继续上次位置');
	await waitFor(
		client,
		`Boolean(document.querySelector('.writing-canvas .monaco-editor'))`,
		'manuscript editor',
		20_000
	);
}

async function validateDragFeedback(client) {
	const dragStart = await evaluate(client, `(() => {
		const handle = document.querySelector(
			'.tree-drag-handle[aria-label^="拖动章节："]'
		);
		if (!handle) return undefined;
		const rect = handle.getBoundingClientRect();
		return {
			label: handle.getAttribute('aria-label'),
			beforeOpacity: getComputedStyle(handle).opacity,
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		};
	})()`);
	assert(dragStart, 'No chapter drag handle was rendered.');
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		x: dragStart.x,
		y: dragStart.y
	});
	await delay(150);
	const afterHoverOpacity = await evaluate(
		client,
		`getComputedStyle(document.querySelector(
			'.tree-drag-handle[aria-label^="拖动章节："]'
		)).opacity`
	);
	assert(Number(dragStart.beforeOpacity) === 0, 'Drag handle must be hidden before hover.');
	assert(Number(afterHoverOpacity) === 1, 'Drag handle must be visible after hover.');
	await evaluate(client, `document.querySelector(
		'.tree-drag-handle[aria-label^="拖动章节："]'
	).focus(); true`);
	await pressKey(client, ' ');
	await waitFor(
		client,
		`Boolean(document.querySelector(
			'.tree-row[data-interaction-state="drag-source"]'
		))`,
		'keyboard drag pickup'
	);
	const keyboardPickup = await evaluate(
		client,
		`Boolean(document.querySelector(
			'.tree-row[data-interaction-state="drag-source"]'
		))`
	);
	await client.call('Page.reload', { ignoreCache: false });
	await waitFor(
		client,
		`Boolean(
			document.querySelector('.writing-canvas .monaco-editor')
			|| document.querySelector('main[aria-label="写作首页"]')
		)`,
		'workspace reload'
	);
	const dashboardVisible = await evaluate(
		client,
		`Boolean(document.querySelector('main[aria-label="写作首页"]'))`
	);
	if (dashboardVisible) {
		await clickButton(client, '继续上次位置');
	}
	await waitFor(
		client,
		`Boolean(document.querySelector('.writing-canvas .monaco-editor'))`,
		'manuscript after keyboard-drag reset',
		20_000
	);
	const pointerPath = await evaluate(client, `(() => {
		const handles = [...document.querySelectorAll(
			'.tree-drag-handle[aria-label^="拖动章节："]'
		)];
		if (handles.length < 2) return undefined;
		const start = handles[0].getBoundingClientRect();
		const target = handles[1].closest('.tree-row').getBoundingClientRect();
		return {
			start: {
				x: start.left + start.width / 2,
				y: start.top + start.height / 2
			},
			target: {
				x: target.left + target.width / 2,
				y: target.top + target.height / 2
			}
		};
	})()`);
	assert(pointerPath, 'The fixture needs at least two chapters for drag acceptance.');
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		...pointerPath.start
	});
	await client.call('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		button: 'left',
		buttons: 1,
		clickCount: 1,
		...pointerPath.start
	});
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		button: 'left',
		buttons: 1,
		x: (pointerPath.start.x + pointerPath.target.x) / 2,
		y: (pointerPath.start.y + pointerPath.target.y) / 2
	});
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseMoved',
		button: 'left',
		buttons: 1,
		...pointerPath.target
	});
	await waitFor(
		client,
		`Boolean(document.querySelector('.interaction-drop-indicator-label'))`,
		'pointer semantic drop preview'
	);
	const preview = await evaluate(client, `(() => {
		const label = document.querySelector('.interaction-drop-indicator-label')
			?.textContent?.replace(/\\s+/gu, ' ').trim();
		const liveText = [...document.querySelectorAll('[role="status"]')]
			.map(node => node.textContent?.replace(/\\s+/gu, ' ').trim())
			.filter(Boolean);
		return { label, liveText };
	})()`);
	assert(preview.label?.startsWith('移动到“'), `Unexpected drag preview: ${preview.label}`);
	await screenshot(client, '01-semantic-drag-preview-1536x992.png');
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		button: 'left',
		buttons: 0,
		clickCount: 1,
		...pointerPath.target
	});
	await waitFor(
		client,
		`document.querySelector(
			'.interaction-undo-toast strong'
		)?.textContent?.trim() === '章节已移动并保存'`,
		'persisted drag result'
	);
	const result = await evaluate(client, `(() => {
		const toast = document.querySelector('.interaction-undo-toast');
		return {
			title: toast.querySelector('strong')?.textContent?.trim(),
			message: toast.querySelector('small')?.textContent?.replace(/\\s+/gu, ' ').trim(),
			undoLabel: [...toast.querySelectorAll('button')]
				.find(button => button.textContent?.trim() === '撤销')
				?.textContent?.trim()
		};
	})()`);
	assert(
		result.message?.includes('顺序') && result.message?.includes('父级'),
		`Drag result did not explain order and parent effects: ${result.message}`
	);
	assert(result.undoLabel === '撤销', 'Drag result did not expose Undo.');
	await clickButton(client, '撤销');
	await waitFor(
		client,
		`!document.querySelector('.interaction-undo-toast')`,
		'drag undo'
	);
	return {
		...dragStart,
		afterHoverOpacity,
		keyboardPickup,
		preview,
		result,
		undone: true
	};
}

async function validateShortcutFocus(client) {
	await focusButton(client, '新建章节');
	await pressShortcut(client, {
		key: 'n',
		code: 'KeyN',
		ctrlKey: true,
		shiftKey: true
	});
	await waitFor(
		client,
		`Boolean(document.querySelector('[role="menu"][aria-label="新建内容"]'))`,
		'quick-create menu'
	);
	const quickCreate = await evaluate(client, `(() => ({
		firstItem: document.activeElement?.textContent?.replace(/\\s+/gu, ' ').trim(),
		menuInsideViewport: (() => {
			const rect = document.querySelector(
				'[role="menu"][aria-label="新建内容"]'
			).getBoundingClientRect();
			return rect.left >= 0 && rect.top >= 0
				&& rect.right <= innerWidth && rect.bottom <= innerHeight;
		})()
	}))()`);
	assert(quickCreate.firstItem?.includes('新建项目'), 'Quick create did not focus its first item.');
	assert(quickCreate.menuInsideViewport, 'Quick-create menu is outside the viewport.');
	await pressFocusedEscape(client);
	await waitFor(
		client,
		`!document.querySelector('[role="menu"][aria-label="新建内容"]')`,
		'quick-create close'
	);
	const quickCreateFocusRestored = await evaluate(
		client,
		`document.activeElement?.getAttribute('aria-label') === '新建章节'`
	);
	assert(quickCreateFocusRestored, 'Quick-create did not restore its exact focus origin.');

	await pressShortcut(client, { key: 'a', code: 'KeyA', altKey: true });
	await waitFor(
		client,
		`Boolean(document.querySelector(
			'[role="dialog"][aria-labelledby="ai-generation-title"]'
		))`,
		'AI quick-actions dialog'
	);
	const ai = await evaluate(client, `(() => ({
		idle: document.querySelector(
			'[role="dialog"][aria-labelledby="ai-generation-title"]'
		)?.textContent?.includes('等待开始') ?? false,
		focusInside: document.querySelector(
			'[role="dialog"][aria-labelledby="ai-generation-title"]'
		)?.contains(document.activeElement) ?? false
	}))()`);
	assert(ai.idle, 'Alt+A unexpectedly started an AI job.');
	assert(ai.focusInside, 'AI quick actions did not receive focus.');
	await pressFocusedEscape(client);
	await waitFor(
		client,
		`!document.querySelector(
			'[role="dialog"][aria-labelledby="ai-generation-title"]'
		)`,
		'AI quick-actions close'
	);
	const aiFocusRestored = await evaluate(
		client,
		`document.activeElement?.getAttribute('aria-label') === '新建章节'`
	);
	assert(aiFocusRestored, 'AI quick actions did not restore focus.');

	await pressShortcut(client, { key: 'n', code: 'KeyN', ctrlKey: true });
	await waitFor(
		client,
		`Boolean(document.querySelector(
			'[role="dialog"][aria-labelledby="chapter-create-title"]'
		))`,
		'chapter-creation dialog'
	);
	const chapterDialog = await evaluate(client, `(() => {
		const dialog = document.querySelector(
			'[role="dialog"][aria-labelledby="chapter-create-title"]'
		);
		const rect = dialog.getBoundingClientRect();
		const controls = [...dialog.querySelectorAll('button, input, select')]
			.filter(element => {
				const style = getComputedStyle(element);
				const target = element.getBoundingClientRect();
				return style.display !== 'none' && target.width > 0 && target.height > 0;
			});
		return {
			inputFocused: document.activeElement?.getAttribute('aria-label') === '章节标题',
			insideViewport: rect.left >= 0 && rect.top >= 0
				&& rect.right <= innerWidth && rect.bottom <= innerHeight,
			undersizedControls: controls.flatMap(element => {
				const target = element.getBoundingClientRect();
				return target.width < 44 || target.height < 44
					? [{
						label: element.getAttribute('aria-label')
							?? element.textContent?.replace(/\\s+/gu, ' ').trim(),
						width: Math.round(target.width),
						height: Math.round(target.height)
					}]
					: [];
			})
		};
	})()`);
	assert(chapterDialog.inputFocused, 'Ctrl+N did not focus the chapter title.');
	assert(chapterDialog.insideViewport, 'Chapter dialog is outside the viewport.');
	assert(
		chapterDialog.undersizedControls.length === 0,
		`Chapter dialog has undersized controls: ${JSON.stringify(
			chapterDialog.undersizedControls
		)}`
	);
	await screenshot(client, '02-chapter-shortcut-focus-1280x800.png');
	await pressFocusedEscape(client);
	await waitFor(
		client,
		`!document.querySelector(
			'[role="dialog"][aria-labelledby="chapter-create-title"]'
		)`,
		'chapter-creation close'
	);
	const chapterFocusRestored = await evaluate(
		client,
		`document.activeElement?.getAttribute('aria-label') === '新建章节'`
	);
	assert(chapterFocusRestored, 'Chapter dialog did not restore focus.');
	return {
		quickCreate,
		quickCreateFocusRestored,
		ai,
		aiFocusRestored,
		chapterDialog,
		chapterFocusRestored
	};
}

async function validateCompactReducedMotion(client) {
	await focusButton(client, '新建章节');
	await pressShortcut(client, { key: 's', code: 'KeyS', ctrlKey: true });
	await pressShortcut(client, { key: 'F11', code: 'F11' });
	await waitFor(
		client,
		`document.querySelector('.app-shell')?.classList.contains('is-focus-mode')`,
		'focus mode'
	);
	const focusMode = await evaluate(client, `({
		editorVisible: Boolean(document.querySelector('.writing-canvas .monaco-editor')),
		globalNavigationVisible: Boolean(document.querySelector(
			'nav[aria-label="全局导航"]'
		)),
		exitButtonVisible: Boolean(document.querySelector(
			'button[aria-label="退出专注"]'
		))
	})`);
	assert(
		focusMode.editorVisible && !focusMode.globalNavigationVisible && focusMode.exitButtonVisible,
		'F11 focus mode did not preserve the editor-only workspace.'
	);
	await pressFocusedEscape(client);
	await waitFor(
		client,
		`!document.querySelector('.app-shell')?.classList.contains('is-focus-mode')`,
		'focus-mode exit'
	);

	await client.call('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
	});
	await pressShortcut(client, { key: 'n', code: 'KeyN', ctrlKey: true });
	await waitFor(
		client,
		`Boolean(document.querySelector(
			'[role="dialog"][aria-labelledby="chapter-create-title"]'
		))`,
		'reduced-motion chapter dialog'
	);
	const reducedMotion = await evaluate(client, `(() => {
		const overlay = document.querySelector('.chapter-create-overlay');
		const dialog = document.querySelector('.chapter-create-dialog');
		return {
			matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
			overlayAnimation: getComputedStyle(overlay).animationDuration,
			dialogAnimation: getComputedStyle(dialog).animationDuration,
			overlayAnimationName: getComputedStyle(overlay).animationName,
			dialogAnimationName: getComputedStyle(dialog).animationName
		};
	})()`);
	assert(reducedMotion.matches, 'Reduced-motion media query did not match.');
	assert(
		Number.parseFloat(reducedMotion.overlayAnimation) <= 0.001
			&& Number.parseFloat(reducedMotion.dialogAnimation) <= 0.001,
		`Reduced motion retained animation: ${JSON.stringify(reducedMotion)}`
	);
	await screenshot(client, '03-compact-reduced-motion-1024x720.png');
	await pressFocusedEscape(client);
	await client.call('Emulation.setEmulatedMedia', { features: [] });
	return { focusMode, reducedMotion };
}

await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(join(tmpdir(), 'writing-buddy-gate-g-'));
const edge = spawn(edgePath, [
	`--remote-debugging-port=${port}`,
	`--user-data-dir=${profileDirectory}`,
	'--no-first-run',
	'--no-default-browser-check',
	'--disable-background-networking',
	'--disable-component-update',
	'--disable-sync',
	'--hide-crash-restore-bubble',
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
	await client.call('DOM.enable');

	await setViewport(client, 1536, 992);
	await openFixture(client);
	const drag = await validateDragFeedback(client);
	const metrics1536 = await collectViewportMetrics(client);

	await setViewport(client, 1280, 800);
	const shortcuts = await validateShortcutFocus(client);
	const metrics1280 = await collectViewportMetrics(client);

	await setViewport(client, 1024, 720);
	const compact = await validateCompactReducedMotion(client);
	const metrics1024 = await collectViewportMetrics(client);

	for (const metrics of [metrics1536, metrics1280, metrics1024]) {
		assert(metrics.pageOverflowX === 0, `Page overflowed horizontally: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Page overflowed vertically: ${JSON.stringify(metrics)}`);
		assert(
			metrics.clippedInteractive === 0,
			`Interactive controls were clipped: ${JSON.stringify(metrics.clippedInteractiveDetails)}`
		);
	}

	const report = {
		generatedAt: new Date().toISOString(),
		appUrl,
		captures: [
			{
				name: '01-semantic-drag-preview-1536x992.png',
				width: 1536,
				height: 992,
				interaction: { drag },
				...metrics1536
			},
			{
				name: '02-chapter-shortcut-focus-1280x800.png',
				width: 1280,
				height: 800,
				interaction: shortcuts,
				...metrics1280
			},
			{
				name: '03-compact-reduced-motion-1024x720.png',
				width: 1024,
				height: 720,
				interaction: compact,
				...metrics1024
			}
		]
	};
	await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Gate G browser acceptance passed: ${metricsPath}`);
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
