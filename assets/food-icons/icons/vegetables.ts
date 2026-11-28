// Vegetables and legumes.
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
	svg,
	type Ramp
} from '../lib.ts';

export const vegetables: Record<string, string> = {};

// --- Pilot (2026-11-27) ---

vegetables.eggplant = svg(
	ramp(
		'M720 250C850 320 860 520 760 660C640 830 440 965 270 905C130 855 140 690 260 600C380 510 480 470 560 330C600 270 650 235 720 250Z',
		P.purple,
		-70,
		-55,
		highlight(330, 760, 38, 90, 55, P.purple.hi)
	) +
		line('M760 245C780 180 820 130 880 100', P.leaf.dark, 44) +
		`<path fill="${P.leaf.base}" d="M585 345C615 255 690 215 760 222C830 230 880 280 900 345C850 318 812 330 790 362C770 312 710 300 670 335C640 360 610 362 585 345Z"/>`
);

vegetables.chili = svg(
	ramp(
		'M330 230C470 230 545 330 590 460C645 615 725 760 885 880C660 940 445 850 350 700C265 565 235 420 240 320C242 270 278 230 330 230Z',
		P.scarlet,
		-45,
		-40,
		line('M360 330C350 450 390 590 470 700', P.scarlet.hi, 30)
	) +
		line('M300 265C280 200 240 150 170 130', P.leaf.dark, 42) +
		`<path fill="${P.leaf.base}" d="M240 330C240 255 300 222 360 240C400 252 420 285 420 320C390 300 360 300 335 320C300 300 265 305 240 330Z"/>`
);

// --- Batch 2 (2026-11-28): each drawn from the real thing's outline (STYLE.md) ---

// Tomato: round, a little flattened, faint lobes; a star of five sepals and a short stalk on top.
const TOMATO = polar(
	512,
	590,
	(a) => {
		const k = 1 + 0.012 * Math.cos(6 * a);
		return [380 * Math.cos(a) * k, 345 * Math.sin(a) * k];
	},
	0,
	72
);
const sepalStar = (cx: number, cy: number, r: number, fill: string) =>
	[200, 250, 295, 340, 25]
		.map((a) => {
			const x = Math.round(cx + Math.cos(deg(a)) * r);
			const y = Math.round(cy + Math.sin(deg(a)) * r * 0.55);
			return leaf(cx, cy, x, y, r * 0.18, fill);
		})
		.join('');
vegetables.tomato = svg(
	ramp(TOMATO, P.tomato, -70, -55, highlight(330, 470, 50, 95, 35, P.tomato.hi)) +
		sepalStar(512, 285, 190, P.leaf.base) +
		line('M512 290C512 240 520 200 545 170', P.leaf.dark, 34)
);

// Olives: a green and a kalamata on a sprig with two narrow leaves.
const OLIVE = (cx: number, cy: number, turn: number) =>
	polar(cx, cy, (a) => [175 * Math.cos(a), 128 * Math.sin(a)], turn, 48);
vegetables.olives = svg(
	line('M300 300C420 330 560 360 700 330', '#7C8A5A', 22) +
		leaf(380, 315, 200, 180, 34, '#8FA36A') +
		leaf(600, 345, 820, 250, 34, '#7C9158') +
		ramp(
			OLIVE(420, 620, -25),
			P.greenOlive,
			-35,
			-30,
			highlight(350, 570, 24, 50, 60, P.greenOlive.hi)
		) +
		ramp(
			OLIVE(650, 560, -25),
			P.blackOlive,
			-35,
			-30,
			highlight(585, 510, 22, 48, 60, P.blackOlive.hi)
		)
);

