// Drafts for the owner to choose between: versions of an icon still in question (STYLE.md: a Redo comes back as three
// versions). The chosen one moves to its family file and the rest are deleted. Names start with draft_.
import {
	P,
	band,
	circle,
	deg,
	ellipse,
	highlight,
	leaf,
	line,
	near,
	polar,
	ramp,
	shaded,
	svg,
	type Ramp
} from '../lib.ts';

export const drafts: Record<string, string> = {};

/** Draws `body` scaled by `s` around (512, 600), turned by `turn` degrees and moved by (dx, dy). */
const place = (body: string, dx: number, dy: number, s = 1, turn = 0) =>
	`<g transform="translate(${512 + dx} ${600 + dy}) rotate(${turn}) scale(${s}) translate(-512 -600)">${body}</g>`;

// ---------------------------------------------------------------- Batch 2, round 2 (owner's notes, 2026-11-28)

// --- Beans ("just looks bad"): real bean outlines, a band with blunt ends along a slight arc. ---

// A bean: a smooth oval, a little flatter on the side its small eye sits.
const bean = (cx: number, cy: number, len: number, wide: number, turn: number, r: Ramp) =>
	ramp(
		polar(
			cx,
			cy,
			(a) => [
				(len / 2) * Math.cos(a),
				(wide / 2) * Math.sin(a) * (1 - 0.14 * near(a, Math.PI / 2, 0.55))
			],
			turn,
			48
		),
		r,
		-len / 14,
		-wide / 6,
		highlight(cx - len * 0.17, cy - wide * 0.16, len * 0.07, wide * 0.12, 80 + turn, r.hi) +
			`<ellipse cx="${cx}" cy="${cy + wide * 0.28}" rx="${len * 0.07}" ry="${wide * 0.06}" fill="${r.dark}" transform="rotate(${turn} ${cx} ${cy})"/>`
	);
// A chickpea: round, a small beak, a few soft wrinkles.
const chickpea = (cx: number, cy: number, r: number) =>
	ramp(
		polar(cx, cy, (a) => {
			const k = 1 + 0.1 * near(a, deg(-55), 0.18);
			return [r * Math.cos(a) * k, r * Math.sin(a) * k];
		}),
		P.chickpea,
		-r / 4,
		-r / 5,
		line(
			`M${cx - r * 0.35} ${cy + r * 0.15}Q${cx - r * 0.1} ${cy + r * 0.35} ${cx + r * 0.2} ${cy + r * 0.2}M${cx + r * 0.05} ${cy - r * 0.25}Q${cx + r * 0.3} ${cy - r * 0.05} ${cx + r * 0.45} ${cy + r * 0.25}`,
			P.chickpea.dark,
			r * 0.07,
			' opacity=".55"'
		) + highlight(cx - r * 0.45, cy - r * 0.35, r * 0.1, r * 0.2, 30, P.chickpea.hi)
	);
// A: a heap of white beans (kuru fasulye).
drafts.draft_beans_a = svg(
	bean(380, 480, 330, 200, -18, P.whiteBean) +
		bean(660, 470, 330, 200, 20, P.whiteBean) +
		bean(520, 640, 340, 205, -4, P.whiteBean) +
		bean(320, 740, 320, 195, 22, P.whiteBean) +
		bean(720, 740, 320, 195, -20, P.whiteBean)
);
// B: mixed: kidney beans, a white bean and chickpeas.
drafts.draft_beans_b = svg(
	bean(380, 470, 330, 195, -15, P.kidneyBean) +
		bean(680, 490, 330, 195, 18, P.whiteBean) +
		chickpea(330, 720, 120) +
		bean(560, 680, 330, 195, -8, P.kidneyBean) +
		chickpea(800, 720, 115)
);
// C: chickpeas.
drafts.draft_beans_c = svg(
	[
		[380, 440, 135],
		[640, 430, 135],
		[260, 650, 130],
		[510, 640, 140],
		[770, 650, 130],
		[390, 840, 125],
		[640, 840, 125]
	]
		.map(([x, y, r]) => chickpea(x, y, r))
		.join('')
);

// --- Bell pepper ("not just red"): the same pepper in red, yellow and green. ---

const PEPPER =
	'M512 300C620 262 800 292 840 452C880 612 830 822 720 902C670 937 622 902 592 922C552 947 472 947 432 922C402 902 354 937 304 902C194 822 144 612 184 452C224 292 404 262 512 300Z';
const pepper = (r: Ramp, stalk: string) =>
	ramp(
		PEPPER,
		r,
		-70,
		-50,
		line(
			'M400 330C370 500 370 760 420 920M624 330C654 500 654 760 604 920',
			r.dark,
			18,
			' opacity=".55"'
		) + highlight(300, 520, 40, 100, 15, r.hi)
	) +
	`<ellipse cx="512" cy="300" rx="115" ry="42" fill="${P.leaf.base}"/>` +
	line('M512 300C510 240 530 190 580 160', stalk, 52);
