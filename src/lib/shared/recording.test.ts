import { describe, expect, it } from 'vitest';
import { tooShortToHear } from './recording.ts';

describe('a Speak recording too short to hear (2026-11-25 Review.md audit, 2.2)', () => {
	it('is an empty one, or a WAV under a quarter of a second, header included', () => {
		expect(tooShortToHear(0, 'audio/mp4')).toBe(true);
		expect(tooShortToHear(44, 'audio/wav')).toBe(true);
		expect(tooShortToHear(44 + 7_999, 'audio/wav')).toBe(true);
		expect(tooShortToHear(44 + 8_000, 'audio/wav')).toBe(false);
		// Other formats are compressed: their size says nothing about their length.
		expect(tooShortToHear(500, 'audio/mp4')).toBe(false);
	});
});
