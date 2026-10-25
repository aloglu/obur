// Enforces the module boundaries in docs/design.md ("Module boundaries"):
// - code outside a module imports it only through its public entry (src/lib/server/modules/<name>/index.ts);
// - the pure parser modules do not import the database, SvelteKit, Node built-ins or other server code.
import path from 'node:path';

const MODULES = path.join('src', 'lib', 'server', 'modules');
const PURE_MODULES = new Set(['label-parser', 'nl-parser']);
const PURE_FORBIDDEN_PACKAGES =
	/^(\$app\/|@sveltejs\/|drizzle-orm|postgres$|pg$|pg-boss|node:|fs$|path$|child_process$)/;

/** Resolve an import to a repository-relative path, or undefined for packages. */
function resolveTarget(source, filename, root) {
	if (source.startsWith('$lib/') || source.startsWith('#lib/')) {
		return path.join('src', 'lib', source.slice(5));
	}
	if (source === '$lib' || source === '#lib') return path.join('src', 'lib');
	if (source.startsWith('.')) {
		return path.relative(root, path.resolve(path.dirname(filename), source));
	}
	return undefined;
}

/** Split a repository-relative path into its module name and the path inside the module. */
function moduleOf(relPath) {
	if (!relPath || !relPath.startsWith(MODULES + path.sep)) return undefined;
	const [name, ...rest] = relPath.slice(MODULES.length + 1).split(path.sep);
	return { name, inner: rest.join('/') };
}

const PUBLIC_ENTRY = new Set(['', 'index', 'index.ts', 'index.js']);

export default {
	meta: {
		type: 'problem',
		docs: { description: 'Keep imports within the documented module boundaries.' },
		schema: [],
		messages: {
			deepImport:
				"Import module '{{module}}' through its public entry (modules/{{module}}), not '{{inner}}'.",
			impure:
				"Pure module '{{module}}' must not import '{{source}}' (no database, framework or I/O dependencies).",
			pureServer:
				"Pure module '{{module}}' must not import server code outside itself ('{{source}}')."
		}
	},
	create(context) {
		const root = context.cwd;
		const filename = context.filename;
		const self = moduleOf(path.relative(root, filename));

		function check(node) {
			if (!node.source || typeof node.source.value !== 'string') return;
			const source = node.source.value;
			const target = resolveTarget(source, filename, root);
			const targetModule = moduleOf(target);

			if (
				targetModule &&
				targetModule.name !== self?.name &&
				!PUBLIC_ENTRY.has(targetModule.inner)
			) {
				context.report({
					node: node.source,
					messageId: 'deepImport',
					data: { module: targetModule.name, inner: targetModule.inner }
				});
			}

			if (self && PURE_MODULES.has(self.name)) {
				if (!target && PURE_FORBIDDEN_PACKAGES.test(source)) {
					context.report({
						node: node.source,
						messageId: 'impure',
						data: { module: self.name, source }
					});
				} else if (
					target &&
					target.startsWith(path.join('src', 'lib', 'server')) &&
					targetModule?.name !== self.name
				) {
					context.report({
						node: node.source,
						messageId: 'pureServer',
						data: { module: self.name, source }
					});
				}
			}
		}

		return {
			ImportDeclaration: check,
			ExportNamedDeclaration: check,
			ExportAllDeclaration: check,
			ImportExpression: check
		};
	}
};
