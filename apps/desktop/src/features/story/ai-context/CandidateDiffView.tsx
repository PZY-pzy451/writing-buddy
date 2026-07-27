import { DiffEditor } from '@monaco-editor/react';

export function CandidateDiffView({
	original,
	modified,
	theme
}: {
	readonly original: string;
	readonly modified: string;
	readonly theme: 'vs' | 'vs-dark';
}): React.JSX.Element {
	return (
		<div className="candidate-diff-view" aria-label="原文与建议修改对比">
			<DiffEditor
				height="220px"
				language="markdown"
				original={original}
				modified={modified}
				theme={theme}
				options={{
					automaticLayout: true,
					enableSplitViewResizing: true,
					fontSize: 14,
					lineNumbers: 'off',
					minimap: { enabled: false },
					readOnly: true,
					renderSideBySide: false,
					scrollBeyondLastLine: false,
					wordWrap: 'on'
				}}
			/>
		</div>
	);
}
