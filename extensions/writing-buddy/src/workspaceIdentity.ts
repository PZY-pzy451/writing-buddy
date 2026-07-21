/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function areFilePathsEqual(left: string, right: string, platform: NodeJS.Platform): boolean {
	return platform === 'win32'
		? left.toLowerCase() === right.toLowerCase()
		: left === right;
}
