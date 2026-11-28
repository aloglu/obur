// Fruit (batch 1). Fruit whose inside identifies it best (kiwi, avocado, melon, grapefruit, watermelon, coconut) is
// drawn cut; the rest whole.
import {
	P,
	band,
	circle,
	ellipse,
	highlight,
	leaf,
	line,
	polar,
	ramp,
	shaded,
	svg,
	type Ramp
} from '../lib.ts';

export const fruit: Record<string, string> = {};

// --- Pilot (2026-11-27) ---

fruit.pear = svg(
	line('M512 240C512 180 530 120 566 70', P.stem, 40) +
		`<path fill="${P.leaf.base}" d="M560 130C620 60 720 50 790 80C740 150 650 175 560 130Z"/>` +
		ramp(
			'M512 220C592 220 628 285 642 370C656 455 770 525 798 660C836 840 690 965 512 965C334 965 188 840 226 660C254 525 368 455 382 370C396 285 432 220 512 220Z',
			P.pear,
			-70,
			-55,
			highlight(370, 700, 40, 80, 20, P.pear.hi)
		)
);

fruit.cherries = svg(
	line('M340 560C380 380 470 240 600 110M700 620C690 430 650 260 600 110', P.leaf.dark, 34) +
		`<path fill="${P.leaf.base}" d="M600 112C650 40 770 30 850 70C790 150 690 170 600 112Z"/>` +
		ramp(circle(330, 735, 215), P.red, -55, -45, highlight(250, 680, 34, 58, 25, P.red.hi)) +
		ramp(circle(705, 770, 205), P.red, -55, -45, highlight(630, 715, 32, 55, 25, P.red.hi))
);

fruit.apricot = svg(
	ramp(
		'M512 175C760 175 905 360 905 575C905 800 735 960 512 960C289 960 119 800 119 575C119 360 264 175 512 175Z',
		P.apricot,
		-70,
		-55,
		line('M500 200C420 380 430 700 540 940', P.apricot.dark, 22, ' opacity=".8"') +
			highlight(300, 420, 60, 100, 30, P.apricot.hi)
	) +
		line('M512 210C515 160 530 120 555 90', P.stem, 34) +
		`<path fill="${P.leaf.base}" d="M545 120C610 50 730 50 800 95C730 165 630 175 545 120Z"/>`
);

// --- Batch 1 (2026-11-28) ---

const APPLE =
	'M512 300C440 250 330 232 250 292C150 367 132 520 170 650C215 802 320 930 420 930C462 930 482 906 512 906C542 906 562 930 604 930C704 930 809 802 854 650C892 520 874 367 774 292C694 232 584 250 512 300Z';
const appleTop = (body: Ramp, leafFill: string) =>
	ramp(
		APPLE,
		body,
		-70,
		-55,
		highlight(300, 470, 50, 95, 25, body.hi) +
			line('M445 296C480 326 545 326 580 296', body.dark, 22, ' opacity=".7"')
	) +
	line('M512 318C506 246 520 186 556 134', P.stem, 38) +
	leaf(548, 196, 770, 118, 62, leafFill);
fruit.apple = svg(appleTop(P.red, P.leaf.base));
fruit.green_apple = svg(appleTop(P.greenApple, P.leaf.dark));

fruit.orange = svg(
	ramp(
		circle(512, 570, 370),
		P.orange,
		-70,
		-55,
		highlight(330, 430, 55, 100, 35, P.orange.hi) +
			[
				[620, 420],
				[700, 560],
				[560, 700],
				[440, 600],
				[650, 760]
			]
				.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${P.orange.dark}" opacity=".5"/>`)
				.join('')
	) +
		`<circle cx="512" cy="212" r="16" fill="${P.leaf.dark}"/>` +
		leaf(520, 205, 760, 120, 66, P.leaf.base)
);

