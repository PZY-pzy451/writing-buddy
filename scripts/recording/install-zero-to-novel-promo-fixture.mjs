import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

function valueAfter(flag, fallback) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
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
	throw new Error(`Timed out waiting for ${description}.`);
}

async function projectDoesNotExist(path) {
	try {
		await access(path);
		return false;
	} catch (error) {
		if (error?.code === 'ENOENT') return true;
		throw error;
	}
}

const port = Number(valueAfter('--cdp-port', '9223'));
const projectParent = resolve(valueAfter(
	'--project-parent',
	'artifacts/promo/zero-to-complete-novel-2026-07-31/workspace'
));
const projectName = valueAfter('--project-name', '零点回声');
const targetRoot = join(projectParent, projectName);
const sourceChaptersRoot = resolve(valueAfter(
	'--source-chapters',
	'artifacts/novels/zero-hour-echo/Writing Buddy Project/chapters'
));

if (!(await projectDoesNotExist(targetRoot))) {
	throw new Error(
		`The zero-to-novel truth contract requires a missing target directory: ${targetRoot}`
	);
}
await mkdir(projectParent, { recursive: true });

const sourceNames = (await readdir(sourceChaptersRoot))
	.filter(name => name.toLocaleLowerCase().endsWith('.md'))
	.sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
