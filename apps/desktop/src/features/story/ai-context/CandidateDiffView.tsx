const CONTEXT_LENGTH = 160;

function compactDiff(original: string, modified: string): {
	readonly before: string;
	readonly originalChange: string;
	readonly modifiedChange: string;
	readonly after: string;
} {
	let prefix = 0;
	while (
		prefix < original.length
		&& prefix < modified.length
		&& original[prefix] === modified[prefix]
	) {
		prefix += 1;
	}
	let suffix = 0;
	while (
		suffix < original.length - prefix
		&& suffix < modified.length - prefix
		&& original[original.length - 1 - suffix] === modified[modified.length - 1 - suffix]
	) {
		suffix += 1;
	}
	const beforeStart = Math.max(0, prefix - CONTEXT_LENGTH);
	const afterEnd = Math.min(original.length, original.length - suffix + CONTEXT_LENGTH);
	return {
		before: `${beforeStart > 0 ? '…' : ''}${original.slice(beforeStart, prefix)}`,
		originalChange: original.slice(prefix, original.length - suffix),
		modifiedChange: modified.slice(prefix, modified.length - suffix),
		after: `${original.slice(original.length - suffix, afterEnd)}${afterEnd < original.length ? '…' : ''}`
	};
}

export function CandidateDiffView({
	original,
	modified
}: {
	readonly original: string;
	readonly modified: string;
	readonly theme: 'vs' | 'vs-dark';
}): React.JSX.Element {
	const diff = compactDiff(original, modified);
	return (
		<div className="candidate-diff-view" aria-label="原文与建议修改对比">
			<div className="candidate-diff-grid" aria-label="修改对比">
				<section>
					<strong>原文</strong>
					<pre>
						{diff.before}
						{diff.originalChange
							? <del>{diff.originalChange}</del>
							: <span className="diff-insertion-point">插入点</span>}
						{diff.after}
					</pre>
				</section>
				<section>
					<strong>建议修改</strong>
					<pre>
						{diff.before}
						{diff.modifiedChange ? <ins>{diff.modifiedChange}</ins> : null}
						{diff.after}
					</pre>
				</section>
			</div>
		</div>
	);
}
