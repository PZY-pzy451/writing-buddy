import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

function valueAfter(flag, fallback) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
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

const stopPort = Number(valueAfter('--port', '49231'));

if (process.argv.includes('--stop')) {
	await connectToRecorder(stopPort);
	process.stdout.write(`Stopped recorder on port ${stopPort}.\n`);
	process.exit(0);
}

const ffmpegPath = resolve(valueAfter('--ffmpeg', 'artifacts/promo/recording-tools/ffmpeg.exe'));
const outputPath = resolve(valueAfter('--output', 'artifacts/promo/window-recording.mp4'));
const windowTitle = valueAfter('--title', 'Writing Buddy');
const frameRate = Number(valueAfter('--framerate', '20'));
const maxSeconds = Number(valueAfter('--max-seconds', '900'));
const captureDesktop = process.argv.includes('--desktop');
const offsetX = Number(valueAfter('--offset-x', '0'));
const offsetY = Number(valueAfter('--offset-y', '0'));
const videoSize = valueAfter('--video-size', '');
const logPath = `${outputPath}.log`;

await mkdir(dirname(outputPath), { recursive: true });

const captureArgs = [
	'-y',
	'-f', 'gdigrab',
	'-framerate', String(frameRate),
	'-draw_mouse', '1',
];

if (captureDesktop) {
	if (videoSize) captureArgs.push('-video_size', videoSize);
	captureArgs.push('-offset_x', String(offsetX), '-offset_y', String(offsetY), '-i', 'desktop');
} else {
	captureArgs.push('-i', `title=${windowTitle}`);
}

const ffmpeg = spawn(ffmpegPath, [
	...captureArgs,
	'-t', String(maxSeconds),
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
	if (stopping) return;
	stopping = true;
	ffmpeg.stdin.write('q\n');
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
	captureSource: captureDesktop ? `desktop:${offsetX},${offsetY}:${videoSize || 'full'}` : `window:${windowTitle}`,
	frameRate,
	outputPath,
	logPath
}) + '\n');

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, requestStop);
}

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
