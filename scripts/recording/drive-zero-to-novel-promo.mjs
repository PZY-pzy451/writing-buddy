import {
	access,
	mkdir,
	readFile,
	readdir,
	stat,
	writeFile
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

function valueAfter(flag, fallback) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
}

function delay(milliseconds) {
	return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

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
				if (message.error) pending.reject(new Error(message.error.message));
				else pending.resolve(message.result);
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
			this.pending.set(id, { resolve: resolveCall, reject });
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

async function waitForTarget(port) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		try {
			const targets = await fetch(`http://127.0.0.1:${port}/json/list`, {
				signal: AbortSignal.timeout(750)
			}).then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page'
					&& !candidate.url.startsWith('devtools://')
			));
			if (target) return target;
		} catch {
			// The diagnostic desktop client is still starting.
		}
		await delay(100);
	}
	throw new Error(`Timed out waiting for Writing Buddy on CDP port ${port}.`);
}

async function evaluate(client, expression) {
	const response = await client.call('Runtime.evaluate', {
		expression,
		awaitPromise: true,
		returnByValue: true,
		userGesture: true
	});
	if (response.exceptionDetails) {
		throw new Error(
			response.exceptionDetails.exception?.description
				?? response.exceptionDetails.text
		);
	}
	return response.result.value;
}

async function waitFor(client, expression, description, timeout = 30_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(80);
	}
	const body = await evaluate(
		client,
		'document.body?.innerText?.replace(/\\s+/gu, " ").slice(0, 1200)'
	).catch(() => '');
	throw new Error(`Timed out waiting for ${description}. Visible text: ${body}`);
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

async function clickButton(client, label, options = {}) {
	const {
		scopeSelector,
		match = 'exact',
		index = 0
	} = options;
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	const matchExpression = match === 'contains'
		? 'normalize(button.getAttribute("aria-label")).includes(label) || normalize(button.textContent).includes(label)'
		: 'normalize(button.getAttribute("aria-label")) === label || normalize(button.textContent) === label';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const buttons = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && !button.disabled && (${matchExpression})) : [];
		return buttons.length > ${index};
	})()`, `button “${label}”`);
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const buttons = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => visible(button) && (${matchExpression})) : [];
		const button = buttons[${index}];
		if (button && !button.disabled) {
			button.scrollIntoView({ block: 'center', inline: 'center' });
			window.__writingBuddyPromoPointer?.(button, true);
			button.click();
		}
		return { count: buttons.length, disabled: button?.disabled ?? true };
	})()`);
	assert(
		result.count > index && !result.disabled,
		`Could not activate button “${label}” at index ${index}; found ${result.count}.`
	);
}

