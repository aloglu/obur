// The text of /third-party-notices.txt, from the packages each build bundled (scripts/notices-plugin.ts): obur's own
// licence, the OpenMoji icons' credit, then each package once with its licence in full. Read when the build
// prerenders the route (src/routes/third-party-notices.txt), after the client and server bundles are written.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NOTICES_DIR, readPackage, type NoticePackage } from './notices-plugin.ts';

/**
 * Packages in the app that are no module of the bundle: the fonts and Tailwind's base styles come in through CSS
 * @import (src/routes/layout.css), and the message functions are code Paraglide writes.
 */
const ALSO = [
	'@fontsource-variable/inter',
	'@fontsource-variable/bricolage-grotesque',
	'tailwindcss',
	'@inlang/paraglide-js'
];

export function noticesText(): string {
	if (!existsSync(NOTICES_DIR)) throw new Error(`${NOTICES_DIR} is missing: run vite build first`);
	const packages = new Map<string, NoticePackage>();
	for (const file of readdirSync(NOTICES_DIR).filter((f) => f.endsWith('.json'))) {
		for (const pkg of JSON.parse(
			readFileSync(path.join(NOTICES_DIR, file), 'utf8')
		) as NoticePackage[])
			packages.set(`${pkg.name}@${pkg.version}`, pkg);
	}
	for (const name of ALSO) {
		const pkg = readPackage(path.join('node_modules', name));
		if (!pkg) throw new Error(`${name} is not installed`);
		packages.set(`${pkg.name}@${pkg.version}`, pkg);
	}
	const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
	const rule = '-'.repeat(78);
	const parts = [
		'obur: third-party notices',
		'',
		'obur is MIT licensed:',
		'',
		readFileSync('LICENSE', 'utf8').trim(),
		'',
		rule,
		'Icons: OpenMoji, the open-source emoji and icon project (https://openmoji.org), version 15.1.0, licensed under',
		'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Changes: numbers rounded to two decimals,',
		'element IDs and whitespace removed; the dark-mode copies have the black outlines redrawn in a light tone.',
		'',
		rule,
		`The app also contains these ${sorted.length} packages, each under its own licence:`,
		''
	];
	for (const pkg of sorted) {
		parts.push(rule, `${pkg.name} ${pkg.version} (${pkg.license})`, '');
		if (!pkg.texts.length)
			parts.push(`(The package has no licence file; its licence is ${pkg.license}.)`, '');
		for (const { text } of pkg.texts) parts.push(text, '');
	}
	return parts.join('\n');
}
