import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const executable = process.env.WRITING_BUDDY_EXE ?? join(
	repositoryRoot,
	'apps',
	'desktop',
	'src-tauri',
	'target',
	'release',
	'writing-buddy-next.exe'
);
const debuggingPort = Number(process.env.WRITING_BUDDY_NATIVE_CDP_PORT ?? 9751);
const outputDirectory = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'screenshots',
	'genre-to-draft-gate-d'
);
const metricsPath = join(
	repositoryRoot,
	'docs',
	'acceptance',
	'genre-to-draft-gate-d-metrics.json'
);
const acceptanceStartedAt = performance.now();

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

async function waitFor(client, expression, description, timeout = 20_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(50);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForTarget(child) {
	const deadline = Date.now() + 25_000;
	while (Date.now() < deadline) {
		assert(child.exitCode === null, `Writing Buddy exited early with ${child.exitCode}.`);
		try {
			const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)
				.then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page'
				&& !candidate.url.startsWith('devtools://')
			));
			if (target) return target;
		} catch {
			// WebView2 is still starting.
		}
		await delay(80);
	}
	throw new Error('Timed out waiting for the native Writing Buddy WebView target.');
}

async function invoke(client, command, args = {}) {
	return evaluate(client, `(async () => {
		const internals = window.__TAURI_INTERNALS__;
		if (!internals?.invoke) throw new Error('nativeTauriBridgeUnavailable');
		return internals.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)});
	})()`);
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

async function clickButton(client, label, scopeSelector = undefined) {
	const rootExpression = scopeSelector
		? `document.querySelector(${JSON.stringify(scopeSelector)})`
		: 'document';
	await waitFor(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		return Boolean(root && [...root.querySelectorAll('button:not([hidden])')]
			.some(button => !button.disabled && visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			)));
	})()`, `button “${label}”`);
	const result = await evaluate(client, `(() => {
		${normalizeTextExpression}
		const root = ${rootExpression};
		const label = ${JSON.stringify(label)};
		const matches = root ? [...root.querySelectorAll('button:not([hidden])')]
			.filter(button => !button.disabled && visible(button) && (
				normalize(button.getAttribute('aria-label')) === label
				|| normalize(button.textContent) === label
			)) : [];
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(result === 1, `Expected one button named “${label}”; found ${result}.`);
}

async function openCreationJourney(client) {
	try {
		await waitFor(client, `(() => {
			if (document.querySelector('.structured-outline-workspace')) return true;
			return [...document.querySelectorAll('button')].some(button => (
				!button.disabled
				&& button.getBoundingClientRect().width > 0
				&& button.textContent?.replace(/\\s+/gu, '').includes('创作旅程')
			));
		})()`, 'creation-journey route or dashboard action');
	} catch (error) {
		const diagnostic = await evaluate(client, `(() => ({
			shellClass: document.querySelector('.app-shell')?.className,
			bodyText: document.body.innerText.replace(/\\s+/gu, ' ').trim().slice(0, 2_000),
			buttons: [...document.querySelectorAll('button')].map(button => ({
				text: button.textContent?.replace(/\\s+/gu, ' ').trim(),
				ariaLabel: button.getAttribute('aria-label'),
				disabled: button.disabled,
				width: Math.round(button.getBoundingClientRect().width),
				height: Math.round(button.getBoundingClientRect().height)
			})).slice(0, 80)
		}))()`);
		throw new Error(
			`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`,
			{ cause: error }
		);
	}
	if (await evaluate(client, `Boolean(document.querySelector('.structured-outline-workspace'))`)) {
		return;
	}
	const count = await evaluate(client, `(() => {
		const matches = [...document.querySelectorAll('button')].filter(button => (
			!button.disabled
			&& button.getBoundingClientRect().width > 0
			&& button.textContent?.replace(/\\s+/gu, '').includes('创作旅程')
		));
		if (matches.length === 1) matches[0].click();
		return matches.length;
	})()`);
	assert(count === 1, `Expected one dashboard creation-journey action; found ${count}.`);
}

async function fillByLabel(client, label, value) {
	const result = await evaluate(client, `(() => {
		const element = document.querySelector(
			'[aria-label=' + CSS.escape(${JSON.stringify(label)}) + ']'
		);
		if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
			return { found: Boolean(element), value: null };
		}
		element.focus();
		const prototype = element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
		Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
			element,
			${JSON.stringify(value)}
		);
		element.dispatchEvent(new Event('input', { bubbles: true }));
		element.dispatchEvent(new Event('change', { bubbles: true }));
		element.blur();
		return { found: true, value: element.value };
	})()`);
	assert(
		result.found && result.value === value,
		`Could not fill “${label}”: ${JSON.stringify(result)}`
	);
	await waitFor(
		client,
		`document.querySelector('[aria-label=' + CSS.escape(${JSON.stringify(label)}) + ']')?.value === ${JSON.stringify(value)}`,
		`updated value for “${label}”`
	);
	await delay(80);
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
	await delay(180);
}

async function screenshot(client, name) {
	const capture = await client.call('Page.captureScreenshot', {
		format: 'png',
		fromSurface: true,
		captureBeyondViewport: false
	});
	await writeFile(join(outputDirectory, name), Buffer.from(capture.data, 'base64'));
}

async function collectMetrics(client, expectedMode) {
	return evaluate(client, `(() => {
		const workspace = document.querySelector('.structured-outline-workspace');
		const grid = document.querySelector('.structured-outline-grid');
		const tree = document.querySelector('.structured-outline-tree');
		const cards = document.querySelector('.structured-outline-cards');
		const inspector = document.querySelector('.structured-outline-inspector');
		if (!workspace || !grid || !tree || !cards || !inspector) {
			return { missingWorkspace: true };
		}
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...workspace.querySelectorAll('button, input, textarea, select')]
			.filter(visible);
		const undersizedControls = controls.flatMap(element => {
			const rect = element.getBoundingClientRect();
			return rect.height < 44 ? [{
				label: element.getAttribute('aria-label')
					?? element.textContent?.replace(/\\s+/gu, ' ').trim(),
				width: Math.round(rect.width),
				height: Math.round(rect.height)
			}] : [];
		});
		const page = document.documentElement;
		const gridStyle = getComputedStyle(grid);
		const treeRect = tree.getBoundingClientRect();
		const cardsRect = cards.getBoundingClientRect();
		const inspectorRect = inspector.getBoundingClientRect();
		const primaryButtons = [...workspace.querySelectorAll('button.primary-button')]
			.filter(element => visible(element) && !element.disabled);
		return {
			missingWorkspace: false,
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(0, page.scrollWidth - page.clientWidth),
			pageOverflowY: Math.max(0, page.scrollHeight - page.clientHeight),
			workspaceOverflowX: Math.max(0, workspace.scrollWidth - workspace.clientWidth),
			gridTemplateColumns: gridStyle.gridTemplateColumns,
			gridTemplateAreas: gridStyle.gridTemplateAreas,
			primaryActionCount: primaryButtons.length,
			undersizedControls,
			tree: {
				left: Math.round(treeRect.left),
				top: Math.round(treeRect.top),
				width: Math.round(treeRect.width),
				height: Math.round(treeRect.height)
			},
			cards: {
				left: Math.round(cardsRect.left),
				top: Math.round(cardsRect.top),
				width: Math.round(cardsRect.width),
				height: Math.round(cardsRect.height)
			},
			inspector: {
				left: Math.round(inspectorRect.left),
				top: Math.round(inspectorRect.top),
				width: Math.round(inspectorRect.width),
				height: Math.round(inspectorRect.height)
			},
			expectedMode: ${JSON.stringify(expectedMode)}
		};
	})()`);
}

function buildJourney(projectId) {
	const timestamp = '2026-07-30T08:00:00.000Z';
	const beats = [
		{
			title: '雨夜来信',
			summary: '失踪多年的姐姐寄来一封只写着车站编号的信。',
			goal: '确认来信是否真实',
			conflict: '旧车站已封闭且有人阻止调查',
			outcome: '主角找到仍在运作的寄存柜',
			hook: '柜中录音提到了明晚',
			povHint: '林澄'
		},
		{
			title: '玻璃顶下的脚印',
			summary: '雨水显出一串不可能存在的脚印。',
			goal: '追踪脚印来源',
			conflict: '脚印在封闭站台中央消失',
			outcome: '发现维修通道',
			hook: '通道里亮起旧时刻表',
			povHint: '林澄'
		},
		{
			title: '错位时刻表',
			summary: '废弃时刻表记录着尚未发生的列车。',
			goal: '破解列车编号',
			conflict: '编号指向姐姐失踪当晚',
			outcome: '确认有人在重演旧案',
			hook: '下一站写着主角住址',
			povHint: '林澄'
		},
		{
			title: '站长室的第二把钥匙',
			summary: '旧站长留下两把只能同时使用的钥匙。',
			goal: '进入封存档案室',
			conflict: '另一把钥匙在未知跟踪者手中',
			outcome: '双方被迫短暂合作',
			hook: '档案证明姐姐主动消失',
			povHint: '林澄'
		},
		{
			title: '零点末班车',
			summary: '主角在零点列车到站前作出最后选择。',
			goal: '阻止下一次失踪',
			conflict: '救姐姐意味着让旧案永远沉没',
			outcome: '真相被公开，循环终止',
			hook: '远处再次响起并不存在的汽笛',
			povHint: '林澄'
		}
	];
	return {
		schemaVersion: 2,
		revision: 1,
		projectId,
		startRoute: 'genre',
		stage: 'outline',
		genreInput: {
			projectId,
			genre: '都市悬疑',
			premise: '一座废弃车站在雨夜重新亮起时刻表。',
			mode: 'deep',
			scale: 'novel',
			tones: ['克制', '悬疑'],
			protagonistHints: ['档案修复师林澄'],
			requiredElements: ['旧车站', '雨夜来信'],
			excludedElements: ['超能力解决一切'],
			endingPreference: 'bittersweet',
			audience: '成年悬疑读者',
			structureTemplateId: 'five-beat-mystery'
		},
		storyOutline: {
			id: 'journey-story-outline:rain-station',
			projectId,
			title: '雨夜无日期',
			genre: '都市悬疑',
			premise: '一座废弃车站在雨夜重新亮起时刻表。',
			themePromise: '记忆不是证词，但选择可以成为证词。',
			protagonistGoal: '找到姐姐失踪的真实原因。',
			centralConflict: '主角越接近真相，越可能让旧案中的幸存者再次受伤。',
			stakes: '姐姐的下落与主角自己的清白。',
			mysteryQuestion: '是谁让废弃车站在雨夜重新运作？',
			endingDirection: '真相公开，但姐姐选择留在远方。',
			structureTemplateId: 'five-beat-mystery',
			status: 'draft',
			revision: 1,
			createdAt: timestamp,
			updatedAt: timestamp
		},
		genreGeneration: {
			suggestedCharacters: [],
			suggestedWorldRules: [],
			warnings: [],
			generatedAt: timestamp
		},
		elements: [
			{ id: 'journey-element:genre', category: 'theme', text: '都市悬疑', locked: true },
			{ id: 'journey-element:station', category: 'place', text: '旧车站', locked: true },
			{ id: 'journey-element:letter', category: 'object', text: '雨夜来信', locked: false }
		],
		core: {
			oneSentence: '',
			protagonist: '',
			goal: '',
			obstacle: '',
			stakes: '',
			mystery: '',
			readerExperience: '',
			endingDirection: ''
		},
		directions: [],
		selectedDirectionIds: [],
		outline: beats.map((beat, index) => ({
			id: `journey-outline:rain-beat-${index + 1}`,
			title: beat.title,
			summary: beat.summary,
			purpose: beat.goal,
			type: 'story_beat',
			order: index,
			goal: beat.goal,
			conflict: beat.conflict,
			outcome: beat.outcome,
			hook: beat.hook,
			povHint: beat.povHint,
			characterIds: [],
			plotThreadIds: [],
			foreshadowingIds: [],
			status: 'planned',
			source: 'ai_generated',
			revision: 1
		})),
		chapters: [],
		guidance: { answers: [] },
		locks: {
			coreFields: [],
			directionIds: [],
			outlineNodeIds: [],
			chapterIds: []
		},
		impacts: [],
		stale: {
			directions: false,
			outline: false,
			chapters: false
		},
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

async function seedFreshProject(client, projectParent) {
	const created = await invoke(client, 'create_project', {
		request: {
			name: '雨夜无日期',
			description: 'Phase 1.2B Gate D 原生验收项目',
			rootDirectory: projectParent,
			projectType: 'longform',
			language: 'zh-CN',
			templateId: 'blank-longform',
			selectedInitialResources: ['first-volume'],
			themeId: 'paper',
			accentId: 'gold',
			writingMode: 'planningFirst'
		}
	});
	assert(created?.projectId && created?.root, `Native project creation failed: ${JSON.stringify(created)}`);
	assert(
		created.firstChapterId === undefined || created.firstChapterId === null,
		'Fresh acceptance project unexpectedly created a chapter.'
	);
	await invoke(client, 'open_project', {
		projectRoot: created.root,
		mode: 'read-write'
	});
	const journey = buildJourney(created.projectId);
	const write = await invoke(client, 'write_creation_journey_state', {
		projectRoot: created.root,
		content: `${JSON.stringify(journey, null, 2)}\n`,
		expectedHash: ''
	});
	assert(write?.hash, `Native journey seed failed: ${JSON.stringify(write)}`);
	const persistedWorkspace = JSON.stringify({
		state: {
			recentProjectRoot: created.root,
			recentProjectRoots: [created.root],
			activeMode: 'planning',
			storyView: 'creation-journey',
			theme: 'paper',
			accent: 'gold'
		},
		version: 2
	});
	const seedScript = await client.call('Page.addScriptToEvaluateOnNewDocument', {
		source: `localStorage.setItem(
			'writing-buddy-next-workspace',
			${JSON.stringify(persistedWorkspace)}
		);`
	});
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'reloaded app shell');
	await client.call('Page.removeScriptToEvaluateOnNewDocument', {
		identifier: seedScript.identifier
	});
	await openCreationJourney(client);
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-workspace'))`,
		'structured outline workspace'
	);
	return { created, journey, seedHash: write.hash };
}

async function exerciseWorkspace(client) {
	await fillByLabel(client, '故事标题', '雨夜车站：修订大纲');

	const initialIds = await evaluate(client, `[
		...document.querySelectorAll('.structured-outline-card')
	].map(card => card.getAttribute('aria-label'))`);
	assert(initialIds.length === 5, `Expected five outline cards; found ${initialIds.length}.`);

	const dragStarted = await evaluate(client, `(() => {
		const card = document.querySelectorAll('.structured-outline-card')[0];
		if (!card) return false;
		return card.dispatchEvent(new DragEvent('dragstart', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
	})()`);
	assert(dragStarted, 'The first outline card did not start dragging.');
	await delay(100);
	await evaluate(client, `(() => {
		const card = document.querySelectorAll('.structured-outline-card')[2];
		if (!card) return false;
		card.dispatchEvent(new DragEvent('dragover', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
		card.dispatchEvent(new DragEvent('drop', {
			bubbles: true,
			cancelable: true,
			dataTransfer: new DataTransfer()
		}));
		return true;
	})()`);
	await waitFor(
		client,
		`document.querySelectorAll('[data-testid="outline-card-title"]')[2]?.textContent?.trim() === '雨夜来信'`,
		'persisted drag reorder'
	);

	await evaluate(client, `document.querySelectorAll('.structured-outline-card')[1]?.click(); true`);
	await waitFor(
		client,
		`Boolean(document.querySelector('[aria-label=' + CSS.escape('节点标题') + ']'))`,
		'story beat inspector'
	);
	await fillByLabel(client, '节点标题', '错位时刻表（作者修订）');
	await clickButton(client, '锁定此节点', '.structured-outline-inspector');
	await waitFor(
		client,
		`[...document.querySelectorAll('.structured-outline-inspector button')]
			.some(button => button.textContent?.replace(/\\s+/gu, ' ').trim() === '解除节点锁定')`,
		'locked outline node'
	);
	await clickButton(client, '保存大纲', '.structured-outline-toolbar');
	await delay(500);

	const idsAfterDrag = await evaluate(client, `[
		...document.querySelectorAll('[data-testid="outline-card-title"]')
	].map(element => element.textContent?.trim())`);
	return { initialCardLabels: initialIds, cardTitlesAfterDrag: idsAfterDrag };
}

async function installOutlineAlternativeFixture(client) {
	const installed = await evaluate(client, `(() => {
		const nativeInternals = window.__TAURI_INTERNALS__;
		if (!nativeInternals?.invoke || typeof window.fetch !== 'function') return false;
		if (window.__writingBuddyGateDFetchFixture) return true;
		const originalFetch = window.fetch.bind(window);
		window.__writingBuddyGateDCalls = [];
		const dispatch = (channelId, index, message) => {
			const raw = { index, message };
			if (typeof nativeInternals.runCallback === 'function') {
				nativeInternals.runCallback(channelId, raw);
				return;
			}
			const callback = nativeInternals.callbacks?.get?.(channelId)
				?? nativeInternals.callbacks?.[channelId];
			if (typeof callback === 'function') callback(raw);
		};
		const response = value => ({
			headers: {
				get(name) {
					const normalized = String(name).toLowerCase();
					if (normalized === 'tauri-response') return 'ok';
					if (normalized === 'content-type') return 'application/json';
					return null;
				}
			},
			json: async () => value,
			text: async () => JSON.stringify(value),
			arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(value)).buffer
		});
		window.fetch = async (resource, options) => {
			const url = new URL(
				typeof resource === 'string' ? resource : resource.url,
				location.href
			);
			if (url.hostname !== 'ipc.localhost') {
				return originalFetch(resource, options);
			}
			const command = decodeURIComponent(url.pathname.replace(/^\\//u, ''));
			window.__writingBuddyGateDCalls.push({
				command,
				bodyType: typeof options?.body,
				url: url.href
			});
			if (command === 'ai_get_preferences') {
				return response({
					providerId: 'deepseek',
					defaultModelId: 'deepseek-v4-flash',
					thinkingMode: 'disabled',
					maxOutputTokens: 4096,
					connectionTimeoutMs: 15000,
					firstContentTimeoutMs: 180000,
					streamIdleTimeoutMs: 120000
				});
			}
			if (command !== 'ai_start_generation') {
				return originalFetch(resource, options);
			}
			const body = typeof options?.body === 'string'
				? options.body
				: await new Response(options?.body).text();
			const ipcPayload = JSON.parse(body || '{}');
			const request = ipcPayload?.request;
			const serializedChannel = ipcPayload?.onEvent;
			const channelId = typeof serializedChannel === 'string'
				? Number(serializedChannel.replace(/^__CHANNEL__:/u, ''))
				: serializedChannel?.id;
			const payload = JSON.parse(
				request?.messages?.find(message => message.role === 'user')?.content ?? '{}'
			);
			window.__writingBuddyGateDCalls.push({
				operation: payload.operation,
				channelId,
				jobId: request?.jobId
			});
			if (
				payload.operation !== 'generate-outline-alternatives'
				|| !request?.jobId
				|| !Number.isSafeInteger(channelId)
			) {
				throw new Error('invalidGateDNativeAiFixtureRequest');
			}
			const current = payload.target.current;
			const generatedOutput = JSON.stringify({
				operation: 'generate-outline-alternatives',
				targetId: payload.target.id,
				alternatives: [{
					label: '冲突升级',
					rationale: '让当前线索立刻带来不可逆的私人代价。',
					replacement: {
						...current,
						summary: '主角找到脚印源头，却发现姐姐的名字刻在站台下。',
						conflict: '公开线索会让姐姐成为旧案唯一嫌疑人。',
						hook: '最后一枚脚印出现在主角身后。'
					}
				}, {
					label: '人物驱动',
					rationale: '把外部谜团转化为主角与跟踪者之间的主动选择。',
					replacement: {
						...current,
						summary: '主角必须在跟踪者与姐姐留下的线索之间作出选择。',
						conflict: '跟踪者声称自己也收到过姐姐的雨夜来信。'
					}
				}, {
					label: '节奏收紧',
					rationale: '减少解释并提前呈现代价。',
					replacement: {
						...current,
						title: '脚印反噬',
						outcome: '主角进入维修通道，却失去离站的唯一钥匙。'
					}
				}]
			});
			const events = [
				{ type: 'job_started', jobId: request.jobId },
				{ type: 'connection_opened', jobId: request.jobId },
				{ type: 'content_delta', jobId: request.jobId, text: generatedOutput },
				{
					type: 'usage',
					jobId: request.jobId,
					usage: {
						inputTokens: 120,
						outputTokens: 180,
						totalTokens: 300,
						cachedInputTokens: 0
					}
				},
				{ type: 'completed', jobId: request.jobId, finishReason: 'stop' }
			];
			events.forEach((event, index) => {
				setTimeout(() => dispatch(channelId, index, event), 15 * (index + 1));
			});
			setTimeout(() => nativeInternals.runCallback(channelId, {
				index: events.length,
				end: true
			}), 15 * (events.length + 1));
			return response(null);
		};
		window.__writingBuddyGateDFetchFixture = true;
		return true;
	})()`);
	assert(installed, 'Could not install the bounded native Gate D AI fixture.');
}

async function collectAuthorControlMetrics(client) {
	return evaluate(client, `(() => {
		const workspace = document.querySelector('.structured-outline-workspace');
		const review = document.querySelector('.structured-outline-candidate-review');
		if (!workspace || !review) return { missingReview: true };
		const visible = element => {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return rect.width > 0 && rect.height > 0
				&& style.display !== 'none' && style.visibility !== 'hidden';
		};
		const controls = [...review.querySelectorAll('button, input, select')]
			.filter(visible);
		return {
			missingReview: false,
			viewport: { width: innerWidth, height: innerHeight },
			pageOverflowX: Math.max(
				0,
				document.documentElement.scrollWidth - document.documentElement.clientWidth
			),
			workspaceOverflowX: Math.max(0, workspace.scrollWidth - workspace.clientWidth),
			reviewOverflowX: Math.max(0, review.scrollWidth - review.clientWidth),
			undersizedControls: controls.flatMap(element => {
				const touchTarget = element instanceof HTMLInputElement
					&& element.type === 'checkbox'
					? element.closest('label') ?? element
					: element;
				const rect = touchTarget.getBoundingClientRect();
				return rect.height < 44 ? [{
					label: element.getAttribute('aria-label')
						?? element.textContent?.replace(/\\s+/gu, ' ').trim(),
					width: Math.round(rect.width),
					height: Math.round(rect.height)
				}] : [];
			}),
			selectedTabCount: review.querySelectorAll('[role="tab"][aria-selected="true"]').length,
			fieldDiffCount: review.querySelectorAll('.structured-outline-field-diff').length,
			reviewHeight: Math.round(review.getBoundingClientRect().height),
			reviewVisibleInViewport: review.getBoundingClientRect().top < innerHeight
				&& review.getBoundingClientRect().bottom > 0
		};
	})()`);
}

async function exerciseAuthorControl(client, projectRoot) {
	await installOutlineAlternativeFixture(client);
	await evaluate(client, `document.querySelectorAll('.structured-outline-card')[0]?.click(); true`);
	await waitFor(
		client,
		`[...document.querySelectorAll('.structured-outline-inspector button')]
			.some(button => button.textContent?.replace(/\\s+/gu, ' ').trim() === '生成 3 个局部候选')`,
		'outline alternative action'
	);
	const versionsBefore = await invoke(client, 'list_versions', { projectRoot });
	await clickButton(client, '生成 3 个局部候选', '.structured-outline-inspector');
	await delay(1_000);
	const generationDiagnostic = await evaluate(client, `(() => ({
		reviewReady: Boolean(document.querySelector('.structured-outline-candidate-review')),
		calls: window.__writingBuddyGateDCalls,
		alerts: [...document.querySelectorAll('[role="alert"]')]
			.map(element => element.textContent?.replace(/\\s+/gu, ' ').trim()),
		callbackIds: [...(window.__TAURI_INTERNALS__?.callbacks?.keys?.() ?? [])],
		inspectorButtons: [...document.querySelectorAll('.structured-outline-inspector button')]
			.map(element => ({
				disabled: element.disabled,
				text: element.textContent?.replace(/\\s+/gu, ' ').trim()
			})),
		status: document.querySelector('.creation-journey-status')?.textContent
			?.replace(/\\s+/gu, ' ').trim()
	}))()`);
	assert(
		generationDiagnostic.reviewReady,
		`Native AI fixture did not create candidate review: ${JSON.stringify(generationDiagnostic)}`
	);
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-candidate-review'))`,
		'three-candidate field diff'
	);
	const comparison = await evaluate(client, `(() => ({
		currentVisible: [...document.querySelectorAll('.structured-outline-candidate-tabs > span')]
			.some(element => element.textContent?.trim() === 'Current'),
		tabLabels: [...document.querySelectorAll('.structured-outline-candidate-tabs [role="tab"]')]
			.map(element => element.textContent?.replace(/\\s+/gu, ' ').trim()),
		selectedTabCount: document.querySelectorAll(
			'.structured-outline-candidate-tabs [role="tab"][aria-selected="true"]'
		).length,
		changedFieldLabels: [...document.querySelectorAll(
			'.structured-outline-field-diff-heading strong'
		)].map(element => element.textContent?.trim())
	}))()`);
	assert(comparison.currentVisible, 'Current comparison column was not visible.');
	assert(
		JSON.stringify(comparison.tabLabels) === JSON.stringify([
			'A · 冲突升级',
			'B · 人物驱动',
			'C · 节奏收紧'
		]),
		`Unexpected candidate tabs: ${JSON.stringify(comparison.tabLabels)}`
	);
	assert(comparison.selectedTabCount === 1, 'Exactly one candidate tab should be selected.');
	assert(
		JSON.stringify(comparison.changedFieldLabels) === JSON.stringify([
			'一句话概要',
			'核心冲突',
			'结尾钩子'
		]),
		`Unexpected field diff: ${JSON.stringify(comparison.changedFieldLabels)}`
	);

	const captures = [];
	for (const profile of [
		{ width: 1536, height: 992, name: '01-candidate-diff-1536x992.png' },
		{ width: 1280, height: 800, name: '02-candidate-diff-1280x800.png' },
		{ width: 1024, height: 720, name: '03-candidate-diff-1024x720.png' }
	]) {
		await setViewport(client, profile.width, profile.height);
		const metrics = await collectAuthorControlMetrics(client);
		assert(!metrics.missingReview, `Candidate review missing at ${profile.width}x${profile.height}.`);
		assert(metrics.pageOverflowX === 0, `Candidate page overflow: ${JSON.stringify(metrics)}`);
		assert(
			metrics.workspaceOverflowX === 0 && metrics.reviewOverflowX === 0,
			`Candidate review overflow: ${JSON.stringify(metrics)}`
		);
		assert(
			metrics.undersizedControls.length === 0,
			`Candidate controls below 44px: ${JSON.stringify(metrics.undersizedControls)}`
		);
		assert(metrics.selectedTabCount === 1, 'Candidate selection was lost during resize.');
		assert(metrics.fieldDiffCount === 3, 'Field Diff count changed during resize.');
		assert(metrics.reviewVisibleInViewport, 'Candidate review scrolled fully outside the viewport.');
		await screenshot(client, profile.name);
		captures.push({ name: profile.name, ...metrics });
	}

	await setViewport(client, 1536, 992);
	const unchecked = await evaluate(client, `(() => {
		const checkbox = document.querySelector(
			'input[aria-label=' + CSS.escape('采用 一句话概要') + ']'
		);
		if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return false;
		checkbox.click();
		return !checkbox.checked;
	})()`);
	assert(unchecked, 'Could not exclude the summary field from partial apply.');
	await clickButton(client, '采用已选 2 个字段', '.structured-outline-candidate-review');
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-impact-report'))`,
		'impact report after partial apply'
	);
	await screenshot(client, '04-impact-report-after-partial-apply-1536x992.png');

	const appliedFile = await invoke(client, 'read_creation_journey_state', { projectRoot });
	const applied = JSON.parse(appliedFile.content);
	const target = applied.outline.find(node => node.id === 'journey-outline:rain-beat-2');
	assert(
		target.summary === '雨水显出一串不可能存在的脚印。',
		`Unselected summary changed: ${target.summary}`
	);
	assert(
		target.conflict === '公开线索会让姐姐成为旧案唯一嫌疑人。',
		`Selected conflict was not applied: ${target.conflict}`
	);
	assert(
		target.hook === '最后一枚脚印出现在主角身后。',
		`Selected hook was not applied: ${target.hook}`
	);
	assert(target.source === 'ai_revised', 'Applied node was not marked as AI revised.');
	const versionsAfterApply = await invoke(client, 'list_versions', { projectRoot });
	assert(
		versionsAfterApply.length === versionsBefore.length + 1,
		'Partial apply did not create exactly one safety snapshot.'
	);

	const impact = await evaluate(client, `(() => ({
		copy: document.querySelector('.structured-outline-impact-report')?.textContent
			?.replace(/\\s+/gu, ' ').trim(),
		downstreamCount: document.querySelectorAll(
			'.structured-outline-impact-report li'
		).length,
		chapterOrSceneNodes: [...document.querySelectorAll('.structured-outline-tree button')]
			.filter(button => /章节|场景/u.test(button.textContent ?? '')).length
	}))()`);
	assert(impact.copy?.includes('只报告，不会自动重写'), 'Impact report missed no-rewrite copy.');
	assert(impact.downstreamCount === 4, `Unexpected downstream count: ${impact.downstreamCount}`);
	assert(impact.chapterOrSceneNodes === 0, 'Partial apply fabricated Chapter/Scene nodes.');

	await clickButton(client, '撤销本次 AI 采用', '.structured-outline-impact-report');
	await waitFor(
		client,
		`!document.querySelector('.structured-outline-impact-report')`,
		'guarded AI apply undo'
	);
	const restoredFile = await invoke(client, 'read_creation_journey_state', { projectRoot });
	const restored = JSON.parse(restoredFile.content);
	const restoredTarget = restored.outline.find(
		node => node.id === 'journey-outline:rain-beat-2'
	);
	assert(
		restoredTarget.conflict === '脚印在封闭站台中央消失',
		`Undo did not restore conflict: ${restoredTarget.conflict}`
	);
	assert(
		restoredTarget.hook === '通道里亮起旧时刻表',
		`Undo did not restore hook: ${restoredTarget.hook}`
	);
	const versionsAfterUndo = await invoke(client, 'list_versions', { projectRoot });
	assert(
		versionsAfterUndo.length === versionsBefore.length + 2,
		'Undo did not create its own safety snapshot.'
	);
	return {
		comparison,
		captures,
		versionsBefore: versionsBefore.length,
		versionsAfterApply: versionsAfterApply.length,
		versionsAfterUndo: versionsAfterUndo.length,
		partiallyAppliedFields: ['conflict', 'hook'],
		restoredConflict: restoredTarget.conflict,
		restoredHook: restoredTarget.hook
	};
}

