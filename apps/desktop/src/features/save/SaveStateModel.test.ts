import { describe, expect, it } from 'vitest';
import {
	classifySaveFailure,
	closeProtectionFor,
	saveStatePresentation,
	type SaveState
} from './SaveStateModel';

describe('SaveStateModel', () => {
	it.each<readonly [SaveState, string]>([
		[{ type: 'clean', savedAt: '2026-07-29T11:00:00.000Z' }, '已保存'],
		[{ type: 'dirty' }, '尚未保存'],
		[{ type: 'saving', startedAt: '2026-07-29T11:00:01.000Z' }, '正在保存…'],
		[{ type: 'offline', pendingChanges: 2 }, '离线，等待保存'],
		[{ type: 'failed', errorCode: 'writeFailed', retryable: true }, '保存失败'],
		[{ type: 'external_conflict', detectedAt: '2026-07-29T11:00:02.000Z' }, '文件已被其他程序修改']
	])('presents %o with explicit text', (state, text) => {
		expect(saveStatePresentation(state).label).toBe(text);
	});

	it('classifies conflicts, unavailable storage and persistent failures without exposing raw details', () => {
		expect(classifySaveFailure(new Error('externalChange:expected:path-secret'))).toEqual({
			type: 'external_conflict'
		});
		expect(classifySaveFailure(new Error('deviceUnavailable:C:\\secret\\book'))).toEqual({
			type: 'offline',
			errorCode: 'deviceUnavailable'
		});
		expect(classifySaveFailure(new Error('accessDenied:C:\\secret\\book'))).toEqual({
			type: 'failed',
			errorCode: 'accessDenied',
			retryable: false
		});
		expect(classifySaveFailure(new Error('unexpected C:\\secret\\book'))).toEqual({
			type: 'failed',
			errorCode: 'saveFailed',
			retryable: true
		});
	});

	it('allows clean close and protects every unresolved save state', () => {
		expect(closeProtectionFor({ type: 'clean', savedAt: 'now' })).toEqual({
			action: 'allow'
		});
		expect(closeProtectionFor({ type: 'saving', startedAt: 'now' })).toEqual({
			action: 'wait',
			message: '正在完成当前保存，完成后即可安全退出。'
		});
		expect(closeProtectionFor({ type: 'dirty' }).action).toBe('confirm');
		expect(closeProtectionFor({
			type: 'failed',
			errorCode: 'writeFailed',
			retryable: true
		}).action).toBe('confirm');
		expect(closeProtectionFor({
			type: 'external_conflict',
			detectedAt: 'now'
		}).action).toBe('confirm');
	});
});
