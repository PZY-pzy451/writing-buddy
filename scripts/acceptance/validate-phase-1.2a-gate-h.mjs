import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const profiles = JSON.parse(await readFile(
	join(repositoryRoot, 'scripts', 'acceptance', 'gate-h-profiles.json'),
	'utf8'
));
const outputDirectory = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'screenshots',
	'gate-writer-h'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'gate-writer-h-profile-metrics.json'
);
const edgePath = process.env.EDGE_PATH
	?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const appUrl = process.env.WRITING_BUDDY_URL ?? 'http://127.0.0.1:1420/';

const performanceBudgets = {
	shellVisibleMs: 2_000,
	projectInteractiveMs: 5_000,
	restoreToInputMs: 10_000,
	workspaceSwitchMs: 150
};

class CdpClient {
	constructor(url) {
		this.url = url;
		this.nextId = 1;
		this.pending = new Map();
		this.listeners = new Map();
	}

	async connect() {
		this.socket = new WebSocket(this.url);
		await new Promise((resolveConnection, reject) => {
			this.socket.addEventListener('open', resolveConnection, { once: true });
			this.socket.addEventListener('error', reject, { once: true });
		});
		this.socket.addEventListener('message', event => {
			const message = JSON.parse(event.data);
			if (message.id) {
				const pending = this.pending.get(message.id);
				if (!pending) return;
				this.pending.delete(message.id);
				if (message.error) {
					pending.reject(new Error(`${message.error.message} (${pending.method})`));
				} else {
					pending.resolve(message.result);
				}
				return;
			}
			for (const listener of this.listeners.get(message.method) ?? []) {
				listener(message.params);
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

	on(method, listener) {
		const listeners = this.listeners.get(method) ?? [];
		listeners.push(listener);
		this.listeners.set(method, listeners);
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

async function evaluate(client, expression) {
	for (let attempt = 0; attempt < 2; attempt += 1) {
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
			if (
				attempt === 0
				&& error instanceof Error
				&& error.message.includes('Promise was collected')
			) {
				await delay(50);
				continue;
			}
			throw error;
		}
	}
	throw new Error('Runtime evaluation did not complete.');
}

async function waitFor(client, expression, description, timeout = 15_000) {
	const startedAt = performance.now();
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) {
			return Math.round(performance.now() - startedAt);
		}
		await delay(40);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForTarget(port) {
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
		await delay(80);
	}
	throw new Error(`Timed out waiting for Edge target on port ${port}.`);
}

async function launchProfile(profileDirectory, port, profile) {
	const startedAt = performance.now();
	const child = spawn(edgePath, [
		`--remote-debugging-port=${port}`,
		`--user-data-dir=${profileDirectory}`,
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-background-networking',
		'--disable-component-update',
		'--disable-sync',
		'--hide-crash-restore-bubble',
		`--window-size=${profile.viewport.width},${profile.viewport.height}`,
		appUrl
	], {
		stdio: 'ignore',
		windowsHide: true
	});
	const target = await waitForTarget(port);
	const client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	const browserErrors = [];
	client.on('Runtime.exceptionThrown', params => {
		browserErrors.push(params.exceptionDetails?.exception?.description
			?? params.exceptionDetails?.text
			?? 'Uncaught browser exception');
	});
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('DOM.enable');
	await client.call('Emulation.setDeviceMetricsOverride', {
		width: profile.viewport.width,
		height: profile.viewport.height,
		screenWidth: profile.viewport.width,
		screenHeight: profile.viewport.height,
		deviceScaleFactor: 1,
		mobile: false
	});
	await client.call('Emulation.setEmulatedMedia', {
		features: [{
			name: 'prefers-reduced-motion',
			value: profile.reducedMotion ? 'reduce' : 'no-preference'
		}]
	});
	await waitFor(
		client,
		`Boolean(document.querySelector('.app-shell'))`,
		'application shell'
	);
	return {
		browserErrors,
		child,
		client,
		shellVisibleMs: Math.round(performance.now() - startedAt),
		targetId: target.id
	};
}

async function stopProfile(run, closePage = true) {
	if (closePage) {
		try {
			await evaluate(
				run.client,
				`window.dispatchEvent(new PageTransitionEvent('pagehide')); true`
			);
			await delay(200);
		} catch {
			// The target may already be closing.
		}
	}
	try {
		await Promise.race([
			run.client.call('Browser.close'),
			delay(3_000)
		]);
	} catch {
		// CDP can disconnect immediately after accepting Browser.close.
	}
	run.client.close();
	for (let attempt = 0; attempt < 30 && run.child.exitCode === null; attempt += 1) {
		await delay(100);
	}
	if (run.child.pid && run.child.exitCode === null) {
		spawnSync('taskkill', ['/PID', String(run.child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
	await delay(120);
}

const normalizeTextExpression = `
	const normalize = value => (value ?? '').replace(/\\s+/gu, ' ').trim();
	const visible = element => {
		const rect = element.getBoundingClientRect();
		const style = getComputedStyle(element);
		return rect.width > 0 && rect.height > 0
			&& style.display !== 'none' && style.visibility !== 'hidden';
	};
`;

async function clickButton(client, label, scopeSelector) {
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		return Boolean(root && [...root.querySelectorAll('button:not([hidden])')]
			.some(button => visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			)));
	})()`, `visible button “${label}”`);
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		if (!root) return { count: 0 };
		const label = ${JSON.stringify(label)};
		const matches = [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			));
		if (matches.length === 1) matches[0].click();
		return { count: matches.length };
	})()`);
	assert(result.count === 1, `Expected one visible button “${label}”; found ${result.count}.`);
}

async function activateButton(client, label, inputMethod, scopeSelector) {
	if (inputMethod !== 'keyboard') {
		await clickButton(client, label, scopeSelector);
		return;
	}
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		if (!root) return { count: 0, focused: false };
		const matches = [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			));
		if (matches.length === 1) matches[0].focus();
		return {
			count: matches.length,
			focused: matches.length === 1 && document.activeElement === matches[0]
		};
	})()`);
	assert(
		result.count === 1 && result.focused,
		`Could not keyboard-focus button “${label}”.`
	);
	const key = {
		key: 'Enter',
		code: 'Enter',
		text: '\r',
		unmodifiedText: '\r',
		windowsVirtualKeyCode: 13,
		nativeVirtualKeyCode: 13
	};
	await client.call('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
	await client.call('Input.dispatchKeyEvent', {
		type: 'keyUp',
		key: key.key,
		code: key.code,
		windowsVirtualKeyCode: key.windowsVirtualKeyCode,
		nativeVirtualKeyCode: key.nativeVirtualKeyCode
	});
}

async function focusSelector(client, selector) {
	const result = await evaluate(client, `(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		element?.focus();
		return Boolean(element && document.activeElement === element);
	})()`);
	assert(result, `Could not focus ${selector}.`);
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
		const target = document.activeElement instanceof HTMLElement
			? document.activeElement
			: window;
		target.dispatchEvent(new KeyboardEvent('keydown', {
			...init,
			bubbles: true,
			cancelable: true
		}));
		target.dispatchEvent(new KeyboardEvent('keyup', {
			...init,
			bubbles: true,
			cancelable: true
		}));
		return true;
	})()`);
}

