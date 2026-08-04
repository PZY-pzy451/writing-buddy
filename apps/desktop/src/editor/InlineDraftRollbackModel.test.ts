import { describe, expect, it, vi } from 'vitest';

import { rollbackAppliedInlineDraft } from './InlineDraftRollbackModel';

describe('InlineDraftRollbackModel', () => {
	it('undoes the captured source model without touching a replacement editor model', async () => {
		const sourceUndo = vi.fn();
		const replacementUndo = vi.fn();
		const sourceModel = {
			undo: sourceUndo,
			getValue: () => 'source before AI edit'
		};
		const replacementModel = {
			undo: replacementUndo,
			getValue: () => 'new project content'
		};

		const restoredContent = await rollbackAppliedInlineDraft(sourceModel);

		expect(restoredContent).toBe('source before AI edit');
		expect(sourceUndo).toHaveBeenCalledOnce();
		expect(replacementModel.getValue()).toBe('new project content');
		expect(replacementUndo).not.toHaveBeenCalled();
	});
});
