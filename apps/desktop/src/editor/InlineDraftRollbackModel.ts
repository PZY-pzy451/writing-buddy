export interface UndoableInlineDraftModel {
	readonly undo: () => void | Promise<void>;
	readonly getValue: () => string;
}

export async function rollbackAppliedInlineDraft(
	model: UndoableInlineDraftModel
): Promise<string> {
	await model.undo();
	return model.getValue();
}