// A: three peppers, red in front.
drafts.draft_bell_pepper_a = svg(
	place(pepper(P.greenPepper, '#2F5E22'), -230, -90, 0.72) +
		place(pepper(P.yellowPepper, P.leaf.dark), 230, -90, 0.72) +
		place(pepper(P.redPepper, P.leaf.dark), 0, 40, 0.82)
);
// B: a red and a yellow one.
drafts.draft_bell_pepper_b = svg(
	place(pepper(P.yellowPepper, P.leaf.dark), 170, -40, 0.8) +
		place(pepper(P.redPepper, P.leaf.dark), -150, 40, 0.84)
);
// C: one green pepper (dolmalık).
drafts.draft_bell_pepper_c = svg(pepper(P.greenPepper, '#2F5E22'));

// --- Broccoli ("too long a stem; needs more texture at the top"): a short thick stalk, a bumpy crown. ---

const bumps = (cx: number, cy: number, r: number, n: number) =>
	Array.from({ length: n }, (_, i) => {
		const a = i * 2.399;
		const d = r * 0.68 * Math.sqrt((i + 0.5) / n);
		const x = Math.round(cx + Math.cos(a) * d);
		const y = Math.round(cy + Math.sin(a) * d);
		const s = Math.round(r * 0.2);
		return (
			`<circle cx="${x}" cy="${y}" r="${s}" fill="${P.broccoli.dark}" opacity=".55"/>` +
			`<circle cx="${Math.round(x - s * 0.25)}" cy="${Math.round(y - s * 0.25)}" r="${Math.round(s * 0.55)}" fill="${P.broccoli.hi}" opacity=".6"/>`
		);
	}).join('');
const floret = (x: number, y: number, r: number, n = 9) =>
	ramp(circle(x, y, r), P.broccoli, -r / 4, -r / 5, bumps(x, y, r, n));
// A: a short stalk, five bumpy florets.
drafts.draft_broccoli_a = svg(
	ramp(
		'M430 650C440 760 450 840 470 880C490 915 534 915 554 880C574 840 584 760 594 650Z',
		P.stalk,
		-30,
		0,
		line('M512 760L440 660M512 760L590 660', P.stalk.dark, 30)
	) +
		(
			[
				[320, 520, 150],
				[512, 430, 175],
				[705, 520, 150],
				[410, 640, 135],
				[615, 640, 135]
			] as [number, number, number][]
		)
			.map(([x, y, r]) => floret(x, y, r))
			.join('')
);
// B: a tighter crown of seven florets over a stub.
drafts.draft_broccoli_b = svg(
	ramp(
		'M450 700C455 790 465 850 480 880C495 905 529 905 544 880C559 850 569 790 574 700Z',
		P.stalk,
		-25,
		0
	) +
		(
			[
				[300, 560, 120],
				[430, 450, 135],
				[600, 450, 135],
				[725, 560, 120],
				[512, 560, 140],
				[380, 660, 115],
				[645, 660, 115]
			] as [number, number, number][]
		)
			.map(([x, y, r]) => floret(x, y, r, 7))
			.join('')
);
// C: one floret: a stalk branching into a domed head.
drafts.draft_broccoli_c = svg(
	ramp(
		'M455 640C465 760 470 840 485 885C497 915 527 915 539 885C554 840 559 760 569 640Z',
		P.stalk,
		-25,
		0
	) +
		line('M512 700L420 610M512 700L610 610', P.stalk.base, 40) +
		floret(512, 450, 300, 22)
);

// --- Carrot ("carrots don't look like this"): a fat, rounded shoulder tapering to a point, ringed, with fronds. ---

const frond = (x1: number, y1: number, x2: number, y2: number, fill: string) => {
	const a = Math.atan2(y2 - y1, x2 - x1);
	const r = Math.round;
	const leaves = [0.35, 0.6, 0.85]
		.map((t) => {
			const x = x1 + (x2 - x1) * t;
			const y = y1 + (y2 - y1) * t;
			const l = 90 * (1.1 - t * 0.5);
			return (
				leaf(
					r(x),
					r(y),
					r(x + Math.cos(a - 0.9) * l),
					r(y + Math.sin(a - 0.9) * l),
					l * 0.22,
					fill
				) +
				leaf(r(x), r(y), r(x + Math.cos(a + 0.9) * l), r(y + Math.sin(a + 0.9) * l), l * 0.22, fill)
			);
		})
		.join('');
	return (
		line(`M${x1} ${y1}L${x2} ${y2}`, fill, 16) +
		leaves +
		leaf(x2, y2, r(x2 + (x2 - x1) * 0.25), r(y2 + (y2 - y1) * 0.25), 18, fill)
	);
};
const carrotAt = (t: number): [number, number] => [
	330 + t * 440,
	310 + t * 560 - Math.sin(Math.PI * t) * 30
];
const carrot = (W: number) => {
	const c = band(carrotAt, (t) => 16 + W * Math.min(1, (t / 0.06) ** 0.5) * (1 - t) ** 0.8, 30);
	// Rings across the carrot, from alternate edges a third of the way in.
	const rings = [0.18, 0.3, 0.42, 0.54, 0.66, 0.78]
		.map((t, i) => {
			const [x, y] = carrotAt(t);
			const w = (W * (1 - t) ** 0.8) / 2;
			const side = i % 2 ? 1 : -1;
			const [nx, ny] = [-0.79 * side, 0.61 * side];
			const p = (k: number) => `${Math.round(x + nx * w * k)} ${Math.round(y + ny * w * k)}`;
			return line(`M${p(0.95)}L${p(0.3)}`, P.carrot.dark, 14, ' opacity=".75"');
		})
		.join('');
	return ramp(c.d, P.carrot, -45, -35, rings);
};
const fronds =
	frond(330, 300, 150, 90, P.leaf.base) +
	frond(330, 300, 300, 50, P.leaf.dark) +
	frond(330, 300, 90, 250, P.leaf.dark);
