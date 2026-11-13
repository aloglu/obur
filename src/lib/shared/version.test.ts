import { describe, expect, it } from 'vitest';
import { compareVersions, newerVersion, parseVersion } from './version.ts';

const cmp = (a: string, b: string) =>
	Math.sign(compareVersions(parseVersion(a)!, parseVersion(b)!));

describe('versions', () => {
	it('reads release and test-release numbers, and nothing else', () => {
		expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: null });
		expect(parseVersion('1.0.0-beta.10')?.pre).toEqual({ label: 'beta', n: 10 });
		for (const odd of ['', 'latest', '1.2', '1.2.3.4', '1.2.3-beta', 'v1.2.3<script>', '1.2.3 '])
			expect(parseVersion(odd)).toBeNull();
	});

	it('orders by number, with a test release before its full release', () => {
		expect(cmp('1.0.0-beta.10', '1.0.0-beta.9')).toBe(1);
		expect(cmp('1.0.0', '1.0.0-beta.10')).toBe(1);
		expect(cmp('1.0.10', '1.0.9')).toBe(1);
		expect(cmp('1.1.0-beta.1', '1.0.5')).toBe(1);
		expect(cmp('2.0.0', '2.0.0')).toBe(0);
	});

	it('tells a full release only about full releases, and a test release about both', () => {
		const published = ['v1.0.0', 'v1.0.1', 'v1.1.0-beta.2', 'v1.0.0-beta.9', 'nightly', 'v0.9.0'];
		expect(newerVersion('1.0.0', published)).toBe('1.0.1');
		expect(newerVersion('1.0.1', published)).toBeNull();
		expect(newerVersion('1.0.0-beta.9', published)).toBe('1.1.0-beta.2');
		expect(newerVersion('1.1.0-beta.2', ['v1.1.0', 'v1.1.0-beta.3'])).toBe('1.1.0');
		expect(newerVersion('not-a-version', published)).toBeNull();
	});
});
