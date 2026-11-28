// Drafts for the owner to choose between: three versions of each icon still in question. The chosen one moves to its
// family file and the rest are deleted. Names start with draft_.
import {
	P,
	band,
	circle,
	clipped,
	highlight,
	leaf,
	line,
	polar,
	ramp,
	shaded,
	svg
} from '../lib.ts';
import type { Ramp } from '../lib.ts';

export const drafts: Record<string, string> = {};

const deg = (a: number) => (a * Math.PI) / 180;
/** Closeness of angle `a` to `at`, 1 there and fading over `spread` radians: for bumps on an outline. */
const near = (a: number, at: number, spread: number) => {
	const d = Math.atan2(Math.sin(a - at), Math.cos(a - at));
	return Math.exp(-((d / spread) ** 2));
};

// --- Banana: a band along a gentle arc, tapering at both ends, its lower face in shadow, with a stalk and a tip. ---

function banana(R: number, from: number, to: number, wide: number, back = false) {
	const r = back ? { hi: '#F6DC7A', base: '#EFC232', dark: '#CF9718' } : P.banana;
	const cx = 512;
	const cy = 560 - R;
	const centre = (t: number): [number, number] => {
		const a = deg(from + (to - from) * t);
		return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
	};
	const width = (t: number) => Math.max(34, wide * Math.sin(Math.PI * t) ** 0.6);
	const { d, line: mid } = band(centre, width);
	const [sx, sy] = centre(0);
	const [nx, ny] = centre(0.04);
	const [ex, ey] = centre(1);
	const len = Math.hypot(sx - nx, sy - ny);
	const ux = (sx - nx) / len;
	const uy = (sy - ny) / len;
	const ridge = mid
		.slice(3, -3)
		.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y - wide * 0.12)}`)
		.join('');
	return (
		line(
			`M${Math.round(sx)} ${Math.round(sy)}L${Math.round(sx + ux * 90)} ${Math.round(sy + uy * 90)}`,
			'#8C7A35',
			44
		) +
		shaded(
			d,
			r.base,
			r.dark,
			0,
			-46,
			line(ridge, r.hi, 22, ' opacity=".75" stroke-linejoin="round"')
		) +
		`<circle cx="${Math.round(ex)}" cy="${Math.round(ey)}" r="24" fill="#7A6A2E"/>`
	);
}
drafts.draft_banana_a = svg(`<g transform="rotate(-22 512 512)">${banana(900, 122, 58, 230)}</g>`);
drafts.draft_banana_b = svg(`<g transform="rotate(-22 512 512)">${banana(620, 128, 52, 215)}</g>`);
drafts.draft_banana_c = svg(
	`<g transform="rotate(-22 512 512)"><g transform="translate(40 -120) rotate(-8 512 512)">${banana(760, 124, 60, 200, true)}</g>${banana(760, 122, 58, 220)}</g>`
);

// --- Lemon: an oval whose tips are part of the outline, the stem end's larger. ---

function lemonShape(rx: number, ry: number, tip1: number, tip2: number, turn: number) {
	return polar(
		512,
		560,
		(a) => {
			const k = 1 + tip1 * near(a, 0, 0.09) + tip2 * near(a, Math.PI, 0.09);
			return [rx * Math.cos(a) * k, ry * Math.sin(a) * k];
		},
		turn,
		72
	);
}
const pores = (r: Ramp) =>
	[
		[620, 470],
		[700, 590],
		[540, 680],
		[440, 560]
	]
		.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${r.dark}" opacity=".45"/>`)
		.join('');
const citrus = (d: string, r: Ramp) =>
	svg(ramp(d, r, -60, -50, highlight(350, 470, 44, 95, 60, r.hi) + pores(r)));
drafts.draft_lemon_a = citrus(lemonShape(320, 250, 0.16, 0.07, -25), P.lemon);
drafts.draft_lemon_b = citrus(lemonShape(310, 258, 0.12, 0.05, -25), P.lemon);
drafts.draft_lemon_c = citrus(lemonShape(335, 245, 0.2, 0.1, -25), P.lemon);

// --- Lime: rounder than a lemon, a small tip; or cut open, a whole one behind. ---

drafts.draft_lime_a = citrus(lemonShape(300, 258, 0.07, 0.03, -20), P.lime);
drafts.draft_lime_b = svg(
	ramp(
		lemonShape(295, 265, 0.05, 0, -20),
		P.lime,
		-60,
		-50,
		highlight(350, 480, 42, 90, 60, P.lime.hi) + pores(P.lime)
	) + leaf(700, 330, 900, 230, 50, P.leaf.base)
);
const SEGMENTS = Array.from({ length: 8 }, (_, i) => {
	const a = (i * Math.PI) / 4 + Math.PI / 8;
	return `M640 640L${Math.round(640 + Math.cos(a) * 240)} ${Math.round(640 + Math.sin(a) * 240)}`;
}).join('');
drafts.draft_lime_c = svg(
	`<g transform="translate(-150 -150)">${ramp(lemonShape(250, 215, 0.05, 0.03, -20), P.lime, -50, -45)}</g>` +
		`<path fill="${P.lime.dark}" d="${circle(640, 640, 300)}"/>` +
		`<path fill="#F2F7DC" d="${circle(640, 640, 270)}"/>` +
		shaded(
			circle(640, 640, 246),
			'#B9DE7A',
			'#9CCB4B',
			-25,
			-25,
			line(SEGMENTS, '#F2F7DC', 16) + `<circle cx="640" cy="640" r="26" fill="#F2F7DC"/>`
		)
);

