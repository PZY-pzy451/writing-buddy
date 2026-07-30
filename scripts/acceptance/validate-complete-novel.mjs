import { spawn, spawnSync } from 'node:child_process';
import {
	appendFile,
	cp,
	mkdir,
	mkdtemp,
	rm,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = resolve(repositoryRoot, 'artifacts', 'novels', 'zero-hour-echo');
const sourceProjectRoot = resolve(artifactRoot, 'Writing Buddy Project');
const reportPath = resolve(artifactRoot, 'acceptance-report.json');
const progressPath = resolve(artifactRoot, 'acceptance-progress.log');
const screenshotRoot = resolve(artifactRoot, 'screenshots');
const executable = resolve(
	process.env.WRITING_BUDDY_EXE
		?? join(
			repositoryRoot,
			'apps',
			'desktop',
			'src-tauri',
			'target',
			'release',
			'writing-buddy-next.exe'
		)
);
const staticOnly = process.argv.includes('--static-only');
const basePort = Number(process.env.WRITING_BUDDY_NATIVE_CDP_PORT ?? 9762);

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

async function progress(message) {
	const line = `${new Date().toISOString()} ${message}\n`;
	process.stdout.write(line);
	await appendFile(progressPath, line, 'utf8');
}

function delay(milliseconds) {
	return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
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

async function invoke(client, command, args = {}) {
	return evaluate(client, `(async () => {
		const invoke = window.__TAURI_INTERNALS__?.invoke;
		if (!invoke) throw new Error('nativeTauriBridgeUnavailable');
		return invoke(${JSON.stringify(command)}, ${JSON.stringify(args)});
	})()`);
}

async function waitFor(client, expression, description, timeout = 30_000) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await evaluate(client, expression)) return;
		await delay(80);
	}
	throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForTarget(child, port) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		assert(child.exitCode === null, `Writing Buddy exited early with ${child.exitCode}.`);
		try {
			const targets = await fetch(`http://127.0.0.1:${port}/json/list`, {
				signal: AbortSignal.timeout(750)
			})
				.then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page'
				&& !candidate.url.startsWith('devtools://')
			));
			if (target) return target;
		} catch {
			// WebView2 is still starting.
		}
		await delay(100);
	}
	throw new Error(`Timed out waiting for native WebView target on ${port}.`);
}

async function launchApp(profileDirectory, port) {
	await mkdir(profileDirectory, { recursive: true });
	const output = [];
	const child = spawn(executable, [], {
		env: {
			...process.env,
			WEBVIEW2_USER_DATA_FOLDER: profileDirectory,
			WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
				`--remote-debugging-port=${port} --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`
		},
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true
	});
	child.stdout?.on('data', chunk => output.push(chunk.toString()));
	child.stderr?.on('data', chunk => output.push(chunk.toString()));
	const target = await waitForTarget(child, port);
	const client = new CdpClient(target.webSocketDebuggerUrl);
	await client.connect();
	await client.call('Page.enable');
	await client.call('Runtime.enable');
	return { child, client, output };
}