async function verifyPersistedState(client, projectRoot) {
	const file = await invoke(client, 'read_creation_journey_state', { projectRoot });
	assert(file?.content && file?.hash, 'Native journey file was not readable after save.');
	const state = JSON.parse(file.content);
	const expectedIds = [
		'journey-outline:rain-beat-2',
		'journey-outline:rain-beat-3',
		'journey-outline:rain-beat-1',
		'journey-outline:rain-beat-4',
		'journey-outline:rain-beat-5'
	];
	assert(
		state.storyOutline?.title === '雨夜车站：修订大纲',
		`Root title was not persisted: ${state.storyOutline?.title}`
	);
	assert(
		JSON.stringify(state.outline.map(node => node.id)) === JSON.stringify(expectedIds),
		`Outline order was not persisted: ${JSON.stringify(state.outline.map(node => node.id))}`
	);
	assert(
		state.outline.every((node, index) => node.order === index),
		`Outline order fields were not normalized: ${JSON.stringify(
			state.outline.map(node => node.order)
		)}`
	);
	assert(
		state.outline[1].title === '错位时刻表（作者修订）',
		`Node edit was not persisted: ${state.outline[1].title}`
	);
	assert(
		JSON.stringify(state.locks.outlineNodeIds) === JSON.stringify([
			'journey-outline:rain-beat-3'
		]),
		`Node lock was not persisted: ${JSON.stringify(state.locks.outlineNodeIds)}`
	);
	assert(state.chapters.length === 0, 'Structured outline unexpectedly materialized chapters.');
	return {
		hash: file.hash,
		revision: state.revision,
		storyOutlineRevision: state.storyOutline.revision,
		outlineIds: state.outline.map(node => node.id),
		outlineOrders: state.outline.map(node => node.order),
		lockedIds: state.locks.outlineNodeIds,
		chapterCount: state.chapters.length
	};
}

