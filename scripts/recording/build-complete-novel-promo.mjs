import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function valueAfter(flag, fallback) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
}

function escapeFilterPath(path) {
	return path
		.replaceAll('\\', '/')
		.replace(/^([A-Za-z]):/, '$1\\:')
		.replaceAll("'", "\\'");
}

const inputPath = resolve(valueAfter(
	'--input',
	'artifacts/promo/complete-novel-writing-2026-07-31/raw/complete-novel-writing-webview-take.mp4'
));
const outputPath = resolve(valueAfter(
	'--output',
	'artifacts/promo/complete-novel-writing-2026-07-31/Writing-Buddy-complete-novel-demo.zh-CN.mp4'
));
const captionsPath = resolve(valueAfter(
	'--captions',
	'artifacts/promo/complete-novel-writing-2026-07-31/captions.zh-CN.ass'
));
const ffmpegPath = resolve(valueAfter(
	'--ffmpeg',
	'artifacts/promo/recording-tools/ffmpeg.exe'
));
const fontRegularPath = resolve(valueAfter('--font', 'C:/Windows/Fonts/msyh.ttc'));
const fontBoldPath = resolve(valueAfter('--font-bold', 'C:/Windows/Fonts/msyhbd.ttc'));
const sourceDuration = Number(valueAfter('--source-duration', '384.375'));
const removeStart = Number(valueAfter('--remove-start', '79'));
const removeEnd = Number(valueAfter('--remove-end', '92'));
const titleDuration = Number(valueAfter('--title-duration', '8'));
const outroDuration = Number(valueAfter('--outro-duration', '8'));
const width = 2560;
const captureHeight = 1370;
const outputHeight = 1440;

if (!(sourceDuration > removeEnd && removeEnd > removeStart && removeStart > 0)) {
	throw new Error('The source duration and removed interval are invalid.');
}

for (const path of [
	inputPath,
	captionsPath,
	ffmpegPath,
	fontRegularPath,
	fontBoldPath
]) {
	await access(path);
}
await mkdir(dirname(outputPath), { recursive: true });

const regularFont = escapeFilterPath(fontRegularPath);
const boldFont = escapeFilterPath(fontBoldPath);
const captions = escapeFilterPath(captionsPath);
const navy = '0x111c31';
const cream = '0xf7f2e8';
const gold = '0xd2a357';

const title = [
	`[1:v]drawtext=fontfile='${boldFont}':text='Writing Buddy':fontcolor=${gold}:fontsize=64:x=(w-text_w)/2:y=370`,
	`drawtext=fontfile='${boldFont}':text='从故事核心到完整小说':fontcolor=${cream}:fontsize=92:x=(w-text_w)/2:y=500`,
	`drawtext=fontfile='${regularFont}':text='《零点回声》  ·  12 章  ·  26,266 字':fontcolor=${cream}:fontsize=42:x=(w-text_w)/2:y=660`,
	`drawtext=fontfile='${regularFont}':text='真实 Writing Buddy 桌面工作流演示':fontcolor=0xb8c3d8:fontsize=34:x=(w-text_w)/2:y=748[title]`
].join(',');

const outro = [
	`[2:v]drawtext=fontfile='${boldFont}':text='写下核心。发展结构。完成故事。':fontcolor=${cream}:fontsize=76:x=(w-text_w)/2:y=470`,
	`drawtext=fontfile='${boldFont}':text='Writing Buddy':fontcolor=${gold}:fontsize=62:x=(w-text_w)/2:y=620`,
	`drawtext=fontfile='${regularFont}':text='作者始终拥有最后决定权':fontcolor=0xb8c3d8:fontsize=36:x=(w-text_w)/2:y=735[outro]`
].join(',');

const filter = [
	`[0:v]split=2[raw-a][raw-b]`,
	`[raw-a]trim=start=0:end=${removeStart},setpts=PTS-STARTPTS[first]`,
	`[raw-b]trim=start=${removeEnd}:end=${sourceDuration},setpts=PTS-STARTPTS[second]`,
	title,
	outro,
	`[title][first][second][outro]concat=n=4:v=1:a=0,`
		+ `pad=${width}:${outputHeight}:0:${(outputHeight - captureHeight) / 2}:color=${navy},`
		+ `ass=filename='${captions}'[video]`
].join(';');

const ffmpeg = spawn(ffmpegPath, [
	'-y',
	'-hide_banner',
	'-loglevel', 'warning',
	'-stats',
	'-i', inputPath,
	'-f', 'lavfi',
	'-i', `color=c=${navy}:s=${width}x${captureHeight}:r=24:d=${titleDuration}`,
	'-f', 'lavfi',
	'-i', `color=c=${navy}:s=${width}x${captureHeight}:r=24:d=${outroDuration}`,
	'-filter_complex', filter,
	'-map', '[video]',
	'-r', '24',
	'-c:v', 'libx264',
	'-preset', 'medium',
	'-crf', '18',
	'-pix_fmt', 'yuv420p',
	'-movflags', '+faststart',
	'-metadata', 'title=Writing Buddy 完整小说创作演示',
	'-metadata', 'comment=《零点回声》：12 章、26,266 字；作者确认后写入。',
	outputPath
], {
	stdio: ['ignore', 'inherit', 'inherit'],
	windowsHide: true
});

const exitCode = await new Promise((resolveExit, rejectExit) => {
	ffmpeg.once('error', rejectExit);
	ffmpeg.once('exit', resolveExit);
});

if (exitCode !== 0) {
	throw new Error(`ffmpeg exited with code ${exitCode}.`);
}

process.stdout.write(JSON.stringify({
	status: 'complete',
	inputPath,
	outputPath,
	removedInterval: [removeStart, removeEnd],
	titleDuration,
	outroDuration
}) + '\n');
