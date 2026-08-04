import { describe, expect, it } from 'vitest';
import {
	controlReferenceTokens,
	summarizeTraceability,
	testSourceReferencesControl,
	validateTraceabilityRows
} from './traceability.mjs';

function completeInput() {
	return {
		rows: [{
			feature_id: 'FEATURE-01-01', page_id: 'PAGE-WRITING', control_id: 'CTRL-WRITE',
			state_id: 'STATE-WRITE-SUCCESS', test_case_id: 'TC-WRITE-001',
			automation_status: 'AUTOMATED', execution_status: 'PASS', cache_status: 'PASS', notes: ''
		}],
		domainCount: 1, featureIds: ['FEATURE-01-01'], pageIds: ['PAGE-WRITING'], workspaceCount: 1,
		controlIds: ['CTRL-WRITE'], stateIds: ['STATE-WRITE-SUCCESS'], shortcutIds: ['SHORTCUT-SAVE'],
		nativeActionIds: ['NATIVE-WRITE'], testCaseIds: ['TC-WRITE-001'],
		mappedShortcutIds: new Set(['SHORTCUT-SAVE']), mappedNativeActionIds: new Set(['NATIVE-WRITE'])
	};
}

describe('regression traceability gate', () => {
	it('TC-QA-TRACEABILITY-001 reports PASS only when every inventory kind is mapped', () => {
		expect(summarizeTraceability(completeInput())).toMatchObject({
			status: 'PASS', productConclusion: 'PASS', counts: { totalUnmapped: 0 }
		});
	});

	it('TC-QA-TRACEABILITY-002 fails closed when a control state lacks a test', () => {
		const input = completeInput();
		input.rows = [{ ...input.rows[0], test_case_id: '', automation_status: 'MISSING' }];
		expect(summarizeTraceability(input)).toMatchObject({
			status: 'REGRESSION_INCOMPLETE', productConclusion: 'PARTIAL'
		});
	});

	it('TC-QA-TRACEABILITY-003 requires reasons for N/A, skip and cached results', () => {
		const base = completeInput().rows[0];
		expect(validateTraceabilityRows([
			{ ...base, execution_status: 'NOT_APPLICABLE', notes: '' },
			{ ...base, execution_status: 'SKIPPED_WITH_REASON', notes: '' },
			{ ...base, execution_status: 'PASS', cache_status: 'CACHED_PASS', last_passed_commit: '', evidence_path: '' }
		])).toHaveLength(3);
	});

	it('TC-QA-TRACEABILITY-004 maps an exact data-testid reference when an accessible name is absent', () => {
		const control = {
			accessibleName: '',
			stableSelectorValue: 'event-inspector-story-start'
		};

		expect(controlReferenceTokens(control)).toEqual(['event-inspector-story-start']);
		expect(testSourceReferencesControl(
			control,
			"screen.getByTestId('event-inspector-story-start')"
		)).toBe(true);
		expect(testSourceReferencesControl(
			control,
			"screen.getByTestId('event-inspector-story-end')"
		)).toBe(false);
	});
});