async function clickAria(client, label, scopeSelector = undefined) {
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const element = root?.querySelector(
			'[aria-label=${JSON.stringify(label)}]'
		);
		return Boolean(element && visible(element) && !element.disabled);
	})()`, `control “${label}”`);
	const clicked = await evaluate(client, `(() => {
		const root = ${rootExpression};
		const element = root?.querySelector(
			'[aria-label=${JSON.stringify(label)}]'
		);
		if (!element || element.disabled) return false;
		element.scrollIntoView({ block: 'center', inline: 'center' });
		window.__writingBuddyPromoPointer?.(element, true);
		element.click();
		return true;
	})()`);
	assert(clicked, `Could not activate control “${label}”.`);
}

async function fillSelector(client, selector, value, index = 0) {
	const result = await evaluate(client, `(() => {
		const matches = [...document.querySelectorAll(${JSON.stringify(selector)})];
		const element = matches[${index}];
		if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
			return { count: matches.length, filled: false };
		}
		const prototype = element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
		element.scrollIntoView({ block: 'center', inline: 'center' });
		element.focus();
		window.__writingBuddyPromoPointer?.(element, true);
		Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
			element,
			${JSON.stringify(value)}
		);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
		return { count: matches.length, filled: element.value === ${JSON.stringify(value)} };
	})()`);
	assert(result.count > index && result.filled, `Could not fill ${selector} at index ${index}.`);
}

async function selectValue(client, selector, value) {
	const changed = await evaluate(client, `(() => {
		const element = document.querySelector(${JSON.stringify(selector)});
		if (!(element instanceof HTMLSelectElement)) return false;
		element.scrollIntoView({ block: 'center', inline: 'center' });
		element.focus();
		window.__writingBuddyPromoPointer?.(element, true);
		Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(
			element,
			${JSON.stringify(value)}
		);
		element.dispatchEvent(new Event('change', { bubbles: true }));
		return element.value === ${JSON.stringify(value)};
	})()`);
	assert(changed, `Could not select ${value} in ${selector}.`);
}

async function screenshot(client, path) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, Buffer.from(capture.data, 'base64'));
}

async function installInteractionOverlay(client) {
	await evaluate(client, `(() => {
		if (document.querySelector('#writing-buddy-promo-pointer')) return;
		const style = document.createElement('style');
		style.textContent = \`
			#writing-buddy-promo-pointer {
				position: fixed;
				left: 0;
				top: 0;
				width: 30px;
				height: 38px;
				z-index: 2147483647;
				pointer-events: none;
				transform: translate3d(72px, 72px, 0);
				transition: transform 180ms cubic-bezier(.2, .75, .25, 1);
				filter: drop-shadow(0 2px 4px rgba(17, 28, 49, .35));
			}
			#writing-buddy-promo-pointer svg {
				display: block;
				width: 25px;
				height: 31px;
			}
			#writing-buddy-promo-pointer span {
				position: absolute;
				left: -10px;
				top: -10px;
				width: 34px;
				height: 34px;
				border: 3px solid rgba(190, 107, 53, .72);
				border-radius: 999px;
				opacity: 0;
				transform: scale(.35);
			}
			#writing-buddy-promo-pointer.is-clicking span {
				animation: writing-buddy-promo-click 520ms ease-out;
			}
			@keyframes writing-buddy-promo-click {
				0% { opacity: .95; transform: scale(.35); }
				100% { opacity: 0; transform: scale(1.35); }
			}
		\`;
		document.head.append(style);
		const pointer = document.createElement('div');
		pointer.id = 'writing-buddy-promo-pointer';
		pointer.setAttribute('aria-hidden', 'true');
		pointer.innerHTML = \`
			<svg viewBox="0 0 28 34" aria-hidden="true">
				<path d="M3 2.5 23.5 20l-9.2 1.8 5.4 8.4-4.8 2.8-5.1-8.3L3 31Z"
					fill="#fff" stroke="#111c31" stroke-width="2.2"
					stroke-linejoin="round"/>
			</svg>
			<span></span>
		\`;
		document.body.append(pointer);
		window.__writingBuddyPromoPointer = (element, clicked = false) => {
			const rect = element.getBoundingClientRect();
			const x = Math.round(rect.left + Math.min(rect.width * .5, rect.width - 18));
			const y = Math.round(rect.top + Math.min(rect.height * .5, rect.height - 18));
			pointer.style.transform = \`translate3d(\${x}px, \${y}px, 0)\`;
			if (!clicked) return;
			pointer.classList.remove('is-clicking');
			void pointer.offsetWidth;
			pointer.classList.add('is-clicking');
		};
	})()`);
}

async function focusEditorAtEnd(client) {
	const center = await evaluate(client, `(() => {
		const editor = document.querySelector('.monaco-editor');
		if (!editor) return null;
		window.__writingBuddyPromoPointer?.(editor, true);
		const rect = editor.getBoundingClientRect();
		return {
			x: Math.round(rect.left + Math.min(rect.width - 40, rect.width * 0.62)),
			y: Math.round(rect.top + Math.min(rect.height - 40, rect.height * 0.62))
		};
	})()`);
	assert(center, 'The manuscript editor is not visible.');
	await client.call('Input.dispatchMouseEvent', {
		type: 'mousePressed',
		x: center.x,
		y: center.y,
		button: 'left',
		clickCount: 1
	});
	await client.call('Input.dispatchMouseEvent', {
		type: 'mouseReleased',
		x: center.x,
		y: center.y,
		button: 'left',
		clickCount: 1
	});
	await dispatchShortcut(client, 'End', 2);
	await delay(350);
}

