/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class OwnedValue<T> {
	private current: T | undefined;

	get value(): T | undefined {
		return this.current;
	}

	set(value: T): void {
		this.current = value;
	}

	clear(value: T): void {
		if (this.current === value) {
			this.current = undefined;
		}
	}
}