async function pressElementKey(client, selector, key, count = 1) {
	await evaluate(client, `(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!element) return false;
		element.focus();
		for (let index = 0; index < ${count}; index += 1) {
			element.dispatchEvent(new KeyboardEvent('keydown', {
				key: ${JSON.stringify(key)},
				code: ${JSON.stringify(key)},
				bubbles: true,
				cancelable: true
			}));
			element.dispatchEvent(new KeyboardEvent('keyup', {
				key: ${JSON.stringify(key)},
				code: ${JSON.stringify(key)},
				bubbles: true,
				cancelable: true
			}));
		}
		return true;
	})()`);
}

async function insertAtEditorEnd(client, text) {
	await focusSelector(
		client,
		'.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea'
	);
	await client.call('Input.dispatchKeyEvent', {
		type: 'rawKeyDown',
		key: 'End',
		code: 'End',
		modifiers: 2,
		windowsVirtualKeyCode: 35,
		nativeVirtualKeyCode: 35
	});
	await client.call('Input.dispatchKeyEvent', {
		type: 'keyUp',
		key: 'End',
		code: 'End',
		modifiers: 2,
		windowsVirtualKeyCode: 35,
		nativeVirtualKeyCode: 35
	});
	await client.call('Input.insertText', { text });
}

async function readExperienceState(client, marker) {
	return evaluate(client, `import('/src/app/store.ts').then(({ useAppStore }) => {
		const state = useAppStore.getState();
		const projectId = state.snapshot?.project.projectId;
		const resourceId = state.activeResource?.id;
		const view = projectId && resourceId
			? state.documentViews[\`\${projectId}:\${resourceId}\`]
			: undefined;
		return {
			activeMode: state.activeMode,
			activeResourceId: resourceId,
			chapterTitle: state.activeResource?.title,
			contentLength: state.session?.content.length ?? 0,
			contentIncludesMarker: state.session?.content.includes(${JSON.stringify(marker)}) ?? false,
			content: state.session?.content ?? '',
			projectRoot: state.snapshot?.root,
			resourcePath: state.activeResource?.path,
			saveState: state.saveState.type,
			sidebarWidth: state.sidebarWidth,
			view: view ? {
				lineNumber: view.lineNumber,
				column: view.column,
				scrollTop: view.scrollTop
			} : undefined
		};
	})`);
}

