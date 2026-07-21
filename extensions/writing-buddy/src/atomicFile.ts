/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AtomicFileOperations<TDestination, TTemporary> {
	createTemporaryFile(destination: TDestination): PromiseLike<TTemporary>;
	writeTemporaryFile(temporary: TTemporary, content: Uint8Array): PromiseLike<void>;
	publishTemporaryFileCreateOnly(temporary: TTemporary, destination: TDestination): PromiseLike<boolean>;
	removeTemporaryFile(temporary: TTemporary): PromiseLike<void>;
}

export async function writeFileCreateOnlyAtomically<TDestination, TTemporary>(
	operations: AtomicFileOperations<TDestination, TTemporary>,
	destination: TDestination,
	content: Uint8Array
): Promise<boolean> {
	const temporary = await operations.createTemporaryFile(destination);
	try {
		await operations.writeTemporaryFile(temporary, content);
		return await operations.publishTemporaryFileCreateOnly(temporary, destination);
	} finally {
		// Cleanup is deliberately best-effort. A leaked temporary file is safer than
		// changing the publication result or masking a write/publish failure.
		try {
			await operations.removeTemporaryFile(temporary);
		} catch {
			// Keep the primary operation's result or error authoritative.
		}
	}
}

interface NodeTemporaryFile {
	readonly path: string;
	readonly handle: fs.FileHandle;
}

function hasErrorCode(error: unknown, code: string): boolean {
	return error instanceof Error && 'code' in error && error.code === code;
}

const nodeAtomicFileOperations: AtomicFileOperations<string, NodeTemporaryFile> = {
	createTemporaryFile: async destination => {
		const temporaryPath = path.join(
			path.dirname(destination),
			`.${path.basename(destination)}.${process.pid}.${crypto.randomUUID()}.tmp`
		);
		return {
			path: temporaryPath,
			handle: await fs.open(temporaryPath, 'wx')
		};
	},
	writeTemporaryFile: async (temporary, content) => {
		let writeError: unknown;
		try {
			await temporary.handle.writeFile(content);
			await temporary.handle.sync();
		} catch (error) {
			writeError = error;
			throw error;
		} finally {
			try {
				await temporary.handle.close();
			} catch (error) {
				if (writeError === undefined) {
					throw error;
				}
			}
		}
	},
	publishTemporaryFileCreateOnly: async (temporary, destination) => {
		try {
			await fs.link(temporary.path, destination);
			return true;
		} catch (error) {
			if (hasErrorCode(error, 'EEXIST')) {
				return false;
			}
			throw error;
		}
	},
	removeTemporaryFile: async temporary => {
		try {
			await fs.unlink(temporary.path);
		} catch (error) {
			if (!hasErrorCode(error, 'ENOENT')) {
				throw error;
			}
		}
	}
};

export function writeFileCreateOnly(destination: string, content: Uint8Array): Promise<boolean> {
	return writeFileCreateOnlyAtomically(nodeAtomicFileOperations, destination, content);
}
