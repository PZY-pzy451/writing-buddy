import { spawn } from 'node:child_process';
import {
	access,
	mkdir,
	open,
	readFile,
	rename,
	rm,
	writeFile
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

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

function formatSrtTime(seconds) {
	const milliseconds = Math.round(seconds * 1000);
	const hours = Math.floor(milliseconds / 3_600_000);
	const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
	const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
	const remainder = milliseconds % 1000;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:`
		+ `${String(wholeSeconds).padStart(2, '0')},${String(remainder).padStart(3, '0')}`;
}

function formatAssTime(seconds) {
	const centiseconds = Math.round(seconds * 100);
	const hours = Math.floor(centiseconds / 360_000);
	const minutes = Math.floor((centiseconds % 360_000) / 6000);
	const wholeSeconds = Math.floor((centiseconds % 6000) / 100);
	const remainder = centiseconds % 100;
	return `${hours}:${String(minutes).padStart(2, '0')}:`
		+ `${String(wholeSeconds).padStart(2, '0')}.${String(remainder).padStart(2, '0')}`;
}

function run(command, args) {
	return new Promise((resolveExit, rejectExit) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'inherit', 'inherit'],
			windowsHide: true
		});
		child.once('error', rejectExit);
		child.once('exit', (exitCode) => {
			if (exitCode === 0) {
				resolveExit();
				return;
			}
			rejectExit(new Error(`${command} exited with code ${exitCode}.`));
		});
	});
}

const inputPath = resolve(valueAfter(
	'--input',
	'artifacts/promo/zero-to-complete-novel-polished-2026-07-31/raw/'
		+ 'zero-to-complete-novel-webview-take-02.mp4'
));
const outputPath = resolve(valueAfter(
	'--output',
	'artifacts/promo/zero-to-complete-novel-polished-2026-07-31/'
		+ 'Writing-Buddy-zero-to-complete-novel-polished.zh-CN.mp4'
));
const voiceoverDirectory = resolve(valueAfter(
	'--voiceover-directory',
	'artifacts/promo/zero-to-complete-novel-polished-2026-07-31/voiceover'
));
const ffmpegPath = resolve(valueAfter(
	'--ffmpeg',
	'artifacts/promo/recording-tools/ffmpeg.exe'
));
const fontRegularPath = resolve(valueAfter('--font', 'C:/Windows/Fonts/msyh.ttc'));
const fontBoldPath = resolve(valueAfter('--font-bold', 'C:/Windows/Fonts/msyhbd.ttc'));
const captionsAssPath = resolve(valueAfter(
	'--captions-ass',
	join(dirname(outputPath), 'captions.zh-CN.ass')
));
const captionsSrtPath = resolve(valueAfter(
	'--captions-srt',
	join(dirname(outputPath), 'captions.zh-CN.srt')
));
const narrationPath = resolve(valueAfter(
	'--narration',
	join(dirname(outputPath), 'narration.zh-CN.wav')
));
const width = 2560;
const height = 1440;
const frameRate = 24;
const titleDuration = 4;
const outroDuration = 7;
const expectedDuration = 102;
const mainSpeed = 1.2;

const sourceSegments = [
	{ label: 'cold', start: 124.5, end: 128, speed: 1 },
	{ label: 'project', start: 16, end: 30, speed: mainSpeed },
	{ label: 'premise', start: 30, end: 43, speed: mainSpeed },
	{ label: 'outline', start: 43, end: 59, speed: mainSpeed },
	{ label: 'materialize', start: 59, end: 66, speed: mainSpeed },
	{ label: 'firstDraft', start: 66, end: 78, speed: mainSpeed },
	{ label: 'openingDraft', start: 84, end: 102, speed: mainSpeed },
	{ label: 'confirm', start: 105, end: 124, speed: mainSpeed },
	{ label: 'dashboard', start: 124, end: 129, speed: 1 }
];

const captions = [
	{ start: 0.25, end: 3.25, text: '从一个想法，到三章、六个场景和完整结局。' },
	{ start: 7.8, end: 18.8, text: '从空白项目开始，选择题材创作路线；所有内容都写入本地项目。' },
	{ start: 19.4, end: 29.65, text: '输入题材、核心前提和创作边界，AI 先生成可编辑的大纲候选。' },
	{ start: 30.4, end: 42.95, text: '作者逐级确认一卷、三章和六个场景，不满意可以随时返回调整。' },
	{ start: 43.7, end: 48.85, text: '确认后，大纲变成真正可写的章节与场景。' },
	{ start: 49.6, end: 58.8, text: '先写一句，AI 再依据已确认资料补全章节。' },
	{
		start: 59.5,
		end: 73.8,
		text: '新章节没有正文时，会从首个场景开始起草；生成只产生临时草稿。'
	},
	{ start: 74.5, end: 89.45, text: '作者可以原地修改；确认后才写入正文，并自动创建安全快照。' },
	{ start: 90.25, end: 95.05, text: '三章写完，字数、进度和审校状态一目了然。' },
	{ start: 96, end: 101.7, text: 'AI 提供候选，作者拥有最后决定权。' }
];

const narrationSchedule = [
	{ name: '01-result.wav', start: 0.3 },
	{ name: '02-project.wav', start: 8 },
	{ name: '03-premise.wav', start: 19.5 },
	{ name: '04-outline.wav', start: 30.5 },
	{ name: '05-materialize.wav', start: 43.6 },
	{ name: '06-first-draft.wav', start: 49.5 },
	{ name: '07-opening-draft.wav', start: 59.4 },
	{ name: '08-confirm.wav', start: 74.4 },
	{ name: '09-dashboard.wav', start: 90.2 },
	{ name: '10-outro.wav', start: 96 }
];

for (const path of [
	inputPath,
	ffmpegPath,
	fontRegularPath,
	fontBoldPath,
	...narrationSchedule.map(({ name }) => join(voiceoverDirectory, name))
]) {
	await access(path);
}

await mkdir(dirname(outputPath), { recursive: true });
const lockPath = `${outputPath}.build.lock`;
const temporaryOutputPath = `${outputPath}.${process.pid}.tmp.mp4`;
const temporaryNarrationPath = `${narrationPath}.${process.pid}.tmp.wav`;
const segmentDirectory = `${outputPath}.${process.pid}.segments`;
const concatListPath = join(segmentDirectory, 'segments.txt');
const joinedVideoPath = join(segmentDirectory, 'joined.mp4');
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

const srt = captions.map((caption, index) => (
	`${index + 1}\n${formatSrtTime(caption.start)} --> ${formatSrtTime(caption.end)}\n`
		+ `${caption.text}\n`
)).join('\n');
const assHeader = `[Script Info]
Title: Writing Buddy 从零到完整小说
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Promo,Microsoft YaHei,48,&H00F7F2E8,&H00F7F2E8,&H00111C31,&HC018243E,-1,0,0,0,100,100,0,0,3,3,0,8,120,120,92,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const ass = assHeader + captions.map((caption) => (
	`Dialogue: 0,${formatAssTime(caption.start)},${formatAssTime(caption.end)},`
		+ `Promo,,0,0,0,,${caption.text}`
)).join('\n') + '\n';

await writeFile(captionsSrtPath, srt, 'utf8');
await writeFile(captionsAssPath, ass, 'utf8');

const voiceInputs = narrationSchedule.flatMap(({ name }) => [
	'-i',
	join(voiceoverDirectory, name)
]);
const voiceFilters = narrationSchedule.map(({ start }, index) => {
	const delay = Math.round(start * 1000);
	return `[${index}:a]adelay=${delay}|${delay},volume=1.0[v${index}]`;
});
const voiceLabels = narrationSchedule.map((_, index) => `[v${index}]`).join('');
const narrationFilter = [
	...voiceFilters,
	`${voiceLabels}amix=inputs=${narrationSchedule.length}:duration=longest:`
		+ `dropout_transition=0,apad,atrim=duration=${expectedDuration},`
		+ 'afade=t=in:st=0:d=0.2,afade=t=out:st=101.5:d=0.5[narration]'
].join(';');

const regularFont = escapeFilterPath(fontRegularPath);
const boldFont = escapeFilterPath(fontBoldPath);
const captionsFilterPath = escapeFilterPath(captionsAssPath);
const navy = '0x111c31';
const cream = '0xf7f2e8';
const gold = '0xd2a357';
const appFrameFilter = `fps=${frameRate},scale=2304:${height}:`
	+ `force_original_aspect_ratio=decrease,pad=${width}:${height}:`
	+ `(ow-iw)/2:(oh-ih)/2:color=${navy}`;
const titleFilter = [
	`drawtext=fontfile='${boldFont}':text='Writing Buddy':`
		+ `fontcolor=${gold}:fontsize=64:x=(w-text_w)/2:y=340`,
	`drawtext=fontfile='${boldFont}':text='从零开始，把一个想法写成完整小说':`
		+ `fontcolor=${cream}:fontsize=82:x=(w-text_w)/2:y=490`,
	`drawtext=fontfile='${regularFont}':text='《零点回声》  ·  1 卷  ·  3 章  ·  6 场景':`
		+ `fontcolor=${cream}:fontsize=42:x=(w-text_w)/2:y=650`,
	`drawtext=fontfile='${regularFont}':text='真实 Writing Buddy 桌面工作流':`
		+ `fontcolor=0xb8c3d8:fontsize=34:x=(w-text_w)/2:y=750`,
	`drawtext=fontfile='${regularFont}':text='从空白项目，到完整结局':`
		+ `fontcolor=${gold}:fontsize=32:x=(w-text_w)/2:y=830`
].join(',');
const outroFilter = [
	`drawtext=fontfile='${boldFont}':text='从一个想法，到一部完整小说。':`
		+ `fontcolor=${cream}:fontsize=76:x=(w-text_w)/2:y=430`,
	`drawtext=fontfile='${boldFont}':text='Writing Buddy':`
		+ `fontcolor=${gold}:fontsize=68:x=(w-text_w)/2:y=590`,
	`drawtext=fontfile='${regularFont}':text='AI 提供候选，作者拥有最后决定权':`
		+ `fontcolor=0xb8c3d8:fontsize=40:x=(w-text_w)/2:y=730`,
	`drawtext=fontfile='${regularFont}':text='现在，打开你的第一章':`
		+ `fontcolor=${gold}:fontsize=34:x=(w-text_w)/2:y=830`
].join(',');
const orderedSegments = [
	sourceSegments[0],
	{ label: 'title', generated: true, duration: titleDuration, filter: titleFilter },
	...sourceSegments.slice(1, -1),
	sourceSegments.at(-1),
	{ label: 'outro', generated: true, duration: outroDuration, filter: outroFilter }
];

try {
	await run(ffmpegPath, [
		'-y',
		'-hide_banner',
		'-loglevel', 'warning',
		'-stats',
		...voiceInputs,
		'-filter_complex', narrationFilter,
		'-map', '[narration]',
		'-c:a', 'pcm_s16le',
		temporaryNarrationPath
	]);
	await rm(narrationPath, { force: true });
	await rename(temporaryNarrationPath, narrationPath);

	await rm(segmentDirectory, { recursive: true, force: true });
	await mkdir(segmentDirectory, { recursive: true });
	const segmentPaths = [];
	for (const [index, segment] of orderedSegments.entries()) {
		const segmentPath = join(
			segmentDirectory,
			`${String(index + 1).padStart(2, '0')}-${segment.label}.mp4`
		);
		const inputArguments = segment.generated
			? [
				'-f', 'lavfi',
				'-i', `color=c=${navy}:s=${width}x${height}:`
					+ `r=${frameRate}:d=${segment.duration}`
			]
			: [
				'-ss', String(segment.start),
				'-t', String(segment.end - segment.start),
				'-i', inputPath
			];
		const videoTransform = segment.generated
			? segment.filter
			: `setpts=(PTS-STARTPTS)/${segment.speed},${appFrameFilter}`;
		await run(ffmpegPath, [
			'-y',
			'-hide_banner',
			'-loglevel', 'warning',
			'-stats',
			...inputArguments,
			'-an',
			'-vf', videoTransform,
			'-r', String(frameRate),
			'-c:v', 'libx264',
			'-preset', 'fast',
			'-crf', '16',
			'-pix_fmt', 'yuv420p',
			'-movflags', '+faststart',
			segmentPath
		]);
		segmentPaths.push(segmentPath);
	}

	await writeFile(
		concatListPath,
		segmentPaths.map((path) => (
			`file '${path.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`
		)).join('\n') + '\n',
		'utf8'
	);
	await run(ffmpegPath, [
		'-y',
		'-hide_banner',
		'-loglevel', 'warning',
		'-stats',
		'-f', 'concat',
		'-safe', '0',
		'-i', concatListPath,
		'-c', 'copy',
		joinedVideoPath
	]);

	await run(ffmpegPath, [
		'-y',
		'-hide_banner',
		'-loglevel', 'warning',
		'-stats',
		'-i', joinedVideoPath,
		'-i', narrationPath,
		'-filter_complex',
		`[0:v]ass=filename='${captionsFilterPath}',`
			+ 'fade=t=in:st=0:d=0.2,fade=t=out:st=101.6:d=0.4[video];'
			+ `[1:a]aresample=48000,apad,atrim=duration=${expectedDuration}[audio]`,
		'-map', '[video]',
		'-map', '[audio]',
		'-r', String(frameRate),
		'-c:v', 'libx264',
		'-preset', 'medium',
		'-crf', '18',
		'-pix_fmt', 'yuv420p',
		'-c:a', 'aac',
		'-b:a', '160k',
		'-ar', '48000',
		'-movflags', '+faststart',
		'-metadata', 'title=Writing Buddy 从零到完整小说',
		'-metadata', 'comment=《零点回声》：真实桌面工作流，从空白项目到完整结局。',
		temporaryOutputPath
	]);
	await rm(outputPath, { force: true });
	await rename(temporaryOutputPath, outputPath);

	const manifestPath = join(dirname(outputPath), 'promo-build-manifest.json');
	const voiceManifest = JSON.parse(
		(await readFile(
			join(voiceoverDirectory, 'voiceover-manifest.json'),
			'utf8'
		)).replace(/^\uFEFF/, '')
	);
	await writeFile(manifestPath, `${JSON.stringify({
		status: 'complete',
		inputPath,
		outputPath,
		expectedDuration,
		resolution: `${width}x${height}`,
		frameRate,
		audio: {
			codec: 'aac',
			language: 'zh-CN',
			voice: voiceManifest[0]?.voice ?? 'unknown'
		},
		captions: {
			burnedIn: captionsAssPath,
			sidecar: captionsSrtPath
		},
		sourceSegments
	}, undefined, 2)}\n`, 'utf8');

	process.stdout.write(`${JSON.stringify({
		status: 'complete',
		outputPath,
		manifestPath,
		expectedDuration,
		resolution: `${width}x${height}`,
		frameRate,
		audio: 'zh-CN narration',
		captionsSrtPath
	}, undefined, 2)}\n`);
} finally {
	if (buildLock) {
		await buildLock.close();
	}
	await rm(lockPath, { force: true });
	await rm(temporaryOutputPath, { force: true });
	await rm(temporaryNarrationPath, { force: true });
	await rm(segmentDirectory, { recursive: true, force: true });
}
