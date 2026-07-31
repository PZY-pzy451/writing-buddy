import { spawn } from 'node:child_process';
import { access, mkdir, open, rename, rm } from 'node:fs/promises';
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
	'artifacts/promo/zero-to-complete-novel-2026-07-31/raw/zero-to-complete-novel-webview-take.mp4'
));
const outputPath = resolve(valueAfter(
	'--output',
	'artifacts/promo/zero-to-complete-novel-2026-07-31/Writing-Buddy-zero-to-complete-novel.zh-CN.mp4'
));
const captionsPath = resolve(valueAfter(
	'--captions',
	'artifacts/promo/zero-to-complete-novel-2026-07-31/captions.zh-CN.ass'
));
const ffmpegPath = resolve(valueAfter(
	'--ffmpeg',
	'artifacts/promo/recording-tools/ffmpeg.exe'
));
const fontRegularPath = resolve(valueAfter('--font', 'C:/Windows/Fonts/msyh.ttc'));
const fontBoldPath = resolve(valueAfter('--font-bold', 'C:/Windows/Fonts/msyhbd.ttc'));
const sourceStart = Number(valueAfter('--source-start', '15'));
const sourceEnd = Number(valueAfter('--source-end', '165'));
const titleDuration = Number(valueAfter('--title-duration', '7'));
const outroDuration = Number(valueAfter('--outro-duration', '7'));
const width = 2560;
const height = 1440;

if (!(sourceEnd > sourceStart && sourceStart >= 0)) {
	throw new Error('The source trim interval is invalid.');
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
const lockPath = `${outputPath}.build.lock`;
const temporaryOutputPath = `${outputPath}.${process.pid}.tmp.mp4`;
let buildLock;
try {
	buildLock = await open(lockPath, 'wx');
	await buildLock.writeFile(`${process.pid}\n`);
} catch (error) {
	if (error?.code === 'EEXIST') {
		throw new Error(
			`Another promotional build owns ${lockPath}. `
			+ 'Verify that no ffmpeg build is active before removing the stale lock.',
			{ cause: error }
		);
	}
	throw error;
}

const regularFont = escapeFilterPath(fontRegularPath);
const boldFont = escapeFilterPath(fontBoldPath);
const captions = escapeFilterPath(captionsPath);
const navy = '0x111c31';
const cream = '0xf7f2e8';
const gold = '0xd2a357';

const title = [
	`[1:v]drawtext=fontfile='${boldFont}':text='Writing Buddy':fontcolor=${gold}:fontsize=64:x=(w-text_w)/2:y=350`,
	`drawtext=fontfile='${boldFont}':text='从零开始，完整写完一部小说':fontcolor=${cream}:fontsize=88:x=(w-text_w)/2:y=490`,
	`drawtext=fontfile='${regularFont}':text='《零点回声》  ·  1 卷  ·  3 章  ·  6 场景':fontcolor=${cream}:fontsize=44:x=(w-text_w)/2:y=650`,
	`drawtext=fontfile='${regularFont}':text='26,210 字  ·  真实 Writing Buddy 桌面工作流':fontcolor=0xb8c3d8:fontsize=34:x=(w-text_w)/2:y=744`,
	`drawtext=fontfile='${regularFont}':text='从空白项目到完整结局':fontcolor=${gold}:fontsize=32:x=(w-text_w)/2:y=825[title]`
].join(',');

const outro = [
	`[2:v]drawtext=fontfile='${boldFont}':text='从一个想法，到一部完整小说。':fontcolor=${cream}:fontsize=78:x=(w-text_w)/2:y=455`,
	`drawtext=fontfile='${boldFont}':text='Writing Buddy':fontcolor=${gold}:fontsize=64:x=(w-text_w)/2:y=615`,
	`drawtext=fontfile='${regularFont}':text='AI 提供候选，作者拥有最后决定权':fontcolor=0xb8c3d8:fontsize=38:x=(w-text_w)/2:y=748[outro]`
].join(',');

const filter = [
	`[0:v]trim=start=${sourceStart}:end=${sourceEnd},setpts=PTS-STARTPTS,`
		+ `fps=24,scale=2304:${height}:force_original_aspect_ratio=decrease,`
		+ `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${navy}[raw]`,
	title,
	outro,
	`[title][raw][outro]concat=n=3:v=1:a=0,ass=filename='${captions}'[video]`
].join(';');

try {
	const ffmpeg = spawn(ffmpegPath, [
		'-y',
		'-hide_banner',
		'-loglevel', 'warning',
		'-stats',
		'-i', inputPath,
		'-f', 'lavfi',
		'-i', `color=c=${navy}:s=${width}x${height}:r=24:d=${titleDuration}`,
		'-f', 'lavfi',
		'-i', `color=c=${navy}:s=${width}x${height}:r=24:d=${outroDuration}`,
		'-filter_complex', filter,
		'-map', '[video]',
		'-r', '24',
		'-c:v', 'libx264',
		'-preset', 'medium',
		'-crf', '18',
		'-pix_fmt', 'yuv420p',
		'-movflags', '+faststart',
		'-metadata', 'title=Writing Buddy 从零到完整小说演示',
		'-metadata', 'comment=《零点回声》：从空白项目到 1 卷、3 章、6 场景和完整结局；所有 AI 正文均由作者确认后写入。',
		temporaryOutputPath
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
	await rm(outputPath, { force: true });
	await rename(temporaryOutputPath, outputPath);
} finally {
	await buildLock.close();
	await rm(lockPath, { force: true });
	await rm(temporaryOutputPath, { force: true });
}

process.stdout.write(`${JSON.stringify({
	status: 'complete',
	inputPath,
	outputPath,
	sourceInterval: [sourceStart, sourceEnd],
	titleDuration,
	outroDuration,
	expectedDuration: titleDuration + sourceEnd - sourceStart + outroDuration,
	resolution: `${width}x${height}`
}, undefined, 2)}\n`);
