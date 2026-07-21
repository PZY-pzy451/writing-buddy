/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface UriWithScheme<T> {
	readonly scheme: string;
	with(change: { readonly scheme: string }): T;
}

export function toLocalStorageUri<T extends UriWithScheme<T>>(uri: T): T {
	return uri.scheme === 'vscode-userdata' ? uri.with({ scheme: 'file' }) : uri;
}