// A: one fat carrot with feathery fronds.
drafts.draft_carrot_a = svg(fronds + carrot(280));
// B: two carrots.
drafts.draft_carrot_b = svg(
	place(fronds + carrot(260), 120, -60, 0.8, 12) + place(fronds + carrot(280), -90, 40, 0.88, -6)
);
// C: one carrot, more upright.
drafts.draft_carrot_c = svg(place(fronds + carrot(290), 0, 0, 1, 20));

// --- Corn ("its top isn't that straight"): a cob rounded at both ends, rows of kernels, husk leaves. ---

const cobWidth = (t: number) => 300 * Math.sin(Math.PI * (0.04 + 0.92 * t)) ** 0.45;
const COB = band((t) => [512, 160 + t * 700], cobWidth, 30);
const kernels = Array.from({ length: 12 }, (_, row) => {
	const t = (row + 0.7) / 12.6;
	const y = 160 + t * 700;
	const w = cobWidth(t) / 2;
	return [-0.62, -0.21, 0.21, 0.62]
		.filter((f) => Math.abs(f) * w > 20)
		.map(
			(f) =>
				`<rect x="${Math.round(512 + f * w - 24)}" y="${Math.round(y - 22)}" width="48" height="44" rx="18" fill="${P.corn.hi}" opacity=".8"/>`
		)
		.join('');
}).join('');
const cob = ramp(COB.d, P.corn, -40, -20, kernels);
// A: husk leaves peeled down from the base.
drafts.draft_corn_a = svg(
	'<g transform="rotate(28 512 512)">' +
		cob +
		`<path fill="${P.husk.dark}" d="M512 940C380 900 270 760 250 520C330 680 420 800 512 860Z"/>` +
		`<path fill="${P.husk.base}" d="M512 940C644 900 754 760 774 500C694 680 604 800 512 860Z"/>` +
		line('M512 930L512 1000', P.husk.dark, 44) +
		'</g>'
);
// B: the cob alone, a stub of stalk.
drafts.draft_corn_b = svg(
	'<g transform="rotate(28 512 512)">' + cob + line('M512 860L512 930', P.husk.dark, 60) + '</g>'
);
// C: the husk still wrapped round the lower half.
drafts.draft_corn_c = svg(
	'<g transform="rotate(28 512 512)">' +
		cob +
		ramp(
			'M340 560C330 720 400 880 512 950C624 880 694 720 684 560C640 640 580 700 512 720C444 700 384 640 340 560Z',
			P.husk,
			-30,
			0
		) +
		line('M512 720L512 940', P.husk.dark, 14, ' opacity=".6"') +
		'</g>'
);

// --- Ginger ("looks like a baby bear lying on its back"): a flat rhizome whose lobes reach sideways like fingers,
// ringed, with pale cut ends; no upright knobs. ---

const lobe = (cx: number, cy: number, rx: number, ry: number, turn: number) =>
	polar(cx, cy, (a) => [rx * Math.cos(a), ry * Math.sin(a)], turn, 40);
const GINGER = [
	lobe(470, 620, 300, 120, -8),
	lobe(700, 500, 190, 88, -35),
	lobe(270, 520, 170, 80, 35),
	lobe(760, 660, 170, 82, 10)
].join('');
const rings = (pts: [number, number, number][]) =>
	pts
		.map(([x, y, a]) =>
			line(
				`M${x - 40} ${y}Q${x} ${y + 14} ${x + 40} ${y}`,
				P.ginger.deep!,
				11,
				` opacity=".55" transform="rotate(${a} ${x} ${y})"`
			)
		)
		.join('');
const ginger =
	ramp(
		GINGER,
		P.ginger,
		-45,
		-40,
		rings([
			[380, 620, 80],
			[540, 610, 85],
			[650, 520, 55],
			[330, 520, 120],
			[740, 650, 100]
		]) + highlight(420, 570, 26, 80, 80, P.ginger.hi)
	) +
	`<ellipse cx="868" cy="410" rx="38" ry="58" fill="#F6E3A6" transform="rotate(-35 868 410)"/>` +
	`<ellipse cx="923" cy="690" rx="38" ry="58" fill="#F6E3A6" transform="rotate(10 923 690)"/>`;
