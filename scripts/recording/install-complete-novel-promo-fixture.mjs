import { resolve } from 'node:path';

const projectRoot = resolve(process.argv[2] ?? '');
const port = Number(process.argv[3] ?? 9223);
if (!process.argv[2]) {
	throw new Error('Usage: node install-complete-novel-promo-fixture.mjs <project-root> [cdp-port]');
}

function delay(milliseconds) {
	return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

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

async function waitForTarget() {
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
			// The recording build is still starting.
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

async function waitFor(client, expression, description) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(80);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

const target = await waitForTarget();
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.connect();
await client.call('Page.enable');
await client.call('Runtime.enable');

const workspace = JSON.stringify({
	state: {
		recentProjectRoot: projectRoot,
		recentProjectRoots: [projectRoot],
		activeMode: 'works',
		storyView: 'characters',
		theme: 'paper',
		accent: 'blue',
		sidebarOpen: true,
		sidebarWidth: 272,
		assistantWidth: 360,
		dockHeight: 240
	},
	version: 2
});
await client.call('Page.addScriptToEvaluateOnNewDocument', {
	source: `localStorage.setItem(
		'writing-buddy-next-workspace',
		${JSON.stringify(workspace)}
	);`
});
await client.call('Page.reload', { ignoreCache: true });
await waitFor(
	client,
	`document.body.innerText.includes('零点回声')
		&& document.body.innerText.includes('12 章')`,
	'complete novel dashboard'
);

const installed = await evaluate(client, `(() => {
	const nativeInternals = window.__TAURI_INTERNALS__;
	if (!nativeInternals?.invoke || typeof window.fetch !== 'function') return false;
	if (window.__writingBuddyPromoFixture) return true;
	const originalFetch = window.fetch.bind(window);
	window.__writingBuddyPromoCalls = [];
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
	const chunk = (value, count = 3) => {
		const size = Math.ceil(value.length / count);
		return Array.from({ length: count }, (_, index) => (
			value.slice(index * size, (index + 1) * size)
		)).filter(Boolean);
	};
	window.fetch = async (resource, options) => {
		const url = new URL(
			typeof resource === 'string' ? resource : resource.url,
			location.href
		);
		if (url.hostname !== 'ipc.localhost') {
			return originalFetch(resource, options);
		}
		const command = decodeURIComponent(url.pathname.replace(/^\\//u, ''));
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
		let generated;
		if (request?.jobType === 'manuscript-continuation') {
			generated = {
				candidates: [{
					title: '追查相位差',
					content: '顾言重新戴上耳机，把那四十七秒拖进相位分析器。波形深处，一列早已停运的列车正从雨声背后驶来。',
					rationale: '延续声音证据，让调查从私人记忆进入可验证的物理线索。'
				}, {
					title: '核验死者声纹',
					content: '她没有立刻相信那声“姐”。顾言调出封存声纹，决定先证明这段声音究竟属于顾川，还是属于一台学会思念的机器。',
					rationale: '强化法证职业选择，并把情感冲突转化为下一步行动。'
				}, {
					title: '打开零点日志',
					content: '零点日志只开放四十七秒。顾言按下确认键，屏幕上却先跳出一条尚未发生的地铁封站通知。',
					rationale: '快速制造新钩子，把“迟到的声音”推进到“提前出现的事故”。'
				}]
			};
			if (payload.actionType !== 'three-directions') {
				generated.candidates = generated.candidates.slice(0, 1);
			}
		} else if (payload.operation === 'generate-outline-alternatives') {
			const current = payload.target.current;
			generated = {
				operation: 'generate-outline-alternatives',
				targetId: payload.target.id,
				alternatives: [{
					label: '证据推进',
					rationale: '让声音异常立刻转化为可验证线索。',
					replacement: {
						...current,
						summary: '顾言恢复零点缺失的四十七秒，并听见尚未发生的地铁封站广播。',
						conflict: '公开异常记录会触发声网内部审查，也可能永久封存顾川的权限。',
						hook: '广播准确报出第二天九点十七分的七号线封站。'
					}
				}, {
					label: '人物选择',
					rationale: '把调查推进建立在顾言是否相信弟弟声音的选择上。',
					replacement: {
						...current,
						summary: '顾言在提交证据与私下追查之间选择后者，第一次违背声证流程。',
						conflict: '她必须决定死者的声音能否成为证据。',
						hook: '顾川的第二条留言要求她不要相信下一次来电。'
					}
				}, {
					label: '悬念收紧',
					rationale: '减少解释，提前呈现城市级风险。',
					replacement: {
						...current,
						title: '被删掉的四十七秒',
						outcome: '顾言找到缺失片段，却发现自己的声纹也在未来广播中。',
						hook: '广播末尾传来顾言尚未说过的一句话。'
					}
				}]
			};
		} else {
			throw new Error('unsupportedPromoFixtureRequest');
		}
		const output = JSON.stringify(generated);
		const events = [
			{ type: 'job_started', jobId: request.jobId },
			{ type: 'connection_opened', jobId: request.jobId },
			...chunk(output).map(text => ({
				type: 'content_delta',
				jobId: request.jobId,
				text
			})),
			{
				type: 'usage',
				jobId: request.jobId,
				usage: {
					inputTokens: 860,
					outputTokens: 246,
					totalTokens: 1106,
					cachedInputTokens: 512
				}
			},
			{ type: 'completed', jobId: request.jobId, finishReason: 'stop' }
		];
		window.__writingBuddyPromoCalls.push({
			jobType: request?.jobType,
			operation: payload.operation,
			jobId: request?.jobId
		});
		events.forEach((event, index) => {
			setTimeout(() => dispatch(channelId, index, event), 90 * (index + 1));
		});
		setTimeout(() => nativeInternals.runCallback(channelId, {
			index: events.length,
			end: true
		}), 90 * (events.length + 1));
		return response(null);
	};
	window.__writingBuddyPromoFixture = true;
	return true;
})()`);
if (!installed) throw new Error('Could not install the Writing Buddy promo fixture.');

const result = await evaluate(client, `({
	title: document.querySelector('h1')?.textContent?.trim()
		?? document.querySelector('h2')?.textContent?.trim(),
	fixtureInstalled: window.__writingBuddyPromoFixture === true,
	projectVisible: document.body.innerText.includes('零点回声'),
	chapterCountVisible: document.body.innerText.includes('12 章')
})`);
client.close();
process.stdout.write(`${JSON.stringify({ projectRoot, port, ...result }, undefined, 2)}\n`);