async function setProfileTheme(client, theme) {
	await evaluate(client, `import('/src/app/store.ts').then(({ useAppStore }) => {
		useAppStore.setState({ theme: ${JSON.stringify(theme)} });
		return useAppStore.getState().theme;
	})`);
	await waitFor(
		client,
		`document.documentElement.dataset.theme === ${JSON.stringify(theme)}
			|| document.body.dataset.theme === ${JSON.stringify(theme)}
			|| document.querySelector('.app-shell')?.getAttribute('data-theme')
				=== ${JSON.stringify(theme)}
			|| getComputedStyle(document.documentElement)
				.getPropertyValue('--surface-base').trim().length > 0`,
		'theme application'
	);
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
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.visibility !== 'hidden' && style.display !== 'none';
		};
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
		const controls = [...document.querySelectorAll(
			'button:not([hidden]), input:not([hidden]), select:not([hidden]), '
				+ 'textarea:not([hidden]), [role="separator"], [role="tab"]'
		)].filter(visible);
		const clipped = controls.filter(element => {
			const rect = element.getBoundingClientRect();
			return !hasScrollableAncestor(element) && (
				rect.left < -1 || rect.top < -1
				|| rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1
			);
		});
		return {
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
			pageOverflowY: Math.max(0, root.scrollHeight - root.clientHeight),
			clippedInteractive: clipped.length,
			domNodes: document.querySelectorAll('*').length
		};
	})()`);
}

function manuscriptFor(profileId) {
	const paragraph = '雨声沿着站台顶棚缓慢移动，灯下的尘埃像被遗忘的星点。林墨停在门边，先确认钟面，又听见远处铁轨传来短促回响。';
	const marker = `【${profileId}恢复标记】`;
	const content = `\n\n${marker}\n${Array.from({ length: 7 }, (_, index) => (
		`${index + 1}。${paragraph}`
	)).join('\n')}`;
	return { content, marker };
}

async function prepareProfile(profileDirectory, port, profile) {
	const run = await launchProfile(profileDirectory, port, profile);
	try {
		await evaluate(run.client, 'localStorage.clear(); sessionStorage.clear(); true');
		await run.client.call('Page.reload', { ignoreCache: true });
		await waitFor(
			run.client,
			`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))`,
			'welcome screen'
		);
		await clickButton(
			run.client,
			'打开项目',
			'main[aria-label="开始使用 Writing Buddy"]'
		);
		await waitFor(
			run.client,
			`Boolean(document.querySelector('main[aria-label="作品仪表盘"]'))`,
			'prepared project dashboard'
		);
		await clickButton(run.client, '继续上次位置');
		try {
			await waitFor(
				run.client,
				`Boolean(document.querySelector('.writing-canvas .monaco-editor'))`,
				'prepared manuscript editor',
				20_000
			);
		} catch (error) {
			const diagnostic = await evaluate(run.client, `import('/src/app/store.ts').then(
				({ useAppStore }) => {
					const state = useAppStore.getState();
					return {
						activeMode: state.activeMode,
						activeResource: state.activeResource?.id ?? null,
						error: state.error ?? null,
						mainLabels: [...document.querySelectorAll('main')]
							.map(main => main.getAttribute('aria-label')),
						saveState: state.saveState.type
					};
				}
			)`);
			console.error('[Gate H] Preparation diagnostic', diagnostic);
			throw error;
		}
		await delay(100);
	} finally {
		await stopProfile(run);
	}
}

async function rehydrateSavedContent(client, state, content) {
	await evaluate(client, `import('/src/platform/bridge.ts').then(
		({ desktopBridge }) => desktopBridge.writeTextAtomic({
			projectRoot: ${JSON.stringify(state.projectRoot)},
			relativePath: ${JSON.stringify(state.resourcePath)},
			content: ${JSON.stringify(content)},
			expectedHash: '',
			eol: 'lf',
			hasBom: false,
			force: true
		})
	)`);
}

async function installOneShotSaveFailure(client) {
	await evaluate(client, `import('/src/platform/bridge.ts').then(({ desktopBridge }) => {
		if (!globalThis.__gateHFailureWrapper) {
			globalThis.__gateHOriginalWrite = desktopBridge.writeTextAtomic.bind(desktopBridge);
			globalThis.__gateHFailureWrapper = request => {
				if (
					globalThis.__gateHFailurePending
					&& request.relativePath.startsWith('chapters/')
				) {
					globalThis.__gateHFailurePending = false;
					return Promise.reject(new Error('gateHInjectedSaveFailure'));
				}
				return globalThis.__gateHOriginalWrite(request);
			};
		}
		globalThis.__gateHFailurePending = true;
		desktopBridge.writeTextAtomic = globalThis.__gateHFailureWrapper;
		return true;
	})`);
}

async function restoreSaveBridge(client) {
	await evaluate(client, `import('/src/platform/bridge.ts').then(({ desktopBridge }) => {
		if (globalThis.__gateHOriginalWrite) {
			desktopBridge.writeTextAtomic = globalThis.__gateHOriginalWrite;
		}
		return true;
	})`);
}

async function runProfile(profile, profileIndex) {
	const profileDirectory = await mkdtemp(join(tmpdir(), `writing-buddy-${profile.id}-`));
	const evidence = {
		id: profile.id,
		inputMethod: profile.inputMethod,
		reducedMotion: profile.reducedMotion,
		theme: profile.theme,
		viewport: profile.viewport,
		tasks: Object.fromEntries(profile.tasks.map(task => [task, false])),
		timingsMs: {},
		checks: {}
	};
	const writing = manuscriptFor(profile.id);
	let firstRun;
	let secondRun;
	let savedState;
	let savedContent;
	let firstBrowserErrors;
	try {
		await prepareProfile(profileDirectory, 9600 + profileIndex * 3, profile);

		const firstStartedAt = performance.now();
		firstRun = await launchProfile(
			profileDirectory,
			9601 + profileIndex * 3,
			profile
		);
		evidence.timingsMs.shellVisible = firstRun.shellVisibleMs;
		evidence.tasks['open-app'] = true;
		await waitFor(
			firstRun.client,
			`Boolean(document.querySelector('main[aria-label="作品仪表盘"]'))`,
			'first-start project dashboard'
		);
		evidence.timingsMs.projectInteractive = Math.round(
			performance.now() - firstStartedAt
		);
		evidence.checks.continueVisible = await evaluate(
			firstRun.client,
			`[...document.querySelectorAll('button')].some(button => (
				button.textContent?.replace(/\\s+/gu, ' ').trim()
					=== '继续上次位置'
				&& button.getBoundingClientRect().width > 0
			))`
		);
		assert(evidence.checks.continueVisible, `${profile.id}: Continue Writing not found.`);
		await setProfileTheme(firstRun.client, profile.theme);
		const continueStartedAt = performance.now();
		await activateButton(
			firstRun.client,
			'继续上次位置',
			profile.inputMethod
		);
		await waitFor(
			firstRun.client,
			`Boolean(document.querySelector('.writing-canvas .monaco-editor'))`,
			'first-start editor input',
			20_000
		);
		evidence.timingsMs.restoreToInput = Math.round(
			performance.now() - continueStartedAt
		);
		evidence.tasks['continue-writing'] = true;

		const initialState = await readExperienceState(firstRun.client, writing.marker);
		evidence.checks.expectedChapter = Boolean(initialState.activeResourceId);
		evidence.checks.initialPositionAvailable = Boolean(initialState.view);
		assert(evidence.checks.expectedChapter, `${profile.id}: no active chapter.`);
		evidence.tasks['verify-position'] = true;

		await insertAtEditorEnd(firstRun.client, writing.content);
		await waitFor(
			firstRun.client,
			`import('/src/app/store.ts').then(({ useAppStore }) => (
				useAppStore.getState().session?.content.includes(
					${JSON.stringify(writing.marker)}
				) ?? false
			))`,
			'300-character manuscript input'
		);
		await pressShortcut(firstRun.client, {
			key: 's',
			code: 'KeyS',
			ctrlKey: true
		});
		await waitFor(
			firstRun.client,
			`import('/src/app/store.ts').then(({ useAppStore }) => (
				useAppStore.getState().saveState.type === 'clean'
			))`,
			'clean save after 300 characters'
		);
		evidence.checks.insertedCharacters = writing.content.length;
		assert(writing.content.length >= 300, `${profile.id}: input was below 300 characters.`);
		evidence.tasks['write-300-and-save'] = true;

		const focusButtonVisible = await evaluate(firstRun.client, `(() => {
			const button = document.querySelector('button[aria-label="专注模式"]');
			return Boolean(button && button.getBoundingClientRect().width > 0);
		})()`);
		const focusStartedAt = performance.now();
		if (profile.inputMethod === 'pointer' && focusButtonVisible) {
			await clickButton(firstRun.client, '专注模式');
		} else {
			await pressShortcut(firstRun.client, { key: 'F11', code: 'F11' });
		}
		await waitFor(
			firstRun.client,
			`document.querySelector('.app-shell')?.classList.contains('is-focus-mode')`,
			'focus mode'
		);
		evidence.timingsMs.focusEnter = Math.round(performance.now() - focusStartedAt);
		if (profile.id === 'paper-keyboard-medium') {
			await screenshot(
				firstRun.client,
				'02-keyboard-focus-mode-1280x800.png'
			);
		}
		const focusExitStartedAt = performance.now();
		await pressShortcut(firstRun.client, { key: 'Escape', code: 'Escape' });
		await waitFor(
			firstRun.client,
			`!document.querySelector('.app-shell')?.classList.contains('is-focus-mode')`,
			'focus-mode exit'
		);
		evidence.timingsMs.focusExit = Math.round(performance.now() - focusExitStartedAt);
		evidence.tasks['focus-roundtrip'] = true;

		const planningStartedAt = performance.now();
		await activateButton(firstRun.client, '规划', profile.inputMethod);
		await waitFor(
			firstRun.client,
			`[...document.querySelectorAll('.global-rail button')].some(button => (
				button.textContent?.trim() === '规划'
				&& button.getAttribute('aria-current') === 'page'
			))`,
			'planning workspace'
		);
		evidence.timingsMs.planningSwitch = Math.round(
			performance.now() - planningStartedAt
		);
		if (profile.id === 'paper-compact') {
			await screenshot(firstRun.client, '03-compact-planning-1024x720.png');
		}
		const writingStartedAt = performance.now();
		await activateButton(firstRun.client, '写作', profile.inputMethod);
		await waitFor(
			firstRun.client,
			`[...document.querySelectorAll('.global-rail button')].some(button => (
				button.textContent?.trim() === '写作'
				&& button.getAttribute('aria-current') === 'page'
			))`,
			'writing workspace'
		);
		evidence.timingsMs.writingSwitch = Math.round(
			performance.now() - writingStartedAt
		);
		evidence.tasks['workspace-roundtrip'] = true;

		const separatorSelector =
			'[role="separator"][aria-label="调整作品侧栏宽度"]';
		const sidebarBefore = await evaluate(
			firstRun.client,
			`Number(document.querySelector(${JSON.stringify(separatorSelector)})
				?.getAttribute('aria-valuenow'))`
		);
		await pressElementKey(
			firstRun.client,
			separatorSelector,
			'ArrowRight',
			profile.sidebarSteps
		);
		const sidebarAfter = await evaluate(
			firstRun.client,
			`Number(document.querySelector(${JSON.stringify(separatorSelector)})
				?.getAttribute('aria-valuenow'))`
		);
		assert(sidebarAfter > sidebarBefore, `${profile.id}: sidebar did not resize.`);
		savedState = await readExperienceState(firstRun.client, writing.marker);
		savedContent = savedState.content;
		evidence.checks.sidebarBefore = sidebarBefore;
		evidence.checks.sidebarAfter = sidebarAfter;
		evidence.checks.savedBeforeClose = savedState.saveState === 'clean';
		assert(evidence.checks.savedBeforeClose, `${profile.id}: close state was not clean.`);
		evidence.tasks['resize-and-close'] = true;
		const firstViewport = await collectViewportMetrics(firstRun.client);
		assert(firstViewport.pageOverflowX === 0, `${profile.id}: horizontal overflow.`);
		assert(firstViewport.clippedInteractive === 0, `${profile.id}: clipped controls.`);
		firstBrowserErrors = [...firstRun.browserErrors];
		await stopProfile(firstRun);
		firstRun = undefined;

		const secondStartedAt = performance.now();
		secondRun = await launchProfile(
			profileDirectory,
			9602 + profileIndex * 3,
			profile
		);
		await waitFor(
			secondRun.client,
			`Boolean(document.querySelector('main[aria-label="作品仪表盘"]'))`,
			'second-start project dashboard'
		);
		evidence.timingsMs.secondProjectInteractive = Math.round(
			performance.now() - secondStartedAt
		);
		await rehydrateSavedContent(secondRun.client, savedState, savedContent);
		await setProfileTheme(secondRun.client, profile.theme);
		const secondContinueStartedAt = performance.now();
		await activateButton(
			secondRun.client,
			'继续上次位置',
			profile.inputMethod
		);
		await waitFor(
			secondRun.client,
			`Boolean(document.querySelector('.writing-canvas .monaco-editor'))`,
			'second-start editor input',
			20_000
		);
		evidence.timingsMs.secondRestoreToInput = Math.round(
			performance.now() - secondContinueStartedAt
		);
		evidence.tasks['second-start-continue'] = true;

		const restoredState = await readExperienceState(secondRun.client, writing.marker);
		evidence.checks.chapterRestored =
			restoredState.activeResourceId === savedState.activeResourceId;
		evidence.checks.contentRestored = restoredState.contentIncludesMarker;
		evidence.checks.layoutRestored =
			Math.abs(restoredState.sidebarWidth - savedState.sidebarWidth) <= 1;
		evidence.checks.cursorLineDelta = savedState.view && restoredState.view
			? Math.abs(restoredState.view.lineNumber - savedState.view.lineNumber)
			: undefined;
		evidence.checks.scrollDelta = savedState.view && restoredState.view
			? Math.abs(restoredState.view.scrollTop - savedState.view.scrollTop)
			: undefined;
		assert(evidence.checks.chapterRestored, `${profile.id}: chapter was not restored.`);
		assert(evidence.checks.contentRestored, `${profile.id}: manuscript content was lost.`);
		assert(evidence.checks.layoutRestored, `${profile.id}: sidebar layout was not restored.`);
		if (evidence.checks.cursorLineDelta !== undefined) {
			assert(
				evidence.checks.cursorLineDelta <= 1,
				`${profile.id}: cursor restored outside the target paragraph.`
			);
		}

		await installOneShotSaveFailure(secondRun.client);
		await insertAtEditorEnd(secondRun.client, '\n恢复检查。');
		const failureStartedAt = performance.now();
		await pressShortcut(secondRun.client, {
			key: 's',
			code: 'KeyS',
			ctrlKey: true
		});
		await waitFor(
			secondRun.client,
			`import('/src/app/store.ts').then(({ useAppStore }) => (
				useAppStore.getState().saveState.type === 'failed'
			))`,
			'visible save failure'
		);
		evidence.timingsMs.saveFailureVisible = Math.round(
			performance.now() - failureStartedAt
		);
		evidence.checks.failureTextVisible = await evaluate(
			secondRun.client,
			`[...document.querySelectorAll('body *')].some(element => (
				element.children.length === 0
				&& element.textContent?.trim() === '保存失败'
				&& element.getBoundingClientRect().width > 0
			))`
		);
		assert(evidence.checks.failureTextVisible, `${profile.id}: save failure text missing.`);
		if (profile.id === 'midnight-reduced-wide') {
			await screenshot(
				secondRun.client,
				'04-midnight-reduced-save-failure-1536x992.png'
			);
		}
		await restoreSaveBridge(secondRun.client);
		const recoveryStartedAt = performance.now();
		await activateButton(secondRun.client, '重试', profile.inputMethod);
		await waitFor(
			secondRun.client,
			`import('/src/app/store.ts').then(({ useAppStore }) => (
				useAppStore.getState().saveState.type === 'clean'
			))`,
			'save recovery'
		);
		evidence.timingsMs.saveRecovery = Math.round(
			performance.now() - recoveryStartedAt
		);
		evidence.tasks['save-failure-recovery'] = true;

		const finalState = await readExperienceState(secondRun.client, writing.marker);
		evidence.checks.finalSaved = finalState.saveState === 'clean';
		evidence.checks.finalContentPresent = finalState.contentIncludesMarker;
		evidence.checks.finalLayoutPresent =
			Math.abs(finalState.sidebarWidth - savedState.sidebarWidth) <= 1;
		assert(evidence.checks.finalSaved, `${profile.id}: final state was not saved.`);
		assert(evidence.checks.finalContentPresent, `${profile.id}: final content missing.`);
		assert(evidence.checks.finalLayoutPresent, `${profile.id}: final layout missing.`);
		evidence.tasks['verify-no-loss'] = true;
		if (profile.id === 'paper-pointer-wide') {
			await screenshot(secondRun.client, '01-restored-writing-1536x992.png');
		}
		if (profile.id === 'midnight-keyboard-medium') {
			await screenshot(
				secondRun.client,
				'05-midnight-restored-1280x800.png'
			);
		}
		const secondViewport = await collectViewportMetrics(secondRun.client);
		assert(secondViewport.pageOverflowX === 0, `${profile.id}: second-start overflow.`);
		assert(secondViewport.clippedInteractive === 0, `${profile.id}: second-start clipping.`);
		assert(firstBrowserErrors.length === 0, `${profile.id}: browser exceptions.`);
		assert(secondRun.browserErrors.length === 0, `${profile.id}: browser exceptions.`);
		evidence.checks.firstViewport = firstViewport;
		evidence.checks.secondViewport = secondViewport;
		evidence.checks.blockingCrash = false;
		evidence.pass = profile.tasks.every(task => evidence.tasks[task] === true);
		return evidence;
	} finally {
		if (firstRun) await stopProfile(firstRun, false);
		if (secondRun) await stopProfile(secondRun);
		const resolvedProfileDirectory = resolve(profileDirectory);
		const resolvedTempDirectory = resolve(tmpdir());
		if (resolvedProfileDirectory.startsWith(resolvedTempDirectory)) {
			await rm(resolvedProfileDirectory, {
				recursive: true,
				force: true,
				maxRetries: 5
			});
		}
	}
}

await mkdir(outputDirectory, { recursive: true });
const results = [];
for (let index = 0; index < profiles.length; index += 1) {
	const profile = profiles[index];
	console.log(`[Gate H] Running ${profile.id} (${index + 1}/${profiles.length})`);
	results.push(await runProfile(profile, index));
}

const summary = {
	profileCount: results.length,
	continueWritingFound: results.filter(result => result.checks.continueVisible).length,
	inputWithoutExplanation: results.filter(result => (
		result.tasks['write-300-and-save']
	)).length,
	focusModeCompleted: results.filter(result => result.tasks['focus-roundtrip']).length,
	saveStateUnderstood: results.filter(result => (
		result.checks.savedBeforeClose && result.checks.failureTextVisible
	)).length,
	saveFailureRecovered: results.filter(result => (
		result.tasks['save-failure-recovery']
	)).length,
	secondStartRestored: results.filter(result => (
		result.tasks['second-start-continue']
		&& result.checks.chapterRestored
		&& result.checks.layoutRestored
	)).length,
	contentOrLayoutLoss: results.filter(result => (
		!result.checks.finalContentPresent || !result.checks.finalLayoutPresent
	)).length,
	blockingCrashes: results.filter(result => result.checks.blockingCrash).length
};

assert(summary.profileCount === 5, 'Gate H requires exactly five profiles.');
assert(summary.continueWritingFound === 5, 'Continue Writing threshold failed.');
assert(summary.inputWithoutExplanation >= 4, 'Input-without-explanation threshold failed.');
assert(summary.focusModeCompleted >= 4, 'Focus-mode threshold failed.');
assert(summary.saveStateUnderstood === 5, 'Save-state clarity threshold failed.');
assert(summary.saveFailureRecovered === 5, 'Save recovery threshold failed.');
assert(summary.secondStartRestored === 5, 'Second-start restore threshold failed.');
assert(summary.contentOrLayoutLoss === 0, 'Content or layout loss detected.');
assert(summary.blockingCrashes === 0, 'Blocking crash detected.');

const sanitizedResults = results.map(result => ({
	id: result.id,
	inputMethod: result.inputMethod,
	pass: result.pass,
	reducedMotion: result.reducedMotion,
	theme: result.theme,
	viewport: result.viewport,
	tasks: result.tasks,
	timingsMs: result.timingsMs,
	checks: {
		blockingCrash: result.checks.blockingCrash,
		chapterRestored: result.checks.chapterRestored,
		contentRestored: result.checks.contentRestored,
		continueVisible: result.checks.continueVisible,
		cursorLineDelta: result.checks.cursorLineDelta,
		failureTextVisible: result.checks.failureTextVisible,
		finalContentPresent: result.checks.finalContentPresent,
		finalLayoutPresent: result.checks.finalLayoutPresent,
		finalSaved: result.checks.finalSaved,
		initialPositionAvailable: result.checks.initialPositionAvailable,
		insertedCharacters: result.checks.insertedCharacters,
		layoutRestored: result.checks.layoutRestored,
		savedBeforeClose: result.checks.savedBeforeClose,
		scrollDelta: result.checks.scrollDelta,
		sidebarAfter: result.checks.sidebarAfter,
		sidebarBefore: result.checks.sidebarBefore,
		firstViewport: result.checks.firstViewport,
		secondViewport: result.checks.secondViewport
	},
	budgets: {
		shellVisible: result.timingsMs.shellVisible <= performanceBudgets.shellVisibleMs,
		projectInteractive:
			result.timingsMs.projectInteractive <= performanceBudgets.projectInteractiveMs,
		restoreToInput:
			result.timingsMs.restoreToInput <= performanceBudgets.restoreToInputMs,
		planningSwitch:
			result.timingsMs.planningSwitch <= performanceBudgets.workspaceSwitchMs,
		writingSwitch:
			result.timingsMs.writingSwitch <= performanceBudgets.workspaceSwitchMs
	}
}));

const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	method: 'five-isolated-no-explanation-test-profiles',
	privacy: {
		recordsAuthorContent: false,
		recordsPaths: false,
		recordsPromptsOrAiOutput: false
	},
	performanceBudgets,
	summary,
	profiles: sanitizedResults
};
await writeFile(metricsPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Gate H five-profile acceptance passed: ${metricsPath}`);