const gingerSlice = (cx: number, cy: number, r: number) =>
	`<path fill="${P.ginger.base}" d="${circle(cx, cy, r)}"/>` +
	`<path fill="#F6E3A6" d="${circle(cx, cy, r * 0.86)}"/>` +
	`<path fill="none" stroke="#E9CE7E" stroke-width="${r * 0.06}" d="${circle(cx, cy, r * 0.55)}"/>`;
// A: the root alone.
drafts.draft_ginger_a = svg(ginger);
// B: the root and a slice.
drafts.draft_ginger_b = svg(place(ginger, -40, -60, 0.9) + gingerSlice(700, 820, 150));
// C: a smaller root and three slices.
drafts.draft_ginger_c = svg(
	place(ginger, -60, -120, 0.75) +
		gingerSlice(330, 820, 120) +
		gingerSlice(540, 850, 120) +
		gingerSlice(750, 820, 120)
);

// --- Herbs ("not bad, but we can redo it"): parsley, basil, mint. ---

// Flat-leaf parsley: a bunch of stems ending in lobed leaf clusters.
const parsleyCluster = (x: number, y: number, s: number, fill: string) =>
	[-50, 0, 50]
		.map((a) => {
			const ex = Math.round(x + Math.sin(deg(a)) * 120 * s);
			const ey = Math.round(y - Math.cos(deg(a)) * 120 * s);
			return leaf(x, y, ex, ey, 52 * s, fill);
		})
		.join('');
drafts.draft_herbs_a = svg(
	line(
		'M512 960C500 800 420 600 330 420M512 960C512 780 512 560 512 330M512 960C524 800 604 600 694 420',
		P.leaf.dark,
		22
	) +
		parsleyCluster(330, 430, 1.25, P.leaf.dark) +
		parsleyCluster(694, 430, 1.25, P.leaf.dark) +
		parsleyCluster(512, 340, 1.35, P.leaf.base) +
		parsleyCluster(420, 600, 1.1, P.leaf.base) +
		parsleyCluster(610, 600, 1.1, P.leaf.base)
);
// Basil: big, cupped, rounded leaves in pairs.
const basilLeaf = (x1: number, y1: number, x2: number, y2: number, fill: Ramp) => {
	const mx = (x1 + x2) / 2;
	const my = (y1 + y2) / 2;
	return (
		leaf(x1, y1, x2, y2, 125, fill.base) +
		line(
			`M${x1} ${y1}Q${Math.round(mx + (my - y1) * 0.05)} ${Math.round(my)} ${x2} ${y2}`,
			fill.dark,
			12,
			' opacity=".7"'
		)
	);
};
drafts.draft_herbs_b = svg(
	line('M512 960C510 800 510 600 512 380', P.leaf.dark, 34) +
		basilLeaf(512, 800, 220, 680, P.leaf) +
		basilLeaf(512, 800, 804, 680, P.leaf) +
		basilLeaf(512, 590, 270, 430, { ...P.leaf, base: P.leaf.hi }) +
		basilLeaf(512, 590, 754, 430, { ...P.leaf, base: P.leaf.hi }) +
		basilLeaf(512, 420, 512, 130, P.leaf)
);
// Mint: pointed, toothed leaves with veins.
const mintLeaf = (x1: number, y1: number, x2: number, y2: number, fill: string) => {
	const len = Math.hypot(x2 - x1, y2 - y1);
	const a = Math.atan2(y2 - y1, x2 - x1);
	const pts: [number, number][] = [];
	for (let i = 0; i <= 20; i++) {
		const t = i / 20;
		const w = len * 0.3 * Math.sin(Math.PI * t) ** 0.8 * (1 + (i % 2 ? 0.08 : 0));
		pts.push([t * len, -w]);
	}
	for (let i = 19; i >= 1; i--) {
		const t = i / 20;
		const w = len * 0.3 * Math.sin(Math.PI * t) ** 0.8 * (1 + (i % 2 ? 0.08 : 0));
		pts.push([t * len, w]);
	}
	const d =
		'M' +
		pts
			.map(
				([u, v]) =>
					`${Math.round(x1 + u * Math.cos(a) - v * Math.sin(a))} ${Math.round(y1 + u * Math.sin(a) + v * Math.cos(a))}`
			)
			.join('L') +
		'Z';
	const veins = [0.3, 0.5, 0.7]
		.map((t) => {
			const bx = x1 + t * len * Math.cos(a);
			const by = y1 + t * len * Math.sin(a);
			const l = len * 0.2;
			return `M${Math.round(bx)} ${Math.round(by)}L${Math.round(bx + l * Math.cos(a - 0.7))} ${Math.round(by + l * Math.sin(a - 0.7))}M${Math.round(bx)} ${Math.round(by)}L${Math.round(bx + l * Math.cos(a + 0.7))} ${Math.round(by + l * Math.sin(a + 0.7))}`;
		})
		.join('');
	return (
		`<path fill="${fill}" d="${d}"/>` +
		line(`M${x1} ${y1}L${x2} ${y2}${veins}`, P.leaf.hi, 9, ' opacity=".75"')
	);
};
drafts.draft_herbs_c = svg(
	line('M512 960C508 780 508 520 512 300', P.leaf.dark, 34) +
		mintLeaf(512, 820, 230, 700, P.leaf.dark) +
		mintLeaf(512, 820, 794, 700, P.leaf.dark) +
		mintLeaf(512, 620, 270, 480, P.leaf.base) +
		mintLeaf(512, 620, 754, 480, P.leaf.base) +
		mintLeaf(512, 430, 330, 280, P.leaf.dark) +
		mintLeaf(512, 430, 694, 280, P.leaf.dark) +
		mintLeaf(512, 320, 512, 90, P.leaf.base)
);