// Potato: a lumpy oval with eyes.
const POTATO = polar(
	512,
	560,
	(a) => {
		const k = 1 + 0.05 * Math.sin(3 * a + 1) + 0.03 * Math.cos(5 * a);
		return [390 * Math.cos(a) * k, 280 * Math.sin(a) * k];
	},
	-15,
	72
);
const eye = (x: number, y: number, turn: number) =>
	line(
		`M${x - 22} ${y}Q${x} ${y + 16} ${x + 22} ${y}`,
		P.potato.dark,
		12,
		` transform="rotate(${turn} ${x} ${y})"`
	);
vegetables.potato = svg(
	ramp(
		POTATO,
		P.potato,
		-70,
		-55,
		highlight(330, 470, 45, 90, 50, P.potato.hi) +
			eye(600, 430, -15) +
			eye(700, 620, 10) +
			eye(450, 640, -20) +
			eye(320, 560, 30) +
			[
				[540, 540],
				[620, 700],
				[380, 450],
				[760, 500]
			]
				.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${P.potato.dark}" opacity=".6"/>`)
				.join('')
	)
);

// Carrot: a tapering cone with ridges and a leafy top.
const carrot = band(
	(t) => [330 + t * 440, 330 + t * 530],
	(t) => 30 + 220 * (1 - t) ** 0.85,
	24
);
vegetables.carrot = svg(
	leaf(330, 330, 170, 90, 40, P.leaf.dark) +
		leaf(330, 330, 290, 60, 40, P.leaf.base) +
		leaf(330, 330, 90, 200, 40, P.leaf.base) +
		ramp(
			carrot.d,
			P.carrot,
			-45,
			-35,
			[
				[0.25, 90],
				[0.42, 70],
				[0.58, 55],
				[0.72, 40]
			]
				.map(([t, w]) => {
					const [x, y] = [330 + t * 440, 330 + t * 530];
					return line(
						`M${Math.round(x - w)} ${Math.round(y + w * 0.3)}L${Math.round(x - w * 0.3)} ${Math.round(y + w * 0.05)}`,
						P.carrot.dark,
						14
					);
				})
				.join('') + line('M330 360C400 470 480 580 560 690', P.carrot.hi, 22, ' opacity=".6"')
		)
);

// Corn: a cob of kernels in rows, two husk leaves around its base; turned on a diagonal.
const COB = band(
	(t) => [512, 170 + t * 700],
	(t) => Math.max(60, 300 * Math.sin(Math.PI * (0.12 + t * 0.8)) ** 0.5),
	24
);
const KERNELS = Array.from({ length: 11 }, (_, r) =>
	[-90, -30, 30, 90]
		.map((dx) => {
			const y = 230 + r * 58;
			return `<ellipse cx="${512 + dx}" cy="${y}" rx="26" ry="23" fill="${P.corn.hi}" opacity=".75"/>`;
		})
		.join('')
).join('');
vegetables.corn = svg(
	'<g transform="rotate(28 512 512)">' +
		ramp(COB.d, P.corn, -40, -20, KERNELS) +
		`<path fill="${P.husk.dark}" d="M512 930C400 900 330 760 330 560C380 700 440 800 512 860Z"/>` +
		`<path fill="${P.husk.base}" d="M512 930C624 900 694 760 694 520C644 690 584 800 512 860Z"/>` +
		line('M512 930L512 990', P.husk.dark, 40) +
		'</g>'
);

// Bell pepper: blocky, three lobes at the bottom, grooves, a thick green stalk.
const PEPPER =
	'M512 300C620 262 800 292 840 452C880 612 830 822 720 902C670 937 622 902 592 922C552 947 472 947 432 922C402 902 354 937 304 902C194 822 144 612 184 452C224 292 404 262 512 300Z';
vegetables.bell_pepper = svg(
	ramp(
		PEPPER,
		{ hi: '#F27466', base: '#E0352B', dark: '#B0201E' },
		-70,
		-50,
		line(
			'M400 330C370 500 370 760 420 920M624 330C654 500 654 760 604 920',
			'#B0201E',
			18,
			' opacity=".55"'
		) + highlight(300, 520, 40, 100, 15, '#F27466')
	) +
		`<ellipse cx="512" cy="300" rx="115" ry="42" fill="${P.leaf.base}"/>` +
		line('M512 300C510 240 530 190 580 160', P.leaf.dark, 52)
);

