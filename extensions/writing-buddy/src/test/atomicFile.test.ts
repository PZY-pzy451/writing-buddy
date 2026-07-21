/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AtomicFileOperations, writeFileCreateOnlyAtomically } from '../atomicFile';

interface TemporaryFile {
	readonly id: string;
	readonly destination: string;
}

class MemoryAtomicFileOperations implements AtomicFileOperations<string, TemporaryFile> {
	readonly destinations = new Map<string, Uint8Array>();
	readonly temporaryFiles = new Map<string, Uint8Array>();
	beforePublish: ((destination: string) => void) | undefined;
	failWrite = false;
	destinationWasVisibleDuringWrite = false;

	async createTemporaryFile(destination: string): Promise<TemporaryFile> {
		const temporary = { id: `${destination}.temporary`, destination };
		this.temporaryFiles.set(temporary.id, new Uint8Array());
		return temporary;
	}

	async writeTemporaryFile(temporary: TemporaryFile, content: Uint8Array): Promise<void> {
		this.destinationWasVisibleDuringWrite = this.destinations.has(temporary.destination);
		this.temporaryFiles.set(temporary.id, content);
		if (this.failWrite) {
			throw new Error('simulated write failure');
		}
	}

	async publishTemporaryFileCreateOnly(temporary: TemporaryFile, destination: string): Promise<boolean> {
		this.beforePublish?.(destination);
		if (this.destinations.has(destination)) {
			return false;
		}

		const content = this.temporaryFiles.get(temporary.id);
		if (!content) {
			throw new Error('temporary file missing');
		}
		this.destinations.set(destination, content);
		return true;
	}

	async removeTemporaryFile(temporary: TemporaryFile): Promise<void> {
		this.temporaryFiles.delete(temporary.id);
	}
}

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);
const decode = (value: Uint8Array | undefined): string | undefined => value ? new TextDecoder().decode(value) : undefined;

suite('atomic create-only file publication', () => {
	test('publishes only after the complete content is written', async () => {
		const operations = new MemoryAtomicFileOperations();

		const created = await writeFileCreateOnlyAtomically(operations, '/destination/chapter.md', encode('complete chapter'));

		assert.strictEqual(created, true);
		assert.strictEqual(operations.destinationWasVisibleDuringWrite, false);
		assert.strictEqual(decode(operations.destinations.get('/destination/chapter.md')), 'complete chapter');
		assert.strictEqual(operations.temporaryFiles.size, 0);
	});

	test('preserves a destination created before atomic publication', async () => {
		const operations = new MemoryAtomicFileOperations();
		operations.beforePublish = destination => operations.destinations.set(destination, encode('concurrent reader edits'));

		const created = await writeFileCreateOnlyAtomically(operations, '/destination/chapter.md', encode('fixture chapter'));

		assert.strictEqual(created, false);
		assert.strictEqual(decode(operations.destinations.get('/destination/chapter.md')), 'concurrent reader edits');
		assert.strictEqual(operations.temporaryFiles.size, 0);
	});

	test('leaves no destination or temporary file after a write failure', async () => {
		const operations = new MemoryAtomicFileOperations();
		operations.failWrite = true;

		await assert.rejects(
			writeFileCreateOnlyAtomically(operations, '/destination/chapter.md', encode('partial chapter')),
			/simulated write failure/
		);
		assert.strictEqual(operations.destinations.has('/destination/chapter.md'), false);
		assert.strictEqual(operations.temporaryFiles.size, 0);
	});
});