// --- Leafy greens ("a leaf more than leafy greens"): a lettuce head, a spinach bunch, a cabbage. ---

// A: a lettuce head: ruffled layers around a pale heart.
const ruffle = (r: number, n: number, k: number) =>
	polar(
		512,
		600,
		(a) => [
			r * Math.cos(a) * (1 + k * Math.sin(n * a)),
			r * 0.9 * Math.sin(a) * (1 + k * Math.sin(n * a))
		],
		0,
		96
	);
drafts.draft_leafy_greens_a = svg(
	ramp(ruffle(400, 11, 0.05), P.lettuce, -50, -40) +
		shaded(ruffle(310, 9, 0.05), P.lettuce.base, P.lettuce.dark, -40, -35) +
		shaded(ruffle(210, 7, 0.05), P.lettuce.hi, P.lettuce.base, -30, -25) +
		line(
			'M512 600L330 420M512 600L700 410M512 600L300 700M512 600L730 720',
			P.lettuce.dark,
			12,
			' opacity=".5"'
		)
);
// B: a spinach bunch: spade-shaped leaves on stems, tied.
const spade = (tip: [number, number], turn: number, fill: Ramp) => {
	const [x, y] = tip;
	const d = polar(
		x,
		y,
		(a) => {
			const k = 1 + 0.35 * near(a, deg(-90), 0.45);
			return [150 * Math.cos(a) * k, 190 * Math.sin(a) * k];
		},
		turn,
		48
	);
	return ramp(
		d,
		fill,
		-30,
		-30,
		line(
			`M${x} ${y + 170}L${x} ${y - 200}`,
			'#D9EBBF',
			12,
			` transform="rotate(${turn} ${x} ${y})"`
		)
	);
};
drafts.draft_leafy_greens_b = svg(
	line('M512 960L330 560M512 960L512 520M512 960L700 560', P.stalk.dark, 26) +
		spade([300, 420], -25, { ...P.lettuce, base: P.lettuce.dark, dark: P.lettuce.deep! }) +
		spade([724, 420], 25, { ...P.lettuce, base: P.lettuce.dark, dark: P.lettuce.deep! }) +
		spade([512, 360], 0, P.lettuce) +
		`<rect x="462" y="820" width="100" height="44" rx="14" fill="#C0504D"/>`
);
// C: a cabbage: a round head with two big outer leaves and their veins.
drafts.draft_leafy_greens_c = svg(
	ramp(circle(512, 580, 330), { hi: '#DDEFB8', base: '#B9DB86', dark: '#94BF62' }, -50, -40) +
		ramp(
			'M512 940C300 940 150 800 150 600C150 470 220 380 300 340C260 460 280 620 400 720C450 760 480 840 512 940Z',
			P.lettuce,
			-30,
			-20,
			line(
				'M480 900C380 760 280 620 300 380M400 760L230 640M360 640L200 520',
				P.lettuce.hi,
				12,
				' opacity=".7"'
			)
		) +
		ramp(
			'M512 940C724 940 874 800 874 600C874 470 804 380 724 340C764 460 744 620 624 720C574 760 544 840 512 940Z',
			{ ...P.lettuce, base: P.lettuce.dark, dark: P.lettuce.deep! },
			-30,
			-20,
			line(
				'M544 900C644 760 744 620 724 380M624 760L794 640M664 640L824 520',
				P.lettuce.base,
				12,
				' opacity=".7"'
			)
		)
);

// --- Olives ("the leaf has no connection to the olives"): olives hang from the branch that bears the leaves. ---

const olive = (cx: number, cy: number, r: Ramp) =>
	ramp(
		polar(cx, cy, (a) => [118 * Math.cos(a), 160 * Math.sin(a)], -15, 40),
		r,
		-28,
		-30,
		highlight(cx - 45, cy - 55, 18, 40, 15, r.hi)
	);
