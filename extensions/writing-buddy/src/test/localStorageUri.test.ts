/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { toLocalStorageUri, UriWithScheme } from '../localStorageUri';

interface FakeUri extends UriWithScheme<FakeUri> {
	readonly authority: string;
	readonly path: string;
}

function uri(scheme: string, authority: string, path: string): FakeUri {
	return {
		scheme,
		authority,
		path,
		with: change => uri(change.scheme, authority, path)
	};
}

suite('local storage URI', () => {
	test('maps desktop vscode-userdata storage to its local file URI', () => {
		const result = toLocalStorageUri(uri('vscode-userdata', '', '/C:/profile/User/globalStorage/example'));
		assert.deepStrictEqual({ scheme: result.scheme, authority: result.authority, path: result.path }, {
			scheme: 'file',
			authority: '',
			path: '/C:/profile/User/globalStorage/example'
		});
	});

	test('preserves an existing file URI instance', () => {
		const fileUri = uri('file', '', '/C:/profile/User/globalStorage/example');
		assert.strictEqual(toLocalStorageUri(fileUri), fileUri);
	});
});
