/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { OwnedValue } from '../ownedValue';

suite('OwnedValue', () => {
	test('does not clear a newer value when an older owner is disposed', () => {
		const owner = new OwnedValue<object>();
		const first = {};
		const second = {};

		owner.set(first);
		owner.set(second);
		owner.clear(first);

		assert.strictEqual(owner.value, second);
	});

	test('clears the matching current value', () => {
		const owner = new OwnedValue<object>();
		const current = {};

		owner.set(current);
		owner.clear(current);

		assert.strictEqual(owner.value, undefined);
	});
});