const BRANCH = 'M140 300C330 330 560 330 880 250';
// A: a branch with three leaves; two olives hang from it.
drafts.draft_olives_a = svg(
	line(BRANCH, '#7C6A4A', 26) +
		leaf(260, 318, 120, 470, 40, '#8FA36A') +
		leaf(560, 316, 470, 150, 40, '#7C9158') +
		leaf(760, 280, 900, 440, 40, '#8FA36A') +
		line('M380 325L390 470M640 300L650 470', '#7C6A4A', 18) +
		olive(395, 600, P.greenOlive) +
		olive(660, 600, P.blackOlive)
);
// B: the same branch with three olives.
drafts.draft_olives_b = svg(
	line(BRANCH, '#7C6A4A', 26) +
		leaf(240, 318, 110, 470, 40, '#8FA36A') +
		leaf(860, 260, 940, 430, 40, '#7C9158') +
		line('M330 325L340 470M520 322L530 520M700 296L710 470', '#7C6A4A', 18) +
		olive(345, 600, P.greenOlive) +
		olive(705, 600, P.greenOlive) +
		olive(530, 680, P.blackOlive)
);
// C: two olives on short stalks, two leaves from the same twig.
drafts.draft_olives_c = svg(
	line('M512 160L512 360M512 360L400 440M512 360L630 440', '#7C6A4A', 22) +
		leaf(512, 250, 300, 130, 48, '#8FA36A') +
		leaf(512, 250, 724, 120, 48, '#7C9158') +
		olive(400, 600, P.greenOlive) +
		olive(640, 600, P.blackOlive)
);

// --- Onion ("strange shape"): a round bulb with a short pointed top, lines from top to roots. ---

const ONION = polar(
	512,
	610,
	(a) => {
		const k = 1 + 0.32 * near(a, deg(-90), 0.24);
		return [330 * Math.cos(a) * k, 300 * Math.sin(a) * k];
	},
	0,
	96
);
const onion = (r: Ramp) =>
	line('M470 905L455 960M512 910L512 970M554 905L569 960', P.onion.deep!, 14) +
	ramp(
		ONION,
		r,
		-65,
		-50,
		line(
			'M512 230C390 340 330 600 440 905M512 230C634 340 694 600 584 905M512 230C300 360 220 620 310 840M512 230C724 360 804 620 714 840',
			r.deep!,
			12,
			' opacity=".5"'
		) + highlight(320, 560, 36, 90, 20, r.hi)
	) +
	line('M512 240C506 200 520 170 540 150', r.deep!, 24);
// A: a yellow onion.
drafts.draft_onion_a = svg(onion(P.onion));
// B: a red onion.
drafts.draft_onion_b = svg(onion(P.redOnion));
// C: a yellow onion with a cut half in front.
// The cut face of a half onion: concentric rings inside a thin golden rim.
const ringsCut = (cx: number, cy: number, r: number) =>
	`<path fill="${P.onion.base}" d="${circle(cx, cy, r)}"/>` +
	[0.9, 0.74, 0.58, 0.42, 0.26, 0.1]
		.map((k, i) => `<path fill="${i % 2 ? '#F7EBCF' : '#EBD9AE'}" d="${circle(cx, cy, r * k)}"/>`)
		.join('');
drafts.draft_onion_c = svg(place(onion(P.onion), -90, -70, 0.8) + ringsCut(640, 760, 230));

// --- Peanut ("needs more texture"): the shell netted with rows of pits, ridges along it. ---

const peanutShell = (cx: number, cy: number, s: number, turn: number) =>
	polar(
		cx,
		cy,
		(a) => {
			const k = 1 - 0.25 * (near(a, Math.PI / 2, 0.4) + near(a, -Math.PI / 2, 0.4));
			return [390 * s * Math.cos(a), 200 * s * Math.sin(a) * k];
		},
		turn,
		72
	);
const pits = (cx: number, cy: number, s: number, turn: number) =>
	`<g transform="rotate(${turn} ${cx} ${cy})">` +
	Array.from({ length: 7 }, (_, row) =>
		Array.from({ length: 12 }, (_, col) => {
			const x = Math.round(cx - 330 * s + col * 60 * s + (row % 2) * 30 * s);
			const y = Math.round(cy - 150 * s + row * 50 * s);
			return `<ellipse cx="${x}" cy="${y}" rx="${Math.round(17 * s)}" ry="${Math.round(13 * s)}" fill="${P.peanut.deep}" opacity=".45"/>`;
		}).join('')
	).join('') +
	line(
		`M${cx - 360 * s} ${cy - 60 * s}Q${cx} ${cy - 110 * s} ${cx + 360 * s} ${cy - 60 * s}M${cx - 360 * s} ${cy + 60 * s}Q${cx} ${cy + 110 * s} ${cx + 360 * s} ${cy + 60 * s}`,
		P.peanut.dark,
		10 * s,
		' opacity=".5"'
	) +
	'</g>';
const shell = (cx: number, cy: number, s: number, turn: number) =>
	ramp(
		peanutShell(cx, cy, s, turn),
		P.peanut,
		-55 * s,
		-45 * s,
		pits(cx, cy, s, turn) + highlight(cx - 180 * s, cy - 40 * s, 30 * s, 70 * s, 55, P.peanut.hi)
	);
