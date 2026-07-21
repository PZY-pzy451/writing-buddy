/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface CreateOnlyFileSystem<T> {
	createDirectory(path: T): PromiseLike<void>;
	readFile(path: T): PromiseLike<Uint8Array>;
	writeFileCreateOnly(path: T, content: Uint8Array): PromiseLike<boolean>;
	joinPath(base: T, ...segments: string[]): T;
}

export const sampleNovelFixturePaths: readonly string[] = [
	'Volume 01/Chapter 001.md',
	'Volume 01/Chapter 002.md',
	'Volume 01/Chapter 003.md',
	'Characters/README.md',
	'Worldbuilding/README.md',
	'Timeline/README.md',
	'Notes/README.md'
];

export async function copyFixturesCreateOnly<T>(
	fileSystem: CreateOnlyFileSystem<T>,
	sourceRoot: T,
	destinationRoot: T,
	fixturePaths: readonly string[]
): Promise<void> {
	await fileSystem.createDirectory(destinationRoot);

	for (const fixturePath of fixturePaths) {
		const segments = fixturePath.split('/').filter(Boolean);
		const fileName = segments.at(-1);
		if (!fileName) {
			continue;
		}

		const directorySegments = segments.slice(0, -1);
		for (let depth = 1; depth <= directorySegments.length; depth++) {
			await fileSystem.createDirectory(fileSystem.joinPath(destinationRoot, ...directorySegments.slice(0, depth)));
		}

		const destination = fileSystem.joinPath(destinationRoot, ...segments);
		const source = fileSystem.joinPath(sourceRoot, ...segments);
		await fileSystem.writeFileCreateOnly(destination, await fileSystem.readFile(source));
	}
}