async function dispatchShortcut(client, key, modifiers) {
	const windowsVirtualKeyCode = key === 'End'
		? 35
		: key.toUpperCase().charCodeAt(0);
	if (modifiers & 2) {
		await client.call('Input.dispatchKeyEvent', {
			type: 'rawKeyDown',
			key: 'Control',
			code: 'ControlLeft',
			windowsVirtualKeyCode: 17,
			nativeVirtualKeyCode: 17,
			modifiers: 2
		});
	}
	await client.call('Input.dispatchKeyEvent', {
		type: 'rawKeyDown',
		key,
		code: key === 'End' ? 'End' : `Key${key.toUpperCase()}`,
		windowsVirtualKeyCode,
		nativeVirtualKeyCode: windowsVirtualKeyCode,
		modifiers
	});
	await client.call('Input.dispatchKeyEvent', {
		type: 'keyUp',
		key,
		code: key === 'End' ? 'End' : `Key${key.toUpperCase()}`,
		windowsVirtualKeyCode,
		nativeVirtualKeyCode: windowsVirtualKeyCode,
		modifiers
	});
	if (modifiers & 2) {
		await client.call('Input.dispatchKeyEvent', {
			type: 'keyUp',
			key: 'Control',
			code: 'ControlLeft',
			windowsVirtualKeyCode: 17,
			nativeVirtualKeyCode: 17,
			modifiers: 0
		});
	}
}

async function writeChapterWithAi(client, chapterTitle, chapterNumber) {
	await waitFor(
		client,
		`document.querySelector('.writer-header h1')?.textContent?.trim()
			=== ${JSON.stringify(chapterTitle)}
			&& Boolean(document.querySelector('.monaco-editor'))`,
		`${chapterTitle} editor`
	);
	await focusEditorAtEnd(client);
	if (chapterNumber === 1) {
		await client.call('Input.insertText', {
			text: '\n\n顾言把耳机音量调低了一格。她知道，接下来必须由自己决定。\n'
		});
		await delay(900);
		await dispatchShortcut(client, 's', 2);
		await waitFor(
			client,
			`document.body.innerText.includes('已保存')`,
			'Ctrl+S author edit save'
		);
		await delay(1800);
		await focusEditorAtEnd(client);
	}

	if (!await evaluate(
		client,
		`Boolean(document.querySelector('.assistant-panel'))`
	)) {
		await clickAria(client, '更多章节操作', '.writer-header');
		await clickButton(client, '继续本段', {
			scopeSelector: '.writer-tools-menu',
			match: 'contains'
		});
	} else {
		await clickButton(client, '继续本段', {
			scopeSelector: '.assistant-panel',
			match: 'contains'
		});
	}
	const generationButtonLabel = chapterNumber === 1
		? '确认资料并生成候选'
		: '确认资料并生成开篇';
	await waitFor(
		client,
		`Boolean(document.querySelector('.continuation-panel'))
			&& [...document.querySelectorAll('.continuation-panel button')]
				.some(button => button.textContent?.includes(
					${JSON.stringify(generationButtonLabel)}
				)
					&& !button.disabled)`,
		`${chapterTitle} continuation context`
	);
	await fillSelector(
		client,
		'.continuation-panel textarea[aria-label="告诉 AI 接下来发生什么"]',
		[
			'按照已确认的两场景结构写完第一幕：从零点来电推进到未来广播，保留克制的法证细节。',
			'写完第二幕：让白噪声地图证明城市正在干预选择，并把旧港危机推到不可回避。',
			'写完第三幕并明确收束：顾言公开风险、关闭数字回声，城市在风暴后重新拥有选择。'
		][chapterNumber - 1]
	);
	await waitFor(
		client,
		`[...document.querySelectorAll('.continuation-panel button')]
			.some(button => button.textContent?.includes(
				${JSON.stringify(generationButtonLabel)}
			)
				&& !button.disabled)`,
		`${chapterTitle} updated author guidance`
	);
	await delay(1800);
	await clickButton(client, generationButtonLabel, {
		scopeSelector: '.continuation-panel'
	});
	await waitFor(
		client,
		`Boolean(document.querySelector('.inline-draft-card'))
			&& document.querySelector('.inline-draft-card textarea')?.value.length > 8000`,
		`${chapterTitle} AI temporary draft`,
		45_000
	);
	await delay(3500);
	await clickButton(client, '写入正文', {
		scopeSelector: '.inline-draft-card'
	});
	await waitFor(
		client,
		`!document.querySelector('.inline-draft-card')
			&& document.body.innerText.includes('AI 草稿已写入正文')`,
		`${chapterTitle} safe manuscript commit`,
		45_000
	);
	await delay(3000);
	await focusEditorAtEnd(client);
	await delay(1600);
}