// A shelled peanut: a small oval in its reddish skin, a seam down the middle.
const nut = (cx: number, cy: number, turn: number) =>
	ramp(
		polar(cx, cy, (a) => [120 * Math.cos(a), 85 * Math.sin(a)], turn, 40),
		P.nut,
		-20,
		-18,
		line(
			`M${cx - 100} ${cy}L${cx + 100} ${cy}`,
			P.nut.dark,
			8,
			` opacity=".6" transform="rotate(${turn} ${cx} ${cy})"`
		) + highlight(cx - 40, cy - 30, 14, 26, 60 + turn, P.nut.hi)
	);
drafts.draft_peanut_a = svg(shell(512, 560, 1, -35));
drafts.draft_peanut_b = svg(shell(470, 500, 0.85, -35) + nut(640, 820, -15) + nut(820, 700, 25));
// C: a shell broken open, two nuts in it.
drafts.draft_peanut_c = svg(
	ramp(peanutShell(512, 560, 1, -35), P.peanut, -55, -45, pits(512, 560, 1, -35)) +
		`<path fill="#F2DDB8" d="${peanutShell(522, 548, 0.8, -35)}"/>` +
		nut(400, 640, -35) +
		nut(624, 480, -35)
);

// --- Peas ("can hardly see the peas"): an open pod with big peas sitting high in it. ---

const podBack = (dx: number, dy: number, s: number) =>
	place(
		ramp(
			'M140 560C300 380 720 300 900 400C760 470 520 560 330 640C250 660 170 630 140 560Z',
			P.pod,
			-20,
			-40
		),
		dx,
		dy,
		s
	);
const podFront = (dx: number, dy: number, s: number) =>
	place(
		`<path fill="${P.pod.base}" d="M150 590C320 700 640 640 880 430C870 560 700 760 420 780C280 790 180 700 150 590Z"/>` +
			line('M190 640C330 720 620 690 840 500', P.pod.hi, 16, ' opacity=".7"'),
		dx,
		dy,
		s
	);
const pea = (x: number, y: number, r: number) =>
	ramp(
		circle(x, y, r),
		P.pea,
		-r / 4,
		-r / 5,
		highlight(x - r * 0.38, y - r * 0.3, r * 0.15, r * 0.27, 35, P.pea.hi)
	);
const PEAS: [number, number][] = [
	[300, 560],
	[430, 520],
	[565, 485],
	[700, 450]
];
// A: the open pod, peas showing above its lip.
drafts.draft_peas_a = svg(
	podBack(0, 0, 1) +
		PEAS.map(([x, y]) => pea(x, y, 82)).join('') +
		podFront(0, 0, 1) +
		line('M890 405C940 360 945 320 915 290', P.pod.dark, 22)
);
// B: the pod and three loose peas.
drafts.draft_peas_b = svg(
	place(
		podBack(0, 0, 1) + PEAS.map(([x, y]) => pea(x, y, 82)).join('') + podFront(0, 0, 1),
		0,
		-80,
		0.85
	) +
		pea(330, 850, 80) +
		pea(520, 880, 80) +
		pea(710, 850, 80)
);
// C: a shorter pod, bigger peas.
drafts.draft_peas_c = svg(
	podBack(0, 0, 1) +
		(
			[
				[330, 540],
				[505, 490],
				[680, 445]
			] as [number, number][]
		)
			.map(([x, y]) => pea(x, y, 105))
			.join('') +
		podFront(0, 0, 1)
);

// --- Potato ("needs more texture"): eyes, speckles and soft bumps. ---

const potatoShape = (cx: number, cy: number, s: number, turn: number) =>
	polar(
		cx,
		cy,
		(a) => {
			const k = 1 + 0.04 * Math.sin(3 * a + 1) + 0.02 * Math.sin(2 * a);
			return [390 * s * Math.cos(a) * k, 280 * s * Math.sin(a) * k];
		},
		turn,
		72
	);
const potatoTexture = (cx: number, cy: number, s: number) => {
	const eyes: [number, number, number][] = [
		[0.22, -0.4, -15],
		[0.48, 0.15, 10],
		[-0.15, 0.3, -20],
		[-0.48, 0.05, 30],
		[0.05, -0.05, 0],
		[0.3, 0.55, 40],
		[-0.35, -0.38, -40]
	];
	const specks: [number, number][] = [
		[0.1, -0.25],
		[0.35, -0.1],
		[0.6, -0.2],
		[-0.2, -0.15],
		[-0.4, 0.4],
		[0.15, 0.45],
		[0.55, 0.38],
		[-0.6, -0.15],
		[0.0, 0.2],
		[-0.25, 0.6],
		[0.4, 0.25],
		[-0.05, -0.5]
	];
	const X = (f: number) => Math.round(cx + f * 390 * s);
	const Y = (f: number) => Math.round(cy + f * 280 * s);
	return (
		[
			[-0.2, -0.1, 0.3],
			[0.3, 0.2, 0.25]
		]
			.map(
				([fx, fy, r]) =>
					`<ellipse cx="${X(fx)}" cy="${Y(fy)}" rx="${Math.round(r * 390 * s)}" ry="${Math.round(r * 260 * s)}" fill="${P.potato.hi}" opacity=".2"/>`
			)
			.join('') +
		eyes
			.map(([fx, fy, a]) => {
				const [x, y] = [X(fx), Y(fy)];
				const w = 24 * s;
				return line(
					`M${x - w} ${y}Q${x} ${y + w * 0.75} ${x + w} ${y}`,
					P.potato.dark,
					12 * s,
					` transform="rotate(${a} ${x} ${y})"`
				);
			})
			.join('') +
		specks
			.map(
				([fx, fy]) =>
					`<circle cx="${X(fx)}" cy="${Y(fy)}" r="${Math.round(8 * s)}" fill="${P.potato.dark}" opacity=".55"/>`
			)
			.join('')
	);
};
const potato = (cx: number, cy: number, s: number, turn: number) =>
	ramp(
		potatoShape(cx, cy, s, turn),
		P.potato,
		-70 * s,
		-55 * s,
		potatoTexture(cx, cy, s) +
			highlight(cx - 190 * s, cy - 100 * s, 40 * s, 80 * s, 50, P.potato.hi)
	);
