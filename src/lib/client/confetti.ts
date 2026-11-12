// The celebration's confetti (docs/ui.md, "Achievements"): paper that falls, lands and stays, and flies up like a
// snow globe when stirred. Plain numbers in, plain numbers out: the component draws it. Lengths are CSS pixels,
// times seconds.

export interface Piece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Rotation in the page's plane, radians. */
	angle: number;
	spin: number;
	/** The tumble that makes paper flash as it falls, radians. */
	flip: number;
	/** Index into the caller's colours. */
	colour: number;
}
export interface Box {
	width: number;
	height: number;
}
export interface Vector {
	x: number;
	y: number;
}

/** Half a piece's width for collisions: a little under its size, so paper overlaps the way paper does. */
export const RADIUS = 6;
/** Below this speed (px/s) a pile counts as still, and nothing needs drawing again. */
export const STILL = 12;
const PULL = 1100;
const DRAG = 2;
/** What a piece keeps of its speed each step it rubs against an edge or another piece. */
const RUB = 0.92;

/** About one piece per 4 px of width: a phone gets around a hundred, a wide screen no more than 180. */
export const countFor = (width: number) => Math.max(60, Math.min(180, Math.round(width / 4)));

/** Pieces above the top edge at different heights, already falling, so they arrive over a second or two. */
export function scatter(count: number, box: Box, colours: number, random = Math.random): Piece[] {
	return Array.from({ length: count }, (_, i) => ({
		x: RADIUS + random() * (box.width - 2 * RADIUS),
		y: -RADIUS - random() * box.height * 0.9,
		vx: (random() - 0.5) * 240,
		vy: random() * 200,
		angle: random() * Math.PI * 2,
		spin: (random() - 0.5) * 12,
		flip: random() * Math.PI * 2,
		colour: i % colours
	}));
}

/**
 * Moves everything on by `dt`. `gravity` is in g: (0, 1) is straight down the page. Returns the fastest piece's speed,
 * so the caller can stop drawing once the pile is still.
 *
 * Pieces are moved, then pushed out of each other and back inside the edges, and their speed is whatever movement
 * that left them: a piece resting on others ends up with none, so a pile lies still instead of trembling.
 */
export function step(pieces: Piece[], box: Box, gravity: Vector, dt: number): number {
	const slow = Math.exp(-DRAG * dt);
	const from = pieces.map((p) => {
		p.vx = (p.vx + gravity.x * PULL * dt) * slow;
		p.vy = (p.vy + gravity.y * PULL * dt) * slow;
		const start = { x: p.x, y: p.y, speed: Math.hypot(p.vx, p.vy), touched: false };
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.angle += p.spin * dt;
		p.flip += Math.min(start.speed / 40, 9) * dt;
		return start;
	});
	for (let pass = 0; pass < 4; pass++) {
		for (let i = 0; i < pieces.length; i++) {
			const a = pieces[i];
			for (let j = i + 1; j < pieces.length; j++) {
				const b = pieces[j];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				if (Math.abs(dx) >= 2 * RADIUS || Math.abs(dy) >= 2 * RADIUS) continue;
				const distance = Math.hypot(dx, dy);
				if (distance >= 2 * RADIUS) continue;
				// Two pieces on exactly the same spot part sideways, alternating so a stack of them spreads.
				const nx = distance ? dx / distance : (i + j) % 2 ? 1 : -1;
				const ny = distance ? dy / distance : 0;
				const overlap = (2 * RADIUS - distance) / 2;
				a.x -= nx * overlap;
				a.y -= ny * overlap;
				b.x += nx * overlap;
				b.y += ny * overlap;
				from[i].touched = from[j].touched = true;
			}
		}
		pieces.forEach((p, i) => {
			if (walls(p, box)) from[i].touched = true;
		});
	}
	let fastest = 0;
	pieces.forEach((p, i) => {
		const start = from[i];
		p.vx = (p.x - start.x) / dt;
		p.vy = (p.y - start.y) / dt;
		let speed = Math.hypot(p.vx, p.vy);
		// Being pushed out of an overlap must not throw a piece faster than it was going.
		if (speed > start.speed && speed > 0) {
			p.vx *= start.speed / speed;
			p.vy *= start.speed / speed;
			speed = start.speed;
		}
		if (start.touched) {
			p.vx *= RUB;
			p.vy *= RUB;
			p.spin *= 0.85;
			speed *= RUB;
			// Barely moving against something: at rest, exactly where it was.
			if (speed < STILL / 2) {
				p.vx = p.vy = speed = 0;
				p.spin = 0;
			}
		}
		fastest = Math.max(fastest, speed);
	});
	return fastest;
}

/** Puts a piece back inside the sides, the bottom, and the top once it has come in. True when it was outside. */
function walls(p: Piece, box: Box): boolean {
	const x = Math.min(Math.max(p.x, RADIUS), box.width - RADIUS);
	// New pieces still fall in from above; only ones thrown upward meet the top edge.
	const y = Math.min(p.vy < 0 ? Math.max(p.y, RADIUS) : p.y, box.height - RADIUS);
	const moved = x !== p.x || y !== p.y;
	p.x = x;
	p.y = y;
	return moved;
}

/** The snow globe: everything is thrown about, mostly away from where it was lying. */
export function stir(pieces: Piece[], gravity: Vector, strength = 2000, random = Math.random) {
	const size = Math.hypot(gravity.x, gravity.y);
	const up = size > 0.2 ? { x: -gravity.x / size, y: -gravity.y / size } : { x: 0, y: 0 };
	for (const p of pieces) {
		const direction = random() * Math.PI * 2;
		const push = strength * (0.35 + random() * 0.65);
		p.vx += Math.cos(direction) * push * 0.6 + up.x * push;
		p.vy += Math.sin(direction) * push * 0.6 + up.y * push;
		p.spin = (random() - 0.5) * 16;
	}
}
