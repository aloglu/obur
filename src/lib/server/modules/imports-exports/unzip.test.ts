import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readArchive } from './archive.ts';
import { archiveKind, readLoseItArchive } from './loseit.ts';
import { listZip, MAX_ENTRIES, TooManyEntries, unzipLimited } from './unzip.ts';

/** An archive whose file says it holds one byte, and holds `mb` megabytes of zeros. */
function lying(mb: number): Uint8Array {
	const zip = zipSync({ 'manifest.json': new Uint8Array(mb * 1024 * 1024) }, { level: 9 });
	const view = new DataView(zip.buffer);
	view.setUint32(22, 1, true);
	for (let i = zip.length - 22; i >= 0; i--)
		if (view.getUint32(i, true) === 0x02014b50) {
			view.setUint32(i + 24, 1, true);
			break;
		}
	return zip;
}

describe('unzipLimited (G07)', () => {
	it('unpacks the wanted files whole', () => {
		const zip = zipSync({
			'a.json': strToU8('{"a":1}'),
			'b.txt': strToU8('x'),
			'c/': new Uint8Array()
		});
		const out = unzipLimited(zip, (n) => n === 'a.json', 1024);
		expect(out).not.toBe('too_large');
		expect(Object.keys(out)).toEqual(['a.json']);
		expect(new TextDecoder().decode((out as Record<string, Uint8Array>)['a.json'])).toBe('{"a":1}');
	});

	it('stops a file that unpacks past the limit, whatever size it declares, without unpacking it all', () => {
		const zip = lying(400);
		const started = performance.now();
		expect(unzipLimited(zip, () => true, 10 * 1024 * 1024)).toBe('too_large');
		// Unpacking all 400 MB takes about a second; stopping at 10 MB takes a small part of that.
		expect(performance.now() - started).toBeLessThan(300);
	});

	it('makes both import readers refuse such a file as too large', () => {
		const zip = lying(250);
		expect(() => readArchive(zip)).toThrow(/too_large/);
		const loseit = zipSync({ 'food-logs.csv': new Uint8Array(250 * 1024 * 1024) }, { level: 9 });
		expect(() => readLoseItArchive(loseit)).toThrow(/too_large/);
	});
});

describe('archives that list too many files (G07, 2026-11-23 verification)', () => {
	const many = (first: Record<string, Uint8Array>) => {
		const files: Record<string, Uint8Array> = { ...first };
		for (let i = 0; i < MAX_ENTRIES + 1; i++) files[`x/${i}.txt`] = new Uint8Array();
		return zipSync(files);
	};

	it('in folders alone are refused as too large by the obur reader', () => {
		const files: Record<string, Uint8Array> = { 'manifest.json': strToU8('{}') };
		for (let i = 0; i < MAX_ENTRIES + 1; i++) files[`x${i}/`] = new Uint8Array();
		const zip = zipSync(files);
		expect(archiveKind(zip)).toBe('too_large');
		expect(() => readArchive(zip)).toThrow(/too_large/);
	});

	it('are said to be too large, and every reader refuses them', () => {
		const loseit = many({
			'food-logs.csv': strToU8('Date'),
			'daily-calorie-summary.csv': strToU8('Date')
		});
		expect(archiveKind(loseit)).toBe('too_large');
		expect(() => readLoseItArchive(loseit)).toThrow(/too_large/);
		expect(unzipLimited(loseit, () => true, 1024 * 1024)).toBe('too_large');
		expect(() => listZip(loseit, () => {})).toThrow(TooManyEntries);
	});

	it('up to the limit are read as usual', () => {
		const files: Record<string, Uint8Array> = { 'a.json': strToU8('{}') };
		for (let i = 0; i < MAX_ENTRIES - 1; i++) files[`x/${i}.txt`] = new Uint8Array();
		const out = unzipLimited(zipSync(files), (n) => n === 'a.json', 1024);
		expect(Object.keys(out)).toEqual(['a.json']);
	});
});