drafts.draft_potato_a = svg(potato(512, 560, 1, -15));
drafts.draft_potato_b = svg(potato(400, 460, 0.75, 20) + potato(580, 660, 0.85, -15));
// C: a whole potato and a cut half showing its pale flesh.
drafts.draft_potato_c = svg(
	potato(430, 480, 0.8, -15) +
		`<path fill="${P.potato.base}" d="${potatoShape(660, 720, 0.62, 10)}"/>` +
		shaded(potatoShape(660, 720, 0.56, 10), '#FBEDB8', '#F1D98E', 15, 15)
);

// --- Seeds ("straight up awful"): a spoonful, a bowl, sunflower seeds. ---

const seedField = (cx: number, cy: number, w: number, h: number, n: number) =>
	Array.from({ length: n }, (_, i) => {
		// Spread evenly over the oval: a sunflower spiral (golden angle).
		const d = Math.sqrt((i + 0.5) / n);
		const x = Math.round(cx + Math.cos(i * 2.39996) * d * (w / 2));
		const y = Math.round(cy + Math.sin(i * 2.39996) * d * (h / 2));
		const tone = [P.grain.deep, '#FFF6E0', P.grain.dark][i % 3];
		return `<ellipse cx="${x}" cy="${y}" rx="17" ry="27" fill="${tone}" transform="rotate(${((i * 47) % 120) - 60} ${x} ${y})"/>`;
	}).join('');
/** The heap under the seeds: lighter than the seeds, so they stand out. */
const HEAP: Ramp = { hi: '#F1E0BC', base: '#E3C995', dark: '#C9A66A' };
// A: a wooden spoon heaped with seeds.
drafts.draft_seeds_a = svg(
	`<g transform="rotate(-30 512 600)">` +
		ramp('M500 620H940C960 620 975 640 975 660C975 680 960 700 940 700H500Z', P.wood, 0, -20) +
		ramp(ellipse(330, 660, 250, 150), P.wood, -30, -30) +
		ramp(
			'M120 640C160 470 260 400 330 400C400 400 500 470 540 640Z',
			HEAP,
			-30,
			-25,
			seedField(330, 540, 360, 200, 40)
		) +
		'</g>'
);
// B: a small bowl of seeds.
drafts.draft_seeds_b = svg(
	ramp(
		'M160 560C200 380 340 300 512 300C684 300 824 380 864 560Z',
		HEAP,
		-40,
		-30,
		seedField(512, 460, 600, 240, 70)
	) +
		ramp('M140 540H884C884 760 720 900 512 900C304 900 140 760 140 540Z', P.bowl, -60, -40) +
		`<ellipse cx="512" cy="540" rx="372" ry="26" fill="${P.bowl.dark}"/>`
);
// C: sunflower seeds: big striped teardrops.
const sunflowerSeed = (cx: number, cy: number, turn: number) => {
	const d = polar(
		cx,
		cy,
		(a) => {
			const k = 1 + 0.3 * near(a, deg(-90), 0.6) - 0.15 * near(a, deg(90), 0.8);
			return [110 * Math.cos(a), 200 * Math.sin(a) * k];
		},
		turn,
		48
	);
	return ramp(
		d,
		{ hi: '#5E5862', base: '#3A363E', dark: '#24212A' },
		-25,
		-25,
		`<g transform="rotate(${turn} ${cx} ${cy})">` +
			line(
				`M${cx - 45} ${cy - 150}Q${cx - 60} ${cy} ${cx - 40} ${cy + 150}M${cx} ${cy - 220}L${cx} ${cy + 165}M${cx + 45} ${cy - 150}Q${cx + 60} ${cy} ${cx + 40} ${cy + 150}`,
				'#E8E4DC',
				18
			) +
			'</g>'
	);
};
drafts.draft_seeds_c = svg(
	sunflowerSeed(330, 560, -25) + sunflowerSeed(700, 560, 25) + sunflowerSeed(512, 640, 0)
);