async function reopenAndVerify(client) {
	await client.call('Page.reload', { ignoreCache: true });
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'app shell after reopen');
	await openCreationJourney(client);
	await waitFor(
		client,
		`Boolean(document.querySelector('.structured-outline-workspace'))`,
		'structured outline after reopen'
	);
	const restored = await evaluate(client, `(() => ({
		title: document.querySelector('[aria-label=' + CSS.escape('故事标题') + ']')?.value,
		cardTitles: [...document.querySelectorAll('[data-testid="outline-card-title"]')]
			.map(element => element.textContent?.trim()),
		lockedCardCount: document.querySelectorAll('.structured-outline-card.is-locked').length,
		chapterOrSceneNodes: [...document.querySelectorAll('.structured-outline-tree button')]
			.filter(button => /章节|场景/u.test(button.textContent ?? '')).length
	}))()`);
	assert(restored.title === '雨夜车站：修订大纲', 'Root title did not survive native reopen.');
	assert(
		restored.cardTitles[1] === '错位时刻表（作者修订）',
		'Node title did not survive native reopen.'
	);
	assert(restored.cardTitles[2] === '雨夜来信', 'Card order did not survive native reopen.');
	assert(restored.lockedCardCount === 1, 'Node lock did not survive native reopen.');
	assert(
		restored.chapterOrSceneNodes === 0,
		'The structured outline tree displayed fabricated Chapter/Scene nodes.'
	);
	return restored;
}

