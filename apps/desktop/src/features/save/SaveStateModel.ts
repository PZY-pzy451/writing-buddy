export type SaveState =
	| { readonly type: 'clean'; readonly savedAt: string }
	| { readonly type: 'dirty' }
	| { readonly type: 'saving'; readonly startedAt: string }
	| { readonly type: 'offline'; readonly pendingChanges: number }
	| {
		readonly type: 'failed';
		readonly errorCode: string;
		readonly retryable: boolean;
	}
	| { readonly type: 'external_conflict'; readonly detectedAt: string };

export interface SaveStatePresentation {
	readonly label: string;
	readonly detail: string;
	readonly tone: 'success' | 'warning' | 'progress' | 'danger';
}

export type SaveFailureClassification =
	| { readonly type: 'external_conflict' }
	| { readonly type: 'offline'; readonly errorCode: string }
	| {
		readonly type: 'failed';
		readonly errorCode: string;
		readonly retryable: boolean;
	};

export type CloseProtection =
	| { readonly action: 'allow' }
	| { readonly action: 'wait'; readonly message: string }
	| { readonly action: 'confirm'; readonly message: string };

const unavailableCodes = new Set([
	'deviceUnavailable',
	'driveNotReady',
	'networkOffline',
	'pathUnavailable',
	'volumeUnavailable'
]);

const nonRetryableCodes = new Set([
	'accessDenied',
	'invalidProjectRoot',
	'projectReadOnly',
	'readOnly'
]);

function publicErrorCode(error: unknown): string {
	const message = error instanceof Error
		? error.message
		: typeof error === 'string' ? error : '';
	const candidate = message.split(':', 1)[0]?.trim() ?? '';
	return /^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(candidate)
		? candidate
		: 'saveFailed';
}

export function classifySaveFailure(error: unknown): SaveFailureClassification {
	const errorCode = publicErrorCode(error);
	if (errorCode === 'externalChange') {
		return { type: 'external_conflict' };
	}
	if (unavailableCodes.has(errorCode)) {
		return { type: 'offline', errorCode };
	}
	return {
		type: 'failed',
		errorCode: errorCode === 'Error' ? 'saveFailed' : errorCode,
		retryable: !nonRetryableCodes.has(errorCode)
	};
}

export function saveStatePresentation(state: SaveState): SaveStatePresentation {
	switch (state.type) {
		case 'clean':
			return {
				label: '已保存',
				detail: '正文已安全写入本地项目。',
				tone: 'success'
			};
		case 'dirty':
			return {
				label: '尚未保存',
				detail: '正文包含尚未写入项目的修改。',
				tone: 'warning'
			};
		case 'saving':
			return {
				label: '正在保存…',
				detail: '正在安全写入当前正文。',
				tone: 'progress'
			};
		case 'offline':
			return {
				label: '离线，等待保存',
				detail: `${state.pendingChanges} 份修改仍保留在当前编辑器中。`,
				tone: 'danger'
			};
		case 'failed':
			return {
				label: '保存失败',
				detail: state.retryable
					? '正文仍在当前编辑器中，可以重试或另存副本。'
					: '当前目标不可写，请另存副本后检查项目权限。',
				tone: 'danger'
			};
		case 'external_conflict':
			return {
				label: '文件已被其他程序修改',
				detail: '本地内容未被覆盖，请先比较两个版本。',
				tone: 'danger'
			};
	}
}

export function closeProtectionFor(state: SaveState): CloseProtection {
	switch (state.type) {
		case 'clean':
			return { action: 'allow' };
		case 'saving':
			return {
				action: 'wait',
				message: '正在完成当前保存，完成后即可安全退出。'
			};
		case 'dirty':
			return {
				action: 'confirm',
				message: '当前正文包含尚未保存的修改。'
			};
		case 'offline':
			return {
				action: 'confirm',
				message: '存储位置当前不可用，修改尚未写入项目。'
			};
		case 'failed':
			return {
				action: 'confirm',
				message: '最近一次保存失败，退出会丢失当前未保存修改。'
			};
		case 'external_conflict':
			return {
				action: 'confirm',
				message: '磁盘版本与本地版本发生冲突，请先选择如何处理。'
			};
	}
}