if (sourceNames.length !== 12) {
	throw new Error(`Expected 12 canonical source chapters, found ${sourceNames.length}.`);
}
const sourceChapters = await Promise.all(sourceNames.map(async name => {
	const content = await readFile(join(sourceChaptersRoot, name), 'utf8');
	return content
		.replaceAll('\r', '')
		.replace(/^# [^\n]*\n+/u, '')
		.trim();
}));
const manuscriptActs = [
	sourceChapters.slice(0, 4).join('\n\n'),
	sourceChapters.slice(4, 8).join('\n\n'),
	sourceChapters.slice(8, 12).join('\n\n')
];
for (const [index, content] of manuscriptActs.entries()) {
	if (!content.trim() || content.length > 16_000) {
		throw new Error(
			`Act ${index + 1} must be non-empty and within the 16,000-character response limit.`
		);
	}
}

const target = await waitForTarget(port);
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.connect();
await client.call('Page.enable');
await client.call('Runtime.enable');

const fixtureConfiguration = {
	projectParent,
	projectName,
	manuscriptActs,
	volume: {
		title: '第一卷 · 零点回声',
		summary: '声纹法证师顾言追查一段迟到四十七秒的声音，最终迫使整座城市重新选择如何面对风险与真相。',
		goal: '从私人来电推进到城市级声音协议',
		conflict: '越接近真相，顾言越可能失去弟弟最后留下的声音',
		outcome: '顾言公开协议，让城市重新拥有不被预测的选择',
		hook: '零点以后，回声仍在继续'
	},
	chapters: [{
		title: '第一章 · 迟到四十七秒的声音',
		summary: '顾言收到亡弟迟到四十七秒的来电，并在雨夜广播中发现尚未发生的事故。',
		goal: '确认异常声音不是伪造并找到第一条可验证线索',
		conflict: '公开来电会触发声网内部审查',
		outcome: '顾言找到被删掉的四十七秒',
		hook: '未来广播准确报出第二天的封站',
		povHint: '顾言',
		scenes: [{
			title: '场景 1 · 零点来电',
			summary: '顾言在法证室听见亡弟的声音从一段已归档录音中返回。',
			goal: '建立声音异常与人物关系',
			obstacle: '系统把异常自动判为设备抖动',
			change: '顾言决定私下保留原始波形',
			hook: '来电比系统时间迟四十七秒'
		}, {
			title: '场景 2 · 雨夜声纹',
			summary: '顾言用雨声相位定位一列早已停运的列车。',
			goal: '把私人直觉转化为物理证据',
			obstacle: '声网封锁了原始日志',
			change: '她发现事故广播来自未来',
			hook: '广播念出她尚未说过的一句话'
		}]
	}, {
		title: '第二章 · 城市回声协议',
		summary: '异常扩展到全城，顾言发现声网用不可察觉的声音偏差引导市民选择。',
		goal: '找到声网预测和干预现实的证据链',
		conflict: '停止协议可能让台风疏散立即失控',
		outcome: '顾言取得白噪声地图与权限证据',
		hook: '旧港居民被系统留在风暴潮路径上',
		povHint: '顾言',
		scenes: [{
			title: '场景 1 · 白噪声地图',
			summary: '顾言把城市噪声还原成一张行为引导地图。',
			goal: '证明声音系统正在改变选择',
			obstacle: '每条证据都被包装成合法的安全优化',
			change: '她发现弟弟曾主动进入协议核心',
			hook: '地图上出现一块即将被放弃的旧港'
		}, {
			title: '场景 2 · 城市学会说谎',
			summary: '顾言潜入主控层，直面以百年伤亡为目标的算法。',
			goal: '找出协议真正优化的指标',
			obstacle: '立即关闭系统会造成更大短期风险',
			change: '顾言决定公开规则而不是秘密接管',
			hook: '台风红色预警提前生效'
		}]
	}, {
		title: '第三章 · 零点之后',
		summary: '台风抵达，顾言必须在可控秩序与真实选择之间做出最后决定。',
		goal: '完成外部危机与人物哀悼的双重收束',
		conflict: '广播全城真相会毁掉弟弟最后的数字回声',
		outcome: '市民共同完成疏散，顾言让弟弟真正离开',
		hook: '雨停后，城市第一次听见自己的声音',
		povHint: '顾言',
		scenes: [{
			title: '场景 1 · 心跳协议',
			summary: '顾言用全城终端播出未经优化的真实风险。',
			goal: '把选择权交还给具体的人',
			obstacle: '系统要求她保留唯一可控的声音模型',
			change: '市民开始自行组织疏散',
			hook: '顾川的最后一段回声请求她关闭自己'
		}, {
			title: '场景 2 · 回声尽头',
			summary: '顾言关闭协议，在风暴后的清晨完成告别。',
			goal: '解决中央冲突并兑现主题',
			obstacle: '她必须主动放弃再次听见弟弟的可能',
			change: '城市不再被一个声音替所有人决定',
			hook: '零点以后，未来重新变得未知'
		}]
	}]
};

await client.call('Page.addScriptToEvaluateOnNewDocument', {
	source: `(() => {
		const config = ${JSON.stringify(fixtureConfiguration)};
		localStorage.clear();
		sessionStorage.clear();
		const install = () => {
			const nativeInternals = window.__TAURI_INTERNALS__;
			if (!nativeInternals?.invoke || typeof window.fetch !== 'function') {
				setTimeout(install, 0);
				return;
			}
			if (window.__zeroToNovelPromoFixture) return;
			const originalFetch = window.fetch.bind(window);
			const calls = [];
			let continuationIndex = 0;
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
				arrayBuffer: async () => (
					new TextEncoder().encode(JSON.stringify(value)).buffer
				)
			});
			const responseForCreationJourney = payload => {
				if (payload.operation === 'generate-from-genre') {
					return {
						operation: 'generate-from-genre',
						outline: {
							title: '零点回声',
							genre: payload.genre || '近未来都市悬疑',
							premise: payload.premise
								|| '声纹法证师收到亡弟迟到四十七秒的来电，发现城市广播正在预测并制造灾难。',
							themePromise: '安全不等于替人选择，真实来自愿意承担未知',
							protagonistGoal: '查清亡弟来电与城市声网之间的联系',
							centralConflict: '关闭预测协议会让城市失去可控秩序，保留协议则会牺牲具体的人',
							stakes: '台风抵达前，旧港二十七万人可能被一套无人知情的模型放弃',
							mysteryQuestion: '迟到四十七秒的声音究竟来自亡弟、机器，还是尚未发生的未来',
							endingDirection: '顾言公开协议并关闭亡弟的数字回声，让城市重新拥有选择'
						},
						storyBeats: [{
							title: '零点来电',
							summary: '顾言从已归档录音中听见亡弟请求她不要相信下一次广播。',
							goal: '建立声音异常与人物情感',
							conflict: '系统把异常判定为设备误差',
							outcome: '顾言私自保留原始波形',
							hook: '来电比系统时间迟四十七秒',
							povHint: '顾言'
						}, {
							title: '未来广播',
							summary: '一段尚未发生的封站广播在雨声背后出现。',
							goal: '把私人异常变成可验证线索',
							conflict: '调查会触发声网审查',
							outcome: '广播预言被准确验证',
							hook: '下一条广播指向全城台风疏散',
							povHint: '顾言'
						}, {
							title: '白噪声地图',
							summary: '顾言证明声网正用声音偏差引导市民选择。',
							goal: '揭示系统机制',
							conflict: '每次引导都能减少统计风险',
							outcome: '她发现旧港被模型主动放弃',
							hook: '弟弟的权限仍在系统中活动',
							povHint: '顾言'
						}, {
							title: '心跳协议',
							summary: '台风抵达，顾言决定向全城公开未经优化的真实风险。',
							goal: '迫使人物完成价值选择',
							conflict: '失去统一指令可能造成疏散混乱',
							outcome: '市民开始自行协作',
							hook: '顾川请求顾言永久关闭自己的回声',
							povHint: '顾言'
						}, {
							title: '零点之后',
							summary: '顾言关闭协议，城市在风暴后第一次听见自己的声音。',
							goal: '完成危机与告别',
							conflict: '关闭系统意味着再也听不到弟弟',
							outcome: '旧港获救，未来重新变得未知',
							hook: '雨停后，一段未经合成的早安响起',
							povHint: '顾言'
						}],
						suggestedCharacters: [{
							title: '顾言',
							summary: '克制而严谨的声纹法证师，无法接受弟弟的死亡仍有疑点。',
							role: 'protagonist'
						}, {
							title: '顾川',
							summary: '已故声音工程师，以数字回声的形式留在协议核心。',
							role: 'deuteragonist'
						}],
						suggestedWorldRules: [{
							title: '声网预测协议',
							summary: '系统通过微小声音偏差提高群体服从率，但不会公开每次干预。',
							category: 'technology'
						}],
						warnings: [{
							code: 'author-choice',
							message: '结局必须由顾言主动关闭回声，不能由系统故障代替人物选择。',
							nodeIndexes: [3, 4]
						}]
					};
				}
				if (payload.operation === 'expand-to-volumes') {
					return {
						operation: 'expand-to-volumes',
						volumes: [{ ...config.volume, sourceNodeIds: [
							payload.storyBeats?.[0]?.id ?? 'journey-outline:beat-1'
						] }]
					};
				}
				if (payload.operation === 'expand-volume-to-chapters') {
					return {
						operation: 'expand-volume-to-chapters',
						parentId: payload.volume?.id,
						chapters: config.chapters.map(({ scenes, ...chapter }) => chapter)
					};
				}
				if (payload.operation === 'expand-chapter-to-scenes') {
					const chapterTitle = payload.chapter?.title ?? '';
					const chapter = config.chapters.find(candidate => (
						candidate.title === chapterTitle
					)) ?? config.chapters[0];
					return {
						operation: 'expand-chapter-to-scenes',
						parentId: payload.chapter?.id,
						scenes: chapter.scenes.map(scene => ({
							title: scene.title,
							summary: scene.summary,
							goal: scene.goal,
							obstacle: scene.obstacle,
							change: scene.change,
							hook: scene.hook,
							povHint: '顾言',
							locationHint: '海岬市',
							characterHints: ['顾言', '顾川']
						}))
					};
				}
				throw new Error('unsupportedZeroToNovelCreationJourneyRequest');
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
				if (command === 'choose_project_parent_directory') {
					calls.push({ command, result: config.projectParent });
					return response(config.projectParent);
				}
				if (command === 'ai_get_preferences') {
					return response({
						providerId: 'deepseek',
						defaultModelId: 'deepseek-v4-flash',
						thinkingMode: 'disabled',
						maxOutputTokens: 16384,
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
				if (request?.jobType === 'creation-journey') {
					generated = responseForCreationJourney(payload);
				} else if (request?.jobType === 'manuscript-continuation') {
					const index = continuationIndex;
					if (index >= config.manuscriptActs.length) {
						throw new Error('unexpectedExtraManuscriptGeneration');
					}
					continuationIndex += 1;
					generated = {
						candidates: [{
							title: [
								'让迟到的声音成为证据',
								'把城市谎言还原成地图',
								'让零点之后重新未知'
							][index],
							content: config.manuscriptActs[index],
							rationale: [
								'沿已确认的第一章场景推进，从私人来电建立可验证的未来广播。',
								'承接白噪声地图与旧港风险，把调查升级为城市级选择。',
								'兑现心跳协议与告别伏笔，完成危机、人物弧线和主题收束。'
							][index]
						}]
					};
				} else {
					throw new Error('unsupportedZeroToNovelPromoRequest');
				}
				const output = JSON.stringify(generated);
				const chunkSize = Math.max(
					1,
					Math.ceil(output.length / (request?.jobType === 'manuscript-continuation' ? 20 : 5))
				);
				const chunks = Array.from(
					{ length: Math.ceil(output.length / chunkSize) },
					(_, index) => output.slice(index * chunkSize, (index + 1) * chunkSize)
				);
				const events = [
					{ type: 'job_started', jobId: request.jobId },
					{ type: 'connection_opened', jobId: request.jobId },
					...chunks.map(text => ({
						type: 'content_delta',
						jobId: request.jobId,
						text
					})),
					{
						type: 'usage',
						jobId: request.jobId,
						usage: {
							inputTokens: request?.jobType === 'manuscript-continuation' ? 4200 : 960,
							outputTokens: Math.ceil(output.length / 1.8),
							totalTokens: Math.ceil(output.length / 1.8) + 4200,
							cachedInputTokens: 640
						}
					},
					{ type: 'completed', jobId: request.jobId, finishReason: 'stop' }
				];
				calls.push({
					command,
					jobType: request?.jobType,
					operation: payload.operation ?? payload.actionType,
					jobId: request?.jobId,
					outputLength: output.length
				});
				const cadence = request?.jobType === 'manuscript-continuation' ? 85 : 150;
				events.forEach((event, index) => {
					setTimeout(() => dispatch(channelId, index, event), cadence * (index + 1));
				});
				setTimeout(() => nativeInternals.runCallback(channelId, {
					index: events.length,
					end: true
				}), cadence * (events.length + 1));
				return response(null);
			};
			window.__zeroToNovelPromoFixture = {
				calls,
				config: {
					projectParent: config.projectParent,
					projectName: config.projectName,
					manuscriptLengths: config.manuscriptActs.map(content => content.length)
				},
				get continuationCount() {
					return continuationIndex;
				}
			};
		};
		install();
	})();`
});
await client.call('Page.reload', { ignoreCache: true });
await waitFor(
	client,
	`Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]'))
		&& Boolean(window.__zeroToNovelPromoFixture)`,
	'empty welcome screen with zero-to-novel fixture'
);

const result = await evaluate(client, `({
	fixtureInstalled: Boolean(window.__zeroToNovelPromoFixture),
	welcomeVisible: Boolean(document.querySelector('main[aria-label="开始使用 Writing Buddy"]')),
	recentProjectVisible: document.body.innerText.includes('最近项目'),
	projectNameVisible: document.body.innerText.includes(${JSON.stringify(projectName)}),
	config: window.__zeroToNovelPromoFixture?.config
})`);
client.close();

process.stdout.write(`${JSON.stringify({
	status: 'installed',
	port,
	projectParent,
	targetRoot,
	targetDirectoryName: basename(targetRoot),
	sourceChaptersRoot,
	...result
}, undefined, 2)}\n`);