// Cucumber: long, almost straight, dark green with light bumps and a small stalk.
const CUCUMBER = band(
	(t) => [190 + t * 640, 760 - t * 470 + Math.sin(Math.PI * t) * 60],
	(t) => Math.max(50, 230 * Math.min(1, Math.sin(Math.PI * t) * 2) ** 0.5),
	24
);
vegetables.cucumber = svg(
	ramp(
		CUCUMBER.d,
		P.cucumber,
		-30,
		-40,
		[
			[330, 620],
			[430, 560],
			[530, 500],
			[630, 440],
			[400, 660],
			[500, 600],
			[600, 540],
			[700, 470]
		]
			.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${P.cucumber.hi}" opacity=".8"/>`)
			.join('')
	) + line('M830 290L880 250', P.cucumber.dark, 30)
);

// Leafy greens (lettuce, spinach, cabbage): two romaine leaves with ruffled edges and pale midribs.
const romaine = (turn: number, fill: Ramp) => {
	const lf = band(
		(t) => [512 + Math.sin(t * 2) * 30, 920 - t * 760],
		(t) => 40 + 330 * Math.sin(Math.PI * t ** 0.75) ** 0.8 * (1 + 0.03 * Math.sin(t * 28)),
		40
	);
	return (
		`<g transform="rotate(${turn} 512 920)">` +
		ramp(lf.d, fill, -40, -30, line('M512 920C520 700 545 420 560 200', '#EAF3D6', 26)) +
		'</g>'
	);
};
vegetables.leafy_greens = svg(
	romaine(18, { ...P.lettuce, base: P.lettuce.dark, dark: P.lettuce.deep! }) +
		romaine(-14, P.lettuce)
);

// Broccoli: a pale stalk branching into a dark-green crown of florets.
const FLORETS: [number, number, number][] = [
	[330, 470, 140],
	[512, 380, 165],
	[700, 470, 140],
	[410, 580, 130],
	[620, 580, 130]
];
vegetables.broccoli = svg(
	ramp(
		'M440 620L470 900C480 935 544 935 554 900L584 620Z',
		P.stalk,
		-30,
		0,
		line('M512 760L420 620M512 760L610 620', P.stalk.dark, 30)
	) +
		FLORETS.map(([x, y, r]) =>
			ramp(
				circle(x, y, r),
				P.broccoli,
				-r / 4,
				-r / 5,
				highlight(x - r * 0.4, y - r * 0.3, r * 0.15, r * 0.25, 35, P.broccoli.hi)
			)
		).join('')
);

// Garlic and onion: a bulb with a pointed neck, lines along it and a tuft of roots.
const bulb = (w: number, d: string, r: Ramp, lines: string, roots: string) =>
	line(roots, r.deep!, 14) +
	ramp(d, r, -70, -55, lines + highlight(512 - w * 0.55, 600, 40, 95, 15, r.hi)) +
	line('M512 220L512 160', r.deep!, 30);
const GARLIC =
	'M512 200C540 260 566 300 610 330C770 420 860 520 850 680C840 840 690 930 512 930C334 930 184 840 174 680C164 520 254 420 414 330C458 300 484 260 512 200Z';
vegetables.garlic = svg(
	bulb(
		340,
		GARLIC,
		P.garlic,
		line(
			'M512 250C420 400 380 650 430 920M512 250C604 400 644 650 594 920M512 250C330 420 260 650 300 860M512 250C694 420 764 650 724 860',
			P.garlic.deep!,
			12,
			' opacity=".7"'
		) + line('M455 380C425 520 425 700 455 860', '#B98AB0', 14, ' opacity=".5"'),
		'M470 930L450 980M512 935L512 990M554 930L574 980'
	)
);
const ONION =
	'M512 230C550 300 600 330 660 360C820 440 880 560 860 700C840 850 700 930 512 930C324 930 184 850 164 700C144 560 204 440 364 360C424 330 474 300 512 230Z';
