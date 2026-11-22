import { describe, expect, it } from 'vitest';
import { packageDir, readPackage } from './notices-plugin.ts';

describe('packageDir', () => {
	it('finds the package a bundled module came from, scoped or not', () => {
		expect(packageDir('/app/node_modules/svelte/src/index.js')).toBe('/app/node_modules/svelte');
		expect(packageDir('\0/app/node_modules/@lucide/svelte/dist/icons/x.svelte?v=1')).toBe(
			'/app/node_modules/@lucide/svelte'
		);
		expect(packageDir('/app/node_modules/a/node_modules/b/index.js')).toBe(
			'/app/node_modules/a/node_modules/b'
		);
		expect(packageDir('/app/src/lib/shared/numbers.ts')).toBeNull();
	});
});

describe('readPackage', () => {
	it('keeps a font’s licence in full', () => {
		const pkg = readPackage('node_modules/@fontsource-variable/inter');
		expect(pkg?.license).toBe('OFL-1.1');
		expect(pkg?.texts.map((t) => t.text).join('\n')).toContain(
			'SIL Open Font License, Version 1.1'
		);
	});
});