async function openNextChapter(client, nextTitle) {
	await clickAria(client, '更多章节操作', '.writer-header');
	await clickButton(client, '下一章', {
		scopeSelector: '.writer-tools-menu',
		match: 'contains'
	});
	await waitFor(
		client,
		`document.querySelector('.writer-header h1')?.textContent?.trim()
			=== ${JSON.stringify(nextTitle)}`,
		`${nextTitle} navigation`
	);
	await delay(2200);
}

async function pathExists(path) {
	try {
		await access(path);
		return true;
	} catch (error) {
		if (error?.code === 'ENOENT') return false;
		throw error;
	}
}

const port = Number(valueAfter('--cdp-port', '9223'));
const projectParent = resolve(valueAfter(
	'--project-parent',
	'artifacts/promo/zero-to-complete-novel-2026-07-31/workspace'
));
const projectName = valueAfter('--project-name', '零点回声');
const projectRoot = join(projectParent, projectName);
const outputDirectory = resolve(valueAfter(
	'--output-dir',
	'artifacts/promo/zero-to-complete-novel-2026-07-31/evidence'
));
const reportPath = join(outputDirectory, 'zero-to-novel-run.json');
const pace = Number(valueAfter('--pace', '1'));
const pause = milliseconds => delay(milliseconds * pace);
const expectedChapterTitles = [
	'第一章 · 迟到四十七秒的声音',
	'第二章 · 城市回声协议',
	'第三章 · 零点之后'
];

assert(
	await pathExists(projectParent),
	`Project parent must be prepared by the fixture installer: ${projectParent}`
);
assert(
	!(await pathExists(projectRoot)),
	`The project already exists before the recorded take: ${projectRoot}`
);
await mkdir(outputDirectory, { recursive: true });