vegetables.onion = svg(
	bulb(
		360,
		ONION,
		P.onion,
		line(
			'M512 270C410 420 370 650 420 920M512 270C614 420 654 650 604 920M512 270C330 440 250 650 290 860M512 270C694 440 774 650 734 860',
			P.onion.deep!,
			12,
			' opacity=".55"'
		),
		'M470 930L450 985M512 935L512 995M554 930L574 985'
	)
);

// Mushroom: a button mushroom from the side, its domed cap over a short stem.
vegetables.mushroom = svg(
	ramp(
		'M400 600H624L652 880C652 925 600 945 512 945C424 945 372 925 372 880Z',
		P.mushroomStem,
		-40,
		-20
	) +
		`<path fill="${P.mushroomStem.dark}" d="M210 600C260 640 380 660 512 660C644 660 764 640 814 600Z"/>` +
		ramp(
			'M150 560C150 330 320 200 512 200C704 200 874 330 874 560C874 600 840 622 800 622H224C184 622 150 600 150 560Z',
			P.mushroom,
			-70,
			-50,
			highlight(330, 360, 45, 90, 55, P.mushroom.hi) +
				[
					[560, 300],
					[680, 380],
					[450, 430],
					[620, 480]
				]
					.map(
						([x, y]) =>
							`<ellipse cx="${x}" cy="${y}" rx="22" ry="14" fill="${P.mushroom.dark}" opacity=".45"/>`
					)
					.join('')
		)
);

// Ginger: a knobbly root, ringed, with a pale cut end.
const GINGER = [
	ellipse(512, 600, 330, 150),
	ellipse(330, 470, 95, 140),
	ellipse(640, 450, 85, 130),
	ellipse(820, 560, 110, 95)
].join('');
vegetables.ginger = svg(
	ramp(
		GINGER,
		P.ginger,
		-50,
		-45,
		line(
			'M300 400Q330 410 360 400M300 520Q330 530 365 515M610 400Q640 410 670 398M400 600Q420 650 410 700M560 580Q580 640 570 690M720 560Q740 610 730 660',
			P.ginger.deep!,
			12,
			' opacity=".6"'
		) + highlight(420, 540, 30, 70, 70, P.ginger.hi)
	) + `<ellipse cx="895" cy="575" rx="45" ry="70" fill="#F6E3A6"/>`
);

// Peas: an open pod with a row of peas.
const POD = band(
	(t) => [170 + t * 690, 640 - Math.sin(Math.PI * t) * 170 - t * 90],
	(t) => Math.max(30, 260 * Math.sin(Math.PI * t) ** 0.6),
	24
);
vegetables.peas = svg(
	ramp(POD.d, P.pod, 0, -45) +
		`<path fill="${P.pod.dark}" d="M250 600C350 470 650 410 790 470C680 540 420 600 250 600Z"/>` +
		[
			[330, 545],
			[440, 505],
			[555, 475],
			[670, 460]
		]
			.map(([x, y]) =>
				ramp(circle(x, y, 58), P.pea, -14, -12, highlight(x - 22, y - 16, 9, 16, 35, P.pea.hi))
			)
			.join('') +
		line('M860 460C900 420 905 380 880 350', P.pod.dark, 22)
);

// Beans and lentils: four kidney beans.
const KIDNEY = (cx: number, cy: number, turn: number) =>
	polar(
		cx,
		cy,
		(a) => {
			const k = 1 - 0.2 * near(a, Math.PI / 2, 0.45);
			return [165 * Math.cos(a), 100 * Math.sin(a) * k];
		},
		turn,
		48
	);
