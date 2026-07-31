import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

function valueAfter(flag, fallback) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
}

function delay(milliseconds) {
	return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function connectToRecorder(port) {
	return new Promise((resolveConnection, rejectConnection) => {
		const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
			socket.end('stop\n');
		});
		socket.once('error', rejectConnection);
		socket.once('close', resolveConnection);
	});
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
		await new Promise((resolveConnection, rejectConnection) => {
			this.socket.addEventListener('open', resolveConnection, { once: true });
			this.socket.addEventListener('error', rejectConnection, { once: true });
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
		return new Promise((resolveCall, rejectCall) => {
			const id = this.nextId++;
			this.pending.set(id, { resolve: resolveCall, reject: rejectCall });
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

async function waitForTarget(cdpPort) {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		try {
			const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`, {
				signal: AbortSignal.timeout(750)
			}).then(response => response.json());
			const target = targets.find(candidate => (
				candidate.type === 'page'
					&& !candidate.url.startsWith('devtools://')
			));
			if (target) return target;
		} catch {
			// The diagnostic desktop build is still starting.
		}
		await delay(100);
	}
	throw new Error(`Timed out waiting for Writing Buddy on CDP port ${cdpPort}.`);
}

async function writeFrame(stream, frame) {
	if (stream.write(frame)) return;
	await new Promise(resolveDrain => stream.once('drain', resolveDrain));
}

const stopPort = Number(valueAfter('--port', '49232'));

if (process.argv.includes('--stop')) {
	await connectToRecorder(stopPort);
	process.stdout.write(`Stopped recorder on port ${stopPort}.\n`);
	process.exit(0);
}

const cdpPort = Number(valueAfter('--cdp-port', '9223'));
const ffmpegPath = resolve(valueAfter('--ffmpeg', 'artifacts/promo/recording-tools/ffmpeg.exe'));
const outputPath = resolve(valueAfter('--output', 'artifacts/promo/webview-recording.mp4'));
const frameRate = Number(valueAfter('--framerate', '10'));
const maxSeconds = Number(valueAfter('--max-seconds', '900'));
const quality = Number(valueAfter('--quality', '90'));
const videoWidth = Number(valueAfter('--video-width', '2560'));
const logPath = `${outputPath}.log`;

await mkdir(dirname(outputPath), { recursive: true });

const target = await waitForTarget(cdpPort);
const client = new CdpClient(target.webSocketDebuggerUrl);
await client.connect();
await client.call('Page.enable');

const initialCapture = await client.call('Page.captureScreenshot', {
	format: 'jpeg',
	quality,
	fromSurface: true,
	captureBeyondViewport: false
});
let latestFrame = Buffer.from(initialCapture.data, 'base64');

client.on('Page.screencastFrame', params => {
	latestFrame = Buffer.from(params.data, 'base64');
	void client.call('Page.screencastFrameAck', {
		sessionId: params.sessionId
	}).catch(() => {});
});

await client.call('Page.startScreencast', {
	format: 'jpeg',
	quality,
	everyNthFrame: 1
});

const ffmpeg = spawn(ffmpegPath, [
	'-y',
	'-f', 'image2pipe',
	'-framerate', String(frameRate),
	'-vcodec', 'mjpeg',
	'-i', 'pipe:0',
	'-t', String(maxSeconds),
	'-vf', `scale=${videoWidth}:-2`,
	'-c:v', 'libx264',
	'-preset', 'veryfast',
	'-crf', '18',
	'-pix_fmt', 'yuv420p',
	'-movflags', '+faststart',
	outputPath
], {
	stdio: ['pipe', 'ignore', 'pipe'],
	windowsHide: true
});

const logStream = createWriteStream(logPath, { encoding: 'utf8' });
ffmpeg.stderr.pipe(logStream);

let stopping = false;
function requestStop() {
	stopping = true;
}

const server = net.createServer(socket => {
	socket.setEncoding('utf8');
	socket.on('data', message => {
		if (message.trim() === 'stop') requestStop();
	});
});

await new Promise((resolveServer, rejectServer) => {
	server.once('error', rejectServer);
	server.listen(stopPort, '127.0.0.1', resolveServer);
});

process.stdout.write(JSON.stringify({
	status: 'recording',
	port: stopPort,
	captureSource: `cdp:${cdpPort}`,
	frameRate,
	outputPath,
	logPath
}) + '\n');

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, requestStop);
}

const startedAt = performance.now();
const frameDuration = 1000 / frameRate;
let frameNumber = 0;

while (!stopping && performance.now() - startedAt < maxSeconds * 1000) {
	await writeFrame(ffmpeg.stdin, latestFrame);
	frameNumber += 1;
	const nextFrameAt = startedAt + frameNumber * frameDuration;
	await delay(Math.max(0, nextFrameAt - performance.now()));
}

await client.call('Page.stopScreencast').catch(() => {});
client.close();
ffmpeg.stdin.end();

const exitCode = await new Promise((resolveExit, rejectExit) => {
	ffmpeg.once('error', rejectExit);
	ffmpeg.once('exit', resolveExit);
});

server.close();
logStream.end();

if (exitCode !== 0) {
	throw new Error(`ffmpeg exited with code ${exitCode}. See ${logPath}`);
}

process.stdout.write(JSON.stringify({
	status: 'complete',
	outputPath
}) + '\n');
