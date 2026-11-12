import { describe, expect, it } from 'vitest';
import {
	RADIUS,
	STILL,
	countFor,
	pageGravity,
	scatter,
	step,
	stir,
	type Piece
} from './confetti.ts';

/** The same "random" numbers every run. */
function seeded(seed = 7) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

const box = { width: 390, height: 844 };
const down = { x: 0, y: 1 };

function run(pieces: Piece[], gravity: { x: number; y: number }, seconds: number) {
	let fastest = 0;
	for (let t = 0; t < seconds * 60; t++) fastest = step(pieces, box, gravity, 1 / 60);
	return fastest;
}

describe('confetti', () => {
	it('starts out of sight above the top edge, not waiting on it', () => {
		const pieces = scatter(countFor(box.width), box, 5, seeded());
		expect(pieces.length).toBeGreaterThan(90);
		expect(pieces.every((p) => p.y <= -RADIUS)).toBe(true);
	});

	it('falls, piles up at the bottom and stays there, still', () => {
		const pieces = scatter(countFor(box.width), box, 5, seeded());
		const fastest = run(pieces, down, 8);
		expect(fastest).toBeLessThan(STILL);
		for (const p of pieces) {
			expect(p.x).toBeGreaterThanOrEqual(RADIUS - 0.01);
			expect(p.x).toBeLessThanOrEqual(box.width - RADIUS + 0.01);
			expect(p.y).toBeLessThanOrEqual(box.height - RADIUS + 0.01);
			// Everything is in the bottom strip, and more than one layer deep: a pile, not a line.
			expect(p.y).toBeGreaterThan(box.height - 120);
		}
		expect(Math.min(...pieces.map((p) => p.y))).toBeLessThan(box.height - 3 * RADIUS);
	});

	it('slides to whichever side is down when the phone tilts', () => {
		const pieces = scatter(60, box, 5, seeded());
		run(pieces, down, 6);
		run(pieces, { x: 1, y: 0 }, 6);
		expect(pieces.every((p) => p.x > box.width - 120)).toBe(true);
		expect(pieces.every((p) => p.y <= box.height - RADIUS + 0.01)).toBe(true);
	});

	it('flies up when stirred, stays inside, and settles again', () => {
		const random = seeded();
		const pieces = scatter(60, box, 5, random);
		run(pieces, down, 6);
		stir(pieces, down, undefined, random);
		run(pieces, down, 0.4);
		expect(pieces.filter((p) => p.y < box.height - 150).length).toBeGreaterThan(20);
		run(pieces, down, 0.6);
		expect(pieces.every((p) => p.y >= RADIUS - 0.01 && p.x >= RADIUS - 0.01)).toBe(true);
		expect(run(pieces, down, 8)).toBeLessThan(STILL);
	});

	it('reads which way is down from either kind of phone, and when the page is turned', () => {
		// Held upright: Android reports +9.81 on y, an iPhone -9.81.
		expect(pageGravity({ x: 0, y: 9.81 }, 0, false).y).toBeCloseTo(1);
		expect(pageGravity({ x: 0, y: -9.81 }, 0, true).y).toBeCloseTo(1);
		// Right edge down (Android: x = -9.81): down is to the page's right.
		expect(pageGravity({ x: -9.81, y: 0 }, 0, false).x).toBeCloseTo(1);
		// Turned a quarter anticlockwise, the phone's natural left edge is the bottom of the page.
		const turned = pageGravity({ x: 9.81, y: 0 }, 90, false);
		expect(turned.x).toBeCloseTo(0);
		expect(turned.y).toBeCloseTo(1);
	});
});
