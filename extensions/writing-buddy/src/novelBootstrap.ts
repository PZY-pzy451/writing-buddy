/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { writeFileCreateOnly } from './atomicFile';
import { copyFixturesCreateOnly, CreateOnlyFileSystem, sampleNovelFixturePaths } from './fixtureCopy';
import { toLocalStorageUri } from './localStorageUri';
import { areFilePathsEqual } from './workspaceIdentity';

export const sampleNovelDirectoryName = 'sample-novel';

const uriFileSystem: CreateOnlyFileSystem<vscode.Uri> = {
	createDirectory: path => vscode.workspace.fs.createDirectory(path),
	readFile: path => vscode.workspace.fs.readFile(path),
	writeFileCreateOnly: async (path, content) => {
		if (path.scheme !== 'file') {
			throw new Error(`Writing Buddy sample files require a file URI destination, received: ${path.scheme}`);
		}

		return writeFileCreateOnly(path.fsPath, content);
	},
	joinPath: (base, ...segments) => vscode.Uri.joinPath(base, ...segments)
};

export async function ensureSampleNovel(context: vscode.ExtensionContext): Promise<vscode.Uri> {
	const sourceRoot = vscode.Uri.joinPath(context.extensionUri, sampleNovelDirectoryName);
	const destinationRoot = vscode.Uri.joinPath(toLocalStorageUri(context.globalStorageUri), sampleNovelDirectoryName);
	const fixtureDirectories = new Set(sampleNovelFixturePaths.map(path => path.slice(0, path.lastIndexOf('/'))));

	for (const fixtureDirectory of fixtureDirectories) {
		await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(sourceRoot, ...fixtureDirectory.split('/')));
	}

	await copyFixturesCreateOnly(uriFileSystem, sourceRoot, destinationRoot, sampleNovelFixturePaths);
	return destinationRoot;
}

export function isSampleNovelWorkspace(sampleNovelUri: vscode.Uri): boolean {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders?.length !== 1) {
		return false;
	}

	const workspaceUri = workspaceFolders[0].uri;
	if (workspaceUri.scheme !== sampleNovelUri.scheme) {
		return false;
	}

	if (workspaceUri.scheme === 'file') {
		return areFilePathsEqual(workspaceUri.fsPath, sampleNovelUri.fsPath, process.platform);
	}

	return workspaceUri.toString() === sampleNovelUri.toString();
}
