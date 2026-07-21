/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class SerialOperationQueue {
	private settledTail = Promise.resolve();

	enqueue(operation: () => Promise<void>): Promise<void> {
		const result = this.settledTail.then(operation);
		this.settledTail = result.catch(() => undefined);
		return result;
	}
}

export function shouldRevealActiveChapter(treeVisible: boolean, editorStillActive: boolean, revealRequested: boolean): boolean {
	return revealRequested && treeVisible && editorStillActive;
}