await mkdir(outputDirectory, { recursive: true });
const temporaryRoot = await mkdtemp(join(tmpdir(), 'writing-buddy-genre-to-draft-'));
const projectParent = join(temporaryRoot, 'projects');
const profileDirectory = join(temporaryRoot, 'webview-profile');
await mkdir(projectParent, { recursive: true });
await mkdir(profileDirectory, { recursive: true });

const appOutput = [];
const child = spawn(executable, [], {
	env: {
		...process.env,
		WEBVIEW2_USER_DATA_FOLDER: profileDirectory
	},
	stdio: ['ignore', 'pipe', 'pipe'],
	windowsHide: true
});
child.stdout?.on('data', chunk => appOutput.push(chunk.toString()));
child.stderr?.on('data', chunk => appOutput.push(chunk.toString()));

let client;
let closedNormally = false;
try {
	const target = await waitForTarget(child);
	client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	const runtimeErrors = [];
	const consoleErrors = [];
	client.on('Runtime.exceptionThrown', params => {
		runtimeErrors.push(
			params.exceptionDetails?.exception?.description
			?? params.exceptionDetails?.text
			?? 'Uncaught runtime exception'
		);
	});
	client.on('Runtime.consoleAPICalled', params => {
		if (params.type === 'error') {
			consoleErrors.push(params.args.map(argument => (
				argument.value ?? argument.description ?? ''
			)).join(' '));
		}
	});
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	await client.call('DOM.enable');
	await setViewport(client, 1536, 992);
	await waitFor(client, `Boolean(document.querySelector('.app-shell'))`, 'native app shell');
	const shellReadyMs = Math.round(performance.now() - acceptanceStartedAt);
	assert(
		await evaluate(client, `Boolean(window.__TAURI_INTERNALS__?.invoke)`),
		'Acceptance target is not the native Tauri runtime.'
	);

	const seed = await seedFreshProject(client, projectParent);
	const firstWorkspaceReadyMs = Math.round(performance.now() - acceptanceStartedAt);
	const interaction = await exerciseWorkspace(client);
	const authorControl = await exerciseAuthorControl(client, seed.created.root);
	const persisted = await verifyPersistedState(client, seed.created.root);

	const captures = [];
	for (const profile of [
		{ width: 1536, height: 992, name: '05-structured-outline-1536x992.png', mode: 'three-pane' },
		{ width: 1280, height: 800, name: '06-structured-outline-1280x800.png', mode: 'three-pane' },
		{ width: 1024, height: 720, name: '07-structured-outline-stacked-1024x720.png', mode: 'stacked-inspector' }
	]) {
		await setViewport(client, profile.width, profile.height);
		const metrics = await collectMetrics(client, profile.mode);
		assert(!metrics.missingWorkspace, `Workspace missing at ${profile.width}x${profile.height}.`);
		assert(metrics.pageOverflowX === 0, `Page overflowed horizontally: ${JSON.stringify(metrics)}`);
		assert(metrics.pageOverflowY === 0, `Page overflowed vertically: ${JSON.stringify(metrics)}`);
		assert(
			metrics.workspaceOverflowX === 0,
			`Workspace overflowed horizontally: ${JSON.stringify(metrics)}`
		);
		assert(
			metrics.primaryActionCount === 1,
			`Expected one enabled primary action: ${JSON.stringify(metrics)}`
		);
		assert(
			metrics.undersizedControls.length === 0,
			`Found controls below 44px: ${JSON.stringify(metrics.undersizedControls)}`
		);
		if (profile.mode === 'stacked-inspector') {
			assert(
				metrics.inspector.top >= Math.min(
					metrics.tree.top + metrics.tree.height,
					metrics.cards.top + metrics.cards.height
				) - 2,
				`Inspector did not stack below the outline panes: ${JSON.stringify(metrics)}`
			);
		} else {
			assert(
				metrics.tree.top === metrics.cards.top && metrics.cards.top === metrics.inspector.top,
				`Desktop panes were not aligned: ${JSON.stringify(metrics)}`
			);
		}
		await screenshot(client, profile.name);
		captures.push({ name: profile.name, ...metrics });
	}

	await setViewport(client, 1536, 992);
	const restored = await reopenAndVerify(client);
	await screenshot(client, '08-native-reopen-restored-1536x992.png');
	assert(
		runtimeErrors.length === 0,
		`Native runtime exceptions occurred: ${JSON.stringify(runtimeErrors)}`
	);
	assert(
		consoleErrors.length === 0,
		`Native console errors occurred: ${JSON.stringify(consoleErrors)}`
	);

	const report = {
		generatedAt: new Date().toISOString(),
		executable,
		runtime: 'tauri-webview2',
		freshProject: {
			projectId: seed.created.projectId,
			firstChapterId: seed.created.firstChapterId ?? null,
			createdFileCount: seed.created.createdFileCount,
			createdDirectoryCount: seed.created.createdDirectoryCount
		},
		interaction,
		authorControl,
		persisted,
		restored,
		captures,
		runtimeErrors,
		consoleErrors,
		performance: {
			shellReadyMs,
			firstWorkspaceReadyMs,
			acceptanceBeforeShutdownMs: Math.round(performance.now() - acceptanceStartedAt)
		}
	};

	const closeRequest = spawnSync('taskkill', ['/PID', String(child.pid)], {
		encoding: 'utf8',
		windowsHide: true
	});
	await delay(350);
	let shutdownMode = 'window-close';
	if (
		child.exitCode === null
		&& await evaluate(client, `Boolean(document.querySelector('.close-protection-dialog'))`)
	) {
		shutdownMode = 'close-protection-confirmed';
		await clickButton(client, '不保存并退出', '.close-protection-dialog');
	}
	for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt += 1) {
		await delay(100);
	}
	closedNormally = child.exitCode !== null;
	assert(closedNormally, 'Writing Buddy did not exit after a normal window-close request.');
	await writeFile(metricsPath, `${JSON.stringify({
		...report,
		shutdown: {
			mode: shutdownMode,
			exitCode: child.exitCode,
			closeRequestStatus: closeRequest.status,
			closeRequestError: closeRequest.error?.message ?? null
		}
	}, null, 2)}\n`);
	console.log(`Native Genre-to-Draft Gate D acceptance passed: ${metricsPath}`);
} finally {
	client?.close();
	if (child.pid && child.exitCode === null) {
		spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
	if (!closedNormally && appOutput.length) {
		console.error(appOutput.join('').slice(-8_000));
	}
	if (temporaryRoot.startsWith(tmpdir())) {
		await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 4 });
	}
}
