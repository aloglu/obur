// Drafts for the owner to see before they replace a drawing (STYLE.md). Names start with draft_.
// Trial of 2026-11-28: shapes taken from reference photos (outline and proportions only), drawn in the house style.
import { P, band, clipped, highlight, leaf, line, ramp, smooth, svg } from '../lib.ts';

export const drafts: Record<string, string> = {};

type Pt = [number, number];

// --- Banana. Reference: "Banana (white background).jpg", Wikimedia Commons. Outline traced from the photo and
// simplified to 16 points; the dark tips are where the photo has them; the stalk is the outline past x = 800. ---

const BANANA_OUTLINE: Pt[] = [
	[938, 566],
	[834, 508],
	[777, 428],
	[681, 370],
	[612, 355],
	[404, 366],
	[282, 408],
	[132, 520],
	[82, 604],
	[90, 735],
	[174, 762],
	[343, 635],
	[558, 554],
	[831, 573],
	[896, 623],
	[927, 623]
];
const BANANA = smooth(BANANA_OUTLINE);
drafts.draft_banana_photo = svg(
	ramp(
		BANANA,
		P.banana,
		-40,
		-50,
		highlight(470, 415, 150, 18, -8, P.banana.hi) +
			clipped(BANANA, '<path fill="#9C8A3E" d="M790 300H1000V700H790Z"/>')
	) +
		`<path fill="#6B5426" d="${smooth([
			[96, 740],
			[112, 708],
			[146, 716],
			[146, 732],
			[116, 742]
		])}"/>` +
		`<path fill="#6B5426" d="${smooth([
			[902, 572],
			[922, 568],
			[940, 590],
			[926, 616],
			[902, 600]
		])}"/>`
);

// --- Onion. Reference: "Onion on White.JPG", Wikimedia Commons. Outline traced from the photo and made upright
// and symmetrical (its width at each height, mirrored), so the neck tapers out of the bulb as in the photo; a dry tip, roots below,
// fine streaks. ---

const ONION_OUTLINE: Pt[] = [
	[548, 175],
	[562, 228],
	[616, 268],
	[717, 305],
	[775, 348],
	[819, 392],
	[855, 436],
	[877, 479],
	[892, 523],
	[901, 567],
	[904, 610],
	[898, 654],
	[888, 698],
	[872, 741],
	[848, 785],
	[805, 829],
	[761, 872],
	[717, 916],
	[650, 960],
	[374, 960],
	[307, 916],
	[263, 872],
	[219, 829],
	[176, 785],
	[152, 741],
	[136, 698],
	[126, 654],
	[120, 610],
	[123, 567],
	[132, 523],
	[147, 479],
	[169, 436],
	[205, 392],
	[249, 348],
	[307, 305],
	[408, 268],
	[462, 228],
	[476, 175]
];
const ONION = smooth(ONION_OUTLINE);
drafts.draft_onion_photo = svg(
	line('M488 960L466 1020M512 965L512 1030M536 960L558 1020', '#C9A878', 14) +
		ramp(
			ONION,
			P.onion,
			-70,
			-55,
			line(
				'M470 330C390 450 380 700 450 900M560 320C650 440 670 700 590 905M380 360C280 470 250 680 330 860',
				P.onion.deep!,
				8,
				' opacity=".3"'
			) + highlight(300, 520, 40, 100, 15, P.onion.hi)
		) +
		`<path fill="${P.onion.deep}" d="${smooth([
			[488, 190],
			[494, 122],
			[512, 92],
			[530, 122],
			[536, 190]
		])}"/>`
);

// --- Carrot. Reference: "Vegetable-Carrot-Bundle-wStalks.jpg", Wikimedia Commons, for proportions: a long
// gradual taper with rounded shoulders and a thin tail, slightly curved; stems rising from the crown into a bushy
// mass of fine leaves. A little stockier than the real thing so it reads at row size. ---

const carrotLine = (t: number): Pt => [400 + t * 420, 380 + t * 520 + Math.sin(Math.PI * t) * 25];
const CARROT = band(
	carrotLine,
	(t) => 12 + 230 * Math.min(1, (t / 0.07) ** 0.6) * (1 - t ** 1.25) ** 0.9,
	32
);
/** A carrot frond: a stem with many narrow leaflets, as carrot leaves are finely divided. */
const frond = (x1: number, y1: number, x2: number, y2: number, fill: string) => {
	const a = Math.atan2(y2 - y1, x2 - x1);
	const len = Math.hypot(x2 - x1, y2 - y1);
	const r = Math.round;
	let leaves = '';
	for (let i = 2; i <= 9; i++) {
		const t = i / 10;
		const x = x1 + (x2 - x1) * t;
		const y = y1 + (y2 - y1) * t;
		const l = len * 0.24 * (1.15 - t * 0.6);
		for (const s of [-1, 1]) {
			const b = a + s * 0.75;
			leaves += leaf(r(x), r(y), r(x + Math.cos(b) * l), r(y + Math.sin(b) * l), l * 0.16, fill);
		}
	}
	return line(`M${x1} ${y1}L${x2} ${y2}`, fill, 14) + leaves;
};
drafts.draft_carrot_photo = svg(
	frond(400, 380, 210, 90, P.leaf.dark) +
		frond(400, 380, 390, 60, P.leaf.base) +
		frond(400, 380, 120, 260, P.leaf.base) +
		ramp(
			CARROT.d,
			P.carrot,
			-40,
			-35,
			line(
				'M330 470L390 450M380 560L420 555M430 640L470 630M500 720L525 712M560 790L580 784',
				P.carrot.dark,
				13,
				' opacity=".7"'
			) + highlight(380, 480, 22, 90, -38, P.carrot.hi)
		)
);