const target = await waitForTarget(port);
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.connect();
await client.call('Page.enable');
await client.call('Runtime.enable');
const browserErrors = [];
client.on('Runtime.exceptionThrown', params => {
	browserErrors.push(
		params.exceptionDetails?.exception?.description
			?? params.exceptionDetails?.text
			?? 'Uncaught browser exception'
	);
});
try {
	const windowInfo = await client.call('Browser.getWindowForTarget');
	await client.call('Browser.setWindowBounds', {
		windowId: windowInfo.windowId,
		bounds: { windowState: 'maximized' }
	}).catch(() => undefined);
	await installInteractionOverlay(client);

	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))
			&& Boolean(window.__zeroToNovelPromoFixture)`,
		'empty Writing Buddy welcome screen'
	);
	await screenshot(client, join(outputDirectory, '01-empty-welcome.png'));
	await pause(4500);

	await clickButton(client, '新建项目', {
		scopeSelector: 'main[aria-label="开始使用 Writing Buddy"]'
	});
	await waitFor(client, `Boolean(document.querySelector('[role="dialog"]'))`, 'new project wizard');
	await pause(2000);
	await fillSelector(client, 'input[aria-label="作品名称"]', projectName);
	await fillSelector(
		client,
		'textarea[aria-label="作品说明"]',
		'一名声纹法证师收到亡弟迟到四十七秒的来电，发现整座城市的广播正在替人们选择未来。'
	);
	await clickButton(client, '浏览', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('input[aria-label="保存位置"]')?.value?.length > 0
			|| document.querySelector('[role="dialog"]')?.innerText.includes(
				${JSON.stringify(projectParent)}
			)`,
		'new empty project parent selection'
	);
	await screenshot(client, join(outputDirectory, '02-new-project-basics.png'));
	await pause(2800);

	await clickButton(client, '下一步', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('#wizard-start-title')?.textContent === '你现在从哪里开始？'`,
		'genre creation start'
	);
	await clickButton(client, '根据题材生成小说大纲', {
		scopeSelector: '[role="dialog"]',
		match: 'contains'
	});
	await pause(2600);
	await clickButton(client, '下一步', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('#wizard-structure-title')?.textContent === '初始结构'`,
		'initial structure'
	);
	await pause(2200);
	await clickButton(client, '下一步', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('#wizard-appearance-title')?.textContent === '外观与写作方式'`,
		'appearance step'
	);
	await clickButton(client, '纸页', {
		scopeSelector: '[role="dialog"]',
		match: 'contains'
	});
	await clickButton(client, '故事规划优先', {
		scopeSelector: '[role="dialog"]',
		match: 'contains'
	});
	await pause(2200);
	await clickButton(client, '下一步', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('#wizard-review-title')?.textContent === '确认创建'`,
		'project creation review'
	);
	await pause(2600);
	await clickButton(client, '创建项目', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('#creation-journey-heading')?.textContent === '创建你的故事'`,
		'genre-to-outline start',
		45_000
	);
	assert(await pathExists(projectRoot), 'Writing Buddy did not create the project directory.');
	await screenshot(client, join(outputDirectory, '03-created-empty-project.png'));
	await pause(3500);

	await fillSelector(client, 'input[aria-label="选择题材"]', '近未来都市悬疑 + 科幻');
	await fillSelector(
		client,
		'textarea[aria-label="用一句话描述你的故事（可选）"]',
		'声纹法证师收到亡弟迟到四十七秒的来电，发现城市广播正在预测并制造灾难。'
	);
	await clickButton(client, '更多控制', { match: 'contains' });
	await clickButton(client, '中篇');
	await clickButton(client, '克制');
	await clickButton(client, '冷峻');
	await fillSelector(client, 'input[aria-label="主角提示"]', '声纹法证师，失踪者家属');
	await fillSelector(client, 'input[aria-label="希望包含"]', '法证细节，台风危机，人物主动选择');
	await fillSelector(client, 'input[aria-label="不希望出现"]', '无代价复活，系统故障自动解决');
	await selectValue(client, 'select[aria-label="结局倾向"]', 'bittersweet');
	await selectValue(client, 'select[aria-label="结构倾向"]', 'three-act');
	await screenshot(client, join(outputDirectory, '04-genre-brief.png'));
	await pause(3500);

	await clickButton(client, '生成小说大纲', { match: 'contains' });
	await waitFor(
		client,
		`document.querySelector('#genre-context-title')?.textContent === '生成依据'`,
		'AI context preview'
	);
	await pause(2800);
	await clickButton(client, '确认并生成', { scopeSelector: '[role="dialog"]' });
	await waitFor(
		client,
		`document.querySelector('.structured-outline-tree')?.innerText.includes('零点回声')`,
		'generated structured outline',
		45_000
	);
	await screenshot(client, join(outputDirectory, '05-generated-outline.png'));
	await pause(5200);

	await fillSelector(client, 'input[aria-label="拆分候选数量"]', '1');
	await clickButton(client, '拆分为卷');
	await waitFor(
		client,
		`document.querySelector('.outline-hierarchy-preview')?.innerText.includes('第一卷 · 零点回声')`,
		'volume candidate preview'
	);
	await pause(2600);
	await clickButton(client, '确认拆分', {
		scopeSelector: '.outline-hierarchy-preview'
	});
	await waitFor(
		client,
		`[...document.querySelectorAll('.structured-outline-tree button')]
			.some(button => button.getAttribute('aria-label')?.includes('第一卷 · 零点回声')
				&& button.classList.contains('is-selected'))`,
		'confirmed volume'
	);
	await fillSelector(client, 'input[aria-label="拆分候选数量"]', '3');
	await clickButton(client, '拆分为章节');
	await waitFor(
		client,
		`document.querySelector('.outline-hierarchy-preview')?.innerText.includes(
			'第三章 · 零点之后'
		)`,
		'three chapter candidate preview'
	);
	await screenshot(client, join(outputDirectory, '06-three-chapter-preview.png'));
	await pause(3600);
	await clickButton(client, '确认拆分', {
		scopeSelector: '.outline-hierarchy-preview'
	});
	await waitFor(
		client,
		`[...document.querySelectorAll('.structured-outline-tree button')]
			.some(button => button.getAttribute('aria-label')?.includes(
				'第一章 · 迟到四十七秒的声音'
			) && button.classList.contains('is-selected'))`,
		'confirmed chapters'
	);

	for (const chapterTitle of expectedChapterTitles) {
		await clickButton(client, chapterTitle, {
			scopeSelector: '.structured-outline-tree',
			match: 'contains'
		});
		await fillSelector(client, 'input[aria-label="拆分候选数量"]', '2');
		await clickButton(client, '生成场景');
		await waitFor(
			client,
			`Boolean(document.querySelector('.outline-hierarchy-preview'))`,
			`${chapterTitle} scene preview`
		);
		await pause(2200);
		await clickButton(client, '确认拆分', {
			scopeSelector: '.outline-hierarchy-preview'
		});
		await waitFor(
			client,
			`!document.querySelector('.outline-hierarchy-preview')`,
			`${chapterTitle} confirmed scenes`
		);
	}
	await screenshot(client, join(outputDirectory, '07-complete-scene-plan.png'));
	await pause(4200);
	await clickButton(client, '开始写作');
	await waitFor(
		client,
		`document.querySelector('#outline-materialization-title')?.textContent
			=== '创建可写卷、章节和场景'`,
		'native materialization review'
	);
	await pause(3300);
	await clickButton(client, '确认创建并开始写作', {
		scopeSelector: '[role="dialog"]'
	});
	await waitFor(
		client,
		`document.querySelector('.writer-header h1')?.textContent?.trim()
			=== ${JSON.stringify(expectedChapterTitles[0])}
			&& Boolean(document.querySelector('.monaco-editor'))`,
		'first writable chapter',
		45_000
	);
	await screenshot(client, join(outputDirectory, '08-first-writable-chapter.png'));
	await pause(3600);

	await writeChapterWithAi(client, expectedChapterTitles[0], 1);
	await screenshot(client, join(outputDirectory, '09-first-chapter-written.png'));
	await openNextChapter(client, expectedChapterTitles[1]);
	await writeChapterWithAi(client, expectedChapterTitles[1], 2);
	await screenshot(client, join(outputDirectory, '10-second-chapter-written.png'));
	await openNextChapter(client, expectedChapterTitles[2]);
	await writeChapterWithAi(client, expectedChapterTitles[2], 3);
	await screenshot(client, join(outputDirectory, '11-complete-ending.png'));
	await pause(5200);

	await clickAria(client, '打开作品仪表盘');
	await waitFor(
		client,
		`Boolean(document.querySelector('main[aria-label="作品仪表盘"]'))
			&& document.body.innerText.includes('3 个章节')
			&& document.querySelector('main[aria-label="作品仪表盘"]')
				?.innerText.includes('26,210')`,
		'completed project dashboard'
	);
	await screenshot(client, join(outputDirectory, '12-completed-dashboard.png'));
	await pause(7500);

	const fixture = await evaluate(client, `({
		calls: window.__zeroToNovelPromoFixture?.calls ?? [],
		continuationCount: window.__zeroToNovelPromoFixture?.continuationCount ?? 0,
		visibleText: document.querySelector('main[aria-label="作品仪表盘"]')
			?.innerText?.replace(/\\s+/gu, ' ').slice(0, 1600) ?? ''
	})`);
	const chapterDirectory = join(projectRoot, 'chapters');
	const chapterNames = (await readdir(chapterDirectory))
		.filter(name => name.toLocaleLowerCase().endsWith('.md'))
		.sort();
	const chapterEvidence = await Promise.all(chapterNames.map(async name => {
		const path = join(chapterDirectory, name);
		const content = await readFile(path, 'utf8');
		const info = await stat(path);
		return {
			name,
			bytes: info.size,
			characters: content.length,
			nonWhitespaceCharacters: content.replace(/\s/gu, '').length,
			hasSceneAnchors: (content.match(/writing-buddy-scene:/gu) ?? []).length,
			hasEnding: content.includes('她终于听见，海原来一直这么响。')
		};
	}));
	const manifest = JSON.parse(
		await readFile(join(projectRoot, '.writing-buddy', 'project.json'), 'utf8')
	);
	const aiCalls = fixture.calls.filter(call => call.command === 'ai_start_generation');
	const creationCalls = aiCalls.filter(call => call.jobType === 'creation-journey');
	const continuationCalls = aiCalls.filter(call => call.jobType === 'manuscript-continuation');
	const totalNonWhitespaceCharacters = chapterEvidence.reduce(
		(sum, chapter) => sum + chapter.nonWhitespaceCharacters,
		0
	);
	const report = {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		truthContract: {
			targetMissingBeforeRecordedTake: true,
			targetCreatedByWritingBuddy: await pathExists(projectRoot),
			projectRoot,
			projectName
		},
		project: {
			projectId: manifest.projectId,
			title: manifest.title,
			volumeCount: manifest.volumes.length,
			chapterCount: manifest.volumes
				.flatMap(volume => volume.chapters).length,
			chapterEvidence,
			totalNonWhitespaceCharacters
		},
		ai: {
			totalCalls: aiCalls.length,
			creationJourneyCalls: creationCalls.length,
			continuationCalls: continuationCalls.length,
			fixtureContinuationCount: fixture.continuationCount,
			calls: aiCalls
		},
		ui: {
			dashboardText: fixture.visibleText
		},
		browserErrors
	};
	assert(report.project.volumeCount === 1, 'Final project must contain one volume.');
	assert(report.project.chapterCount === 3, 'Final project must contain three chapters.');
	assert(chapterEvidence.length === 3, 'Final project must contain three native manuscript files.');
	assert(
		totalNonWhitespaceCharacters >= 28_000,
		`Final manuscript is too short: ${totalNonWhitespaceCharacters}.`
	);
	assert(
		chapterEvidence.every(chapter => chapter.hasSceneAnchors === 2),
		'Every chapter must retain two materialized scene anchors.'
	);
	assert(chapterEvidence.at(-1)?.hasEnding, 'The final chapter does not contain a resolved ending.');
	assert(creationCalls.length === 6, `Expected six planning AI calls, got ${creationCalls.length}.`);
	assert(continuationCalls.length === 3, `Expected three drafting AI calls, got ${continuationCalls.length}.`);
	assert(fixture.continuationCount === 3, 'The fixture observed duplicate or missing drafting requests.');
	assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join('\n')}`);
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify({
		status: 'complete',
		reportPath,
		projectRoot,
		chapterCount: report.project.chapterCount,
		totalNonWhitespaceCharacters,
		aiCalls: report.ai.totalCalls
	}, undefined, 2)}\n`);
} finally {
	client.close();
}
