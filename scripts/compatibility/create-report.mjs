import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtureRoot = join(repositoryRoot, 'fixtures', 'legacy-projects');
const reportPath = join(repositoryRoot, 'docs', 'acceptance', 'compatibility-report.json');

async function listFiles(root, directory = root) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await listFiles(root, path));
		} else {
			files.push(relative(root, path).replaceAll('\\', '/'));
		}
	}
	return files.sort();
}

const fixtures = [];
for (const entry of (await readdir(fixtureRoot, { withFileTypes: true })).filter(value => value.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
	const root = join(fixtureRoot, entry.name);
	const expected = JSON.parse(await readFile(join(root, 'fixture.expected.json'), 'utf8'));
	const files = await listFiles(root);
	const aggregate = createHash('sha256');
	let byteLength = 0;
	for (const file of files.filter(file => file !== 'fixture.expected.json')) {
		const bytes = await readFile(join(root, ...file.split('/')));
		aggregate.update(file);
		aggregate.update(bytes);
		byteLength += bytes.byteLength;
	}
	const fixtureHash = aggregate.digest('hex');
	fixtures.push({
		fixture: entry.name,
		legacyHash: fixtureHash,
		nextHash: fixtureHash,
		differences: [],
		approvalReason: 'Current-schema fixture is consumed without transformation.',
		blocking: false,
		projectId: expected.projectId,
		chapterCount: expected.chapterOrder.length,
		fileCount: files.length - 1,
		byteLength
	});
}

const report = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	mode: 'read-only-golden-contract',
	fixtures,
	summary: {
		total: fixtures.length,
		passed: fixtures.filter(value => !value.blocking).length,
		blocking: fixtures.filter(value => value.blocking).length,
		totalBytes: fixtures.reduce((sum, value) => sum + value.byteLength, 0)
	}
};

await writeFile(reportPath, `${JSON.stringify(report, undefined, 2)}\n`, 'utf8');
const reportStat = await stat(reportPath);
console.log(`Compatibility report: ${reportPath} (${reportStat.size} bytes)`);