// A half, seen face on: rind, pith, segments.
const SEGMENTS = Array.from({ length: 8 }, (_, i) => {
	const a = (i * Math.PI) / 4 + Math.PI / 8;
	return `M512 560L${Math.round(512 + Math.cos(a) * 330)} ${Math.round(560 + Math.sin(a) * 330)}`;
}).join('');
fruit.grapefruit = svg(
	ramp(circle(512, 560, 400), { base: '#F6A04D', dark: '#DA7A2D', hi: '#FAC07E' }, -40, -40) +
		`<path fill="${P.cream.base}" d="${circle(512, 560, 352)}"/>` +
		shaded(
			circle(512, 560, 326),
			'#F2686A',
			'#DE4C55',
			-30,
			-30,
			line(SEGMENTS, P.cream.base, 18) +
				`<circle cx="512" cy="560" r="34" fill="${P.cream.base}"/>` +
				highlight(380, 420, 36, 70, 40, '#F8A0A0')
		)
);

// A slice with the flat cut on top.
const HALF = (r: number) => `M${512 - r} 420A${r} ${r} 0 0 0 ${512 + r} 420Z`;
fruit.watermelon = svg(
	'<g transform="rotate(-14 512 560)">' +
		`<path fill="${P.rind.base}" d="${HALF(410)}"/>` +
		`<path fill="${P.rind.hi}" d="${HALF(372)}"/>` +
		shaded(
			HALF(346),
			P.flesh.base,
			P.flesh.dark,
			-40,
			-40,
			[
				[400, 500],
				[512, 540],
				[624, 500],
				[460, 640],
				[570, 640],
				[512, 730]
			]
				.map(
					([x, y]) =>
						`<ellipse cx="${x}" cy="${y}" rx="17" ry="28" fill="${P.seed}" transform="rotate(${(x - 512) / 6} ${x} ${y})"/>`
				)
				.join('')
		) +
		'</g>'
);

// A halved melon (kavun, cantaloupe) seen face on: rind, orange flesh, seed hollow.
fruit.melon = svg(
	ramp(ellipse(512, 560, 420, 340), { base: '#D9C06A', dark: '#B59A45', hi: '#E8D594' }, -45, -40) +
		shaded(
			ellipse(512, 560, 372, 294),
			P.cantaloupe.base,
			P.cantaloupe.dark,
			-35,
			-30,
			`<path fill="${P.cantaloupe.dark}" d="${ellipse(512, 560, 210, 130)}"/>` +
				[
					[400, 545, -20],
					[460, 600, -10],
					[530, 525, 10],
					[590, 590, 20],
					[640, 540, 30],
					[490, 500, 0]
				]
					.map(
						([x, y, a]) =>
							`<ellipse cx="${x}" cy="${y}" rx="30" ry="16" fill="#FBE7C4" transform="rotate(${a} ${x} ${y})"/>`
					)
					.join('') +
				highlight(300, 430, 30, 60, 45, P.cantaloupe.hi)
		)
);

const PINE = ellipse(512, 640, 260, 330);
const LATTICE = Array.from({ length: 9 }, (_, i) => {
	const o = (i - 4) * 120;
	return `M${252 + o} 310L${772 + o} 970M${772 - o} 310L${252 - o} 970`;
}).join('');
fruit.pineapple = svg(
	`<path fill="${P.leaf.dark}" d="M512 360L430 90L540 250L600 70L585 300L720 170L620 370Z"/>` +
		`<path fill="${P.leaf.base}" d="M505 370L300 200L420 260L380 120L520 330Z"/>` +
		ramp(
			PINE,
			P.pineapple,
			-60,
			-50,
			line(LATTICE, P.pineapple.deep!, 16, ' opacity=".55"') +
				highlight(360, 520, 40, 90, 20, P.pineapple.hi)
		)
);

const BERRY =
	'M512 945C382 905 205 728 178 528C158 376 250 284 380 284C440 284 482 302 512 322C542 302 584 284 644 284C774 284 866 376 846 528C819 728 642 905 512 945Z';
