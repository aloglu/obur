// obur's version numbers (1.2.3, or 1.2.3-beta.4 for a test release) and which published one is newer. Pure.

export interface Version {
	major: number;
	minor: number;
	patch: number;
	/** A test release's label and number ("beta", 4); null for a full release. */
	pre: { label: string; n: number } | null;
}

const PATTERN = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:-([a-z]{1,12})\.(\d{1,4}))?$/;

/** Reads "1.2.3", "v1.2.3" or "1.2.3-beta.4"; anything else is null (tag names come from outside). */
export function parseVersion(text: string): Version | null {
	const m = PATTERN.exec(text);
	if (!m) return null;
	return {
		major: Number(m[1]),
		minor: Number(m[2]),
		patch: Number(m[3]),
		pre: m[4] ? { label: m[4], n: Number(m[5]) } : null
	};
}

export const versionText = (v: Version): string =>
	`${v.major}.${v.minor}.${v.patch}${v.pre ? `-${v.pre.label}.${v.pre.n}` : ''}`;

/** Negative when a is older than b. A test release comes before its full release. */
export function compareVersions(a: Version, b: Version): number {
	const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
	if (core) return core;
	if (!a.pre || !b.pre) return (a.pre ? 0 : 1) - (b.pre ? 0 : 1);
	return a.pre.label.localeCompare(b.pre.label) || a.pre.n - b.pre.n;
}

/**
 * The newest published version worth telling this installation about, or null. Someone on a full release is told
 * about full releases only; someone on a test release also about newer test releases.
 */
export function newerVersion(current: string, published: string[]): string | null {
	const mine = parseVersion(current);
	if (!mine) return null;
	let best: Version | null = null;
	for (const name of published) {
		const v = parseVersion(name);
		if (!v || (v.pre && !mine.pre)) continue;
		if (compareVersions(v, mine) > 0 && (!best || compareVersions(v, best) > 0)) best = v;
	}
	return best ? versionText(best) : null;
}
