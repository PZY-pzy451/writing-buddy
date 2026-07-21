/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { areFilePathsEqual } from '../workspaceIdentity';

suite('workspace identity', () => {
	test('matches Windows file paths without locale-sensitive casing', () => {
		assert.strictEqual(areFilePathsEqual('D:\\Novel\\Sample', 'd:\\novel\\sample', 'win32'), true);
	});

	test('keeps case-only file paths distinct on case-sensitive platforms', () => {
		assert.strictEqual(areFilePathsEqual('/Novel/Sample', '/novel/sample', 'linux'), false);
	});

	test('matches exact file paths on case-sensitive platforms', () => {
		assert.strictEqual(areFilePathsEqual('/Novel/Sample', '/Novel/Sample', 'linux'), true);
	});
});
