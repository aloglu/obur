// Every write the browser sends itself (`fetch` with a method other than GET) says which account its tab belongs to
// (`...accountHeaders()`), so the server can refuse it when someone else has signed in on this browser since
// (docs/design.md, "Offline scope and synchronization"; 2026-11-19 audit: Export, Speak and Scan had left it out).
// `api()` in client/api.ts already adds it.

/** The value of a property in an object literal, or undefined. */
function property(object, name) {
	return object.properties.find(
		(p) => p.type === 'Property' && !p.computed && (p.key.name ?? p.key.value) === name
	)?.value;
}

const isAccountHeaders = (node) =>
	node.type === 'SpreadElement' &&
	node.argument.type === 'CallExpression' &&
	node.argument.callee.type === 'Identifier' &&
	node.argument.callee.name === 'accountHeaders';

export default {
	meta: {
		type: 'problem',
		docs: { description: "A browser write carries its tab's account (accountHeaders)." },
		schema: [],
		messages: {
			missing:
				"A {{method}} sent with fetch must include '...accountHeaders()' in its headers, or use api()."
		}
	},
	create(context) {
		return {
			CallExpression(node) {
				if (node.callee.type !== 'Identifier' || node.callee.name !== 'fetch') return;
				const options = node.arguments[1];
				if (!options || options.type !== 'ObjectExpression') return;
				const method = property(options, 'method');
				// A method only known at run time is checked too: it could be a write.
				if (!method || (method.type === 'Literal' && String(method.value).toUpperCase() === 'GET'))
					return;
				const headers = property(options, 'headers');
				if (headers?.type === 'ObjectExpression' && headers.properties.some(isAccountHeaders))
					return;
				context.report({
					node,
					messageId: 'missing',
					data: { method: method.type === 'Literal' ? String(method.value) : 'write' }
				});
			}
		};
	}
};
