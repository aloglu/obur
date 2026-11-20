// Compiles the message catalog (messages/*.json) with Paraglide. Paraglide reports a plugin it couldn't load as a
// warning and then says "Successfully compiled" with no messages, so the type check failed later with 110 unrelated
// errors (2026-11-20 audit, R10). Here a plugin that doesn't load stops the build at once. The plugins come from
// node_modules (exact versions in package.json), never from a CDN.
import { spawnSync } from 'node:child_process';

const run = spawnSync(
	'npx',
	[
		'paraglide-js',
		'compile',
		'--project',
		'./project.inlang',
		'--outdir',
		'./src/lib/paraglide',
		'--strategy',
		'custom-obur',
		'baseLocale',
		'--emit-ts-declarations'
	],
	{ encoding: 'utf8' }
);
const output = `${run.stdout}${run.stderr}`;
process.stdout.write(output);
if (run.status !== 0) process.exit(run.status ?? 1);
if (/PluginImportError|Couldn't import the plugin/.test(output)) {
	console.error('i18n: a translation plugin did not load (see above); run npm install.');
	process.exit(1);
}