async function closeApp(run) {
	const request = spawnSync('taskkill', ['/PID', String(run.child.pid)], {
		encoding: 'utf8',
		windowsHide: true
	});
	for (let attempt = 0; attempt < 80 && run.child.exitCode === null; attempt += 1) {
		await delay(100);
	}
	const closed = run.child.exitCode !== null;
	run.client.close();
	if (!closed && run.child.pid) {
		spawnSync('taskkill', ['/PID', String(run.child.pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	}
	assert(closed, `Writing Buddy did not close normally. ${run.output.join('').slice(-2000)}`);
	return { exitCode: run.child.exitCode, closeRequestStatus: request.status };
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
	await writeFile(join(screenshotRoot, name), Buffer.from(capture.data, 'base64'));
}

async function seedWorkspaceOnReload(client, projectRoot) {
	const workspace = JSON.stringify({
		state: {
			recentProjectRoot: projectRoot,
			recentProjectRoots: [projectRoot],
			activeMode: 'works',
			storyView: 'characters',
			theme: 'paper',
			accent: 'blue'
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
}

const preparation = spawnSync(
	process.execPath,
	[resolve(repositoryRoot, 'scripts', 'acceptance', 'prepare-complete-novel.mjs')],
	{ cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }
);
assert(preparation.status === 0, preparation.stderr || 'Complete novel preparation failed.');
const prepared = JSON.parse(preparation.stdout);
assert(prepared.chapterCount === 12, 'Prepared novel did not contain twelve chapters.');
assert(prepared.sceneCount === 24, 'Prepared novel did not contain twenty-four scenes.');
assert(
	prepared.nonWhitespaceCharacters >= 27_000
		&& prepared.nonWhitespaceCharacters <= 35_000,
	`Complete novel length was outside the acceptance window: ${prepared.nonWhitespaceCharacters}`
);
await writeFile(progressPath, '', 'utf8');
await progress('prepared complete novel');

if (staticOnly) {
	await writeFile(reportPath, `${JSON.stringify({
		generatedAt: new Date().toISOString(),
		mode: 'static-only',
		prepared
	}, undefined, 2)}\n`, 'utf8');
	process.stdout.write(`Complete novel static acceptance passed: ${reportPath}\n`);
	process.exit(0);
}

await mkdir(screenshotRoot, { recursive: true });
const temporaryRoot = await mkdtemp(join(tmpdir(), 'writing-buddy-complete-novel-'));
const acceptanceProjectRoot = join(temporaryRoot, 'zero-hour-echo-project');
await cp(sourceProjectRoot, acceptanceProjectRoot, { recursive: true });

let firstRun;
let secondRun;
try {
	firstRun = await launchApp(join(temporaryRoot, 'profile-first'), basePort);
	await progress('launched first native process');
	const runtimeErrors = [];
	const consoleErrors = [];
	firstRun.client.on('Runtime.exceptionThrown', params => {
		runtimeErrors.push(
			params.exceptionDetails?.exception?.description
				?? params.exceptionDetails?.text
				?? 'Uncaught runtime exception'
		);
	});
	firstRun.client.on('Runtime.consoleAPICalled', params => {
		if (params.type === 'error') {
			consoleErrors.push(params.args.map(argument => (
				argument.value ?? argument.description ?? ''
			)).join(' '));
		}
	});
	await waitFor(
		firstRun.client,
		`Boolean(document.querySelector('.app-shell'))`,
		'native app shell'
	);
	await seedWorkspaceOnReload(firstRun.client, acceptanceProjectRoot);
	try {
		await waitFor(
			firstRun.client,
			`document.body.innerText.includes('零点回声')`,
			'complete novel workspace'
		);
	} catch (error) {
		const diagnostic = await evaluate(firstRun.client, `({
			body: document.body.innerText.replace(/\\s+/gu, ' ').trim().slice(0, 3000),
			workspace: localStorage.getItem('writing-buddy-next-workspace')
		})`);
		throw new Error(
			`${error.message} Diagnostic: ${JSON.stringify(diagnostic)}`,
			{ cause: error }
		);
	}
	await progress('loaded visible complete novel workspace');
	const opened = await invoke(firstRun.client, 'open_project', {
		projectRoot: acceptanceProjectRoot,
		mode: 'read-only'
	});
	await progress('opened project and verified native manifest');
	const chapters = opened.project.volumes.flatMap(volume => volume.chapters);
	assert(opened.project.title === '零点回声', 'Native open returned the wrong project.');
	assert(chapters.length === 12, `Native open found ${chapters.length} chapters.`);
	assert(
		opened.integrityIssues.filter(issue => issue.severity === 'error').length === 0,
		`Native open found integrity errors: ${JSON.stringify(opened.integrityIssues)}`
	);
	const totalWords = Object.values(opened.wordCounts)
		.reduce((sum, value) => sum + value, 0);
	assert(totalWords >= 25_000, `Native word count was too small: ${totalWords}.`);

	const journeyFile = await invoke(firstRun.client, 'read_creation_journey_state', {
		projectRoot: acceptanceProjectRoot
	});
	const journey = JSON.parse(journeyFile.content);
	await progress('read creation journey');
	assert(
		journey.outline.filter(node => node.type === 'chapter').length === 12,
		'Native journey read did not retain twelve chapter nodes.'
	);
	assert(
		journey.outline.filter(node => node.type === 'scene').length === 24,
		'Native journey read did not retain twenty-four scene nodes.'
	);

	const indexStats = await invoke(firstRun.client, 'story_rebuild_index', {
		projectRoot: acceptanceProjectRoot
	});
	await progress('rebuilt story index');
	assert(indexStats.ready, 'Story index did not become ready.');
	assert(indexStats.recordCount >= 58, `Story index was unexpectedly small: ${indexStats.recordCount}.`);
	const sceneQuery = await invoke(firstRun.client, 'story_query_index', {
		projectRoot: acceptanceProjectRoot,
		query: { kind: 'scene', offset: 0, limit: 100 }
	});
	assert(sceneQuery.total === 24, `Story index found ${sceneQuery.total} scenes.`);

	const maxPreferences = {
		providerId: 'deepseek',
		defaultModelId: 'deepseek-v4-flash',
		thinkingMode: 'disabled',
		maxOutputTokens: 384_000,
		connectionTimeoutMs: 15_000,
		firstContentTimeoutMs: 180_000,
		streamIdleTimeoutMs: 120_000
	};
	const savedPreferences = await invoke(firstRun.client, 'ai_save_preferences', {
		preferences: maxPreferences
	});
	assert(
		savedPreferences.maxOutputTokens === 384_000,
		'Native preferences did not round-trip 384K.'
	);
	let invalidMaximumRejected = false;
	try {
		await invoke(firstRun.client, 'ai_save_preferences', {
			preferences: { ...maxPreferences, maxOutputTokens: 384_001 }
		});
	} catch {
		invalidMaximumRejected = true;
	}
	assert(invalidMaximumRejected, 'Native preferences accepted an unknown output maximum.');
	await progress('verified 384K native preference boundary');

	const firstChapter = chapters[0];
	const original = await invoke(firstRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: firstChapter.file
	});
	const snapshotId = await invoke(firstRun.client, 'create_snapshot', {
		projectRoot: acceptanceProjectRoot,
		reason: 'milestone',
		label: '完整小说验收：改写前'
	});
	await invoke(firstRun.client, 'write_text_atomic', {
		request: {
			projectRoot: acceptanceProjectRoot,
			relativePath: firstChapter.file,
			content: `${original.content}\n<!-- COMPLETE_NOVEL_ACCEPTANCE -->\n`,
			expectedHash: original.hash,
			eol: 'lf',
			hasBom: false,
			force: false
		}
	});
	const changed = await invoke(firstRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: firstChapter.file
	});
	assert(
		changed.content.includes('COMPLETE_NOVEL_ACCEPTANCE'),
		'Atomic manuscript acceptance edit did not persist.'
	);
	await invoke(firstRun.client, 'restore_version', {
		projectRoot: acceptanceProjectRoot,
		snapshotId
	});
	const restoredVersion = await invoke(firstRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: firstChapter.file
	});
	assert(
		restoredVersion.content === original.content,
		'Snapshot restore did not restore the original chapter.'
	);
	await progress('verified snapshot edit and restore');

	const backup = await invoke(firstRun.client, 'create_backup', {
		projectRoot: acceptanceProjectRoot,
		destination: null
	});
	const inspection = await invoke(firstRun.client, 'inspect_backup', {
		path: backup.path
	});
	assert(inspection.valid, `Native backup inspection failed: ${JSON.stringify(inspection)}`);
	const secondChapter = chapters[1];
	const secondOriginal = await invoke(firstRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: secondChapter.file
	});
	await invoke(firstRun.client, 'write_text_atomic', {
		request: {
			projectRoot: acceptanceProjectRoot,
			relativePath: secondChapter.file,
			content: `${secondOriginal.content}\n损坏模拟文本\n`,
			expectedHash: secondOriginal.hash,
			eol: 'lf',
			hasBom: false,
			force: false
		}
	});
	const restoredEntries = await invoke(firstRun.client, 'restore_backup', {
		path: backup.path,
		projectRoot: acceptanceProjectRoot,
		overwrite: true
	});
	assert(restoredEntries > 0, 'Backup restore returned no entries.');
	const restoredBackupText = await invoke(firstRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: secondChapter.file
	});
	assert(
		restoredBackupText.content === secondOriginal.content,
		'Backup restore did not restore the original second chapter.'
	);
	await progress('verified backup inspect and restore');

	const responsive = [];
	for (const profile of [
		{ width: 390, height: 844 },
		{ width: 1024, height: 720 },
		{ width: 1280, height: 800 },
		{ width: 1536, height: 992 }
	]) {
		await setViewport(firstRun.client, profile.width, profile.height);
		const metrics = await evaluate(firstRun.client, `(() => {
			const page = document.documentElement;
			const visible = element => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return rect.width > 0 && rect.height > 0
					&& style.display !== 'none' && style.visibility !== 'hidden';
			};
			const clippedControls = [...document.querySelectorAll('button, input, textarea, select')]
				.filter(visible)
				.filter(element => {
					const rect = element.getBoundingClientRect();
					return rect.right < 0 || rect.left > innerWidth || rect.bottom < 0 || rect.top > innerHeight;
				}).length;
			return {
				titleVisible: document.body.innerText.includes('零点回声'),
				pageOverflowX: Math.max(0, page.scrollWidth - page.clientWidth),
				clippedControls
			};
		})()`);
		assert(metrics.titleVisible, `Novel title disappeared at ${profile.width}px.`);
		assert(
			metrics.pageOverflowX === 0,
			`Workspace overflowed horizontally at ${profile.width}px: ${JSON.stringify(metrics)}`
		);
		await screenshot(
			firstRun.client,
			`complete-novel-${profile.width}x${profile.height}.png`
		);
		responsive.push({ ...profile, ...metrics });
		await progress(`captured responsive profile ${profile.width}x${profile.height}`);
	}
	assert(runtimeErrors.length === 0, `Runtime errors: ${JSON.stringify(runtimeErrors)}`);
	assert(consoleErrors.length === 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
	const firstShutdown = await closeApp(firstRun);
	firstRun = undefined;
	await progress('closed first native process');

	secondRun = await launchApp(join(temporaryRoot, 'profile-second'), basePort);
	await progress('launched second native process');
	await waitFor(
		secondRun.client,
		`Boolean(document.querySelector('.app-shell'))`,
		'second native app shell'
	);
	await seedWorkspaceOnReload(secondRun.client, acceptanceProjectRoot);
	await waitFor(
		secondRun.client,
		`document.body.innerText.includes('零点回声')`,
		'second-process complete novel workspace'
	);
	const reopened = await invoke(secondRun.client, 'open_project', {
		projectRoot: acceptanceProjectRoot,
		mode: 'read-only'
	});
	assert(
		reopened.project.volumes.flatMap(volume => volume.chapters).length === 12,
		'Second process reopen lost chapters.'
	);
	const reopenedFinale = await invoke(secondRun.client, 'read_text', {
		projectRoot: acceptanceProjectRoot,
		relativePath: 'chapters/12-回声尽头.md'
	});
	assert(
		reopenedFinale.content.includes('她终于听见，海原来一直这么响'),
		'Second process reopen lost the resolved ending.'
	);
	const secondShutdown = await closeApp(secondRun);
	secondRun = undefined;
	await progress('verified second-process reopen and close');

	const report = {
		generatedAt: new Date().toISOString(),
		mode: 'native-complete',
		executable,
		prepared,
		native: {
			title: opened.project.title,
			volumeCount: opened.project.volumes.length,
			chapterCount: chapters.length,
			sceneCount: sceneQuery.total,
			totalWords,
			integrityIssueCount: opened.integrityIssues.length,
			storyIndexRecordCount: indexStats.recordCount,
			journeyChapterNodeCount: journey.outline.filter(node => node.type === 'chapter').length,
			journeySceneNodeCount: journey.outline.filter(node => node.type === 'scene').length,
			maxOutputTokens: savedPreferences.maxOutputTokens,
			invalidMaximumRejected,
			snapshotId,
			snapshotRestored: restoredVersion.content === original.content,
			backupEntryCount: inspection.entryCount,
			backupRestoredEntries: restoredEntries,
			responsive,
			runtimeErrors,
			consoleErrors,
			secondProcessReopen: true,
			firstShutdown,
			secondShutdown
		}
	};
	await writeFile(reportPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
	await progress('wrote native acceptance report');
	process.stdout.write(`Complete novel native acceptance passed: ${reportPath}\n`);
} finally {
	if (firstRun) {
		firstRun.client.close();
		if (firstRun.child.pid && firstRun.child.exitCode === null) {
			spawnSync('taskkill', ['/PID', String(firstRun.child.pid), '/T', '/F'], {
				stdio: 'ignore',
				windowsHide: true
			});
		}
	}
	if (secondRun) {
		secondRun.client.close();
		if (secondRun.child.pid && secondRun.child.exitCode === null) {
			spawnSync('taskkill', ['/PID', String(secondRun.child.pid), '/T', '/F'], {
				stdio: 'ignore',
				windowsHide: true
			});
		}
	}
	if (temporaryRoot.startsWith(tmpdir())) {
		await delay(1_000);
		try {
			await rm(temporaryRoot, {
				recursive: true,
				force: true,
				maxRetries: 8,
				retryDelay: 250
			});
		} catch (error) {
			process.stderr.write(
				`Acceptance temporary profile cleanup deferred: ${error.message}\n`
			);
		}
	}
}