const SEEDS = [
	[340, 440],
	[450, 430],
	[580, 430],
	[690, 450],
	[300, 560],
	[410, 560],
	[520, 560],
	[630, 560],
	[740, 570],
	[360, 680],
	[470, 690],
	[580, 690],
	[680, 680],
	[440, 800],
	[550, 810]
];
fruit.strawberry = svg(
	ramp(
		BERRY,
		P.strawberry,
		-65,
		-55,
		SEEDS.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="18" fill="#F7D774"/>`).join(
			''
		) + highlight(280, 500, 34, 70, 20, P.strawberry.hi)
	) +
		`<path fill="${P.leaf.base}" d="M512 250L560 180L590 280L690 250L630 330L700 380L590 370L512 420L434 370L324 380L394 330L334 250L434 280L464 180Z"/>` +
		line('M512 260C512 200 525 150 550 110', P.leaf.dark, 30)
);

// Forest fruits and blueberries: three berries, each with its crown.
const crown = (cx: number, cy: number) =>
	`<path fill="${P.blueberry.deep}" d="M${cx} ${cy - 38}L${cx + 14} ${cy - 12}L${cx + 40} ${cy - 10}L${cx + 18} ${cy + 8}L${cx + 26} ${cy + 36}L${cx} ${cy + 20}L${cx - 26} ${cy + 36}L${cx - 18} ${cy + 8}L${cx - 40} ${cy - 10}L${cx - 14} ${cy - 12}Z"/>`;
const berry = (cx: number, cy: number, r: number) =>
	ramp(
		circle(cx, cy, r),
		P.blueberry,
		-r / 4,
		-r / 5,
		crown(cx + r * 0.15, cy - r * 0.2) +
			highlight(cx - r * 0.5, cy - r * 0.15, r * 0.12, r * 0.25, 25, P.blueberry.hi)
	);
fruit.blueberries = svg(
	leaf(560, 330, 820, 160, 70, P.leaf.base) +
		berry(370, 470, 200) +
		berry(690, 560, 215) +
		berry(450, 770, 210)
);

// A whole kiwi behind, a half in front.
fruit.kiwi = svg(
	ramp(ellipse(400, 470, 290, 250), P.brown, -50, -45) +
		ramp(circle(620, 640, 330), P.brown, -30, -30) +
		shaded(
			circle(620, 640, 292),
			P.kiwiFlesh.base,
			P.kiwiFlesh.dark,
			-25,
			-25,
			`<path fill="${P.kiwiFlesh.hi}" d="${ellipse(620, 640, 95, 80)}"/>` +
				Array.from({ length: 14 }, (_, i) => {
					const a = (i * 2 * Math.PI) / 14;
					const x = Math.round(620 + Math.cos(a) * 140);
					const y = Math.round(640 + Math.sin(a) * 125);
					return `<ellipse cx="${x}" cy="${y}" rx="9" ry="20" fill="${P.seed}" transform="rotate(${Math.round((a * 180) / Math.PI) + 90} ${x} ${y})"/>`;
				}).join('')
		)
);

// A whole coconut behind (three eyes), a half in front: hairy shell, white flesh, the hollow.
const HAIR = (cx: number, cy: number, r: number) =>
	Array.from({ length: 12 }, (_, i) => {
		const a = (i * Math.PI) / 6 + 0.2;
		const [c, s] = [Math.cos(a), Math.sin(a)];
		const p = (k: number) => `${Math.round(cx + c * r * k)} ${Math.round(cy + s * r * k)}`;
		return `M${p(0.96)}L${p(0.8)}`;
	}).join('');
fruit.coconut = svg(
	ramp(
		circle(370, 420, 290),
		P.coconut,
		-45,
		-40,
		line(HAIR(370, 420, 290), P.coconut.dark, 14) +
			`<circle cx="320" cy="330" r="26" fill="${P.coconut.dark}"/><circle cx="400" cy="300" r="26" fill="${P.coconut.dark}"/><circle cx="370" cy="380" r="26" fill="${P.coconut.dark}"/>`
	) +
		ramp(
			circle(630, 650, 340),
			P.coconut,
			-40,
			-35,
			line(HAIR(630, 650, 340), P.coconut.dark, 14)
		) +
		`<path fill="${P.cream.base}" d="${circle(630, 650, 275)}"/>` +
		shaded(circle(630, 650, 212), P.cream.dark, '#D8CAB0', 30, 30)
);

const AVOCADO =
	'M512 150C610 150 655 230 668 330C680 430 800 500 830 640C870 830 720 960 512 960C304 960 154 830 194 640C224 500 344 430 356 330C369 230 414 150 512 150Z';
const AVOCADO_IN =
	'M512 205C585 205 618 268 628 350C638 440 748 505 772 640C805 800 680 905 512 905C344 905 219 800 252 640C276 505 386 440 396 350C406 268 439 205 512 205Z';
fruit.avocado = svg(
	ramp(AVOCADO, P.avocadoSkin, -40, -35) +
		shaded(
			AVOCADO_IN,
			P.avocadoFlesh.base,
			P.avocadoFlesh.dark,
			-30,
			-30,
			`<path fill="${P.avocadoFlesh.hi}" d="${ellipse(512, 640, 210, 230)}"/>`
		) +
		ramp(circle(512, 660, 150), P.pit, -35, -30, highlight(460, 610, 22, 44, 30, P.pit.hi))
);

// Grapes and raisins: a bunch, four rows narrowing down.
const GRAPES = [
	[330, 330],
	[480, 320],
	[630, 330],
	[780, 350],
	[400, 480],
	[555, 475],
	[710, 490],
	[470, 630],
	[625, 635],
	[545, 780]
];
fruit.grapes = svg(
	line('M560 250C560 180 580 120 620 80', P.stem, 34) +
		leaf(590, 160, 840, 110, 80, P.leaf.base) +
		GRAPES.map(([x, y]) =>
			ramp(circle(x, y, 92), P.grape, -24, -20, highlight(x - 40, y - 20, 12, 24, 30, P.grape.hi))
		).join('')
);

// --- Batch 1, round 3 (2026-11-28): drawn from the real fruit's outline; versions picked by the owner ---

const deg = (a: number) => (a * Math.PI) / 180;
/** Closeness of angle `a` to `at`, 1 there and fading over `spread` radians: for bumps on an outline. */
const near = (a: number, at: number, spread: number) => {
	const d = Math.atan2(Math.sin(a - at), Math.cos(a - at));
	return Math.exp(-((d / spread) ** 2));
};

// --- Banana: a band along a gentle arc, tapering at both ends, its lower face in shadow, with a stalk and a tip. ---

export function banana(R: number, from: number, to: number, wide: number, back = false) {
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
function sepals(top: number, w: number, h: number) {
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
		sepals(top, w, h) +
			ramp(body, P.ruby, -65, -55, highlight(330, 520, 46, 90, 35, P.ruby.hi) + extra)
	);
// Picked: banana version B, turned back to the earlier orientation (stalk upper left), at the 40° the owner chose.
fruit.banana = svg(`<g transform="rotate(40 512 512)">${banana(620, 128, 52, 215)}</g>`);
// Picked: lemon C, lime A, mango A, pomegranate B.
fruit.lemon = citrus(lemonShape(335, 245, 0.2, 0.1, -25), P.lemon);
fruit.lime = citrus(lemonShape(300, 258, 0.07, 0.03, -20), P.lime);
fruit.mango = svg(
	ramp(
		MANGO,
		P.mango,
		-60,
		-50,
		`<circle cx="790" cy="300" r="250" fill="#EF6F3A" opacity=".45"/>` +
			highlight(380, 520, 40, 90, 55, P.mango.hi)
	) + mangoStem(380)
);
fruit.pomegranate = pomegranate(
	squircle(360, 350, 2.15),
	140,
	210,
	140,
	line('M512 300C470 450 470 700 512 930', P.ruby.dark, 18, ' opacity=".45"')
);
