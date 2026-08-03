import ts from 'typescript';

function unwrapExpression(expression) {
	let current = expression;
	while (
		ts.isAsExpression(current)
		|| ts.isSatisfiesExpression(current)
		|| ts.isTypeAssertionExpression(current)
		|| ts.isParenthesizedExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

function propertyName(node) {
	if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
	if (ts.isNumericLiteral(node)) return node.text;
	return node.getText();
}

function caseLabel(expression, sourceFile, index) {
	const value = unwrapExpression(expression);
	if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value)) return value.text;
	if (value.kind === ts.SyntaxKind.TrueKeyword) return 'true';
	if (value.kind === ts.SyntaxKind.FalseKeyword) return 'false';
	if (value.kind === ts.SyntaxKind.NullKeyword) return 'null';
	if (ts.isArrayLiteralExpression(value)) {
		const first = value.elements[0];
		if (first) return caseLabel(first, sourceFile, index);
	}
	return `case-${index + 1}`;
}

function literalCases(expression, sourceFile, bindings, seen = new Set()) {
	const value = unwrapExpression(expression);
	if (ts.isArrayLiteralExpression(value)) {
		if (value.elements.some(ts.isSpreadElement)) return undefined;
		return value.elements.map((element, index) => ({
			label: caseLabel(element, sourceFile, index),
			index
		}));
	}
	if (ts.isObjectLiteralExpression(value)) {
		return value.properties
			.filter(property => (
				ts.isPropertyAssignment(property)
				|| ts.isShorthandPropertyAssignment(property)
				|| ts.isMethodDeclaration(property)
			))
			.map((property, index) => ({ label: propertyName(property.name), index }));
	}
	if (ts.isIdentifier(value)) {
		if (seen.has(value.text)) return undefined;
		const bound = bindings.get(value.text);
		if (!bound) return undefined;
		return literalCases(bound, sourceFile, bindings, new Set([...seen, value.text]));
	}
	if (
		ts.isCallExpression(value)
		&& ts.isPropertyAccessExpression(value.expression)
		&& ts.isIdentifier(value.expression.expression)
		&& value.expression.expression.text === 'Object'
		&& ['entries', 'keys', 'values'].includes(value.expression.name.text)
		&& value.arguments[0]
	) {
		return literalCases(value.arguments[0], sourceFile, bindings, seen);
	}
	return undefined;
}

function rootIdentifier(expression) {
	const value = unwrapExpression(expression);
	if (ts.isIdentifier(value)) return value.text;
	if (ts.isPropertyAccessExpression(value)) return rootIdentifier(value.expression);
	return undefined;
}

function eachCollection(call) {
	if (!ts.isCallExpression(call.expression)) return undefined;
	const factory = call.expression;
	if (!ts.isPropertyAccessExpression(factory.expression)) return undefined;
	if (factory.expression.name.text !== 'each') return undefined;
	if (!['it', 'test'].includes(rootIdentifier(factory.expression.expression) ?? '')) return undefined;
	return factory.arguments[0];
}

function isRegularTestCall(call) {
	const expression = unwrapExpression(call.expression);
	if (ts.isIdentifier(expression)) return ['it', 'test'].includes(expression.text);
	if (!ts.isPropertyAccessExpression(expression)) return false;
	if (expression.name.text === 'each') return false;
	return ['it', 'test'].includes(rootIdentifier(expression.expression) ?? '');
}

function testTitle(argument, sourceFile) {
	if (!argument) return undefined;
	const value = unwrapExpression(argument);
	if (ts.isStringLiteralLike(value)) return value.text.trim();
	if (ts.isTemplateExpression(value)) {
		return value.getText(sourceFile).slice(1, -1).trim();
	}
	return undefined;
}

function enclosingLoopCases(node, sourceFile, bindings) {
	let current = node.parent;
	while (current) {
		if (ts.isForOfStatement(current)) {
			return literalCases(current.expression, sourceFile, bindings);
		}
		current = current.parent;
	}
	return undefined;
}

function renderCaseTitle(title, caseItem, caseIndex) {
	const label = caseItem.label || `case-${caseIndex + 1}`;
	const templateRendered = title.replace(/\$\{[^}]+\}/u, label);
	const formatRendered = templateRendered.replace(/%(?:s|d|i|f|o|O|j)/u, label);
	if (formatRendered !== title) return formatRendered;
	return `${title} [case ${caseIndex + 1}: ${label}]`;
}

function scriptKind(sourcePath) {
	if (sourcePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
	if (sourcePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
	if (sourcePath.endsWith('.ts')) return ts.ScriptKind.TS;
	return ts.ScriptKind.JS;
}

export function discoverVitestTests(sourcePath, sourceText) {
	const sourceFile = ts.createSourceFile(
		sourcePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		scriptKind(sourcePath)
	);
	const bindings = new Map();
	const collectBindings = node => {
		if (
			ts.isVariableDeclaration(node)
			&& ts.isIdentifier(node.name)
			&& node.initializer
		) {
			bindings.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, collectBindings);
	};
	collectBindings(sourceFile);

	const tests = [];
	const visit = node => {
		if (ts.isCallExpression(node)) {
			const each = eachCollection(node);
			const regular = isRegularTestCall(node);
			if (each || regular) {
				const title = testTitle(node.arguments[0], sourceFile);
				if (title) {
					const cases = each
						? literalCases(each, sourceFile, bindings)
						: enclosingLoopCases(node, sourceFile, bindings);
					const instances = cases?.length ? cases : [{ label: '', index: 0 }];
					const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
					for (const [caseIndex, caseItem] of instances.entries()) {
						tests.push({
							title: cases ? renderCaseTitle(title, caseItem, caseIndex) : title,
							declarationTitle: title,
							declarationLine: position.line + 1,
							parameterized: Boolean(each || cases),
							parameterCase: cases ? caseIndex + 1 : undefined,
							parameterCaseLabel: cases ? caseItem.label : undefined,
							parameterizationResolved: !each || Boolean(cases)
						});
					}
				}
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return tests;
}