vegetables.beans = svg(
	[
		[400, 430, -20],
		[650, 470, 25],
		[360, 660, 15],
		[620, 700, -15]
	]
		.map(([x, y, t]) =>
			ramp(
				KIDNEY(x, y, t),
				P.kidneyBean,
				-26,
				-22,
				highlight(x - 60, y - 25, 16, 34, 60 + t, P.kidneyBean.hi)
			)
		)
		.join('')
);

// Peanut: a shell of two lobes with a waist, its surface netted.
const PEANUT = polar(
	512,
	560,
	(a) => {
		const k = 1 - 0.25 * (near(a, Math.PI / 2, 0.4) + near(a, -Math.PI / 2, 0.4));
		return [390 * Math.cos(a), 200 * Math.sin(a) * k];
	},
	-35,
	72
);
const NET = Array.from({ length: 9 }, (_, i) => {
	const o = (i - 4) * 90;
	return `M${152 + o} 260L${872 + o} 860M${872 - o} 260L${152 - o} 860`;
}).join('');
vegetables.peanut = svg(
	ramp(
		PEANUT,
		P.peanut,
		-55,
		-45,
		line(NET, P.peanut.dark, 12, ' opacity=".35"') + highlight(330, 520, 30, 70, 55, P.peanut.hi)
	)
);

// Chestnut: shiny brown, a pointed tip and a pale base.
const CHESTNUT =
	'M512 180C560 260 640 300 720 360C830 440 880 560 860 680C840 800 700 900 512 900C324 900 184 800 164 680C144 560 194 440 304 360C384 300 464 260 512 180Z';
vegetables.chestnut = svg(
	ramp(
		CHESTNUT,
		P.chestnut,
		-60,
		-50,
		`<ellipse cx="512" cy="905" rx="420" ry="135" fill="#DDBE8E"/>` +
			highlight(340, 470, 40, 105, 30, P.chestnut.hi)
	) + line('M512 190L512 150', '#C9A878', 26)
);

// Herbs, spice and seasoning: a sprig with paired leaves.
const HERB_LEAVES: [number, number, number, number][] = [
	[512, 820, 300, 690],
	[512, 820, 724, 690],
	[512, 640, 320, 500],
	[512, 640, 704, 500],
	[512, 460, 350, 320],
	[512, 460, 674, 320],
	[512, 300, 512, 120]
];
vegetables.herbs = svg(
	line('M512 940C505 760 505 500 512 300', P.leaf.dark, 40) +
		HERB_LEAVES.map(([x1, y1, x2, y2], i) =>
			leaf(x1, y1, x2, y2, 100, i % 2 ? P.leaf.base : P.leaf.dark)
		).join('') +
		line(
			'M512 820L360 720M512 820L664 720M512 640L380 540M512 640L644 540M512 460L400 360M512 460L624 360',
			P.leaf.hi,
			8,
			' opacity=".7"'
		)
);

// Seeds and grains (chia, sesame, quinoa, buckwheat): a mound of seeds, a few in front.
const SEED_DOTS = Array.from({ length: 26 }, (_, i) => {
	const row = Math.floor(Math.sqrt(i * 2));
	const x = 512 + ((i * 97) % 520) - 260;
	const y = 600 + ((i * 53) % 260);
	return (
		`<ellipse cx="${x}" cy="${y}" rx="15" ry="24" fill="${i % 3 ? P.grain.deep : P.grain.hi}" transform="rotate(${((i * 37) % 90) - 45} ${x} ${y})"/>` +
		(row ? '' : '')
	);
}).join('');
vegetables.seeds = svg(
	ramp('M140 880C210 650 380 520 512 520C644 520 814 650 884 880Z', P.grain, -50, -40, SEED_DOTS) +
		[
			[300, 930, 20],
			[440, 950, -30],
			[620, 945, 40],
			[740, 925, -10]
		]
			.map(
				([x, y, t]) =>
					`<ellipse cx="${x}" cy="${y}" rx="18" ry="28" fill="${P.grain.dark}" transform="rotate(${t} ${x} ${y})"/>`
			)
			.join('')
);
