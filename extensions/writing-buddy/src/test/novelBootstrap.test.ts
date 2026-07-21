/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { copyFixturesCreateOnly, CreateOnlyFileSystem } from '../fixtureCopy';

class MemoryFileSystem implements CreateOnlyFileSystem<string> {
	readonly directories = new Set<string>();
	readonly files = new Map<string, Uint8Array>();
	beforeWriteFileCreateOnly: ((path: string) => void) | undefined;

	async createDirectory(path: string): Promise<void> {
		this.directories.add(path);
	}

	async readFile(path: string): Promise<Uint8Array> {
		const content = this.files.get(path);
		if (!content) {
			throw new Error(`Missing fixture: ${path}`);
		}
		return content;
	}

	async writeFileCreateOnly(path: string, content: Uint8Array): Promise<boolean> {
		this.beforeWriteFileCreateOnly?.(path);
		if (this.files.has(path) || this.directories.has(path)) {
			return false;
		}

		this.files.set(path, content);
		return true;
	}

	joinPath(base: string, ...segments: string[]): string {
		return [base, ...segments].join('/');
	}
}

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);
const decode = (value: Uint8Array | undefined): string | undefined => value ? new TextDecoder().decode(value) : undefined;

suite('novel bootstrap', () => {
	test('creates missing directories and files', async () => {
		const fileSystem = new MemoryFileSystem();
		fileSystem.files.set('/source/Chapter 001.md', encode('chapter one'));

		await copyFixturesCreateOnly(fileSystem, '/source', '/destination', ['Chapter 001.md']);

		assert.deepStrictEqual({
			directories: [...fileSystem.directories],
			chapter: decode(fileSystem.files.get('/destination/Chapter 001.md'))
		}, {
			directories: ['/destination'],
			chapter: 'chapter one'
		});
	});

	test('preserves existing destination bytes', async () => {
		const fileSystem = new MemoryFileSystem();
		fileSystem.files.set('/source/Chapter 001.md', encode('source bytes'));
		fileSystem.files.set('/destination/Chapter 001.md', encode('reader edits'));

		await copyFixturesCreateOnly(fileSystem, '/source', '/destination', ['Chapter 001.md']);

		assert.strictEqual(decode(fileSystem.files.get('/destination/Chapter 001.md')), 'reader edits');
	});

	test('preserves a destination created concurrently during bootstrap', async () => {
		const fileSystem = new MemoryFileSystem();
		fileSystem.files.set('/source/Chapter 001.md', encode('source bytes'));
		fileSystem.beforeWriteFileCreateOnly = path => {
			if (path === '/destination/Chapter 001.md') {
				fileSystem.files.set(path, encode('concurrent reader edits'));
			}
		};

		await copyFixturesCreateOnly(fileSystem, '/source', '/destination', ['Chapter 001.md']);

		assert.strictEqual(decode(fileSystem.files.get('/destination/Chapter 001.md')), 'concurrent reader edits');
	});

	test('copies fixed fixtures into nested paths', async () => {
		const fileSystem = new MemoryFileSystem();
		fileSystem.files.set('/source/Volume 01/Chapter 001.md', encode('nested chapter'));

		await copyFixturesCreateOnly(fileSystem, '/source', '/destination', ['Volume 01/Chapter 001.md']);

		assert.deepStrictEqual({
			directories: [...fileSystem.directories],
			chapter: decode(fileSystem.files.get('/destination/Volume 01/Chapter 001.md'))
		}, {
			directories: ['/destination', '/destination/Volume 01'],
			chapter: 'nested chapter'
		});
	});
});