// --- Mango: a plump oval, wider at the stem end, with a small beak low on the narrow end. ---

function mangoShape(A: number, B: number, k: number, turn: number) {
	return polar(
		512,
		540,
		(a) => {
			const beak = 1 + 0.07 * near(a, deg(160), 0.22);
			return [A * Math.cos(a) * beak, B * Math.sin(a) * (1 + k * Math.cos(a)) * beak];
		},
		turn,
		72
	);
}
const MANGO = mangoShape(380, 270, 0.16, -35);
const MANGO_LONG = mangoShape(405, 248, 0.14, -35);
// The stem end is the wide end (angle 0), turned -35°: up and to the right.
const mangoStem = (A: number) => {
	const t = deg(-35);
	const x = Math.round(512 + A * 0.97 * Math.cos(t));
	const y = Math.round(540 + A * 0.97 * Math.sin(t));
	return (
		line(`M${x} ${y}L${x + 40} ${y - 50}`, P.stem, 30) +
		leaf(x + 30, y - 40, x + 230, y - 70, 52, P.leaf.base)
	);
};
drafts.draft_mango_a = svg(
	ramp(
		MANGO,
		P.mango,
		-60,
		-50,
		`<circle cx="790" cy="300" r="250" fill="#EF6F3A" opacity=".45"/>` +
			highlight(380, 520, 40, 90, 55, P.mango.hi)
	) + mangoStem(380)
);
drafts.draft_mango_b = svg(
	ramp(
		MANGO,
		{ hi: '#F6D77E', base: '#F2B53A', dark: '#D98A22' },
		-60,
		-50,
		clipped(
			MANGO,
			`<circle cx="230" cy="790" r="300" fill="#8DBB45" opacity=".8"/><circle cx="800" cy="290" r="240" fill="#E5533D" opacity=".6"/>`
		) + highlight(380, 520, 40, 90, 55, '#F8E3A6')
	) + mangoStem(380)
);
drafts.draft_mango_c = svg(
	ramp(MANGO_LONG, P.banana, -60, -50, highlight(370, 520, 40, 95, 55, P.banana.hi)) +
		mangoStem(405)
);

// --- Pomegranate: a slightly squarish body, a crown of pointed sepals on a short tube. ---

function squircle(rx: number, ry: number, n: number, turn = 0) {
	return polar(
		512,
		600,
		(a) => {
			const c = Math.cos(a);
			const s = Math.sin(a);
			return [
				rx * Math.sign(c) * Math.abs(c) ** (2 / n),
				ry * Math.sign(s) * Math.abs(s) ** (2 / n)
			];
		},
		turn,
		72
	);
}
function crown(top: number, w: number, h: number) {
	const x = (f: number) => Math.round(512 + f * w);
	const y = (f: number) => Math.round(top + f * h);
	const pts = [
		[x(-0.5), y(1.3)],
		[x(-0.5), y(0.55)],
		[x(-0.72), y(0)],
		[x(-0.36), y(0.38)],
		[x(-0.22), y(-0.08)],
		[x(0), y(0.34)],
		[x(0.22), y(-0.08)],
		[x(0.36), y(0.38)],
		[x(0.72), y(0)],
		[x(0.5), y(0.55)],
		[x(0.5), y(1.3)]
	];
	return (
		`<path fill="${P.ruby.dark}" d="M${pts.map((p) => p.join(' ')).join('L')}Z"/>` +
		`<ellipse cx="512" cy="${y(0.42)}" rx="${Math.round(w * 0.36)}" ry="${Math.round(h * 0.14)}" fill="${P.ruby.deep}"/>`
	);
}
const pomegranate = (body: string, top: number, w: number, h: number, extra = '') =>
	svg(
		crown(top, w, h) +
			ramp(body, P.ruby, -65, -55, highlight(330, 520, 46, 90, 35, P.ruby.hi) + extra)
	);
drafts.draft_pomegranate_a = pomegranate(squircle(365, 345, 2.1), 150, 190, 130);
drafts.draft_pomegranate_b = pomegranate(
	squircle(360, 350, 2.15),
	140,
	210,
	140,
	line('M512 300C470 450 470 700 512 930', P.ruby.dark, 18, ' opacity=".45"')
);
drafts.draft_pomegranate_c = pomegranate(squircle(370, 340, 2.35), 155, 180, 125);
