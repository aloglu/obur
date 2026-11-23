import { describe, expect, test } from 'vitest';
import { recordingWav, to16k, wav, WAV_RATE } from './wav.ts';

const read = async (blob: Blob) => new DataView(await blob.arrayBuffer());
const ascii = (v: DataView, at: number, n: number) =>
	String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));

describe('wav', () => {
	test('writes a 16 kHz mono 16-bit PCM header the add-on reads', async () => {
		const v = await read(wav(new Float32Array(10)));
		expect(v.byteLength).toBe(44 + 20);
		expect(ascii(v, 0, 4)).toBe('RIFF');
		expect(v.getUint32(4, true)).toBe(36 + 20);
		expect(ascii(v, 8, 8)).toBe('WAVEfmt ');
		expect([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true)]).toEqual([
			1,
			1,
			WAV_RATE
		]);
		expect([v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true)]).toEqual([
			32000, 2, 16
		]);
		expect(ascii(v, 36, 4)).toBe('data');
		expect(v.getUint32(40, true)).toBe(20);
	});

	test('scales samples to 16 bits and clips anything beyond full scale', async () => {
		const v = await read(wav(new Float32Array([0, 1, -1, 0.5, 3, -3])));
		const samples = Array.from({ length: 6 }, (_, i) => v.getInt16(44 + i * 2, true));
		expect(samples).toEqual([0, 32767, -32768, 16383, 32767, -32768]);
	});
});

describe('to16k', () => {
	test('48 kHz becomes a third as many samples, each the average of three', () => {
		const out = to16k(new Float32Array([1, 2, 3, 4, 5, 6, 7]), 48000);
		expect(Array.from(out)).toEqual([2, 5]);
	});

	test('44.1 kHz keeps the length in time and a steady level', () => {
		const out = to16k(new Float32Array(44100).fill(0.25), 44100);
		expect(out.length).toBe(16000);
		expect(out.every((s) => Math.abs(s - 0.25) < 1e-6)).toBe(true);
	});

	test('16 kHz is left as it is', () => {
		const same = new Float32Array([0.1, 0.2]);
		expect(to16k(same, 16000)).toBe(same);
	});
});

describe('recordingWav', () => {
	test('joins the pieces in order and stops at the longest allowed recording', async () => {
		const piece = (value: number) => new Float32Array(48000).fill(value);
		const parts = [piece(0.5), piece(0.5), piece(-0.5)];
		const v = await read(recordingWav(parts, 48000, 2));
		expect(v.getUint32(40, true)).toBe(2 * WAV_RATE * 2);
		expect(v.getInt16(44, true)).toBe(16383);
		expect(v.getInt16(44 + (2 * WAV_RATE - 1) * 2, true)).toBe(16383);
	});

	test('no samples at all is an empty WAV, which the server reads as nothing heard', async () => {
		const v = await read(recordingWav([], 48000, 30));
		expect(v.byteLength).toBe(44);
	});
});
